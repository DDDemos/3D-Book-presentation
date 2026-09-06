// ============================================================================
// main.js — scene bootstrap: renderer, camera, lights, controls, main loop.
// ============================================================================

import * as THREE from "three";
import { Book3D } from "./book.js";
import { Presentation, slides, bookConfig, presentationTitle, loadCoverTexture } from "./presentation.js";
import { initUI } from "./ui.js";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext("webgl2") || canvas.getContext("webgl") || canvas.getContext("experimental-webgl"))
    );
  } catch (e) {
    return false;
  }
}

/**
 * Shows the fatal-error overlay. `detail` (if given) is the real error,
 * shown in a small monospace line so a broken deploy is self-diagnosable
 * instead of always reporting "WebGL isn't available" regardless of cause.
 */
function showFatalError(reason = "webgl", detail = null) {
  document.getElementById("loading-overlay")?.setAttribute("hidden", "");
  const overlay = document.getElementById("webgl-error");
  const title = document.getElementById("webgl-error-title");
  const body = document.getElementById("webgl-error-body");
  const detailEl = document.getElementById("webgl-error-detail");

  if (reason === "webgl") {
    if (title) title.textContent = "3D isn't available in this browser.";
    if (body) {
      body.textContent =
        "This presentation needs WebGL. Please try a recent version of Chrome, Firefox, Edge or Safari, " +
        "or enable hardware acceleration in your browser settings.";
    }
  } else {
    if (title) title.textContent = "Something went wrong while starting the presentation.";
    if (body) body.textContent = "Please reload the page. If this keeps happening, check the browser console for details.";
  }
  if (detailEl) detailEl.textContent = detail ? String(detail) : "";

  overlay?.removeAttribute("hidden");
}

async function boot() {
  if (!hasWebGL()) {
    showFatalError("webgl");
    return;
  }

  let renderer;
  try {
    const canvas = document.getElementById("book-canvas");
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  } catch (e) {
    console.error("[main] Renderer creation failed:", e);
    showFatalError("webgl", (e && (e.stack || e.message)) || `Renderer construction threw: ${e}`);
    return;
  }

  const container = document.getElementById("canvas-container");
  const titleEl = document.getElementById("presentation-title");
  if (titleEl) titleEl.textContent = presentationTitle;
  document.title = presentationTitle;

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe6e1d6);
  scene.fog = new THREE.Fog(0xe6e1d6, 8, 16);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const initialTarget = new THREE.Vector3(0, 0.05, 0);
  // Fixed 3/4 viewing direction; distance is refit to the viewport's aspect
  // ratio (see fitCameraDistance) so the whole open book stays in frame on
  // both wide desktop windows and narrow phone screens.
  const viewDir = new THREE.Vector3(2.8, 1.9, 4.0).normalize();
  const BOOK_HALF_WIDTH = 1.7; // open-book half-width + a touch of margin
  const BOOK_HALF_HEIGHT = 1.15;
  camera.position.copy(viewDir).multiplyScalar(6).add(initialTarget);

  // ---------------------------------------------------------------------
  // Lighting: hemisphere fill + key directional + subtle rim/fill light.
  // ---------------------------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xfff6e8, 0x3a342c, 0.65);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff2df, 1.6);
  key.position.set(3, 4, 2.5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 12;
  key.shadow.camera.left = -3;
  key.shadow.camera.right = 3;
  key.shadow.camera.top = 3;
  key.shadow.camera.bottom = -3;
  key.shadow.bias = -0.0015;
  key.shadow.radius = 3;
  scene.add(key);

  const fill = new THREE.DirectionalLight(0xdce8ff, 0.35);
  fill.position.set(-3, 1.5, -2);
  scene.add(fill);

  const rim = new THREE.PointLight(0xfff2df, 0.4, 12);
  rim.position.set(0, 2.5, -2);
  scene.add(rim);

  // ---------------------------------------------------------------------
  // Camera: fully static. It never responds to drag/scroll input — only
  // its distance is recomputed on resize, to keep the whole book framed at
  // any viewport aspect ratio (see fitCameraDistance).
  // ---------------------------------------------------------------------
  camera.lookAt(initialTarget);

  /** Distance needed for the vertical FOV, at the current aspect, to frame the open book. */
  function fittedDistance() {
    const vFov = (camera.fov * Math.PI) / 180;
    const distForHeight = BOOK_HALF_HEIGHT / Math.tan(vFov / 2);
    const distForWidth = BOOK_HALF_WIDTH / (Math.tan(vFov / 2) * camera.aspect);
    return Math.max(distForHeight, distForWidth) * 1.08;
  }

  /** Repositions the camera along the fixed 3/4 direction to fit the current viewport. */
  function fitCameraDistance() {
    const dist = fittedDistance();
    camera.position.copy(viewDir).multiplyScalar(dist).add(initialTarget);
    camera.lookAt(initialTarget);
  }

  // ---------------------------------------------------------------------
  // Book + presentation
  // ---------------------------------------------------------------------
  const book = new Book3D(scene);
  const presentation = new Presentation(book, slides);

  // Kick off cover/spine texture loads in parallel with the first slide.
  const coverPromise = Promise.all([
    loadCoverTexture(bookConfig.frontCover, "Front Cover").then((t) => book.setFrontCoverTexture(t)),
    loadCoverTexture(bookConfig.backCover, "Back Cover").then((t) => book.setBackCoverTexture(t)),
    loadCoverTexture(bookConfig.spine, "Spine").then((t) => book.setSpineTexture(t)),
  ]);

  await Promise.all([presentation.init(), coverPromise]);

  document.getElementById("loading-overlay")?.setAttribute("hidden", "");
  document.getElementById("app")?.removeAttribute("hidden");

  initUI({ presentation, book, camera, renderer });

  // ---------------------------------------------------------------------
  // Resize
  // ---------------------------------------------------------------------
  function resize() {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (w === 0 || h === 0) return;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    fitCameraDistance();
  }
  window.addEventListener("resize", resize);
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(container);
  }
  resize();

  // ---------------------------------------------------------------------
  // Main loop
  // ---------------------------------------------------------------------
  function animate(nowMs) {
    requestAnimationFrame(animate);
    book.update(nowMs);
    renderer.render(scene, camera);
  }
  requestAnimationFrame(animate);
}

boot().catch((err) => {
  console.error("[main] Fatal error during boot:", err);
  showFatalError("other", err?.stack || err?.message || String(err));
});
