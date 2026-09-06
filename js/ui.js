// DOM-only UI: usable even when Three.js or WebGL cannot load.
export function initUI({ presentation, devMode, retry }) {
  const $ = id => document.getElementById(id);
  const prev = $("prev-btn"), next = $("next-btn"), indexButton = $("index-toggle-btn");
  const popup = $("index-popup"), grid = $("index-grid"), tooltip = $("index-tooltip");
  const viewButton = $("view-toggle-btn"), reader = $("reading-view"), canvas = $("canvas-container");
  document.body.append(tooltip);
  let startupLoading = true;
  let editor = null;
  let editButton = null;
  let uploadCount = 0;
  let imageSource;
  let readingIndex;
  let tooltipButton;
  let restoreAfterNavigation;

  function closeIndex(restore = true) {
    if (popup.hidden) return;
    popup.hidden = true;
    hideTooltip();
    indexButton.setAttribute("aria-expanded", "false");
    if (restore) indexButton.focus();
  }
  function openIndex() {
    if (presentation.busy) return;
    closeEditor(false);
    popup.hidden = false;
    indexButton.setAttribute("aria-expanded", "true");
    const current = grid.children[presentation.currentIndex];
    current.focus({ preventScroll: true });
    current.scrollIntoView({ block: "nearest" });
  }
  function hideTooltip() {
    tooltip.hidden = true;
    tooltipButton?.removeAttribute("aria-describedby");
    tooltipButton = null;
  }
  function showTooltip(button, title) {
    hideTooltip();
    tooltip.textContent = title;
    tooltip.hidden = false;
    tooltipButton = button;
    button.setAttribute("aria-describedby", "index-tooltip");
    // A fixed tooltip escapes the scrollable grid and stays inside the viewport.
    const bounds = button.getBoundingClientRect();
    const box = tooltip.getBoundingClientRect();
    tooltip.style.left = `${Math.max(8, Math.min(innerWidth - box.width - 8, bounds.left + bounds.width / 2 - box.width / 2))}px`;
    tooltip.style.top = `${bounds.top >= box.height + 12 ? bounds.top - box.height - 8 : bounds.bottom + 8}px`;
  }
  presentation.entries.forEach((entry, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = entry.number ? "index-page" : "index-page index-cover";
    button.setAttribute("aria-label", entry.number ? `Slide ${entry.number}: ${entry.title}` : entry.title);
    const number = document.createElement("span");
    number.className = "index-number";
    number.textContent = entry.number || entry.title;
    button.append(number);
    if (entry.number) {
      const name = document.createElement("span");
      name.className = "touch-title";
      name.textContent = entry.title;
      button.append(name);
    }
    button.addEventListener("click", () => { closeIndex(); void presentation.goTo(index); });
    button.addEventListener("pointerenter", event => { if (event.pointerType === "mouse") showTooltip(button, entry.title); });
    button.addEventListener("pointerleave", hideTooltip);
    button.addEventListener("focus", () => showTooltip(button, entry.title));
    button.addEventListener("blur", hideTooltip);
    grid.append(button);
  });
  grid.addEventListener("scroll", hideTooltip);
  grid.addEventListener("keydown", event => {
    const buttons = [...grid.children];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    let target = index;
    if (event.key === "Home") target = 0;
    else if (event.key === "End") target = buttons.length - 1;
    else if (event.key === "ArrowLeft") target--;
    else if (event.key === "ArrowRight") target++;
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const rect = buttons[index].getBoundingClientRect();
      const down = event.key === "ArrowDown";
      const candidates = buttons.map((button, i) => ({ i, rect: button.getBoundingClientRect() }))
        .filter(item => down ? item.rect.top > rect.top + 2 : item.rect.top < rect.top - 2);
      candidates.sort((a, b) => Math.abs(a.rect.top - rect.top) - Math.abs(b.rect.top - rect.top)
        || Math.abs((a.rect.left + a.rect.right - rect.left - rect.right) / 2) - Math.abs((b.rect.left + b.rect.right - rect.left - rect.right) / 2));
      target = candidates[0]?.i ?? index;
    } else return;
    event.preventDefault();
    buttons[Math.max(0, Math.min(buttons.length - 1, target))].focus();
  });
  indexButton.addEventListener("click", () => popup.hidden ? openIndex() : closeIndex());
  $("index-close-btn").addEventListener("click", () => closeIndex());
  document.addEventListener("pointerdown", event => {
    if (!popup.hidden && !event.target.closest(".index-anchor")) closeIndex();
  });
  document.addEventListener("focusin", event => {
    if (!popup.hidden && !popup.contains(event.target) && event.target !== indexButton) closeIndex(false);
  });
  window.addEventListener("resize", hideTooltip);
  prev.addEventListener("click", () => void presentation.prev());
  next.addEventListener("click", () => void presentation.next());
  viewButton.addEventListener("click", () => { closeIndex(false); void presentation.setReading(!presentation.reading); });
  $("retry-btn").addEventListener("click", retry);

  function closeEditor(restore = true) {
    if (!editor || editor.hidden) return;
    editor.hidden = true;
    $("app").inert = false;
    editButton.setAttribute("aria-expanded", "false");
    if (restore) editButton.focus();
  }
  window.addEventListener("keydown", event => {
    if (event.key === "Escape") {
      if (!popup.hidden) { event.preventDefault(); closeIndex(); }
      else if (editor && !editor.hidden) { event.preventDefault(); closeEditor(); }
      return;
    }
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;
    if (!popup.hidden || (editor && !editor.hidden)) return;
    if (event.target.closest?.("button, input, select, textarea, a, [contenteditable]:not([contenteditable='false']), [role='button']")) return;
    if (event.key === "ArrowRight" || event.key === " ") { event.preventDefault(); void presentation.next(); }
    else if (event.key === "ArrowLeft") { event.preventDefault(); void presentation.prev(); }
  });

  function updateReading(state) {
    $("reading-title").textContent = state.entry.title;
    $("reading-description").textContent = state.entry.description || "";
    $("reading-description").hidden = !state.entry.description;
    const source = presentation.source(state.entry.key);
    if (source !== imageSource) {
      imageSource = source;
      const image = document.createElement("img");
      image.alt = state.entry.title;
      image.className = "reading-image";
      const fallback = document.createElement("p");
      fallback.className = "image-fallback";
      fallback.textContent = "Image unavailable. You can still read this page’s title and description.";
      fallback.hidden = true;
      image.addEventListener("error", () => { image.hidden = true; fallback.hidden = false; });
      image.src = source || "";
      $("reading-image-container").replaceChildren(image, fallback);
    }
    $("reading-image-container").querySelector("img").alt = state.entry.title;
    if (readingIndex !== state.index) { reader.scrollTop = 0; readingIndex = state.index; }
  }
  function render(state) {
    if (state.busy && [indexButton, prev, next, viewButton].includes(document.activeElement)) restoreAfterNavigation = document.activeElement;
    $("slide-counter").textContent = state.entry.number ? `Slide ${state.entry.number} / ${presentation.slides.length}` : state.entry.title;
    prev.disabled = !state.canPrev;
    next.disabled = !state.canNext;
    indexButton.disabled = state.busy;
    viewButton.disabled = state.busy || !state.has3D;
    viewButton.textContent = state.reading ? "3D view" : "Reading view";
    viewButton.setAttribute("aria-label", state.reading ? "Switch to 3D view" : "Switch to reading view");
    reader.hidden = !state.reading;
    canvas.hidden = state.reading;
    $("stage").setAttribute("aria-busy", String(state.busy));
    $("action-error").hidden = !state.error;
    $("action-error").textContent = state.error;
    for (const [i, button] of [...grid.children].entries()) {
      button.disabled = state.busy;
      if (i === state.index) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (editor) {
      for (const control of editor.querySelectorAll("input, select")) control.disabled = state.busy || startupLoading;
      const select = $("slide-select");
      if (state.entry.number && !select.matches(":focus") && editor.hidden) select.value = String(state.contentIndex);
      $("slide-file-input").disabled ||= presentation.slides.length === 0;
    }
    $("retry-btn").disabled = state.busy || startupLoading || uploadCount > 0;
    updateReading(state);
    if (!state.busy && restoreAfterNavigation) {
      if (document.activeElement === document.body || document.activeElement === restoreAfterNavigation) {
        (restoreAfterNavigation.disabled ? indexButton : restoreAfterNavigation).focus({ preventScroll: true });
      }
      restoreAfterNavigation = null;
    }
  }

  // Editor markup and event handlers do not exist when DEV_MODE is false.
  if (devMode) {
    editButton = document.createElement("button");
    editButton.id = "edit-toggle-btn";
    editButton.type = "button";
    editButton.className = "icon-btn";
    editButton.textContent = "Edit";
    editButton.setAttribute("aria-controls", "editor-panel");
    editButton.setAttribute("aria-expanded", "false");
    editButton.setAttribute("aria-haspopup", "dialog");
    document.querySelector(".app-footer").append(editButton);
    editor = document.createElement("aside");
    editor.id = "editor-panel";
    editor.className = "editor-panel";
    editor.setAttribute("role", "dialog");
    editor.setAttribute("aria-label", "Texture editor");
    editor.setAttribute("aria-modal", "true");
    editor.hidden = true;
    editor.innerHTML = `<div class="editor-header"><h2>Texture editor</h2><button id="editor-close-btn" class="icon-btn" type="button" aria-label="Close editor">✕</button></div>
      <p class="editor-note">Changes last until this tab is reloaded. To keep an image, update the presentation’s assets and configuration.</p>
      <div class="editor-section"><label for="slide-select">Slide</label><select id="slide-select"></select></div>
      <p id="upload-status" role="status"></p>`;
    document.body.append(editor);
    for (const [i, slide] of presentation.slides.entries()) {
      const option = document.createElement("option");
      option.value = String(i); option.textContent = `${i + 1}. ${slide.title}`;
      $("slide-select").append(option);
    }
    for (const [key, label, id] of [["slide", "Replace slide image", "slide-file-input"], ["frontCover", "Replace front cover", "front-cover-file-input"], ["backCover", "Replace back cover", "back-cover-file-input"], ["spine", "Replace spine", "spine-file-input"]]) {
      const section = document.createElement("div"); section.className = "editor-section";
      const fieldLabel = document.createElement("label"); fieldLabel.className = "file-label"; fieldLabel.textContent = label;
      const input = document.createElement("input"); input.type = "file"; input.accept = "image/*"; input.id = id;
      fieldLabel.htmlFor = id; fieldLabel.append(input); section.append(fieldLabel); editor.insertBefore(section, $("upload-status"));
      input.addEventListener("change", async () => {
        const file = input.files?.[0]; input.value = "";
        if (!file) return;
        const assetKey = key === "slide" ? `slide:${$("slide-select").value}` : key;
        const url = URL.createObjectURL(file);
        uploadCount++;
        $("upload-status").textContent = "Opening image…";
        render(presentation.state());
        await presentation.replaceImage(assetKey, url, async () => {
          await decodeImage(url);
          return presentation.runtime?.prepareImage(assetKey, url) || null;
        });
        uploadCount--;
        $("upload-status").textContent = uploadCount ? "Opening image…" : (presentation.error ? "" : "Image preview updated.");
        render(presentation.state());
      });
    }
    editButton.addEventListener("click", () => {
      if (!editor.hidden) { closeEditor(); return; }
      closeIndex(false); editor.hidden = false;
      $("app").inert = true;
      if (presentation.contentIndex >= 0 && presentation.contentIndex < presentation.slides.length) $("slide-select").value = String(presentation.contentIndex);
      editButton.setAttribute("aria-expanded", "true");
      $("editor-close-btn").focus();
    });
    $("editor-close-btn").addEventListener("click", () => closeEditor());
    editor.addEventListener("keydown", event => {
      if (event.key !== "Tab") return;
      const controls = [...editor.querySelectorAll("button:not(:disabled), input:not(:disabled), select:not(:disabled)")];
      const first = controls[0], last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }
  presentation.onChange(render);
  render(presentation.state());
  return {
    setStartupStatus(status) {
      startupLoading = status === "loading";
      $("startup-notice").hidden = status === "ready";
      $("startup-message").textContent = startupLoading ? "Preparing 3D. Reading view is available now." : "3D is unavailable. You can continue in reading view.";
      $("retry-btn").hidden = status !== "failed";
      render(presentation.state());
    },
  };
}

function decodeImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => finish(new Error("Image decode timed out")), 12000);
    function finish(error) {
      clearTimeout(timer); image.onload = image.onerror = null;
      if (error) reject(error); else resolve();
    }
    image.onload = () => finish();
    image.onerror = () => finish(new Error("Invalid image"));
    image.src = url;
  });
}
