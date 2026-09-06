// Texture ownership is independent of Three.js and testable without WebGL.
export class SlideTextureCache {
  constructor(slides, loader, sources = new Map(), windowSize = 4) {
    this.slides = slides;
    this.loader = loader;
    this.sources = sources;
    this.windowSize = windowSize;
    this.center = 0;
    this.cache = new Map();
    this.overrides = new Map();
    this.pending = new Map();
    this.pins = new Map();
    this.disposed = false;
  }
  peek(index) { return this.overrides.get(index) || this.cache.get(index) || null; }
  hold(indices) {
    for (const index of indices) this.pins.set(index, (this.pins.get(index) || 0) + 1);
    return () => {
      for (const index of indices) {
        const count = this.pins.get(index) - 1;
        if (count) this.pins.set(index, count); else this.pins.delete(index);
      }
      this.evictOutside();
    };
  }
  async get(index) {
    if (index < 0 || index >= this.slides.length || this.disposed) return null;
    if (this.peek(index)) return this.peek(index);
    if (this.pending.has(index)) return this.pending.get(index);
    const source = this.sources.get(`slide:${index}`);
    const promise = Promise.resolve().then(() => this.loader(source || this.slides[index].src, index)).then(tex => {
      if (this.disposed) { tex.dispose(); return null; }
      if (this.overrides.has(index)) { tex.dispose(); return this.overrides.get(index); }
      (source ? this.overrides : this.cache).set(index, tex);
      return tex;
    }).finally(() => this.pending.delete(index));
    this.pending.set(index, promise);
    return promise;
  }
  setOverride(index, texture) {
    const old = this.peek(index);
    this.cache.delete(index);
    this.overrides.set(index, texture);
    if (old && old !== texture) old.dispose();
  }
  preloadAround(index) {
    this.center = Math.max(0, Math.min(this.slides.length - 1, index));
    for (let i = Math.max(0, this.center - 2); i <= Math.min(this.slides.length - 1, this.center + 2); i++) {
      this.get(i).then(() => this.evictOutside()).catch(error => console.warn("[preload]", error));
    }
    this.evictOutside();
  }
  evictOutside() {
    for (const [i, texture] of this.cache) {
      if (!this.pins.has(i) && Math.abs(i - this.center) > this.windowSize) { texture.dispose(); this.cache.delete(i); }
    }
  }
  dispose() {
    this.disposed = true;
    for (const tex of new Set([...this.cache.values(), ...this.overrides.values()])) tex.dispose();
    this.cache.clear(); this.overrides.clear();
  }
}
