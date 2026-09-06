// Content and navigation deliberately have no Three.js dependency.
import { normalizeResources } from "./resources.js?v=6";
export const DEV_MODE = false;
export const presentationTitle = "Intro to Vibe Coding";
export const slides = [
  // One book page per PDF page, including the repeated quote at positions 1 and 13.
  {
    src: "./assets/slides/NewSlides/slide-01-why-build-this-application.png",
    title: "Why build this application?",
    description: "Chip Huyen's AI Engineering asks why you want to build an application before deciding how to build it. The book cover appears beside the quote.",
  },
  {
    src: "./assets/slides/NewSlides/slide-02-google-stitch-prompt.png",
    title: "Prompt Engineering: Google Stitch prompt",
    description: "A Google Stitch prompt for Birmingham Music Stories, combining archival music imagery, gig posters, and industrial heritage with genre stories, a sound map, and an album timeline.",
  },
  {
    src: "./assets/slides/NewSlides/slide-03-demos-and-slides.png",
    title: "Demos & Slides",
    description: "The workshop's demos and slides are available at https://github.com/DDDemos, shown with a preview of the GitHub profile.",
  },
  {
    src: "./assets/slides/NewSlides/slide-04-table-of-contents.png",
    title: "Table of Contents",
    description: "Workshop outline: design and refine a website with Google Stitch, use GitHub for version control and publishing, then work with AI agents, documentation, and skills.",
  },
  {
    src: "./assets/slides/NewSlides/slide-05-prompt-engineering-structure.png",
    title: "Prompt Engineering: Structure of a prompt",
    description: "Structure a prompt around its goal, context and constraints, required content, and success criteria, including behavior, interactions, and tests.",
  },
  {
    src: "./assets/slides/NewSlides/slide-06-birmingham-music-stories.png",
    title: "Birmingham Music Stories",
    description: "An interactive exhibition of Birmingham's musical heritage built with HTML, CSS, and vanilla JavaScript. Its brief includes artist stories, genre filters, a sound map, and a musical timeline.",
  },
  {
    src: "./assets/slides/NewSlides/slide-07-traditional-app-development.png",
    title: "Idea, Frontend, Backend, App",
    description: "A diagram traces traditional application development from an idea through frontend and backend development to a working app.",
  },
  {
    src: "./assets/slides/NewSlides/slide-08-website-builder-workflow.png",
    title: "Idea, Website Builder, App",
    description: "A diagram shows an idea becoming an application through a visual website builder.",
  },
  {
    src: "./assets/slides/NewSlides/slide-09-ai-agent-app-development.png",
    title: "Idea, Prompts, AI Agent, App",
    description: "A diagram shows an idea expressed through prompts, developed by an AI agent, and turned into an application.",
  },
  {
    src: "./assets/slides/NewSlides/slide-10-agentic-workflow.png",
    title: "Agentic Workflow",
    description: "An overview connects app builders, development environments, and coding agents with version control and project context.",
  },
  {
    src: "./assets/slides/NewSlides/slide-11-tools.png",
    title: "Tools",
    description: "The workshop toolset: Google Stitch, Google AI Studio, Git and GitHub, VS Code, and Claude Code.",
  },
  {
    src: "./assets/slides/NewSlides/slide-12-google-stitch-result.png",
    title: "Google Stitch Result",
    description: "A screenshot of Google Stitch showing desktop and mobile designs for the Birmingham Music Stories website.",
  },
  {
    src: "./assets/slides/NewSlides/slide-13-why-build-this-application.png",
    title: "Why build this application?",
    description: "The workshop returns to Chip Huyen's question about why you want to build an application, beside the cover of AI Engineering.",
  },
  {
    src: "./assets/slides/NewSlides/slide-14-google-ai-studio-prompt.png",
    title: "Google AI Studio: Prompt",
    description: "A prompt asks Google AI Studio to implement Birmingham Music Stories from the attached design using only HTML, CSS, and JavaScript, with genre selection, map stories, and expandable featured stories.",
  },
  {
    src: "./assets/slides/NewSlides/slide-15-sending-to-github.png",
    title: "Sending it to GitHub",
    description: "A diagram and repository screenshot show moving a website from Google AI Studio into GitHub.",
  },
  {
    src: "./assets/slides/NewSlides/slide-16-github-desktop.png",
    title: "GitHub Desktop",
    description: "The GitHub Desktop logo appears beside the Birmingham Music History Demo repository on GitHub.",
  },
  {
    src: "./assets/slides/NewSlides/slide-17-clone-it-locally.png",
    title: "Clone it locally",
    description: "Copy a GitHub repository onto a local machine using the Clone a Repository dialog in GitHub Desktop.",
  },
  {
    src: "./assets/slides/NewSlides/slide-18-ide-and-ai-agent.png",
    title: "IDE + AI Agent",
    description: "VS Code and Codex are shown beside a development workspace, pairing a code editor with an AI coding agent.",
  },
  {
    src: "./assets/slides/NewSlides/slide-19-google-ai-studio-result.png",
    title: "Google AI Studio Result",
    description: "A Google AI Studio screenshot shows the implemented Birmingham Music Stories website, with music-history content and a timeline.",
  },
  {
    src: "./assets/slides/NewSlides/slide-20-running-the-website-locally.png",
    title: "Running the website locally",
    description: "Serve the website locally with the Python command: python3 -m http.server 8000 --bind 0.0.0.0.",
  },
  {
    src: "./assets/slides/NewSlides/slide-21-publishing-with-github-pages.png",
    title: "Publishing the website online: GitHub Pages",
    description: "The GitHub Pages repository settings show how to publish the static website online.",
  },
  {
    src: "./assets/slides/NewSlides/slide-22-ai-agent-include-photos.png",
    title: "AI agent: Include photos",
    description: "A Codex prompt asks an agent to replace intended photo placeholders with suitable reusable images, preserve the website design, and keep placeholders when no suitable photograph is found.",
  },
  {
    src: "./assets/slides/NewSlides/slide-23-ai-agent-add-about-me.png",
    title: "AI agent: Add About Me",
    description: "A Codex prompt asks for an About Me page for Diego Minaya, XR Developer, including a photograph, biography, and navigation consistent with the existing website.",
  },
  {
    src: "./assets/slides/NewSlides/slide-24-skills.png",
    title: "Skills",
    description: "Skills are presented as reusable prompts, with https://www.skills.sh/ and screenshots of a frontend-design skill and development workspace.",
  },
  {
    src: "./assets/slides/NewSlides/slide-25-documentation.png",
    title: "Documentation",
    description: "Documentation provides persistent context, prevents repeated prompting, and creates a shared project memory.",
  },
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
