// Schedule frames only when visible work exists. Clock/scheduler injection supports tests.
export function createRenderLoop({ update, render, isAnimating, request = requestAnimationFrame, cancel = cancelAnimationFrame, hidden = () => document.hidden }) {
  let frame = null;
  let active = false;
  let disposed = false;
  function invalidate() {
    if (!disposed && active && !hidden() && frame === null) frame = request(tick);
  }
  function tick(now) {
    frame = null;
    if (disposed || !active || hidden()) return;
    update(now);
    render();
    if (isAnimating()) invalidate();
  }
  function pause() { if (frame !== null) cancel(frame); frame = null; }
  return {
    invalidate,
    setActive(value) { active = value; if (value) invalidate(); else pause(); },
    visibilityChanged() { if (hidden()) pause(); else invalidate(); },
    dispose() { disposed = true; pause(); },
  };
}
