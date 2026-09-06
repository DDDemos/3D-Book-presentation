// Optional WebGL runtime; the application can run without this entire module graph.
import * as THREE from "three";
import { Book3D } from "./book.js?v=4";
import { loadSlideTexture, loadCoverTexture } from "./textures.js?v=4";
import { SlideTextureCache } from "./texture-cache.js?v=4";
import { createRenderLoop } from "./render-loop.js?v=4";

export function createScene(presentation) {
  const container = document.getElementById("canvas-container");
  // Fresh canvas on retries, including after a lost WebGL context.
  const canvas = document.createElement("canvas");
  canvas.id = "book-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.replaceChildren(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
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
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const right = new THREE.Vector3().crossVectors(camera.up, viewDir).normalize();
    const up = new THREE.Vector3().crossVectors(viewDir, right).normalize();
    const depth = presentation.slides.length * 0.0051 + 0.2;
    let distance = 0;
    const fit = (x, y, z) => {
      const point = new THREE.Vector3(x, y, z).sub(initialTarget);
      const forward = point.dot(viewDir);
      distance = Math.max(distance,
        forward + Math.abs(point.dot(right)) / (tangent * camera.aspect),
        forward + Math.abs(point.dot(up)) / tangent);
    };
    // Sample the curved turning envelope; a full bounding cube wastes most of the viewport.
    for (let step = 0; step <= 64; step++) {
      const angle = Math.PI * step / 64;
      for (const y of [-1.08, 1.08]) fit(1.62 * Math.cos(angle), y, 1.62 * Math.sin(angle));
    }
    for (const x of [-1.62, 1.62]) for (const y of [-1.08, 1.08]) fit(x, y, -depth);
    return distance * 1.06;
  }

  /** Repositions the camera along the fixed 3/4 direction to fit the current viewport. */
  function fitCameraDistance() {
    const dist = fittedDistance();
    camera.position.copy(viewDir).multiplyScalar(dist).add(initialTarget);
    camera.lookAt(initialTarget);
  }

  const book = new Book3D(scene);
  let disposed = false;
  const loop = createRenderLoop({
    update: now => book.update(now),
    render: () => renderer.render(scene, camera),
    isAnimating: () => book.isAnimating(),
  });
  const cache = new SlideTextureCache(presentation.slides, loadSlideTexture, presentation.sources);
  const ready = Promise.all([
    ["frontCover", "Front cover", "setFrontCoverTexture"],
    ["backCover", "Back cover", "setBackCoverTexture"],
    ["spine", "Spine", "setSpineTexture"],
  ].map(async ([key, label, setter]) => {
    const texture = await loadCoverTexture(presentation.source(key), label);
    if (disposed) texture.dispose();
    else { book[setter](texture); loop.invalidate(); }
  }));
  function resize() {
    if (disposed) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h, false);
    fitCameraDistance();
    loop.invalidate();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", loop.visibilityChanged);
  resize();
  return {
    book, cache, ready, invalidate: loop.invalidate,
    setActive(value) { loop.setActive(value); if (value) resize(); },
    prepareImage(key, url) {
      return key.startsWith("slide:") ? loadSlideTexture(url, Number(key.split(":")[1])) : loadCoverTexture(url, key);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose(); observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", loop.visibilityChanged);
      book.dispose(); cache.dispose(); key.shadow.dispose(); renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
