# 3D Book Presentation

A page-turning Three.js presentation with a numbered index, an accessible 2D reading view,
and an optional developer texture editor. Plain HTML, CSS, and ES modules: no build step,
package installation, backend, or bundler is required to serve it.

## Run locally

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`. ES modules require an HTTP server; opening `index.html`
directly from the filesystem does not work.

## Add another slide

1. Save an upright landscape image in `assets/slides/`, for example `my-next-slide.jpg`.
   A 16:9 image is recommended; do not rotate it yourself.
2. Open [js/presentation.js](js/presentation.js) and insert this object inside the existing
   `export const slides = [ ... ];` array, after the last slide and before the closing `];`.
   Keep a comma between slide objects. Replace the example filename and text with yours:

   ```js
   {
     src: "./assets/slides/my-next-slide.jpg",
     title: "My next topic",
     description: "A short description of what this slide shows.",
   },
   ```

3. Save and reload the presentation. Open **Index** to find the new slide. Page numbers,
   the counter, and the back-cover position update automatically.

Images are not discovered automatically. Each needs its own slide object. To change the
order, move the whole object, including its optional `resources` array. Dev mode is not
required for adding content through files.

## Documentation

Start with the [documentation index](documentation/README.md), or open a guide directly:

- [Add, replace, reorder, and remove slides](documentation/adding-slides.md).
- [Add website links and copyable text, step by step](documentation/adding-links-and-text.md).
- [Main classes, methods, and runtime flow](documentation/code-reference.md).

## Content and dev mode

Edit **`js/presentation.js`**. It contains the presentation title, slide metadata,
cover image paths, and the code-only developer switch:

```js
export const DEV_MODE = false;
export const presentationTitle = "My presentation";
export const slides = [
  {
    src: "./assets/slides/slide-01.png",
    title: "Introduction",
    description: "The text or image description that readers need to understand this slide.",
  },
];
export const bookConfig = {
  frontCover: "./assets/book/cover-front.png?v=2",
  frontCoverInner: "./assets/book/cover-front-inner.png",
  backCover: "./assets/book/cover-back.png",
  spine: "./assets/book/spine.png",
  pageTexture: "./assets/book/PageTexture.png",
};
```

Add, remove, or reorder objects to change the presentation. `src` is the image path,
`title` supplies the index tooltip and reading-view heading, and `description` is optional
plain text displayed below the image in reading view. Blank or missing titles become
“Slide N.” For presentations containing text, include that text or an equivalent description
so the content is available to screen readers. Images are not automatically transcribed.

The active deck contains 21 workshop images in `assets/slides/NewSlides/`, in PDF page
order, excluding PDF pages 7–10. Each is a separate book page with an Index title and reading-view description.
The quote on PDF pages 1 and 13 remains in both positions. The original three sample images
are retained as test fixtures. The book uses the supplied leather-and-gold
front cover, back cover, and spine PNGs. The physical pages remain 3:4 portrait, but the
content camera rotates 90° to present the right page as a 4:3 landscape surface. Supply
slide images upright in landscape orientation (16:9 recommended); composition rotates
the artwork to match the camera automatically. Images fit without cropping or stretching,
so widescreen slides have additional paper above and below them. The existing square
sample images still work. Cover and spine textures retain the entire source image, fitted to their mesh surfaces
without cropping the artwork. The cover boards are 75% thicker than the original prototype,
with rounded corners, beveled leather edges, and a slight overhang beyond the paper pages. Relative asset paths
work at a domain root or in a GitHub Pages project subdirectory.

`bookConfig.frontCoverInner` supplies the inside lining visible when the front cover opens.
It is separate from the exterior title artwork; the back cover keeps its existing material.

`bookConfig.pageTexture` is the default paper for every page front, page back, and page turn.
Slide artwork is contained on top with a 2% paper margin. Transparent pixels reveal the paper;
opaque image backgrounds remain part of the artwork. The dev editor uses the same composition
for uploaded slides, and reading view displays the same paper behind the original slide image.
The paper image is loaded once per 3D runtime. If it is unavailable, plain cream paper is used.

## Prompts, text, and website links

Attach an optional `resources` array **inside the slide object** in `js/presentation.js`:

```js
{
  src: "./assets/slides/slide-01.png",
  title: "AI-assisted coding",
  description: "An introduction to AI-assisted coding.",
  resources: [
    { type: "text", label: "Example prompt", src: "./assets/text/example-prompt.txt" },
    { type: "url", label: "Example website", url: "https://example.com" }
  ]
}
```

Store long prompts in UTF-8 `.txt` files. File paths are relative to the presentation page,
including when hosted in a project subdirectory. The association is explicit: it does not
depend on page numbers, matching filenames, or slide titles. Reorder the entire slide object
to move its image and resources together. A slide can contain one text resource, one URL,
or both. The URL always appears above the text, regardless of their array order; there is
no selector. Configure at most one item of each type (the first of each type is displayed).
Omit `resources` or use an empty array for slides that need no panel.

The example above demonstrates a prompt and an example.com URL; it is not part of the active
21-slide deck. Slide 2 includes the full Birmingham Music Stories design prompt from
[birmingham-music-stories-stitch-prompt.txt](assets/text/birmingham-music-stories-stitch-prompt.txt).
Slide 10 includes the implementation prompt from
[birmingham-music-stories-ai-studio-prompt.txt](assets/text/birmingham-music-stories-ai-studio-prompt.txt).
Slide 18 includes the photo replacement prompt from
[birmingham-music-stories-photos-prompt.txt](assets/text/birmingham-music-stories-photos-prompt.txt).
Slide 19 includes the About Me page prompt from
[birmingham-music-stories-about-me-prompt.txt](assets/text/birmingham-music-stories-about-me-prompt.txt).
Website resources link slide 2 to Google Stitch, slide 3 to the DDDemos GitHub profile,
and slide 10 to Google AI Studio. On slides with a prompt, the website appears above it.
Attach further resources to the appropriate slide objects as needed.
Text and URLs drawn inside a slide image do not automatically create resource controls.
Resource text is separate from the slide's accessible `description`.

On desktops wider than 960px, the panel sits to the right and the book shifts left with a
slight additional camera angle. On smaller screens the panel sits below the slide; scroll
the presentation area to reach it. Slides without resources return to the centered view.
Reading view uses the same panel, including when WebGL or Three.js is unavailable.

- When both are configured, the website and prompt are visible together. Each has its own
  copy icon; the website also has an external-link icon. Icons have hover tooltips and
  accessible names for screen readers.
- Short text is shown completely. Longer text has an approximately eight-line preview with a
  faded ending. **Show full text** opens a bounded, scrollable view; **Collapse** restores the preview.
- The **copy icon** always uses that item's complete original text, including paragraphs, indentation, Unicode,
  and trailing whitespace. Text is rendered literally; HTML and Markdown are not executed.
- **Copied** appears only after clipboard access succeeds. If the browser denies access,
  the panel selects the complete text in a field so you can copy it manually. Automatic
  clipboard access normally requires HTTPS or localhost and browser permission.
- The **external-link icon** appears only for URL items with an HTTP or HTTPS address. It opens
  a new tab and leaves the presentation at its current slide. A URL inside a prompt does not
  turn that prompt into a website link.

Text files load when the slide appears and successful responses are cached for the current tab. A failed
request or a 10-second timeout shows **Retry** and does not block slide navigation. During
navigation resource controls are unavailable; index jumps show only the final destination's
resources. Late loading or copying completions cannot replace a newer slide's contents or feedback.
Website actions remain usable while the accompanying prompt loads or if its load fails.

Resource editing is file/configuration based. The temporary image editor does not edit or save prompts.

## Navigation

The bottom toolbar places Previous, the counter, Next, Index, Reading view, resource visibility,
and fullscreen controls on one desktop row. Narrow screens use compact icons and wrap as needed,
with 44px touch targets. The reclaimed footer space goes to the book canvas.

- **Previous / Next:** one normal page turn (about 900ms).
- **Left / Right arrow, Space:** previous/next when focus is outside interactive controls.
  Space retains its normal action on a focused button.
- **Index:** opens a compact grid of content numbers **1–N**, plus separate **Front cover**
  and **Back cover** entries. The counter uses the same numbering.
- Hover or keyboard-focus a number to see its slide name. Touch devices show names under
  the numbers; a single tap selects the page.
- Use Tab, arrow keys, Home/End, and Enter/Space inside the index. Escape, the close button,
  selecting a page, or clicking outside closes it. Selection/Escape returns focus to Index.
- Index jumps flip each intervening page at `min(180ms, 2000ms / numberOfTurns)` per page.
  Long jumps target roughly two seconds of animation, excluding image loading and frame-rate
  delays. Choosing the current page simply closes the popup.
- Navigation and image mutation controls are disabled during loading/transitions. Further
  navigation requests are ignored until the current operation finishes.
- **Hide/Show slide resources:** the panel icon appears on slides with text or links. Hiding
  the panel gives its space to the slide and removes the extra camera angle. It stays hidden
  across slides and view switches until you restore it; reloading resets it to visible.
  Desktop 3D reframing takes 240ms without a page flip. Reading view, narrow screens, and
  reduced-motion mode apply the change immediately. Full text and copy controls return with it.
- **Fullscreen:** the corner icon enters or exits native fullscreen for the whole presentation,
  including controls and popups. You can also use the browser's normal exit action. Unsupported
  browsers omit the button; a denied request leaves the presentation usable with an inline message.

Covers remain the first and last positions. Empty and single-slide presentations are supported.
The front cover is centered almost straight on, slightly elevated to reveal its thickness.
The presentation heading appears only here; it fades away and releases its space when the
book opens. The camera rotates smoothly into a nearly straight-on landscape view of the
right page, with a little cover and paper edge visible. It stays steady between slides and
returns to an upright portrait view at the back cover, without restoring the heading.
Content framing uses 2% fit padding; the portrait covers keep their original 4.5% padding.
A transparent frame around the focused board keeps the unused half of the spread
out of view even on tall phone screens or wide cover views. The whole page uses a warm
taupe background on both covers and fades to deep brown on content slides, in both 3D
and reading view. Adjust `--cover-background` and `--slide-background` in `styles.css`
to change these shades. Reduced motion skips the background fade. The transparent 3D
canvas reveals the same backdrop without a separate rectangle or idle rendering.
Cover-boundary camera movement runs alongside the page animation at the same duration;
navigation remains locked until both finish. Each pose fits the available viewport on resize,
including while rotating. There are no drag or wheel camera controls.

With reduced motion enabled, camera poses change immediately, index jumps are immediate,
and ordinary page turns use a shorter, gentler animation. Returning from reading view or
recovering 3D restores both the book and camera directly to the current position.

## Reading view and recovery

**Reading view** displays the current original image, heading, and optional description.
It shares the index and navigation controls with 3D; page changes are immediate. Switching
back to **3D view** restores the current page without replaying intervening flips. Covers are
included. Content images remain upright on a landscape paper surface; covers stay portrait.
Missing images show an inline message while titles and descriptions remain readable.

Reading view initializes independently of Three.js. If the CDN import, WebGL initialization,
or startup fails—or takes longer than 15 seconds—the presentation stays usable in reading view
and shows **Retry 3D**. Late results from timed-out attempts cannot replace the active runtime.
Some browsers cache failed module downloads; if Retry still fails after connectivity returns,
reload the page. No external dependency is needed for reading view itself.

## Developer editing

Set `DEV_MODE = true` in `js/presentation.js` and reload to show **Edit** beside Index and the
view switch. The editor's markup and listeners are created only in dev mode. There is no URL
parameter or browser-storage setting to enable it. This is a presentation UI setting, not
an authentication or security boundary: all served source code is public to visitors.

You can replace a content slide, front cover, back cover, or spine using a local image. Edits
appear in both views where applicable, survive navigation through the entire presentation,
and are retained only in the current tab. Invalid images leave the previous image intact.
Newer uploads take precedence if image decoding completes out of order.

To keep changes, save the images into `assets/`, update the configuration, and commit them.
Reloading discards previews. Saving/exporting previews and reordering through the editor are
not implemented.

## Project structure

- `documentation/`: content authoring guides and the code reference.
- `index.html`, `styles.css`: shared page shell, controls, popup, reading view, and styling.
- `js/presentation.js`: code configuration, view/page state, navigation lock, upload ownership.
- `js/ui.js`: DOM-only controls, accessible index, reading view, and dev-only editor.
- `js/display-config.js`: shared artwork margin and resource-transition duration.
- `js/fullscreen.js`: native fullscreen controls, browser state synchronization, and failure feedback.
- `js/resource-panel.js`, `js/resources.js`: slide-linked resource panel, clipboard actions,
  website validation, and cached plain-text loading.
- `js/main.js`, `js/startup.js`: lightweight entry point, startup deadline, retry and cleanup.
- `js/scene.js`, `js/camera.js`: optional Three.js runtime, lighting, automatic camera poses,
  eased camera transitions, and viewport fitting.
- `js/book.js`: procedural covers, spine, page stacks, bending pages, and direct layout restoration.
- `js/textures.js`, `js/texture-cache.js`: image composition and nearby-slide caching with
  separately retained uploaded textures.
- `js/render-loop.js`: renders only after changes or during animations; pauses while hidden.
- `tests/run.mjs`: dependency-free controller, cache, startup, and render-scheduling checks.
- `tests/browser.html`: repeatable browser integration checks using isolated application frames.

## Validation

Serving the project does not require Node. Developers can optionally run the checks with
Node 22 or newer:

```sh
node tests/run.mjs
```

Open `http://localhost:8000/tests/browser.html` to run the browser integration checks.
They exercise the real 3D runtime and image-upload handler, including dev mode, longer decks,
reading-view recovery, and narrow portrait/landscape layouts. Test fixtures enable dev mode
only inside their own frames; they do not change the production configuration.
The labeled `tests/landscape.svg` fixture checks 16:9 orientation, complete corner visibility,
and uploaded replacements. Camera checks cover framing, resize during rotation, cover
transitions, and the absence of continuing idle frames.
Resource checks cover 1,000-word exact copying, clipboard-denied manual selection, overflow
previews, URL actions, stale responses, retries, responsive panels, and reading-only startup.
After the checks pass, use **Inspect landscape fixture** to visually inspect the labeled
slide in desktop, narrow portrait, or short landscape viewports using the normal controls.

Manual browser acceptance checks should include index clicks and focus/hover names, keyboard
navigation, every cover/content position, reading/3D synchronization, narrow layouts, browser
zoom, reduced motion, and dev mode on/off. Also test failed startup and image loading. The
controller suite uses fake textures and an injected renderer clock; it does not replace WebGL
or screen-reader testing.

## GitHub Pages

Commit and push the files, then configure the repository's Pages source to the desired branch
and root directory. No generated output folder is required. `.nojekyll` prevents Jekyll
processing. Three.js is pinned to version 0.160.0 in the import map; 3D requires that CDN to be
reachable. Reading view and the local content remain available if it is not.
