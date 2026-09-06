// Three.js texture creation. Loaded only by the optional 3D runtime.
import * as THREE from "three";
import { SLIDE_ARTWORK_MARGIN } from "./display-config.js?v=7";

const PAGE_ASPECT = 0.75; // width / height of a single page, must match book.js
const CANVAS_W = 1024;
const CANVAS_H = Math.round(CANVAS_W / PAGE_ASPECT);

const PLACEHOLDER_PALETTES = [
  ["#8a5a34", "#5f3c22"],
  ["#3c5a68", "#26404b"],
  ["#5a6b3c", "#3d4a28"],
  ["#6b3c56", "#472639"],
  ["#3c4a6b", "#28324a"],
];

function paletteFor(index) {
  return PLACEHOLDER_PALETTES[index % PLACEHOLDER_PALETTES.length];
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/**
 * Draws a tasteful placeholder slide (used when an image is missing/broken,
 * and as the initial appearance before a real image finishes loading).
 */
function drawPlaceholder(ctx, { label, sublabel, index }) {
  const [c1, c2] = paletteFor(index);
  const grad = ctx.createLinearGradient(0, 0, CANVAS_W, CANVAS_H);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.strokeStyle = "rgba(255,255,255,0.25)";
  ctx.lineWidth = 6;
  roundedRect(ctx, 24, 24, CANVAS_W - 48, CANVAS_H - 48, 18);
  ctx.stroke();

  ctx.fillStyle = "rgba(255,255,255,0.92)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "600 64px Georgia, 'Times New Roman', serif";
  ctx.fillText(label, CANVAS_W / 2, CANVAS_H / 2 - 20);

  if (sublabel) {
    ctx.font = "400 30px Georgia, 'Times New Roman', serif";
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillText(sublabel, CANVAS_W / 2, CANVAS_H / 2 + 46);
  }
}

/** Paint the default paper before compositing any slide artwork. */
function drawPaper(ctx, paperImage) {
  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  if (paperImage) ctx.drawImage(paperImage, 0, 0, CANVAS_W, CANVAS_H);
}

/** Contain the artwork inside a paper margin; preserve its transparent areas. */
function compositeImage(img, index, paperImage) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  drawPaper(ctx, paperImage);
  // Camera screen-up is world +X. Rotate artwork clockwise in canvas space
  // so its top points along +X on the mesh and reads upright in that view.
  ctx.save();
  ctx.translate(CANVAS_W / 2, CANVAS_H / 2);
  ctx.rotate(Math.PI / 2);
  if (img) {
    const available = 1 - 2 * SLIDE_ARTWORK_MARGIN;
    const scale = Math.min(CANVAS_H * available / img.width, CANVAS_W * available / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    ctx.fillStyle = "#6b6357";
    ctx.textAlign = "center";
    ctx.font = "36px Georgia, serif";
    ctx.fillText(`Slide ${index + 1}`, 0, -12);
    ctx.font = "24px Georgia, serif";
    ctx.fillText("Image unavailable", 0, 32);
  }
  ctx.restore();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function placeholderTexture(index, label, sublabel) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");
  drawPlaceholder(ctx, { label, sublabel, index });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Loads an image URL, resolving with an HTMLImageElement or rejecting. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const timer = setTimeout(() => finish(new Error(`Image load timed out: ${url}`)), 12000);
    function finish(error) {
      clearTimeout(timer);
      img.onload = img.onerror = null;
      if (error) reject(error);
      else resolve(img);
    }
    img.onload = () => finish();
    img.onerror = () => finish(new Error(`Failed to load image: ${url}`));
    img.crossOrigin = "anonymous";
    img.src = url;
  });
}

/**
 * Loads a slide texture, falling back to a generated placeholder on error.
 * Never rejects.
 */
export async function loadSlideTexture(url, index, paperImage = null) {
  try {
    const img = await loadImage(url);
    return compositeImage(img, index, paperImage);
  } catch (err) {
    console.warn(`[presentation] ${err.message} — using placeholder.`);
    return compositeImage(null, index, paperImage);
  }
}

/** Loads a cover/spine texture, falling back to a tasteful solid material. */
export async function loadCoverTexture(url, label) {
  try {
    const img = await loadImage(url);
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, 2048 / Math.max(img.width, img.height));
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3a2a1c"; // in case the source image has transparent areas
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Keep the complete cover and spine artwork, including border ornaments and lettering.
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.needsUpdate = true;
    return tex;
  } catch (err) {
    console.warn(`[presentation] ${err.message} — using fallback cover material.`);
    return placeholderTexture(0, label, "(no image set)");
  }
}

/** The same paper background used beneath slides, shared by page backs and stacks. */
export function makePageBackTexture(paperImage = null) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  drawPaper(ctx, paperImage);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
