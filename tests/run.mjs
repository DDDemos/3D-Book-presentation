// Run with Node 22+: node tests/run.mjs. No packages or WebGL required.
import assert from 'node:assert/strict';

// Node 22+ detects ES modules in the build-free browser source.
const root = new URL('../', import.meta.url);
async function module(name) {
  return import(new URL(`js/${name}.js?test=${Date.now()}`, root).href);
}
const { Presentation } = await module('presentation');
const { SlideTextureCache } = await module('texture-cache');
const { createStartup } = await module('startup');
const { createRenderLoop } = await module('render-loop');
const { ResourceTextStore, websiteURL } = await module('resources');
const { initFullscreen } = await module('fullscreen');
const checks = [];
const test = (name, run) => checks.push({ name, run });
const texture = label => ({ label, disposed: 0, dispose() { this.disposed++; } });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const content = n => Array.from({ length: n }, (_, i) => ({ src: `slide-${i}`, title: `Title ${i}` }));
function fixture(n = 3, loader = async (_, i) => texture(i)) {
  const p = new Presentation(content(n));
  const turns = [];
  let active = null;
  const book = {
    setSlideCount(n) { this.count = n; },
    setState(i, t) { this.index = i; this.texture = t; active = null; },
    syncLayout(i) { this.index = i; },
    isAnimating: () => !!active,
    flip(options) { assert.equal(active, null); turns.push({ ...options, kind: 'page' }); active = options; },
    flipCover(options) { assert.equal(active, null); turns.push({ ...options, kind: 'cover' }); active = options; },
    replaceSlideTexture(t) { if (t !== undefined) this.texture = t; },
    setFrontCoverTexture(t) { this.front = t; },
  };
  const cache = new SlideTextureCache(p.slides, loader, p.sources);
  const runtime = { book, cache, ready: Promise.resolve(), invalidate() {}, setActive() {},
    setCameraState(i) { this.cameraIndex = i; },
    transitionCamera(i, options) { this.cameraIndex = i; this.cameraOptions = options; return Promise.resolve(); },
    disposed: 0, dispose() { this.disposed++; cache.dispose(); } };
  p.attachRuntime(runtime, null); p.reading = false;
  const finish = async () => { assert.ok(active, 'a transition should be active'); const done = active.onComplete; active = null; done(); await flush(); };
  const drain = async promise => { for (let i = 0; i < n + 5 && p.busy; i++) { await flush(); if (active) await finish(); } return promise; };
  return { p, cache, runtime, book, turns, finish, drain };
}

test('busy state is published before decoding; repeated requests are ignored', async () => {
  const gate = deferred();
  const { p, turns, finish } = fixture(3, () => gate.promise);
  const seen = []; p.onChange(s => seen.push(s));
  const navigation = p.next();
  assert.equal(p.busy, true); assert.equal(seen[0].canNext, false);
  assert.equal(await p.next(), false); assert.equal(await p.goTo(3), false);
  gate.resolve(texture('first')); await flush();
  assert.equal(turns.length, 1); assert.equal(turns[0].duration, undefined);
  await finish(); await navigation;
  assert.equal(p.currentIndex, 1); assert.equal(p.busy, false);
});
test('resources follow their slide objects through insertion and reordering', () => {
  const a = {src: 'a.png', title: 'A', resources: [{type: 'text', label: 'Prompt A', src: './a.txt'}]};
  const b = {src: 'b.png', title: 'B', resources: [{type: 'url', label: 'Site B', url: 'https://example.com/b'}]};
  const p = new Presentation([b, {src: 'new.png'}, a]);
  assert.equal(p.entries[1].resources[0].url, b.resources[0].url);
  assert.deepEqual(p.entries[2].resources, []);
  assert.equal(p.entries[3].resources[0].src, a.resources[0].src);
});
test('resource visibility locks through reframing, persists across views, and never flips a page', async () => {
  const f = fixture(3);
  f.p.entries[1].resources = [{type: 'text', src: './prompt.txt'}];
  await f.drain(f.p.goTo(1));
  f.p.desktopLayout = () => true;
  const turns = f.turns.length, gate = deferred(), seen = [];
  f.p.onChange(s => seen.push(s));
  f.runtime.transitionCamera = (index, options) => {
    assert.equal(index, 0); assert.equal(options.duration, 240); assert.equal(options.waitForLayout, true);
    return gate.promise;
  };
  const hidden = f.p.setResourcesVisible(false);
  assert.equal(seen[0].busy, true); assert.equal(f.p.resourcesVisible, false);
  assert.equal(f.p.busy, true); assert.equal(f.p.state().resourcesTransitionAnimated, true);
  assert.equal(await f.p.next(), false); assert.equal(await f.p.setResourcesVisible(true), false);
  gate.resolve(); assert.equal(await hidden, true); assert.equal(f.turns.length, turns);
  assert.equal(f.p.busy, false); assert.equal(f.p.state().resourcesTransitioning, false);
  await f.p.setReading(true); await f.p.goTo(2); await f.p.setReading(false);
  assert.equal(f.p.resourcesVisible, false);
  f.p.reducedMotion = () => true;
  await f.p.goTo(1); await f.p.setResourcesVisible(true);
  assert.equal(f.p.resourcesVisible, true); assert.equal(f.turns.length, turns);
  assert.equal(new Presentation().resourcesVisible, true);
});
test('resource toggles recover after camera failure and are immediate in narrow or reading views', async () => {
  const f = fixture(1); f.p.entries[1].resources = [{type: 'url', url: 'https://example.com'}];
  await f.drain(f.p.goTo(1)); f.p.desktopLayout = () => true;
  f.runtime.transitionCamera = () => Promise.reject(new Error('expected reframe failure'));
  const log = console.error; console.error = () => {};
  try { assert.equal(await f.p.setResourcesVisible(false), false); } finally { console.error = log; }
  assert.equal(f.p.resourcesVisible, true); assert.equal(f.p.busy, false);
  f.p.desktopLayout = () => false;
  assert.equal(await f.p.setResourcesVisible(false), true);
  await f.p.setReading(true); f.p.desktopLayout = () => true;
  assert.equal(await f.p.setResourcesVisible(true), true);
  assert.equal(await f.p.setResourcesVisible('false'), false);
});
test('fullscreen uses the document root, follows native exits, and handles failure or unsupported APIs', async () => {
  const listeners = new Map(), events = new Map(), attributes = new Map();
  const button = {hidden: false, addEventListener(k, fn) { listeners.set(k, fn); }, removeEventListener(k) { listeners.delete(k); }, setAttribute(k,v) { attributes.set(k,v); }};
  const status = {hidden: true}; let fail = false, requested = 0, changes = 0;
  const doc = {fullscreenEnabled: true, fullscreenElement: null,
    documentElement: {async requestFullscreen() { requested++; if (fail) throw Error('denied'); doc.fullscreenElement = this; events.get('fullscreenchange')(); }},
    async exitFullscreen() { doc.fullscreenElement = null; events.get('fullscreenchange')(); },
    addEventListener(k,fn) { events.set(k,fn); }, removeEventListener(k) { events.delete(k); }};
  const ui = initFullscreen({button,status,doc,onChange: () => changes++});
  await listeners.get('click')(); assert.equal(requested, 1); assert.equal(doc.fullscreenElement, doc.documentElement);
  assert.equal(attributes.get('aria-label'), 'Exit fullscreen');
  doc.fullscreenElement = null; events.get('fullscreenchange')();
  assert.equal(attributes.get('aria-label'), 'Enter fullscreen'); assert.equal(changes, 2);
  ui.setBusy(true); await listeners.get('click')(); assert.equal(requested, 1);
  ui.setBusy(false); fail = true; await listeners.get('click')();
  assert.equal(status.hidden, false); assert.ok(status.textContent.includes('could not')); assert.equal(button.disabled, false);
  ui.dispose(); assert.equal(events.size, 0); assert.equal(listeners.size, 0);
  doc.fullscreenEnabled = false;
  const unsupported = initFullscreen({button,status,doc}); assert.equal(button.hidden, true); unsupported.dispose();
});
test('index jumps expose only one final resource destination until navigation settles', async () => {
  const f = fixture(3), seen = []; f.p.onChange(state => seen.push(state));
  const navigation = f.p.goTo(3);
  assert.equal(seen[0].navigationTarget, 3);
  assert.equal(await f.p.goTo(1), false);
  await f.drain(navigation);
  assert.ok(seen.filter(state => state.busy).every(state => state.navigationTarget === 3));
  assert.equal(seen.at(-1).navigationTarget, null);
});
test('text files retain long exact content, deduplicate loads, and cache only success', async () => {
  const text = '  Heading — café\r\n\tIndented code\n\n' + 'word '.repeat(1000) + '\n\n  ';
  let calls = 0;
  const store = new ResourceTextStore({baseURL: 'https://example.com/book/', fetchText: async url => {
    calls++; assert.equal(url, 'https://example.com/book/assets/prompt.txt');
    return {ok: true, text: async () => text};
  }});
  const resource = {type: 'text', src: './assets/prompt.txt'};
  const values = await Promise.all([store.load(resource), store.load(resource)]);
  assert.deepEqual(values, [text, text]); assert.equal(calls, 1);
  assert.equal(await store.load(resource), text); assert.equal(calls, 1);
  store.dispose();
});
test('failed and timed-out text loads can retry; disposal aborts pending requests', async () => {
  let fail = true;
  const resource = {type: 'text', src: './prompt.txt'};
  const store = new ResourceTextStore({baseURL: 'https://example.com/', timeout: 5,
    fetchText: async () => fail ? {ok: false, status: 404} : {ok: true, text: async () => 'ready'}});
  await assert.rejects(store.load(resource), /404/);
  fail = false; assert.equal(await store.load(resource), 'ready'); store.dispose();
  const stalled = new ResourceTextStore({baseURL: 'https://example.com/', timeout: 5, fetchText: () => new Promise(() => {})});
  await assert.rejects(stalled.load(resource), /timed out/);
  stalled.fetchText = async () => ({ok: true, text: async () => 'retried'});
  assert.equal(await stalled.load(resource), 'retried'); stalled.dispose();
  const closing = new ResourceTextStore({baseURL: 'https://example.com/', fetchText: () => new Promise(() => {})});
  const pending = closing.load(resource); closing.dispose();
  await assert.rejects(pending, /closed/); assert.equal(closing.cache.size, 0);
});
test('only explicit HTTP and HTTPS websites can be opened', () => {
  assert.equal(websiteURL('https://example.com'), 'https://example.com/');
  assert.equal(websiteURL('http://example.com/path?q=1'), 'http://example.com/path?q=1');
  for (const input of ['javascript:alert(1)', 'data:text/html,test', '/relative', 'not a URL']) assert.equal(websiteURL(input), null);
});
test('index jumps cover-to-cover and back with correct leaves and durations', async () => {
  const f = fixture(3); await f.drain(f.p.goTo(4));
  assert.equal(f.p.currentIndex, 4); assert.equal(f.turns.length, 4);
  assert.equal(f.turns[0].kind, 'cover'); assert.ok(f.turns.every(t => t.duration === 180));
  assert.deepEqual(f.turns.slice(1).map(t => t.frontTexture.label), [0, 1, 2]);
  await f.drain(f.p.goTo(0)); assert.equal(f.p.currentIndex, 0);
  assert.equal(f.turns.at(-1).kind, 'cover'); assert.equal(f.p.busy, false);
  assert.equal(await f.p.goTo(0), false); assert.equal(await f.p.goTo(NaN), false);
});
test('long index jumps cap nominal duration at two seconds', async () => {
  const f = fixture(20); await f.drain(f.p.goTo(21));
  assert.equal(f.turns.length, 21);
  assert.ok(Math.abs(f.turns.reduce((sum, t) => sum + t.duration, 0) - 2000) < .001);
});
test('reading navigation and reduced-motion jumps restore direct positions', async () => {
  const f = fixture(3); await f.p.setReading(true); await f.p.goTo(3);
  assert.equal(f.turns.length, 0); await f.p.setReading(false);
  assert.equal(f.book.index, 2); assert.equal(f.book.texture.label, 2);
  assert.equal(f.runtime.cameraIndex, 2);
  f.p.reducedMotion = () => true; await f.p.goTo(0);
  assert.equal(f.book.index, -1); assert.equal(f.turns.length, 0);
  assert.equal(f.runtime.cameraIndex, -1);
  const normal = f.p.next(); await flush(); assert.equal(f.turns[0].reducedMotion, true);
  assert.equal(f.runtime.cameraOptions.reducedMotion, true);
  await f.finish(); await normal;
});
test('empty and single-slide presentations never request invalid image indices', async () => {
  for (const n of [0, 1]) {
    const f = fixture(n, async (_, i) => { assert.ok(i >= 0 && i < n); return texture(i); });
    await f.drain(f.p.goTo(n + 1)); await f.drain(f.p.goTo(0));
    assert.equal(f.p.currentIndex, 0); assert.equal(f.p.busy, false);
  }
});
test('failed texture load releases lock and keeps the committed index', async () => {
  const f = fixture(1); await flush(); f.cache.cache.clear();
  f.cache.loader = async () => { throw new Error('expected test failure'); };
  const original = console.error; console.error = () => {};
  try { assert.equal(await f.p.next(), false); } finally { console.error = original; }
  assert.equal(f.p.currentIndex, 0); assert.equal(f.p.busy, false); assert.ok(f.p.error);
  assert.equal(f.runtime.cameraIndex, -1); assert.equal(f.p.state().displayIndex, 0);
});
test('camera and book finish together before unlocking; heading follows the destination', async () => {
  const f = fixture(1); const camera = deferred();
  f.runtime.transitionCamera = (i, options) => {
    assert.equal(i, 0); assert.equal(options.duration, 900); return camera.promise;
  };
  const navigation = f.p.next(); await flush();
  assert.equal(f.p.currentIndex, 0); assert.equal(f.p.state().displayIndex, 1);
  await f.finish();
  assert.equal(f.p.busy, true); assert.equal(await f.p.next(), false);
  camera.resolve(); await navigation;
  assert.equal(f.p.currentIndex, 1); assert.equal(f.p.busy, false);
});
test('failed camera transition restores the committed book and camera', async () => {
  const f = fixture(1);
  f.runtime.transitionCamera = () => Promise.reject(new Error('expected camera failure'));
  const original = console.error; console.error = () => {};
  try { assert.equal(await f.p.next(), false); } finally { console.error = original; }
  assert.equal(f.p.busy, false); assert.equal(f.book.index, -1);
  assert.equal(f.runtime.cameraIndex, -1); assert.equal(f.p.state().displayIndex, 0);
});
test('overrides outlive eviction and beat a pending original load', async () => {
  const gate = deferred(); const cache = new SlideTextureCache(content(10), () => gate.promise);
  const pending = cache.get(0); await flush();
  const override = texture('upload'), original = texture('original');
  cache.setOverride(0, override); gate.resolve(original);
  assert.equal(await pending, override); assert.equal(original.disposed, 1);
  cache.center = 8; cache.evictOutside(); assert.equal(await cache.get(0), override); assert.equal(override.disposed, 0);
  const replacement = texture('replacement'); cache.setOverride(0, replacement); assert.equal(override.disposed, 1);
});
test('late preload completion evicts around the latest position', async () => {
  const gate = deferred();
  const cache = new SlideTextureCache(content(12), async (_, i) => i === 0 ? gate.promise : texture(i));
  cache.preloadAround(0); await flush(); cache.preloadAround(8); await flush();
  const current = cache.peek(8); gate.resolve(texture('late')); await flush();
  assert.equal(cache.center, 8); assert.equal(cache.peek(8), current); assert.equal(current.disposed, 0); assert.equal(cache.peek(0), null);
});
test('latest upload wins even when an earlier decode resolves last', async () => {
  const f = fixture(3); const old = deferred(), newer = deferred();
  const one = f.p.replaceImage('slide:0', 'blob:old-test', () => old.promise);
  const two = f.p.replaceImage('slide:0', 'blob:new-test', () => newer.promise);
  const fresh = texture('fresh'); newer.resolve(fresh); assert.equal(await two, true);
  const stale = texture('stale'); old.resolve(stale); assert.equal(await one, false);
  assert.equal(stale.disposed, 1); assert.equal(f.cache.peek(0), fresh); assert.equal(f.p.source('slide:0'), 'blob:new-test');
});
test('upload completion waits for navigation before disposing a displayed texture', async () => {
  const f = fixture(3); const gate = deferred();
  const upload = f.p.replaceImage('slide:0', 'blob:wait-test', () => gate.promise);
  const navigation = f.p.next(); await flush(); gate.resolve(texture('edited')); await flush();
  assert.equal(f.p.sources.has('slide:0'), false);
  await f.finish(); await navigation; await upload;
  assert.equal(f.book.texture.label, 'edited'); assert.equal(f.p.busy, false);
});
test('render loop stops idle, pauses hidden, resumes and cleans up', () => {
  let callbacks = new Map(), id = 0, hidden = false, animating = false, renders = 0;
  const loop = createRenderLoop({ update() {}, render() { renders++; }, isAnimating: () => animating,
    request: fn => { callbacks.set(++id, fn); return id; }, cancel: id => callbacks.delete(id), hidden: () => hidden });
  const tick = () => { const [id, fn] = callbacks.entries().next().value; callbacks.delete(id); fn(100); };
  loop.setActive(true); loop.invalidate(); assert.equal(callbacks.size, 1); tick(); assert.equal(callbacks.size, 0);
  animating = true; loop.invalidate(); tick(); assert.equal(callbacks.size, 1);
  hidden = true; loop.visibilityChanged(); assert.equal(callbacks.size, 0);
  hidden = false; animating = false; loop.visibilityChanged(); tick(); assert.equal(callbacks.size, 0); assert.equal(renders, 3);
  loop.invalidate(); loop.dispose(); assert.equal(callbacks.size, 0);
});
test('startup failure exposes fallback; retry attaches the current reading position', async () => {
  const p = new Presentation(content(3)); const statuses = []; let fail = true;
  const f = fixture(3);
  const startup = createStartup({ presentation: p, onStatus: s => statuses.push(s), loadRuntime: async () => {
    if (fail) throw new Error('expected import failure'); return () => f.runtime;
  }});
  const original = console.warn; console.warn = () => {};
  try { await startup.start(); } finally { console.warn = original; }
  assert.deepEqual(statuses, ['loading', 'failed']); assert.equal(p.reading, true);
  await p.goTo(3); fail = false; await startup.start();
  assert.equal(p.runtime, f.runtime); assert.equal(p.reading, false); assert.equal(f.book.index, 2); assert.equal(statuses.at(-1), 'ready');
  startup.dispose();
});
test('timed-out imports cannot create or attach a stale runtime after retry', async () => {
  const p = new Presentation(content(1)); const old = deferred(); const f = fixture(1);
  let calls = 0, created = 0; const statuses = [];
  const startup = createStartup({ presentation: p, timeout: 5, onStatus: s => statuses.push(s),
    loadRuntime: () => ++calls === 1 ? old.promise : Promise.resolve(() => f.runtime) });
  const original = console.warn; console.warn = () => {};
  try { void startup.start(); await new Promise(resolve => setTimeout(resolve, 15)); } finally { console.warn = original; }
  assert.equal(statuses.at(-1), 'failed'); await startup.start();
  old.resolve(() => { created++; return fixture(1).runtime; }); await flush();
  assert.equal(created, 0); assert.equal(p.runtime, f.runtime); assert.equal(statuses.at(-1), 'ready'); startup.dispose();
});

test('pinned destination survives eviction until a direct navigation commits', async () => {
  const cache = new SlideTextureCache(content(12), async (_, i) => texture(i));
  const release = cache.hold([0, 10]);
  const destination = await cache.get(10);
  cache.evictOutside(); assert.equal(destination.disposed, 0);
  cache.center = 10; release(); assert.equal(destination.disposed, 0);
  cache.center = 0; cache.evictOutside(); assert.equal(destination.disposed, 1);
});
test('timed-out texture startup disposes resources and never attaches after completion', async () => {
  const p = new Presentation(content(1)); const gate = deferred(); const f = fixture(1);
  f.runtime.ready = gate.promise; const statuses = [];
  const startup = createStartup({ presentation: p, timeout: 5, onStatus: s => statuses.push(s), loadRuntime: async () => () => f.runtime });
  const original = console.warn; console.warn = () => {};
  try { void startup.start(); await new Promise(resolve => setTimeout(resolve, 15)); } finally { console.warn = original; }
  assert.equal(statuses.at(-1), 'failed'); assert.ok(f.runtime.disposed); assert.equal(p.runtime, null);
  gate.resolve(); await flush(); assert.equal(p.runtime, null); assert.equal(statuses.at(-1), 'failed'); startup.dispose();
});

export async function runTests(log = console.log) {
  for (const { name, run } of checks) { await run(); log(`PASS ${name}`); }
  log(`${checks.length} checks passed.`);
  return checks.length;
}
await runTests();
