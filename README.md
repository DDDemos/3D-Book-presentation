# 3D Book Presentation

An interactive presentation delivered as a physical, page-turning 3D book, built with
[Three.js](https://threejs.org/). Every page turn is a real bending-paper animation, not a
texture swap — the whole thing is plain HTML, CSS and vanilla JavaScript with **no build step,
no npm, no bundler**. Commit it, push it, and GitHub Pages serves it as-is.

> **Sample content:** `assets/slides/slide-01.png` through `slide-03.png` and
> `assets/book/cover-front.png` are placeholder artwork so the book isn't empty out of the box.
> `assets/book/cover-back.jpg` and `spine.jpg` aren't provided, so those two fall back to a
> generated placeholder material — see [section 4](#4-changing-the-cover--spine-artwork) to
> replace any of this with your own images.

## 1. Running it locally

Because the page loads JavaScript as ES modules, you can't just double-click `index.html`
(browsers block module `fetch()` on the `file://` protocol). Serve the folder with any static
file server instead. The simplest option, using Python (already on most machines):

```bash
python3 -m http.server 8000
```

Then open:

```
http://localhost:8000
```

Any other static server works too (`npx serve`, VS Code's "Live Server" extension, etc.) — the
site has no server-side requirements at all.

## 2. How the project is organized

```
index.html          Page shell, import map, UI markup
styles.css           All styling
js/
  main.js             Scene bootstrap: renderer, camera, lights, controls, render loop
  book.js             The procedural 3D book (geometry, materials, page-turn animation)
  presentation.js      *** central config for slides + cover art, texture loading/caching ***
  ui.js               DOM wiring: buttons, keyboard, click-to-navigate, editor panel
assets/
  slides/             Your slide images (slide-01.jpg, slide-02.jpg, ...)
  book/               Cover-front / cover-back / spine artwork
.nojekyll             Tells GitHub Pages not to run Jekyll on this repo
```

## 3. Changing the slides

Open [`js/presentation.js`](js/presentation.js) and edit the `slides` array — that is the
**only** place slide filenames live:

```js
export const slides = [
  "./assets/slides/slide-01.jpg",
  "./assets/slides/slide-02.jpg",
  "./assets/slides/slide-03.jpg",
];
```

Add or remove lines to add or remove pages from the book — nothing else in the code needs to
change. The book supports well over 20 slides out of the box (only a handful of textures are
ever loaded into memory at once — see "Performance" below).

Paths are relative (`./assets/...`), so this works whether the site is hosted at the root of a
domain or in a GitHub Pages *project* subdirectory (`https://user.github.io/repo-name/`).

If a listed image is missing or fails to load, the book shows a tasteful placeholder (a
gradient with the slide number) instead of breaking — check the browser console for a warning
naming the missing file.

## 4. Changing the cover / spine artwork

Also in `js/presentation.js`:

```js
export const bookConfig = {
  frontCover: "./assets/book/cover-front.jpg",
  backCover: "./assets/book/cover-back.jpg",
  spine: "./assets/book/spine.jpg",
};
```

Drop your own images at those paths (or point the config at different filenames) and reload.
Missing cover art also falls back to a placeholder rather than crashing the page.

## 5. Adding / removing presentation pages

Same answer as #3 — add or delete an entry in the `slides` array. Slide images should roughly
match a **3:4 (portrait) aspect ratio** for the best fit; anything else is automatically
letterboxed ("contain" fit) onto the page rather than stretched or cropped.

## 6. The in-browser texture editor (temporary previews only)

Click the **⚙ Edit** button (bottom of the screen) to open a small panel that lets you:

- Pick a slide from a dropdown and replace its image
- Replace the front cover, back cover, and spine images

These use `URL.createObjectURL()` on a file you pick locally, so you see the change on the 3D
book instantly.

**Important:** this is a live, in-memory preview only. Because this is a static site with no
server or database, there is nothing to write the image back to — closing or reloading the tab
discards it. To make a change permanent:

1. Save the real image file into `assets/slides/` or `assets/book/`.
2. Update the matching path in `js/presentation.js`.
3. Commit and push.

## 7. Deploying with GitHub Pages

No build, no install, no `dist/` folder. Just:

```bash
git add .
git commit -m "Update presentation"
git push
```

Then, in the GitHub repository: **Settings → Pages → Source**, choose the branch you pushed
(typically `main`) and the root folder, and save. GitHub Pages will serve `index.html` as-is.
The included `.nojekyll` file stops GitHub from running its default Jekyll processing over the
site (which could otherwise interfere with the `js/` and `assets/` folders).

`npm` / Node.js are not needed at any point in this workflow — there is nothing to install.

## Controls

| Action | How |
|---|---|
| Next slide | Right arrow, Space, or the "Next" button |
| Previous slide | Left arrow, or the "Previous" button |
| Open/close the texture editor | "⚙ Edit" button |

The camera is fixed at a single 3/4 angle — it never rotates or zooms on drag/scroll, and it
only ever repositions itself automatically on window resize, to keep the whole book in frame at
any aspect ratio. Clicking directly on the book to turn a page is implemented but disabled by
default (`ENABLE_CLICK_TO_NAVIGATE` in `js/ui.js`) — navigation only happens via the buttons and
keyboard.

## The book as bookends

The presentation navigates cover-to-cover, not just through the `slides` array: the closed front
cover is the first "slide", the closed back cover is the last, and your content sits in between.
Pressing Next from the very start swings the front cover open (a rigid hinge, unlike the bending
pages) to reveal `slides[0]`; pressing Next past the last slide swings the last page over to
reveal the closed back cover. No extra configuration is needed for this — it's driven by the
same `slides` array and `bookConfig` described above.

## Notes on the implementation

- The book (covers, spine, pages, page stacks) is built entirely from procedural Three.js
  geometry — there's no `.glb`/`.gltf` model to load.
- The turning page is a subdivided plane whose vertices are bent every frame with a small
  trig-based deformation (curl increases toward the outer edge, peaks mid-turn, and flattens
  out at both ends) — not a rigid rotation. It has a hair of real thickness, with separate
  front/back materials so both sides render correctly and never appear mirrored. The front cover
  itself, by contrast, swings rigidly (no bend) since it's a stiff board, not a sheet of paper.
- Only a handful of slide textures are kept in memory at a time (a small cache around the
  current slide); everything else is composited on demand and disposed when it scrolls out of
  that window, so the site stays light even with a large `slides` array.
- If reduced motion is requested at the OS/browser level, the page-turn animation shortens and
  loses most of its curl, but navigation itself keeps working.
- If WebGL can't initialize at all, the page shows a plain-language message instead of a blank
  screen.
