// Content and navigation deliberately have no Three.js dependency.
import { normalizeResources } from "./resources.js?v=6";
export const DEV_MODE = false;
export const presentationTitle = "Intro to Vibe Coding";
export const slides = [
  { src: "./assets/slides/slide-01.png", title: "AI-assisted coding", description: "A code editor with angle brackets and an AI chip, illustrating AI-assisted software development.",
    resources: [
      { type: "text", label: "Example prompt", src: "./assets/text/example-prompt.txt" },
      { type: "url", label: "Example website", url: "https://example.com" },
    ],
  },
  { src: "./assets/slides/slide-02.png", title: "Human and AI collaboration", description: "A person and a robot beneath overlapping speech bubbles, illustrating a conversation between people and AI." },
  { src: "./assets/slides/slide-03.png", title: "Sharing and iteration", description: "Two illustrated documents connected by arrows, representing exchanging content and iterating on ideas." },
];
export const bookConfig = {
  frontCover: "./assets/book/cover-front.png?v=2",
  frontCoverInner: "./assets/book/cover-front-inner.png",
  backCover: "./assets/book/cover-back.png",
  spine: "./assets/book/spine.png",
  pageTexture: "./assets/book/PageTexture.png",
};

export class Presentation {
  constructor(content = slides, covers = bookConfig) {
    this.slides = content.map((slide, i) => ({ ...slide, title: slide.title?.trim() || `Slide ${i + 1}`, resources: normalizeResources(slide.resources) }));
    this.entries = [
      { key: "frontCover", title: "Front cover", src: covers.frontCover },
      ...this.slides.map((slide, i) => ({ ...slide, key: `slide:${i}`, number: i + 1 })),
      { key: "backCover", title: "Back cover", src: covers.backCover },
    ];
    this.covers = covers;
    this.total = this.entries.length;
    this.currentIndex = 0;
    this.transitionIndex = null;
    this.navigationTarget = null;
    this.busy = false;
    this.reading = true;
    this.runtime = null;
    this.listeners = new Set();
    this.sources = new Map(); // Uploaded blob URLs retained for the current tab.
    this.uploadVersions = new Map();
    this.error = "";
    this.disposed = false;
    this.reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }
  get contentIndex() { return this.currentIndex - 1; }
  onChange(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  _emit() { for (const fn of this.listeners) fn(this.state()); }
  source(key) {
    return this.sources.get(key) || this.entries.find(entry => entry.key === key)?.src || this.covers[key];
  }
  state() {
    return {
      index: this.currentIndex, contentIndex: this.contentIndex, total: this.total,
      entry: this.entries[this.currentIndex], busy: this.busy,
      displayIndex: this.transitionIndex ?? this.currentIndex,
      navigationTarget: this.navigationTarget,
      isAnimating: !!(this.runtime?.book.isAnimating() || this.runtime?.cameraRig?.isAnimating()), reading: this.reading,
      canPrev: !this.busy && this.currentIndex > 0,
      canNext: !this.busy && this.currentIndex < this.total - 1,
      has3D: !!this.runtime, error: this.error,
    };
  }
  // Bootstrap prepares the current texture before attaching a runtime.
  attachRuntime(runtime, texture) {
    this.runtime = runtime;
    runtime.book.setSlideCount(this.slides.length);
    runtime.book.setState(this.contentIndex, texture);
    runtime.setCameraState(this.contentIndex);
    runtime.cache.preloadAround(this.contentIndex);
    this._emit();
  }
  async _run(action, navigationTarget = null) {
    if (this.busy || this.disposed) return false;
    this.busy = true;
    this.navigationTarget = navigationTarget;
    this.error = "";
    this._emit();
    try { await action(); return true; }
    catch (error) {
      console.error("[presentation]", error);
      this.error = "That change could not be completed. Please try again.";
      if (this.runtime) {
        this.runtime.book.setState(this.contentIndex, this.runtime.cache.peek(this.contentIndex));
        this.runtime.setCameraState(this.contentIndex);
        this.runtime.invalidate();
      }
      return false;
    } finally { this.transitionIndex = null; this.navigationTarget = null; this.busy = false; this._emit(); }
  }
  next() { return this._navigate(this.currentIndex + 1, false); }
  prev() { return this._navigate(this.currentIndex - 1, false); }
  goTo(index) { return this._navigate(index, true); }
  _navigate(index, jump) {
    if (!Number.isInteger(index)) return Promise.resolve(false);
    const target = Math.max(0, Math.min(this.total - 1, index));
    if (target === this.currentIndex) return Promise.resolve(false);
    return this._run(async () => {
      if (this.reading || !this.runtime) { this.currentIndex = target; return; }
      if ((jump && this.reducedMotion()) || this.slides.length === 0) {
        const release = this.runtime.cache.hold([this.contentIndex, target - 1]);
        try {
          const texture = await this.runtime.cache.get(target - 1);
          this.runtime.book.setState(target - 1, texture);
          this.runtime.setCameraState(target - 1);
          this.currentIndex = target;
          this.runtime.cache.preloadAround(this.contentIndex);
          this.runtime.invalidate();
        } finally { release(); }
        return;
      }
      const duration = jump ? Math.min(180, 2000 / Math.abs(target - this.currentIndex)) : undefined;
      while (this.currentIndex !== target) await this._step(target > this.currentIndex ? 1 : -1, duration);
    }, target);
  }
  async _step(direction, duration) {
    const { book, cache, invalidate } = this.runtime;
    const next = this.currentIndex + direction;
    const covering = this.currentIndex === 0 || next === 0;
    const leaf = direction > 0 ? this.contentIndex : this.contentIndex - 1;
    const frontTexture = covering ? null : await cache.get(leaf);
    const upcomingRightTexture = await cache.get(next - 1);
    const reducedMotion = this.reducedMotion();
    this.transitionIndex = next;
    this._emit();
    const cameraMotion = this.runtime.transitionCamera(next - 1, { duration: duration ?? 900, reducedMotion });
    const bookMotion = new Promise(resolve => {
      const options = {
        direction: direction > 0 ? "forward" : "backward",
        frontTexture, upcomingRightTexture, duration,
        reducedMotion, onComplete: resolve,
      };
      if (covering) book.flipCover(options);
      else book.flip(options);
      invalidate();
    });
    await Promise.all([bookMotion, cameraMotion]);
    this.currentIndex = next;
    this.transitionIndex = null;
    book.syncLayout(this.contentIndex);
    cache.preloadAround(this.contentIndex);
    this._emit();
    invalidate();
  }
  setReading(reading) {
    return this._run(async () => {
      if (!reading && !this.runtime) throw new Error("3D is unavailable");
      if (!reading) {
        const release = this.runtime.cache.hold([this.contentIndex]);
        try {
          const texture = await this.runtime.cache.get(this.contentIndex);
          this.runtime.book.setState(this.contentIndex, texture);
          this.runtime.setCameraState(this.contentIndex);
          this.runtime.cache.preloadAround(this.contentIndex);
        } finally { release(); }
      }
      this.reading = reading;
      this.runtime?.setActive(!reading);
    });
  }
  // Decode/prepare is injected: reading-only editing never imports Three.js.
  async replaceImage(key, url, prepare) {
    if (this.busy || this.disposed) { URL.revokeObjectURL(url); return false; }
    const version = (this.uploadVersions.get(key) || 0) + 1;
    this.uploadVersions.set(key, version);
    let texture;
    const stale = () => this.disposed || this.uploadVersions.get(key) !== version;
    try {
      texture = await prepare();
      if (stale()) { texture?.dispose(); URL.revokeObjectURL(url); return false; }
      // Navigation can begin during decoding. Commit after the animation settles.
      if (this.busy) await new Promise(resolve => {
        const off = this.onChange(state => { if (!state.busy) { off(); resolve(); } });
      });
      if (stale()) { texture?.dispose(); URL.revokeObjectURL(url); return false; }
      const oldURL = this.sources.get(key);
      this.sources.set(key, url);
      if (this.runtime && texture) {
        if (key.startsWith("slide:")) {
          const index = Number(key.split(":")[1]);
          this.runtime.book.replaceSlideTexture(index === this.contentIndex ? texture : undefined);
          this.runtime.cache.setOverride(index, texture);
        } else {
          const setters = { frontCover: "setFrontCoverTexture", backCover: "setBackCoverTexture", spine: "setSpineTexture" };
          this.runtime.book[setters[key]](texture);
        }
        this.runtime.invalidate();
      }
      if (oldURL) URL.revokeObjectURL(oldURL);
      this.error = "";
      this._emit();
      return true;
    } catch (error) {
      texture?.dispose(); URL.revokeObjectURL(url);
      if (!stale()) { this.error = "This image could not be opened. Please choose another image."; this._emit(); }
      return false;
    }
  }
  dispose() {
    this.disposed = true;
    for (const url of this.sources.values()) URL.revokeObjectURL(url);
    this.sources.clear();
    this.listeners.clear();
    this.runtime?.dispose();
  }
}
