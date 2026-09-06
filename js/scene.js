// Optional WebGL runtime; the application can run without this entire module graph.
import * as THREE from "three";
import { Book3D } from "./book.js?v=6";
import { loadImage, loadSlideTexture, loadCoverTexture, makePageBackTexture } from "./textures.js?v=6";
import { SlideTextureCache } from "./texture-cache.js?v=6";
import { createRenderLoop } from "./render-loop.js?v=6";
import { createCameraRig } from "./camera.js?v=6";

export function createScene(presentation) {
  const container = document.getElementById("canvas-container");
  // Fresh canvas on retries, including after a lost WebGL context.
  const canvas = document.createElement("canvas");
  canvas.id = "book-canvas";
  canvas.setAttribute("aria-hidden", "true");
  container.replaceChildren(canvas);
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  // The page owns the backdrop, including its color transition. Transparent
  // clearing also reveals it outside the framing scissor without a canvas seam.
  // No colored fog: it would bake a second backdrop into the book's materials.
  renderer.setClearColor(0x000000, 0);

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

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

  const book = new Book3D(scene);
  book.setSlideCount(presentation.slides.length);
  const cameraRig = createCameraRig(camera, book, presentation.slides.length);
  const hasPanel = (entryIndex = presentation.navigationTarget ?? presentation.currentIndex) => !!presentation.entries[entryIndex]?.resources?.length;
  let cameraPanel = hasPanel();
  const wantsPanel = () => window.matchMedia("(min-width: 961px)").matches && cameraPanel;
  cameraRig.setState(presentation.contentIndex, {panel: wantsPanel()});
  let disposed = false;
  let viewportDirty = true;
  function render() {
    // Changing the drawing-buffer size clears it. Resize and draw in the same
    // frame so a ResizeObserver (e.g. the fading heading) cannot present a blank canvas.
    if (viewportDirty) fitViewport();
    const { left, right, bottom, top } = cameraRig.getFrame();
    const { x: width, y: height } = renderer.getSize(new THREE.Vector2());
    const x = Math.max(0, Math.floor((left + 1) * width / 2) - 3);
    const y = Math.max(0, Math.floor((bottom + 1) * height / 2) - 3);
    const endX = Math.min(width, Math.ceil((right + 1) * width / 2) + 3);
    const endY = Math.min(height, Math.ceil((top + 1) * height / 2) + 3);
    renderer.setScissorTest(false);
    renderer.clear();
    renderer.setScissor(x, y, endX - x, endY - y);
    renderer.setScissorTest(true);
    renderer.render(scene, camera);
  }
  const loop = createRenderLoop({
    update: now => { book.update(now); cameraRig.update(now); },
    render,
    isAnimating: () => book.isAnimating() || cameraRig.isAnimating(),
  });
  // One paper-image decode per runtime. Every cached or uploaded slide uses the same base.
  const paperPromise = (presentation.covers.pageTexture ? loadImage(presentation.covers.pageTexture) : Promise.resolve(null))
    .catch(error => { console.warn("[paper] Using plain paper:", error); return null; });
  const prepareSlide = async (url, index) => loadSlideTexture(url, index, await paperPromise);
  const cache = new SlideTextureCache(presentation.slides, prepareSlide, presentation.sources);
  const paperReady = paperPromise.then(image => {
    if (!disposed) { book.setPaperTexture(makePageBackTexture(image)); loop.invalidate(); }
  });
  const coverReady = Promise.all([
    ["frontCover", "Front cover", "setFrontCoverTexture"],
    ["frontCoverInner", "Inside front cover", "setFrontCoverInnerTexture"],
    ["backCover", "Back cover", "setBackCoverTexture"],
    ["spine", "Spine", "setSpineTexture"],
  ].map(async ([key, label, setter]) => {
    const texture = await loadCoverTexture(presentation.source(key), label);
    if (disposed) texture.dispose();
    else { book[setter](texture); loop.invalidate(); }
  }));
  const ready = Promise.all([paperReady, coverReady]);
  function fitViewport() {
    if (disposed) return;
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    const ratio = Math.min(window.devicePixelRatio, 2);
    if (renderer.getPixelRatio() !== ratio) renderer.setPixelRatio(ratio);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const size = renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) renderer.setSize(w, h, false);
    cameraRig.resize({panel: wantsPanel()});
    viewportDirty = false;
  }
  function resize() {
    if (disposed) return;
    viewportDirty = true;
    loop.invalidate();
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  window.addEventListener("resize", resize);
  document.addEventListener("visibilitychange", loop.visibilityChanged);
  resize();
  return {
    book, cache, camera, cameraRig, ready, invalidate: loop.invalidate,
    setCameraState(index) { cameraPanel = hasPanel(index + 1); cameraRig.setState(index, {panel: wantsPanel()}); loop.invalidate(); },
    transitionCamera(index, options) {
      cameraPanel = hasPanel();
      const completion = cameraRig.transitionTo(index, {...options, panel: wantsPanel()});
      loop.invalidate();
      return completion;
    },
    setActive(value) { loop.setActive(value); if (value) resize(); },
    prepareImage(key, url) {
      return key.startsWith("slide:") ? prepareSlide(url, Number(key.split(":")[1])) : loadCoverTexture(url, key);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      loop.dispose(); cameraRig.dispose(); observer.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", loop.visibilityChanged);
      book.dispose(); cache.dispose(); key.shadow.dispose(); renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
