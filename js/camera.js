import * as THREE from "three";

const ease = t => t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;

/** Automatic cover/page framing; no drag, wheel, or device-orientation controls. */
export function createCameraRig(camera, book, slideCount) {
  const kindFor = index => index < 0 ? "front" : index >= slideCount ? "back" : "content";
  function pose(kind) {
    const bounds = book.getViewBounds(kind);
    const target = bounds.getCenter(new THREE.Vector3());
    const direction = new THREE.Vector3(...(kind === "content" ? [0.018, 0.045, 1] : [0, 0.12, 1])).normalize();
    // Screen-up along the page's width makes the portrait page a landscape surface.
    const up = new THREE.Vector3(...(kind === "content" ? [1, 0, 0] : [0, 1, 0]));
    const matrix = new THREE.Matrix4().lookAt(target.clone().add(direction), target, up);
    return { bounds, target, rotation: new THREE.Quaternion().setFromRotationMatrix(matrix), focus: kind === "front" ? 0 : 1 };
  }
  let kind = "front";
  let current = pose(kind);
  let animation = null;
  let frame = { left: -1, right: 1, bottom: -1, top: 1 };

  function apply(value) {
    const inverse = value.rotation.clone().invert();
    const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let distance = 0;
    // Fit in the current rolled camera basis, including intermediate orientations.
    // Resize changes the fit without changing the animation's clock or progress.
    for (const x of [value.bounds.min.x, value.bounds.max.x]) {
      for (const y of [value.bounds.min.y, value.bounds.max.y]) {
        for (const z of [value.bounds.min.z, value.bounds.max.z]) {
          const point = new THREE.Vector3(x, y, z).sub(value.target).applyQuaternion(inverse);
          distance = Math.max(distance, point.z + Math.abs(point.x) / (tangent * camera.aspect),
            point.z + Math.abs(point.y) / tangent);
        }
      }
    }
    camera.quaternion.copy(value.rotation);
    camera.position.set(0, 0, distance * 1.045).applyQuaternion(value.rotation).add(value.target);
    camera.updateMatrixWorld();
    // Extra space on tall/wide screens must not expose the unused half of
    // the spread. Keep the complete focused board and spine in a small matte.
    const projected = { left: 1, right: -1, bottom: 1, top: -1 };
    for (const x of [value.bounds.min.x, value.bounds.max.x]) for (const y of [value.bounds.min.y, value.bounds.max.y]) {
      for (const z of [value.bounds.min.z, value.bounds.max.z]) {
        const point = new THREE.Vector3(x, y, z).project(camera);
        projected.left = Math.min(projected.left, point.x);
        projected.right = Math.max(projected.right, point.x);
        projected.bottom = Math.min(projected.bottom, point.y);
        projected.top = Math.max(projected.top, point.y);
      }
    }
    frame = {
      left: THREE.MathUtils.lerp(-1, projected.left, value.focus),
      right: THREE.MathUtils.lerp(1, projected.right, value.focus),
      bottom: THREE.MathUtils.lerp(-1, projected.bottom, value.focus),
      top: THREE.MathUtils.lerp(1, projected.top, value.focus),
    };
  }
  function finish() {
    const pending = animation;
    animation = null;
    pending?.resolve();
  }
  function setState(index) {
    finish();
    kind = kindFor(index);
    current = pose(kind);
    apply(current);
  }
  function transitionTo(index, { duration = 900, reducedMotion = false } = {}) {
    const next = kindFor(index);
    if (reducedMotion || duration <= 0) { setState(index); return Promise.resolve(); }
    if (next === kind && !animation) return Promise.resolve();
    finish();
    kind = next;
    return new Promise(resolve => {
      animation = { from: current, to: pose(kind), start: performance.now(), duration, resolve };
    });
  }
  function update(now) {
    if (!animation) return;
    const { from, to, start, duration } = animation;
    const progress = Math.min(1, Math.max(0, (now - start) / duration));
    const t = ease(progress);
    current = {
      target: from.target.clone().lerp(to.target, t),
      rotation: from.rotation.clone().slerp(to.rotation, t),
      bounds: new THREE.Box3(from.bounds.min.clone().lerp(to.bounds.min, t), from.bounds.max.clone().lerp(to.bounds.max, t)),
      focus: THREE.MathUtils.lerp(from.focus, to.focus, t),
    };
    apply(current);
    if (progress === 1) finish();
  }
  return { setState, transitionTo, update, resize: () => apply(current),
    getFrame: () => ({ ...frame }), isAnimating: () => !!animation, dispose: finish };
}
