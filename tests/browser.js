// Browser-only integration checks; no test packages or production hooks required.
const root = new URL('../', location.href);
const shell = await (await fetch(new URL('index.html', root))).text();
const results = document.getElementById('checks');
let frame;
let passed = 0;
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const wait = async (condition, message = 'Condition timed out') => {
  const deadline = performance.now() + 20000;
  while (!condition()) {
    if (frame?.contentWindow.fixtureError) throw new Error(frame.contentWindow.fixtureError);
    if (performance.now() > deadline) throw new Error(message);
    await new Promise(resolve => setTimeout(resolve, 25));
  }
};
async function fixture({ dev = false, count = 3, fail = false, timeout = false, width = 960, height = 650 } = {}) {
  if (frame) { frame.contentWindow.fixture?.startup.dispose(); frame.contentWindow.fixture?.p.dispose(); frame.remove(); }
  frame = document.createElement('iframe'); frame.title = 'Presentation test fixture';
  frame.style.width = `${width}px`; frame.style.height = `${height}px`;
  const script = `
    import { Presentation, slides } from './js/presentation.js?v=4';
    import { initUI } from './js/ui.js?v=4';
    import { createStartup } from './js/startup.js?v=4';
    window.addEventListener('error', event => window.fixtureError = event.message);
    window.addEventListener('unhandledrejection', event => window.fixtureError = String(event.reason));
    const p = new Presentation(Array.from({length: ${count}}, (_, i) => ({...slides[i % slides.length], title: slides[i % slides.length].title + (${count} > 3 ? ' ' + (i + 1) : '')})));
    let startup;
    const ui = initUI({presentation: p, devMode: ${dev}, retry: () => startup.start()});
    let failed = ${fail};
    startup = createStartup({presentation: p, timeout: ${timeout ? 30 : 15000}, onStatus: ui.setStartupStatus,
      loadRuntime: async () => {
        ${timeout ? 'return new Promise(() => {});' : ''}
        if (failed) throw new Error('Simulated CDN failure');
        try {
          const {createScene} = await import('${root.href}js/scene.js?v=4');
          return () => { try { return createScene(p); } catch (error) { window.fixtureError = error.message + " " + error.stack; throw error; } };
        } catch (error) { window.fixtureError = error.message + " " + error.stack; throw error; }
      }});
    window.fixture = {p, ui, startup, allowRetry: () => failed = false};
    startup.start();
  `;
  frame.srcdoc = shell.replace('<head>', `<head><base href="${root.href}">`)
    .replace(/<script type="module" src="\.\/js\/main\.js\?v=4"><\/script>/, `<script type="module">${script}<\/script>`);
  document.getElementById('surface').append(frame);
  await wait(() => frame.contentWindow.fixture, 'Fixture did not initialize');
  const f = frame.contentWindow.fixture;
  await wait(() => fail || timeout ? !frame.contentDocument.getElementById('retry-btn').hidden : f.p.runtime && !f.p.busy,
    '3D did not initialize (check WebGL/CDN availability)');
  return { ...f, doc: frame.contentDocument, win: frame.contentWindow, $: id => frame.contentDocument.getElementById(id) };
}
async function check(name, action) {
  const item = document.createElement('li'); item.textContent = name; results.append(item);
  try { await action(); item.className = 'pass'; item.textContent = `PASS — ${name}`; passed++; }
  catch (error) { item.className = 'fail'; item.textContent = `FAIL — ${name}: ${error.message}`; throw error; }
}
try {
  let f = await fixture();
  await check('Dev mode off creates no editor markup', () => {
    assert(!f.$('edit-toggle-btn') && !f.$('editor-panel'), 'Editor leaked into normal mode');
  });
  await check('Index numbers, cover entries, current selection, and focus tooltip', () => {
    f.$('index-toggle-btn').click();
    const buttons = [...f.$('index-grid').children];
    assert(buttons.length === 5, 'Incorrect entry count');
    assert(buttons[0].getAttribute('aria-current') === 'page', 'Missing current page');
    assert(f.doc.activeElement === buttons[0], 'Current page did not receive focus');
    buttons[2].focus();
    assert(f.$('index-tooltip').textContent === 'Human and AI collaboration' && !f.$('index-tooltip').hidden, 'Missing title tooltip');
  });
  await check('Mouse hover displays a name without navigating', () => {
    f.$('index-grid').children[1].dispatchEvent(new f.win.PointerEvent('pointerenter', { pointerType: 'mouse' }));
    assert(f.$('index-tooltip').textContent === 'AI-assisted coding', 'Hover name is wrong');
    assert(f.p.currentIndex === 0, 'Hover changed the page');
  });
  await check('Index selection completes fast flips and restores Index focus', async () => {
    f.$('index-grid').children[3].click();
    assert(f.p.busy && f.$('next-btn').disabled && f.$('index-toggle-btn').disabled, 'Navigation did not lock');
    await wait(() => !f.p.busy);
    assert(f.p.currentIndex === 3 && f.$('index-popup').hidden, 'Destination or dismissal incorrect');
    assert(f.doc.activeElement === f.$('index-toggle-btn'), 'Index focus not restored');
    assert(f.p.runtime.book.rightPageMat.map === f.p.runtime.cache.peek(2), 'Wrong displayed texture');
  });
  await check('Every content and cover entry navigates to the correct position', async () => {
    for (const index of [0, 1, 2, 3, 4, 0]) {
      f.$('index-toggle-btn').click(); f.$('index-grid').children[index].click(); await wait(() => !f.p.busy);
      assert(f.p.currentIndex === index, `Wrong index ${index}`);
      assert(f.p.runtime.book.frontCover.rotation.y === (index === 0 ? Math.PI : 0), 'Wrong cover rotation');
    }
  });
  await check('Escape and outside click dismiss the index', () => {
    f.$('index-toggle-btn').click(); f.doc.activeElement.dispatchEvent(new f.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assert(f.$('index-popup').hidden && f.doc.activeElement === f.$('index-toggle-btn'), 'Escape did not restore focus');
    f.$('index-toggle-btn').click(); f.$('presentation-title').dispatchEvent(new f.win.PointerEvent('pointerdown', { bubbles: true }));
    assert(f.$('index-popup').hidden, 'Outside click did not dismiss');
  });
  await check('Reading view and 3D restore the same selected page', async () => {
    f.$('view-toggle-btn').click(); await wait(() => !f.p.busy); await f.p.goTo(2);
    assert(!f.$('reading-view').hidden && f.$('reading-title').textContent === 'Human and AI collaboration', 'Reading view is out of sync');
    assert(f.$('reading-description').textContent.includes('speech bubbles'), 'Description missing');
    f.$('view-toggle-btn').click(); await wait(() => !f.p.busy);
    assert(!f.p.reading && f.p.runtime.book.rightPageMat.map === f.p.runtime.cache.peek(1), '3D is out of sync');
  });
  await check('Reduced-motion index jumps bypass animation', async () => {
    f.p.reducedMotion = () => true; await f.p.goTo(4);
    assert(f.p.currentIndex === 4 && !f.p.runtime.book.isAnimating(), 'Reduced-motion destination incorrect');
  });
  await check('Missing reading image leaves title and description usable', async () => {
    await f.p.setReading(true); f.p.sources.set('slide:0', './assets/missing-test-image.png'); await f.p.goTo(1);
    await wait(() => !f.doc.querySelector('.image-fallback').hidden);
    assert(f.$('reading-title').textContent && f.$('reading-description').textContent, 'Reading content disappeared');
  });
  f = await fixture({ dev: true, count: 12 });
  await check('Dev mode creates editor with focus containment', () => {
    f.$('edit-toggle-btn').click();
    assert(!f.$('editor-panel').hidden && f.$('app').inert, 'Editor did not contain background focus');
    assert(f.doc.activeElement === f.$('editor-close-btn'), 'Editor initial focus incorrect');
  });
  await check('Real image upload handler updates the persistent override', async () => {
    const image = await (await fetch(new URL('assets/slides/slide-02.png', root))).blob();
    const transfer = new f.win.DataTransfer(); transfer.items.add(new f.win.File([image], 'replacement.png', {type: 'image/png'}));
    const input = f.$('slide-file-input'); input.files = transfer.files;
    input.dispatchEvent(new f.win.Event('change', { bubbles: true }));
    await wait(() => f.p.sources.has('slide:0') && f.p.runtime.cache.overrides.has(0));
    f.$('editor-close-btn').click();
    assert(!f.$('app').inert && f.doc.activeElement === f.$('edit-toggle-btn'), 'Editor close focus incorrect');
  });
  await check('Uploaded image survives a long jump and appears in both views', async () => {
    const original = f.p.runtime.cache.peek(0);
    await f.p.goTo(11); await f.p.goTo(1);
    assert(f.p.runtime.book.rightPageMat.map === original, 'Edited texture was lost');
    await f.p.setReading(true);
    assert(f.doc.querySelector('.reading-image').src === f.p.source('slide:0'), 'Reading view did not use upload');
  });
  await check('320px portrait layout fits controls and scrollable long index', async () => {
    frame.style.width = '320px'; frame.style.height = '640px';
    await new Promise(resolve => setTimeout(resolve, 100));
    f.$('index-toggle-btn').click();
    const rect = f.$('index-popup').getBoundingClientRect();
    assert(rect.left >= 0 && rect.right <= 321 && rect.top >= 0, 'Popup overflows narrow viewport');
    assert(f.doc.documentElement.scrollWidth <= 320, 'Page overflows horizontally');
    f.$('index-close-btn').click();
  });
  await check('Short landscape layout keeps index within viewport', async () => {
    frame.style.width = '568px'; frame.style.height = '320px';
    await new Promise(resolve => setTimeout(resolve, 100));
    f.$('index-toggle-btn').click(); const rect = f.$('index-popup').getBoundingClientRect();
    assert(rect.top >= 0 && rect.bottom <= 320, 'Landscape popup overflows'); f.$('index-close-btn').click();
  });
  f = await fixture({ fail: true });
  await check('A failed Three.js import leaves a usable reading view and Retry', async () => {
    assert(!f.$('retry-btn').hidden && !f.$('reading-view').hidden, 'Fallback unavailable');
    await f.p.goTo(2); assert(f.$('reading-title').textContent === 'Human and AI collaboration', 'Fallback navigation failed');
    f.allowRetry(); f.$('retry-btn').click(); await wait(() => f.p.runtime && !f.p.busy);
    assert(f.p.currentIndex === 2 && !f.p.reading, 'Retry did not restore current page');
  });
  f = await fixture({ timeout: true });
  await check('Startup deadline exposes reading view instead of a stuck loader', async () => {
    assert(!f.$('retry-btn').hidden && f.p.reading, 'Timeout fallback unavailable');
    await f.p.goTo(3); assert(f.$('reading-title').textContent === 'Sharing and iteration', 'Timeout blocked navigation');
  });
  document.getElementById('result').textContent = `${passed} browser checks passed.`;
} catch (error) {
  document.getElementById('result').textContent = `${passed} checks passed; stopped on failure: ${error.message}`;
  console.error(error);
}
