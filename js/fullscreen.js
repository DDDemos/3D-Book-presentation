// Keep native fullscreen state separate from the book's navigation state.
export function initFullscreen({ button, status, doc = document, onChange = () => {} }) {
  let pending = false, busy = false, disposed = false;
  button.hidden = !(doc.fullscreenEnabled && doc.documentElement.requestFullscreen);
  function sync() {
    const active = !!doc.fullscreenElement;
    const label = active ? "Exit fullscreen" : "Enter fullscreen";
    button.title = label;
    button.setAttribute("aria-label", label);
    button.setAttribute("aria-pressed", String(active));
    button.disabled = busy || pending;
  }
  function changed() { sync(); onChange(); }
  async function toggle() {
    if (busy || pending || button.hidden) return;
    pending = true; status.hidden = true; sync();
    try {
      if (doc.fullscreenElement) await doc.exitFullscreen();
      else await doc.documentElement.requestFullscreen();
    } catch {
      if (!disposed) {
        status.textContent = "Fullscreen could not be changed. You can continue in this view.";
        status.hidden = false;
      }
    } finally { pending = false; if (!disposed) sync(); }
  }
  button.addEventListener("click", toggle);
  doc.addEventListener("fullscreenchange", changed);
  sync();
  return {
    setBusy(value) { busy = value; sync(); },
    dispose() { disposed = true; button.removeEventListener("click", toggle); doc.removeEventListener("fullscreenchange", changed); },
  };
}
