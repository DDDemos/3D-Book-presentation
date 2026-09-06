// ============================================================================
// ui.js — DOM wiring: buttons, keyboard, click-to-navigate, the optional
// texture editor panel, and reduced-motion / disabled-state bookkeeping.
// ============================================================================

import * as THREE from "three";
import { loadSlideTexture, loadCoverTexture } from "./presentation.js";

// Clicking/tapping directly on the book to turn a page is a nice touch, but
// off by default: navigation should only happen via the Next/Previous
// buttons or the arrow keys. Flip to true to re-enable it.
const ENABLE_CLICK_TO_NAVIGATE = false;

export function initUI({ presentation, book, camera, renderer }) {
  const prevBtn = document.getElementById("prev-btn");
  const nextBtn = document.getElementById("next-btn");
  const counterEl = document.getElementById("slide-counter");

  function render(state) {
    counterEl.textContent = `Slide ${state.index + 1} / ${state.total}`;
    prevBtn.disabled = !state.canPrev;
    nextBtn.disabled = !state.canNext;
    prevBtn.setAttribute("aria-disabled", String(!state.canPrev));
    nextBtn.setAttribute("aria-disabled", String(!state.canNext));
  }

  presentation.onChange(render);
  render(presentation.state());

  prevBtn.addEventListener("click", () => presentation.prev());
  nextBtn.addEventListener("click", () => presentation.next());

  // -------------------------------------------------------------------
  // Keyboard navigation.
  // -------------------------------------------------------------------
  window.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
    if (e.key === "ArrowRight" || e.key === " ") {
      e.preventDefault();
      presentation.next();
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      presentation.prev();
    } else if (e.key === "Escape") {
      closeEditor();
    }
  });

  // -------------------------------------------------------------------
  // Click / tap a side of the book to navigate. Disabled by default (see
  // ENABLE_CLICK_TO_NAVIGATE) — navigation is meant to happen only via the
  // buttons/keyboard. A movement threshold distinguishes a tap from a drag.
  // -------------------------------------------------------------------
  if (ENABLE_CLICK_TO_NAVIGATE) {
    const canvas = renderer.domElement;
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let downPos = null;

    const pickTargets = () =>
      [book.rightPage, book.leftPage, book.frontCover, book.backCover].filter((m) => m && m.visible);

    canvas.addEventListener("pointerdown", (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    canvas.addEventListener("pointerup", (e) => {
      if (!downPos) return;
      const dx = e.clientX - downPos.x;
      const dy = e.clientY - downPos.y;
      downPos = null;
      if (Math.hypot(dx, dy) > 6) return; // was a drag, not a tap

      const rect = canvas.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);

      const hits = raycaster.intersectObjects(pickTargets(), false);
      if (hits.length === 0) return;
      const hit = hits[0].object;
      if (hit === book.rightPage || hit === book.backCover) presentation.next();
      else if (hit === book.leftPage || hit === book.frontCover) presentation.prev();
    });
  }

  // -------------------------------------------------------------------
  // Texture editor panel
  // -------------------------------------------------------------------
  const panel = document.getElementById("editor-panel");
  const editBtn = document.getElementById("edit-toggle-btn");
  const closeBtn = document.getElementById("editor-close-btn");
  const slideSelect = document.getElementById("slide-select");
  const slideFileInput = document.getElementById("slide-file-input");
  const frontCoverInput = document.getElementById("front-cover-file-input");
  const backCoverInput = document.getElementById("back-cover-file-input");
  const spineInput = document.getElementById("spine-file-input");

  // The dropdown lists content slides only (covers have their own file
  // inputs below), so it uses slideUrls.length, not the book's full
  // cover-to-cover navigation length (presentation.total).
  for (let i = 0; i < presentation.slideUrls.length; i++) {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = `Slide ${i + 1}`;
    slideSelect.appendChild(opt);
  }
  slideSelect.value = String(Math.max(0, presentation.contentIndex));
  presentation.onChange((state) => {
    // Leave the dropdown's selection alone while a cover is showing —
    // there's no content slide to reflect.
    if (state.contentIndex >= 0 && state.contentIndex < presentation.slideUrls.length) {
      slideSelect.value = String(state.contentIndex);
    }
  });

  function openEditor() {
    panel.hidden = false;
    editBtn.setAttribute("aria-expanded", "true");
  }
  function closeEditor() {
    panel.hidden = true;
    editBtn.setAttribute("aria-expanded", "false");
  }
  editBtn.addEventListener("click", () => (panel.hidden ? openEditor() : closeEditor()));
  closeBtn.addEventListener("click", closeEditor);

  /** Revokes `url` once `promise` settles (success or failure), to free memory. */
  function revokeAfter(promise, url) {
    promise.finally(() => URL.revokeObjectURL(url));
  }

  slideFileInput.addEventListener("change", () => {
    const file = slideFileInput.files?.[0];
    if (!file) return;
    const index = Number(slideSelect.value);
    const url = URL.createObjectURL(file);
    const p = loadSlideTexture(url, index).then((tex) => {
      presentation.setSlideTextureOverride(index, tex);
    });
    revokeAfter(p, url);
    slideFileInput.value = "";
  });

  frontCoverInput.addEventListener("change", () => {
    const file = frontCoverInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const p = loadCoverTexture(url, "Front Cover").then((tex) => book.setFrontCoverTexture(tex));
    revokeAfter(p, url);
    frontCoverInput.value = "";
  });

  backCoverInput.addEventListener("change", () => {
    const file = backCoverInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const p = loadCoverTexture(url, "Back Cover").then((tex) => book.setBackCoverTexture(tex));
    revokeAfter(p, url);
    backCoverInput.value = "";
  });

  spineInput.addEventListener("change", () => {
    const file = spineInput.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const p = loadCoverTexture(url, "Spine").then((tex) => book.setSpineTexture(tex));
    revokeAfter(p, url);
    spineInput.value = "";
  });
}
