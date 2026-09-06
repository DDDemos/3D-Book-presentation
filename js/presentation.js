// ============================================================================
// presentation.js
//
// THIS IS THE ONE PLACE YOU EDIT TO CHANGE THE CONTENT OF THE PRESENTATION.
//
// - Add or remove slides by editing the `slides` array below.
// - Change the book's cover / spine artwork by editing `bookConfig`.
//
// Paths are relative (start with "./") so the site works when hosted from a
// GitHub Pages project subdirectory (e.g. https://user.github.io/repo/).
// ============================================================================

export const slides = [
  "./assets/slides/slide-01.png",
  "./assets/slides/slide-02.png",
  "./assets/slides/slide-03.png",
  // Add more slides here, e.g.:
  // "./assets/slides/slide-04.jpg",
  // "./assets/slides/slide-05.jpg",
];

export const bookConfig = {
  frontCover: "./assets/book/cover-front.png",
  backCover: "./assets/book/cover-back.jpg",
  spine: "./assets/book/spine.jpg",
};

export const presentationTitle = "Presentation Title";

// ============================================================================
// Texture loading / caching
//
// Slide images are composited ("contain" fit) onto a fixed-aspect canvas so
// that arbitrary source image sizes always map cleanly onto the page mesh's
// UVs, and so a missing/broken image can fall back to a generated placeholder
// without special-casing the geometry.
// ============================================================================

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
function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
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
    canvas.width = CANVAS_W;
    canvas.height = CANVAS_H;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#3a2a1c"; // in case the source image has transparent areas
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    const scale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
    const w = img.width * scale;
    const h = img.height * scale;
    ctx.drawImage(img, (CANVAS_W - w) / 2, (CANVAS_H - h) / 2, w, h);
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

/**
 * Small LRU-ish texture cache keyed by slide index, with preloading of
 * nearby slides so page turns don't stutter waiting on network/decode.
 */
export class SlideTextureCache {
  constructor(slideUrls, windowSize = 4) {
    this.slideUrls = slideUrls;
    this.windowSize = windowSize;
    this.cache = new Map(); // index -> THREE.Texture
    this.pending = new Map(); // index -> Promise<THREE.Texture>
  }

  /** Resolves to a texture for `index`, using the cache if available. */
  async get(index) {
    if (this.cache.has(index)) return this.cache.get(index);
    if (this.pending.has(index)) return this.pending.get(index);

    const url = this.slideUrls[index];
    const promise = loadSlideTexture(url, index).then((tex) => {
      this.cache.set(index, tex);
      this.pending.delete(index);
      return tex;
    });
    this.pending.set(index, promise);
    return promise;
  }

  /** Kicks off (but does not await) loads for slides near `index`. */
  preloadAround(index) {
    const radius = 2;
    for (let i = Math.max(0, index - radius); i <= Math.min(this.slideUrls.length - 1, index + radius); i++) {
      if (!this.cache.has(i) && !this.pending.has(i)) {
        this.get(i).then(() => this.evictOutside(index));
      }
    }
    this.evictOutside(index);
  }

  evictOutside(centerIndex) {
    const keep = this.windowSize;
    for (const [i, tex] of this.cache) {
      if (Math.abs(i - centerIndex) > keep) {
        tex.dispose();
        this.cache.delete(i);
      }
    }
  }
}

// ============================================================================
// Presentation controller: owns navigation state and drives the Book3D
// instance. Knows nothing about rendering/DOM directly (see ui.js).
//
// The book itself is bookended into the navigation sequence: the closed
// front cover is "slide" 1, the closed back cover is the final slide, and
// the content slides sit in between. `currentIndex` walks that whole
// sequence (0 = cover, 1..N = slides[0..N-1], N+1 = back cover); `contentIndex`
// (= currentIndex - 1) is which content slide that corresponds to, or -1 /
// slideUrls.length while a cover is showing — that's what Book3D expects.
// ============================================================================

export class Presentation {
  /**
   * @param {import('./book.js').Book3D} book
   * @param {string[]} slideUrls
   */
  constructor(book, slideUrls) {
    this.book = book;
    this.slideUrls = slideUrls;
    this.total = slideUrls.length + 2; // + closed front cover + closed back cover
    this.currentIndex = 0; // 0 = cover; 1..N = content; N+1 = back cover
    this.cache = new SlideTextureCache(slideUrls);
    this.listeners = new Set();
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  /** Which content slide (0-based) is showing, or -1 / slideUrls.length on a cover. */
  get contentIndex() {
    return this.currentIndex - 1;
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  _emit() {
    for (const fn of this.listeners) fn(this.state());
  }

  state() {
    return {
      index: this.currentIndex,
      total: this.total,
      contentIndex: this.contentIndex,
      isAnimating: this.book.isAnimating(),
      canNext: this.currentIndex < this.total - 1 && !this.book.isAnimating(),
      canPrev: this.currentIndex > 0 && !this.book.isAnimating(),
    };
  }

  async init() {
    this.book.setSlideCount(this.slideUrls.length);
    await this.cache.get(0); // preload slide 0 so the first "open" transition is instant
    this.book.syncLayout(this.contentIndex); // -1: closed cover
    this.cache.preloadAround(0);
    this._emit();
  }

  /** Replaces a specific content slide's texture at runtime (used by the editor). */
  setSlideTextureOverride(index, texture) {
    const old = this.cache.cache.get(index);
    if (old && old !== texture) old.dispose();
    this.cache.cache.set(index, texture);
    if (index === this.contentIndex) {
      this.book.setRightPageTexture(texture);
    }
  }

  /** Returns a Promise that resolves once the current transition finishes. */
  async next() {
    if (this.book.isAnimating()) return;
    if (this.currentIndex >= this.total - 1) return;

    if (this.currentIndex === 0) {
      // Opening the front cover to reveal slide 0.
      const firstTexture = await this.cache.get(0);
      this._emit();
      return new Promise((resolve) => {
        this.book.flipCover({
          direction: "forward",
          upcomingRightTexture: firstTexture,
          reducedMotion: this.reducedMotion,
          onComplete: () => {
            this.currentIndex = 1;
            this.book.syncLayout(this.contentIndex);
            this.cache.preloadAround(0);
            this._emit();
            resolve();
          },
        });
      });
    }

    // Normal content-to-content flip, or the final content slide flipping
    // forward to reveal the closed back cover (upcomingRightTexture is null
    // in that case, which flip() already treats as "nothing revealed").
    const leafContentIndex = this.contentIndex;
    const frontTexture = await this.cache.get(leafContentIndex);
    const nextContentIndex = leafContentIndex + 1;
    const nextTexture = nextContentIndex < this.slideUrls.length ? await this.cache.get(nextContentIndex) : null;

    this._emit();
    return new Promise((resolve) => {
      this.book.flip({
        direction: "forward",
        frontTexture,
        upcomingRightTexture: nextTexture,
        reducedMotion: this.reducedMotion,
        onComplete: () => {
          this.currentIndex += 1;
          this.book.syncLayout(this.contentIndex);
          if (nextContentIndex < this.slideUrls.length) this.cache.preloadAround(nextContentIndex);
          this._emit();
          resolve();
        },
      });
    });
  }

  /** Returns a Promise that resolves once the current transition finishes. */
  async prev() {
    if (this.book.isAnimating()) return;
    if (this.currentIndex <= 0) return;

    if (this.currentIndex === 1) {
      // Closing the front cover back over slide 0.
      this._emit();
      return new Promise((resolve) => {
        this.book.flipCover({
          direction: "backward",
          reducedMotion: this.reducedMotion,
          onComplete: () => {
            this.currentIndex = 0;
            this.book.syncLayout(this.contentIndex);
            this._emit();
            resolve();
          },
        });
      });
    }

    // Normal content backward flip — also covers re-opening from the closed
    // back cover, since that leaf is just the last content slide.
    const leafContentIndex = this.contentIndex - 1;
    const frontTexture = await this.cache.get(leafContentIndex);

    this._emit();
    return new Promise((resolve) => {
      this.book.flip({
        direction: "backward",
        frontTexture,
        upcomingRightTexture: frontTexture,
        reducedMotion: this.reducedMotion,
        onComplete: () => {
          this.currentIndex -= 1;
          this.book.syncLayout(this.contentIndex);
          this.cache.preloadAround(leafContentIndex);
          this._emit();
          resolve();
        },
      });
    });
  }

  /**
   * Steps forward/backward one page at a time until `index` is reached.
   * Jumping straight to an arbitrary page is intentionally not exposed —
   * this keeps the physical page-flip metaphor honest.
   */
  async goTo(index) {
    index = Math.max(0, Math.min(this.total - 1, index));
    while (this.currentIndex !== index) {
      if (index > this.currentIndex) await this.next();
      else await this.prev();
    }
  }
}
