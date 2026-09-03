# Atelier Exhibition — 3D Interactive Book Presentation

A pure static, zero-build 3D book presentation website built with vanilla HTML, CSS, JavaScript, and Three.js (loaded directly via browser ES modules). Features realistic paper-bending page turns, curatorial lighting transitions, slide inspection, and smooth constrained spatial perspective.

Designed for instant deployment to **GitHub Pages** without `npm`, Node.js, or build steps.

---

## Architecture Overview

This project is a 100% pure client-side web application. It requires no compilers, bundlers, or server-side runtimes.

```text
├── index.html            # Main markup matching the curatorial Stitch design
├── styles.css            # Vanilla CSS styling with typographic & color tokens
├── .nojekyll             # Tells GitHub Pages not to process files with Jekyll
├── js/
│   ├── config.js         # Presentation configuration (slides, covers, titles)
│   ├── book.js           # Procedural Three.js 3D book & bending page physics
│   ├── presentation.js   # State manager & Web Audio paper rustle synthesizer
│   ├── ui.js             # UI controls, hotspots, camera sliders & file previews
│   └── main.js           # Application entry point & WebGL initialization
└── assets/
    ├── book/             # Hardcover textures (front, back, spine, travertine)
    └── slides/           # Presentation slide images (slide-01.jpg, etc.)
```

### Key Technical Features

1. **Procedural 3D Book Geometry**:
   - Custom hardcover front and back boards with debossed gold foil cloth texture.
   - Curved cloth-bound spine.
   - Dynamic page stacks (paper blocks) that subtly change thickness as spreads are turned.
   - Travertine stone pedestal base with soft contact shadows.

2. **Inextensible Page Bending Mechanics**:
   - Subdivided mesh with procedural vertex deformation.
   - Non-rigid paper curl: outside edge lifts first, curvature arches across the spine at mid-turn, and unrolls smoothly to rest flat.
   - Supports forward (right-to-left) and backward (left-to-right) navigation.
   - Preserves correct texture orientation on the reverse side (no mirrored text or images).

3. **Curatorial Lighting & Perspective**:
   - Toggle between **Daylight** (soft neutral overhead museum daylight) and **Chiaroscuro** (dramatic evening raking light).
   - Constrained orbit interaction preventing disorientation.
   - One-click **Isometric** camera reset.

4. **Tactile Rag Rustle Audio**:
   - Procedurally synthesized paper friction sound via the Web Audio API (no external MP3/WAV audio files required).

---

## How to Customize

### 1. Adding Slides
1. Export your slides from PowerPoint, Keynote, or Figma as JPG, PNG, or WebP images (recommended ratio: ~3:4, e.g. 1200×1600px).
2. Save your images into `./assets/slides/`:
   ```text
   assets/slides/slide-13.jpg
   assets/slides/slide-14.jpg
   ```
3. Open `js/config.js` and append your new slide paths to the `slides` array:
   ```javascript
   slides: [
     "./assets/slides/slide-01.jpg",
     ...
     "./assets/slides/slide-13.jpg",
     "./assets/slides/slide-14.jpg"
   ]
   ```
4. In `js/config.js`, add a corresponding spread entry in the `spreads` array pairing the left and right slides:
   ```javascript
   {
     id: 7,
     leftSlideIndex: 12,
     rightSlideIndex: 13,
     title: "Plate XIII & XIV — The Terrace",
     subtitle: "South-facing solar colonnade",
     annotation1: "Archival silver gelatin print.",
     annotation2: "Monolithic slab transition."
   }
   ```

### 2. Removing Slides
1. Remove unwanted image paths from the `slides` array in `js/config.js`.
2. Remove or adjust the corresponding entries in the `spreads` array.
3. The page indicators (`04 / 12 Spreads`) and navigation boundaries update automatically.

### 3. Replacing Book Covers & Pedestal
Replace the images in `./assets/book/`:
- `cover-front.jpg`: Outside front cover
- `cover-back.jpg`: Outside back cover
- `spine.jpg`: Outside cloth spine
- `travertine.jpg`: Pedestal stone material

All paths in `js/config.js` are strictly relative (`./assets/...`) so they load correctly under custom domains or GitHub Pages subdirectories.

### 4. Temporary Live Image Preview System
You can test replacement images directly in the running browser without editing files:
1. Click **Book Spec & Inspector** in the top-right toolbar.
2. In the **Slide Texture Preview** section, choose a slide from the dropdown.
3. Click **Select Replacement Image** and choose an image from your computer.
4. The texture will update immediately on the 3D book leaf using browser `URL.createObjectURL()`.
5. When satisfied, copy the image to `./assets/slides/` and commit to make it permanent.

---

## Local Development

To run locally, start any static HTTP server in the repository root:

### Using Python 3:
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your web browser.

### Using Node / npx (optional):
```bash
npx serve .
```

---

## Deploying to GitHub Pages

1. Create a repository on GitHub (e.g. `atelier-3d-book`).
2. Push all files from this project to the `main` branch.
3. On GitHub, navigate to **Settings** → **Pages**.
4. Under **Branch**, select `main` and root `/`.
5. Click **Save**.
6. GitHub Pages will publish your site at:
   ```text
   https://<your-username>.github.io/<repository-name>/
   ```
   Because all paths are strictly relative (`./styles.css`, `./js/...`, `./assets/...`), the site works out of the box with no extra configuration.

---

## Keyboard Shortcuts

- **→ (Right Arrow)** or **Space**: Next folio page
- **← (Left Arrow)**: Previous folio page
- **Esc**: Close Curatorial Inspector drawer
