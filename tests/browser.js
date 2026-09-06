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
async function fixture({ dev = false, count = 3, fail = false, timeout = false, width = 960, height = 650, landscape = false } = {}) {
  if (frame) { frame.contentWindow.fixture?.startup.dispose(); frame.contentWindow.fixture?.p.dispose(); frame.remove(); }
  frame = document.createElement('iframe'); frame.title = 'Presentation test fixture';
  frame.style.width = `${width}px`; frame.style.height = `${height}px`;
  const script = `
    import { Presentation, slides } from './js/presentation.js?v=5';
    import { initUI } from './js/ui.js?v=5';
    import { createStartup } from './js/startup.js?v=5';
    window.addEventListener('error', event => window.fixtureError = event.message);
    window.addEventListener('unhandledrejection', event => window.fixtureError = String(event.reason));
    const p = new Presentation(Array.from({length: ${count}}, (_, i) => ({...slides[i % slides.length], title: slides[i % slides.length].title + (${count} > 3 ? ' ' + (i + 1) : '')})));
    ${landscape ? `p.slides.forEach((slide, i) => { slide.src = '${root.href}tests/landscape.svg'; slide.title = 'Landscape check ' + (i + 1); Object.assign(p.entries[i + 1], slide); });` : ''}
    let startup;
    const ui = initUI({presentation: p, devMode: ${dev}, retry: () => startup.start()});
    let failed = ${fail};
    startup = createStartup({presentation: p, timeout: ${timeout ? 30 : 15000}, onStatus: ui.setStartupStatus,
      loadRuntime: async () => {
        ${timeout ? 'return new Promise(() => {});' : ''}
        if (failed) throw new Error('Simulated CDN failure');
        try {
          const {createScene} = await import('${root.href}js/scene.js?v=5');
          return () => { try { return createScene(p); } catch (error) { window.fixtureError = error.message + " " + error.stack; throw error; } };
        } catch (error) { window.fixtureError = error.message + " " + error.stack; throw error; }
      }});
    window.fixture = {p, ui, startup, allowRetry: () => failed = false};
    startup.start();
  `;
  frame.srcdoc = shell.replace('<head>', `<head><base href="${root.href}">`)
    .replace(/<script type="module" src="\.\/js\/main\.js\?v=5"><\/script>/, `<script type="module">${script}<\/script>`);
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
function assertFraming(f, kind) {
  const {camera, book} = f.p.runtime;
  const bounds = book.getViewBounds(kind);
  const project = (x, y, z) => camera.position.clone().set(x, y, z).project(camera);
  const center = bounds.getCenter(camera.position.clone()).project(camera);
  assert(Math.abs(center.x) < .001 && Math.abs(center.y) < .001, 'Surface is not centered');
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const point = project(x, y, z);
    assert(Math.abs(point.x) < 1 && Math.abs(point.y) < 1 && point.z < 1, 'Surface is clipped');
  }
  const a = project(.75, -.8, 0), b = project(.75, .8, 0);
  assert(kind === 'content' ? Math.abs(a.x - b.x) > 10 * Math.abs(a.y - b.y)
    : Math.abs(a.y - b.y) > 10 * Math.abs(a.x - b.x), 'Incorrect portrait/landscape orientation');
  if (kind !== 'front') {
    const matte = f.p.runtime.cameraRig.getFrame();
    const leftPage = project(-.75, 0, 0);
    assert(leftPage.x < matte.left || leftPage.x > matte.right || leftPage.y < matte.bottom || leftPage.y > matte.top,
      'Unused half of the book remains inside the visible page area');
  }
}
function assertLandscapeTexture(texture) {
  const image = texture.image, ctx = image.getContext('2d');
  const scale = Math.min(image.height * .88 / 1600, image.width * .88 / 900);
  const sample = (x, y) => [...ctx.getImageData(Math.round(image.width / 2 - (y - 450) * scale),
    Math.round(image.height / 2 + (x - 800) * scale), 1, 1).data].join(',');
  for (const [x, y, color] of [[40,40,'255,0,0,255'],[1560,40,'0,255,0,255'],[40,860,'0,0,255,255'],[1560,860,'255,255,0,255']]) {
    assert(sample(x,y) === color, `Landscape corner is cropped, mirrored, or incorrectly rotated: ${x},${y}`);
  }
}
try {
  let f = await fixture();
  await check('Cover is centered, upright, and uses the configured introduction heading', () => {
    assertFraming(f, 'front');
    assert(f.$('presentation-title').textContent === 'Intro to Vibe Coding', 'Wrong introduction title');
    assert(f.$('presentation-title').getAttribute('aria-hidden') === 'false', 'Cover heading is hidden');
  });
  await check('16:9 artwork fits completely and rotates to match the landscape camera', async () => {
    const texture = await f.p.runtime.prepareImage('slide:0', new URL('tests/landscape.svg', root).href);
    assertLandscapeTexture(texture); texture.dispose();
  });
  await check('Default paper is shared by page backs, turning pages, and page stacks', () => {
    const book = f.p.runtime.book;
    assert(book.leftPageMat.map === book.flipBackMat.map, 'Page backs use different paper');
    assert(book.leftStackMat.map === book.leftPageMat.map && book.rightStackMat.map === book.leftPageMat.map, 'Stacks lack paper texture');
    const image = book.leftPageMat.map.image;
    const pixels = image.getContext('2d').getImageData(0, 0, image.width, image.height).data;
    const first = pixels.slice(0, 3).join(',');
    assert(pixels.some((_, i) => i % 400 === 0 && pixels.slice(i, i + 3).join(',') !== first), 'Paper is a flat fallback instead of the supplied texture');
  });
  await check('Slide composition preserves paper margins and transparency beneath opaque artwork', async () => {
    const art = f.doc.createElement('canvas'); art.width = art.height = 100;
    const ctx = art.getContext('2d'); ctx.fillStyle = '#ff0000'; ctx.fillRect(40, 40, 20, 20);
    const composed = await f.p.runtime.prepareImage('slide:0', art.toDataURL());
    const base = f.p.runtime.book.leftPageMat.map.image;
    const pixel = (canvas, x, y) => [...canvas.getContext('2d').getImageData(x, y, 1, 1).data].join(',');
    const image = composed.image;
    assert(pixel(image, 10, 10) === pixel(base, 10, 10), 'Margin overwrote the paper');
    assert(pixel(image, 250, 600) === pixel(base, 250, 600), 'Transparent artwork hid the paper');
    assert(pixel(image, 512, 682) === '255,0,0,255', 'Opaque artwork was not composited on top');
    composed.dispose();
  });
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
      assertFraming(f, index === 0 ? 'front' : index === 4 ? 'back' : 'content');
      assert(f.$('presentation-title').getAttribute('aria-hidden') === String(index !== 0), 'Incorrect heading visibility');
    }
  });
  await check('Opening, closing, and resizing never present a cleared canvas before redrawing', async () => {
    const canvas = f.$('book-canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    let cleared = false, resizes = 0, blankFrames = 0;
    // Canvas size assignments clear the drawing buffer. Mutation observers run
    // after the resize/render callback, before paint: drawing must already be done.
    for (const name of ['width', 'height']) {
      const descriptor = Object.getOwnPropertyDescriptor(f.win.HTMLCanvasElement.prototype, name);
      Object.defineProperty(canvas, name, { configurable: true,
        get() { return descriptor.get.call(this); },
        set(value) { cleared = true; resizes++; descriptor.set.call(this, value); },
      });
    }
    const originals = new Map(['drawArrays', 'drawElements'].map(name => [name, gl[name]]));
    for (const [name, draw] of originals) gl[name] = function(...args) {
      const result = draw.apply(this, args); cleared = false; return result;
    };
    const observer = new f.win.MutationObserver(() => { if (cleared) blankFrames++; });
    observer.observe(canvas, {attributes: true, attributeFilter: ['width', 'height']});
    try {
      await f.p.next(); await f.p.prev();
      frame.style.height = '620px';
      await new Promise(resolve => setTimeout(resolve, 100));
      frame.style.height = '650px';
      await new Promise(resolve => setTimeout(resolve, 100));
      assert(resizes > 0, 'Regression check did not exercise a canvas resize');
      assert(blankFrames === 0, `${blankFrames} canvas resizes cleared the book without redrawing before paint`);
    } finally {
      observer.disconnect();
      for (const name of ['width', 'height']) delete canvas[name];
      for (const [name, draw] of originals) gl[name] = draw;
    }
  });
  await check('Camera stays steady between slides and renders stop after motion settles', async () => {
    await f.p.next();
    const {camera, book} = f.p.runtime;
    const rotation = camera.quaternion.clone(), position = camera.position.clone();
    const navigation = f.p.next();
    await wait(() => book.isAnimating());
    assert(!f.p.runtime.cameraRig.isAnimating(), 'Content navigation moved the camera');
    await navigation;
    assert(camera.quaternion.angleTo(rotation) < .00001 && camera.position.distanceTo(position) < .00001, 'Page pose drifted');
    assert(f.$('presentation-title').getBoundingClientRect().height === 0, 'Hidden heading still occupies space');
    let updates = 0; const update = book.update;
    book.update = function(now) { updates++; return update.call(this, now); };
    await new Promise(resolve => setTimeout(resolve, 100));
    const settled = updates;
    await new Promise(resolve => setTimeout(resolve, 150));
    assert(updates === settled, 'Rendering continues while idle');
    book.update = update;
  });
  await check('Resizing during camera rotation preserves progress and fits the settled view', async () => {
    await f.p.goTo(0);
    const navigation = f.p.next();
    await wait(() => f.p.runtime.cameraRig.isAnimating());
    frame.style.width = '320px'; frame.style.height = '640px';
    assert(f.p.busy, 'Camera transition released navigation early');
    await navigation; assertFraming(f, 'content');
    frame.style.width = '960px'; frame.style.height = '650px';
    await new Promise(resolve => setTimeout(resolve, 100));
    assertFraming(f, 'content');
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
    assert(!f.p.runtime.cameraRig.isAnimating(), 'Reduced motion animated the camera');
    assertFraming(f, 'back');
    const navigation = f.p.prev();
    await wait(() => f.p.runtime.book.isAnimating());
    assert(!f.p.runtime.cameraRig.isAnimating(), 'Ordinary reduced-motion navigation animated the camera');
    assertFraming(f, 'content');
    await navigation;
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
    const image = await (await fetch(new URL('tests/landscape.svg', root))).blob();
    const transfer = new f.win.DataTransfer(); transfer.items.add(new f.win.File([image], 'replacement.svg', {type: 'image/svg+xml'}));
    const input = f.$('slide-file-input'); input.files = transfer.files;
    input.dispatchEvent(new f.win.Event('change', { bubbles: true }));
    await wait(() => f.p.sources.has('slide:0') && f.p.runtime.cache.overrides.has(0));
    assertLandscapeTexture(f.p.runtime.cache.peek(0));
    f.$('editor-close-btn').click();
    assert(!f.$('app').inert && f.doc.activeElement === f.$('edit-toggle-btn'), 'Editor close focus incorrect');
  });
  await check('Uploaded image survives a long jump and appears in both views', async () => {
    const original = f.p.runtime.cache.peek(0);
    await f.p.goTo(11); await f.p.goTo(1);
    assert(f.p.runtime.book.rightPageMat.map === original, 'Edited texture was lost');
    await f.p.setReading(true);
    assert(f.doc.querySelector('.reading-image').src === f.p.source('slide:0'), 'Reading view did not use upload');
    const paper = f.$('reading-image-container').getBoundingClientRect();
    assert(Math.abs(paper.width / paper.height - 4/3) < .01, 'Reading paper is not landscape');
  });
  await check('320px portrait layout fits controls and scrollable long index', async () => {
    frame.style.width = '320px'; frame.style.height = '640px';
    await new Promise(resolve => setTimeout(resolve, 100));
    f.$('index-toggle-btn').click();
    const rect = f.$('index-popup').getBoundingClientRect();
    assert(rect.left >= 0 && rect.right <= 321 && rect.top >= 0, 'Popup overflows narrow viewport');
    assert(f.doc.documentElement.scrollWidth <= 320, 'Page overflows horizontally: ' + f.doc.documentElement.scrollWidth + 'px; ' + [...f.doc.querySelectorAll('body *')].filter(el => el.getBoundingClientRect().right > 321 && !el.hidden).map(el => el.id || el.tagName).join(', '));
    f.$('index-close-btn').click();
  });
  await check('Short landscape layout keeps index within viewport', async () => {
    frame.style.width = '568px'; frame.style.height = '320px';
    await new Promise(resolve => setTimeout(resolve, 100));
    f.$('index-toggle-btn').click(); const rect = f.$('index-popup').getBoundingClientRect();
    assert(rect.top >= 0 && rect.bottom <= 320, 'Landscape popup overflows'); f.$('index-close-btn').click();
    await f.p.setReading(false); assertFraming(f, 'content');
  });
  for (const count of [0, 1]) {
    f = await fixture({count});
    await check(`${count}-slide deck restores cover and content camera poses safely`, async () => {
      await f.p.goTo(count + 1); assertFraming(f, 'back');
      if (count) { await f.p.goTo(1); assertFraming(f, 'content'); }
      await f.p.goTo(0); assertFraming(f, 'front');
    });
  }
  f = await fixture({ fail: true });
  await check('A failed Three.js import leaves a usable reading view and Retry', async () => {
    assert(!f.$('retry-btn').hidden && !f.$('reading-view').hidden, 'Fallback unavailable');
    await f.p.goTo(2); assert(f.$('reading-title').textContent === 'Human and AI collaboration', 'Fallback navigation failed');
    f.allowRetry(); f.$('retry-btn').click(); await wait(() => f.p.runtime && !f.p.busy);
    assert(f.p.currentIndex === 2 && !f.p.reading, 'Retry did not restore current page');
    assertFraming(f, 'content');
  });
  f = await fixture({ timeout: true });
  await check('Startup deadline exposes reading view instead of a stuck loader', async () => {
    assert(!f.$('retry-btn').hidden && f.p.reading, 'Timeout fallback unavailable');
    await f.p.goTo(3); assert(f.$('reading-title').textContent === 'Sharing and iteration', 'Timeout blocked navigation');
  });
  document.getElementById('result').textContent = `${passed} browser checks passed.`;
  const preview = document.getElementById('preview');
  preview.disabled = false;
  preview.addEventListener('click', async () => {
    preview.disabled = true;
    try {
      const [width, height] = document.getElementById('preview-size').value.split(',').map(Number);
      const example = await fixture({landscape: true, width, height});
      await example.p.goTo(1);
      document.getElementById('surface').scrollIntoView({block: 'start'});
    } finally { preview.disabled = false; }
  });
} catch (error) {
  document.getElementById('result').textContent = `${passed} checks passed; stopped on failure: ${error.message}`;
  console.error(error);
}
