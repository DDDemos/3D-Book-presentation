# Main classes and methods

[Documentation index](README.md)

This reference describes the current application code. Content authors usually need only
[presentation.js](../js/presentation.js); the other modules implement its display and behavior.
Some modules expose factory functions returning objects rather than JavaScript classes.

## Startup and data flow

1. [main.js](../js/main.js) creates `Presentation`, applies the configured title, and calls
   `initUI()`. These imports do not require Three.js, so reading view can initialize first.
2. `createStartup().start()` dynamically imports `scene.js`, creates the runtime, waits for
   assets, and attaches it at the current page. Failure or a 15-second deadline leaves
   reading view available with Retry. Late attempts cannot replace the active runtime.
3. UI controls call `Presentation.next()`, `prev()`, `goTo()`, or `setReading()`.
4. The controller publishes its busy state before loading textures. It runs book and camera
   transitions together, commits the page, and then releases the navigation lock.
5. State subscribers update the heading, background theme, Index, reading view, and resource
   panel. The render loop draws only while active work exists or a change invalidates it.

## Index conventions

For **N** content slides, `Presentation` uses entry index **0** for the front cover,
**1–N** for slides, and **N + 1** for the back cover. `goTo(index)` takes this entry index.

The book, camera, and slide cache use `contentIndex = currentIndex - 1`: **−1** is the
front cover, **0–N − 1** are content, and **N** is the back cover. The cache returns `null`
for cover positions. Asset keys are `frontCover`, `backCover`, `spine`, and `slide:0`,
`slide:1`, etc.; the configured inside cover is `frontCoverInner`.

Do not pass an entry index directly to a book or camera method. Use the controller for
user navigation so locking, resources, and view state remain synchronized.

## Presentation

Source: [js/presentation.js](../js/presentation.js).

`new Presentation(content = slides, covers = bookConfig)` normalizes slide metadata,
builds the cover/content entries, and owns navigation and temporary uploads. The module
also exports `slides`, `bookConfig`, `presentationTitle`, and `DEV_MODE`.

- `state()` returns the current entry/index, reading state, busy flag, navigation target,
  display index during a turn, control availability, runtime availability, and error text.
- `onChange(fn)` subscribes to future state changes and returns an unsubscribe function.
  It does not call the listener immediately; call `state()` for the initial render.
- `source(key)` resolves an uploaded image override first, then the configured source.
- `next()` / `prev()` navigate one entry. `goTo(index)` performs an Index jump, clamps
  integer destinations to the deck, and ignores invalid or already-current destinations.
  Navigation methods resolve to a boolean indicating completion; busy requests return
  `false` instead of being queued.
- `setReading(reading)` switches views. Returning to 3D loads the current texture and
  restores book/camera state directly. It resolves to a boolean and requires a runtime
  when switching to 3D.
- `attachRuntime(runtime, texture)` installs a prepared runtime at the current position;
  used by startup after its final current-page check.
- `replaceImage(key, url, prepare)` awaits image preparation and commits a temporary blob
  URL/texture. It guards against older uploads replacing newer ones. Editor keys are
  `slide:i`, `frontCover`, `backCover`, and `spine`.
- `dispose()` revokes uploaded URLs, clears listeners, and disposes the attached runtime.

Internal helpers: `_run(action, navigationTarget)` owns locking, error recovery, and final
unlocking; `_navigate(index, jump)` chooses direct or animated navigation; `_step(direction,
duration)` loads textures and awaits both book/camera completion; `_emit()` notifies subscribers.

## Book3D

Source: [js/book.js](../js/book.js).

`new Book3D(scene)` creates cover boards, spine, page stacks, the bending page, and shadow
geometry. The book's physical page proportions remain portrait.

- `setSlideCount(n)` updates the modeled page count.
- `getViewBounds(kind)` returns bounds for `front`, `content`, or `back` camera framing.
- `setState(contentIndex, texture)` restores cover rotation, visible page, and stack layout
  directly. Used for startup, recovery, reading returns, and immediate jumps.
- `setRightPageTexture(texture)` displays a slide texture owned by the cache.
- `replaceSlideTexture(texture)` clears the turning-page reference and optionally replaces
  the current right-page texture.
- `setFrontCoverTexture(texture)`, `setFrontCoverInnerTexture(texture)`,
  `setBackCoverTexture(texture)`, and `setSpineTexture(texture)` update book-owned textures
  and dispose their replaced maps.
- `setPaperTexture(texture)` updates shared paper on page backs and stacks.
- `flip({ direction, frontTexture, upcomingRightTexture, reducedMotion, duration,
  onComplete })` starts a page turn. `direction` is `"forward"` or `"backward"`;
  `duration` overrides milliseconds, and completion is reported by callback.
- `flipCover({ direction, upcomingRightTexture, reducedMotion, duration, onComplete })`
  opens or closes the rigid front cover. Both flip methods reject overlapping animation
  by throwing; the controller prevents this during normal navigation.
- `update(nowMs)` advances the current animation; `isAnimating()` reports pending motion.
- `syncLayout(contentIndex)` settles page stacks and clears unused turning-page references.
- `dispose()` releases geometry, materials, and book-owned textures. Slide texture ownership
  remains with `SlideTextureCache`.

Geometry construction, stack placement, and page bending are internal methods such as
`_buildStaticParts()`, `_buildFlippingPage()`, `_layoutStacks()`, and `_updateFlipGeometry()`.

## SlideTextureCache

Source: [js/texture-cache.js](../js/texture-cache.js).

`new SlideTextureCache(slides, loader, sources = new Map(), windowSize = 4)` manages
original textures and separate, non-evictable uploaded overrides.

- `get(index)` asynchronously loads or reuses a texture, deduplicates pending loads, and
  gives overrides priority over late original loads. Out-of-range indices return `null`.
- `peek(index)` synchronously returns the override/cached texture, or `null`.
- `hold(indices)` pins textures against eviction and returns a release function.
- `setOverride(index, texture)` stores a replacement and disposes its superseded texture.
- `preloadAround(index)` updates the current center and preloads up to two neighbors on
  each side. `evictOutside()` disposes unpinned originals beyond `windowSize` from the
  latest center, regardless of when a preload started.
- `dispose()` releases cached originals and overrides; late loads dispose their results.

## ResourceTextStore and resource helpers

Source: [js/resources.js](../js/resources.js); no Three.js dependency.

- `normalizeResources(resources)` keeps text/URL items and supplies missing labels.
  The panel displays only the first item of each type.
- `websiteURL(value)` returns a normalized absolute HTTP/HTTPS URL, or `null` for an
  unsupported or invalid address. Copying uses the original configured string.
- `new ResourceTextStore({ fetchText, baseURL, timeout })` creates the text loader.
  Defaults are browser `fetch`, `document.baseURI`, and a 10,000ms timeout.
- `load(resource)` returns the complete text as a promise. Text paths resolve against
  `baseURL`; successful requests are cached and concurrent requests are shared. URL
  resources return their configured string without fetching the destination.
- `dispose()` aborts pending text requests and clears the cache.

## UI and resource-panel factories

Sources: [js/ui.js](../js/ui.js), [js/resource-panel.js](../js/resource-panel.js).

`initUI({ presentation, devMode, retry, resourceOptions })` wires the existing HTML shell,
Index/focus handling, navigation shortcuts, reading view, and code-controlled editor.
It returns `setStartupStatus(status)` for `"loading"`, `"ready"`, or `"failed"`, and
`dispose()` to dispose its resource panel. The page owns the other UI listeners for its lifetime.

Its internal `render(state)` updates controls, title visibility, and the body's `data-page-theme`.
The body supplies the warm cover/deep brown slide backdrop through CSS; light panels keep
their dark text. `updateReading(state)` updates the original image and metadata.

`initResourcePanel({ presentation, store, writeClipboard })` is called by `initUI()`. The
optional store and clipboard function allow browser tests to simulate requests and copying.
The returned `dispose()` unsubscribes, disconnects its resize observer, and disposes the store.

Panel internals: `render(state)` reserves final-destination space and binds the current slide;
`loadText()` handles loading/retry with stale-result guards; `overflow()` detects long
previews; `setExpanded(next)` toggles the full view; `copyResource(kind)` copies the complete
URL or prompt and provides manual selection on failure; `controls()` updates action availability.

## Scene and camera factories

Sources: [js/scene.js](../js/scene.js), [js/camera.js](../js/camera.js).

`createScene(presentation)` returns the optional WebGL runtime with `book`, `cache`,
`camera`, `cameraRig`, and a `ready` promise for cover/paper initialization. Its methods are:

- `setCameraState(contentIndex)` restores the appropriate pose immediately.
- `transitionCamera(contentIndex, options)` returns a promise for the eased transition,
  including the desktop resource-panel orbit when needed.
- `invalidate()` requests a frame. `setActive(value)` enables drawing in 3D and pauses it
  in reading view.
- `prepareImage(key, url)` prepares a cover or paper-composited slide texture for an upload.
- `dispose()` releases the runtime, observers, listeners, textures, and WebGL context.

Canvas resizing and drawing occur in the same render callback to avoid a cleared frame.
Transparent clearing reveals the body's background, including outside the camera framing
scissor. Background fades therefore do not require continuous WebGL rendering.

`createCameraRig(camera, book, slideCount)` returns `setState(contentIndex, { panel })`,
`transitionTo(contentIndex, { duration, reducedMotion, panel })`, `update(now)`,
`resize({ panel })`, `getFrame()`, `isAnimating()`, and `dispose()`.
Transitions default to 900ms and resolve on completion. Reduced motion restores immediately.
`getFrame()` returns normalized left/right/bottom/top bounds for the scene's scissor.
Resizing refits the pose or changes its destination without restarting the animation clock.

## Startup, rendering, and texture helpers

`createStartup({ presentation, loadRuntime, onStatus, timeout = 15000 })` in
[startup.js](../js/startup.js) returns `start()` and `dispose()`. `start()` handles the
initial attempt or Retry; `dispose()` invalidates pending attempts and releases any pending
runtime. The controller owns an already-attached runtime.

`createRenderLoop({ update, render, isAnimating, request, cancel, hidden })` in
[render-loop.js](../js/render-loop.js) returns `invalidate()`, `setActive(value)`,
`visibilityChanged()`, and `dispose()`. It starts inactive, coalesces frame requests,
pauses while hidden, and stops scheduling when animation settles. Scheduler/visibility
functions can be injected for tests.

[textures.js](../js/textures.js) exports `loadImage(url)` (12-second image deadline),
`loadSlideTexture(url, index, paperImage = null)`, `loadCoverTexture(url, label)`, and
`makePageBackTexture(paperImage = null)`. Slide composition fits and rotates artwork over
paper; unavailable slides get a composed placeholder. Cover loading has its own fallback.

## Checks when changing behavior

Run `node tests/run.mjs` with Node 22 or newer for controller, cache, startup, resource,
and render-loop checks. Open `http://localhost:8000/tests/browser.html` while serving the
project for real WebGL/UI checks. The labeled landscape fixture checks orientation and
cropping; browser checks also cover resources, backgrounds, reading fallback, resizing,
and rendering stopping at idle. Neither check suite is part of the deployed application runtime.
