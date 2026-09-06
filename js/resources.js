// Plain-text resources deliberately have no Three.js dependency.
export function normalizeResources(resources) {
  return (Array.isArray(resources) ? resources : [])
    .filter(item => item && (item.type === "text" || item.type === "url"))
    .map(item => ({ ...item, label: item.label?.trim() || (item.type === "url" ? "Website" : "Prompt") }));
}

export function websiteURL(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

export class ResourceTextStore {
  constructor({ fetchText = (...args) => fetch(...args), baseURL = document.baseURI, timeout = 10000 } = {}) {
    this.fetchText = fetchText; this.baseURL = baseURL; this.timeout = timeout;
    this.cache = new Map(); this.pending = new Map(); this.disposed = false;
  }
  load(resource) {
    if (this.disposed) return Promise.reject(new Error("Resource reader is closed"));
    if (resource.type === "url") return Promise.resolve(String(resource.url ?? ""));
    if (!resource.src) return Promise.reject(new Error("No text file is configured"));
    let url;
    try { url = new URL(resource.src, this.baseURL).href; }
    catch { return Promise.reject(new Error("The text file path is invalid")); }
    if (this.cache.has(url)) return Promise.resolve(this.cache.get(url));
    if (this.pending.has(url)) return this.pending.get(url).promise;
    const controller = new AbortController();
    const aborted = new Promise((_, reject) => controller.signal.addEventListener("abort",
      () => reject(controller.signal.reason), { once: true }));
    const timer = setTimeout(() => controller.abort(new Error("Text loading timed out")), this.timeout);
    const request = Promise.resolve().then(() => this.fetchText(url, { signal: controller.signal }))
      .then(response => {
        if (!response.ok) throw new Error(`Text file returned HTTP ${response.status}`);
        return response.text();
      });
    const promise = Promise.race([request, aborted]).then(text => {
      if (!this.disposed) this.cache.set(url, text);
      return text; // Preserve the complete file, including indentation and trailing whitespace.
    }).finally(() => { clearTimeout(timer); this.pending.delete(url); });
    this.pending.set(url, { promise, controller });
    return promise;
  }
  dispose() {
    this.disposed = true;
    for (const {controller} of this.pending.values()) controller.abort(new Error("Resource reader is closed"));
    this.pending.clear(); this.cache.clear();
  }
}
