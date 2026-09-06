import { ResourceTextStore, websiteURL } from "./resources.js?v=6";

/** A single panel follows the committed slide in both reading and 3D views. */
export function initResourcePanel({ presentation, store = new ResourceTextStore(),
  writeClipboard = text => navigator.clipboard.writeText(text) }) {
  const $ = id => document.getElementById(id);
  const stage = $("stage"), slot = $("resource-slot"), panel = $("resource-panel");
  const preview = $("resource-preview"), text = $("resource-text");
  const expand = $("resource-expand"), copy = $("resource-copy"), open = $("resource-open");
  const status = $("resource-status"), retry = $("resource-retry"), manual = $("resource-manual");
  const linkCopy = $("resource-link-copy"), linkStatus = $("resource-link-status");
  let shownIndex = null, textResource = null, linkResource = null, value = null;
  let epoch = 0, disposed = false, navigating = false, busy = false, copying = false, expanded = false;

  function overflow() {
    if (preview.hidden) return;
    const limit = parseFloat(getComputedStyle(text).lineHeight) * 8;
    const long = text.scrollHeight > limit + 1;
    preview.classList.toggle("is-overflowing", long);
    expand.hidden = !long;
  }
  function controls() {
    const href = linkResource ? websiteURL(linkResource.url) : null;
    copy.disabled = busy || copying || value === null;
    linkCopy.disabled = busy || copying || !linkResource;
    expand.disabled = busy;
    retry.disabled = busy;
    open.hidden = !href;
    open.setAttribute("aria-disabled", String(busy));
    if (href && !busy) open.href = href;
    else open.removeAttribute("href");
    open.tabIndex = busy ? -1 : 0;
  }
  function setExpanded(next) {
    expanded = next;
    preview.classList.toggle("is-expanded", next);
    expand.textContent = next ? "Collapse" : "Show full text";
    expand.setAttribute("aria-expanded", String(next));
    if (!next) text.scrollTop = 0;
  }
  async function loadText() {
    const token = ++epoch;
    value = null; copying = false;
    setExpanded(false);
    manual.hidden = true; $("resource-manual-text").value = "";
    text.textContent = ""; preview.hidden = true; expand.hidden = true;
    retry.hidden = true; status.textContent = "Loading text…";
    controls();
    try {
      const complete = await store.load(textResource);
      if (disposed || token !== epoch) return;
      value = complete; text.textContent = complete;
      preview.hidden = false;
      status.textContent = "";
      controls(); overflow();
    } catch {
      if (disposed || token !== epoch) return;
      status.textContent = "This text could not be loaded. Try again.";
      retry.hidden = false; controls();
    }
  }
  function render(state) {
    busy = state.busy;
    const destination = state.navigationTarget ?? state.index;
    const entry = presentation.entries[destination];
    const hasResources = !!entry.resources?.length;
    const moving = state.navigationTarget !== null;
    stage.classList.toggle("has-resources", hasResources);
    // Keep the outgoing panel mounted while its column closes; never expose
    // intermediate slides' resource contents during a multi-page index jump.
    slot.hidden = !hasResources && !moving;
    panel.classList.toggle("is-navigating", moving);
    panel.inert = moving || !hasResources;
    if (moving) {
      if (!navigating) {
        stage.scrollTop = 0;
        epoch++; copying = false; status.textContent = ""; linkStatus.textContent = "";
        const prompt = entry.resources?.find(item => item.type === "text");
        if (prompt) void store.load(prompt).catch(() => {});
      }
      navigating = true;
      controls();
      return;
    }
    if (navigating || shownIndex !== state.index) {
      navigating = false; shownIndex = state.index; epoch++;
      const resources = state.entry.resources || [];
      textResource = resources.find(item => item.type === "text");
      linkResource = resources.find(item => item.type === "url");
      value = null; copying = false; manual.hidden = true;
      $("resource-manual-text").value = "";
      $("resource-link-section").hidden = !linkResource;
      $("resource-text-section").hidden = !textResource;
      panel.classList.toggle("has-both-resources", !!textResource && !!linkResource);
      if (hasResources) {
        $("resource-heading").textContent = `Slide ${state.entry.number} · ${state.entry.title}`;
        if (linkResource) {
          $("resource-link-label").textContent = linkResource.label;
          $("resource-link-value").textContent = String(linkResource.url ?? "");
          linkStatus.textContent = websiteURL(linkResource.url) ? "" : "This address cannot be opened as a website. You can still copy it.";
        }
        if (textResource) {
          $("resource-label").textContent = textResource.label;
          void loadText();
        } else { text.textContent = ""; status.textContent = ""; }
      }
    }
    controls();
  }
  expand.addEventListener("click", () => {
    setExpanded(!expanded);
    if (expanded) text.focus({ preventScroll: true });
  });
  retry.addEventListener("click", () => { void loadText(); });
  open.addEventListener("click", event => { if (busy) event.preventDefault(); });
  async function copyResource(kind) {
    const complete = kind === "url" ? (linkResource ? String(linkResource.url ?? "") : null) : value;
    if (busy || copying || complete === null) return;
    const token = epoch, feedback = kind === "url" ? linkStatus : status;
    copying = true; feedback.textContent = "Copying…"; controls();
    try {
      await writeClipboard(complete);
      if (disposed || token !== epoch) return;
      manual.hidden = true;
      feedback.textContent = "Copied";
    } catch {
      if (disposed || token !== epoch) return;
      feedback.textContent = "Clipboard access is unavailable. Copy the selected full text below using your device’s copy command.";
      manual.hidden = false;
      const field = $("resource-manual-text"); field.value = complete;
      field.focus({ preventScroll: true }); field.select();
      field.scrollIntoView({ block: "nearest" });
    } finally {
      if (!disposed && token === epoch) { copying = false; controls(); }
    }
  }
  copy.addEventListener("click", () => { void copyResource("text"); });
  linkCopy.addEventListener("click", () => { void copyResource("url"); });
  const observer = new ResizeObserver(overflow);
  observer.observe(text);
  const unsubscribe = presentation.onChange(render);
  render(presentation.state());
  return { dispose() { disposed = true; epoch++; unsubscribe(); observer.disconnect(); store.dispose(); } };
}
