// Three.js texture creation. Loaded only by the optional 3D runtime.
import * as THREE from "three";

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

/** Builds a "contain fit" canvas texture from a loaded HTMLImageElement. */
function compositeImage(img, index) {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f4f1ea";
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  const scale = Math.min(CANVAS_W / img.width, CANVAS_H / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  const x = (CANVAS_W - w) / 2;
  const y = (CANVAS_H - h) / 2;
  ctx.drawImage(img, x, y, w, h);

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
export async function loadSlideTexture(url, index) {
  try {
    const img = await loadImage(url);
    return compositeImage(img, index);
  } catch (err) {
    console.warn(`[presentation] ${err.message} — using placeholder.`);
    return placeholderTexture(index, `Slide ${index + 1}`, "(image not found)");
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

/** A neutral, horizontally-symmetric "paper back" texture shared by all pages. */
export function makePageBackTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = Math.round(512 / PAGE_ASPECT);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#f6f2e9";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const grad = ctx.createRadialGradient(
    canvas.width / 2, canvas.height / 2, canvas.height * 0.1,
    canvas.width / 2, canvas.height / 2, canvas.height * 0.7
  );
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.06)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(0,0,0,0.08)";
  ctx.lineWidth = 2;
  roundedRect(ctx, canvas.width * 0.28, canvas.height * 0.42, canvas.width * 0.44, canvas.height * 0.16, 8);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}
