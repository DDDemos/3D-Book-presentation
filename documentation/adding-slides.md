# Add and manage slides

[Documentation index](README.md) · [Links and text](adding-links-and-text.md)

## 1. Prepare the image

Export your slide as an upright landscape image, preferably 16:9, such as 1920 × 1080.
Use a browser-readable image such as PNG or JPG. Save it in `assets/slides/`, for example:

```text
assets/slides/building-your-first-app.jpg
```

Use the exact filename and extension in the configuration, including capitalization.
Descriptive names are fine; filenames do not determine the slide order or number.

Do not rotate the artwork or add the book's paper texture to it. The application rotates
it to match the landscape camera and composes it over the shared paper automatically.
The visible page is 4:3, so a 16:9 image has extra paper above and below it. Artwork is fitted
without cropping or stretching, with a 6% page margin. Transparent image areas reveal the
paper; an opaque background in your image covers it.

## 2. Register the slide

Open [js/presentation.js](../js/presentation.js). Find `export const slides = [` near the
top. Add the following object after an existing slide, before the array's closing `];`:

```js
{
  src: "./assets/slides/building-your-first-app.jpg",
  title: "Building your first app",
  description: "A diagram showing the steps from an idea to a working application.",
},
```

This is an array entry, not a second `slides` declaration. Keep a comma between every pair
of objects. Replace the example description with text that actually describes your artwork.

- `src` identifies the image. Paths starting with `./assets/` are relative to the served
  presentation page, not to the `js/` directory.
- `title` supplies the Index hover/focus name, reading-view heading, and resource-panel
  heading. A missing or blank title becomes “Slide N.”
- `description` is optional plain text shown in reading view. Include an equivalent of
  important image text or meaning; the application does not transcribe images.
- `resources` is optional. Follow the [links and text guide](adding-links-and-text.md) to
  attach a website or copyable prompt to this same object.

The array's first object is Slide 1, the next is Slide 2, and so on. Front and back covers
are added separately from `bookConfig`; do not put them in the `slides` array. Index entries,
the counter, and the book's page count are generated automatically. No HTML changes are needed.

## 3. Save and preview

From the project root, run the local server if one is not already running:

```sh
python3 -m http.server 8000
```

Open `http://localhost:8000`, or reload that page if it is already open. Do not open
`index.html` directly as a file. There is no build command or package installation.

Open **Index**, select the new number, and check the title by hovering or focusing it.
Confirm the artwork is upright and complete. Switch to **Reading view** and check its
title and description. Visit the previous/next slide and the back cover to check the order.

## Replace, reorder, or remove a slide

To replace artwork, save the new image and change that object's `src`. You can also replace
the existing image file at the same path; reload the page afterward. Update its title and
description if the topic changes.

To reorder, cut and paste the **entire object**, from its opening `{` through its closing
`},`, to another position inside `slides`. Include its nested `resources` array so the image,
prompt, and website move together. You do not need to rename the asset files. Numbers are
reassigned after reload; explicitly configured titles keep their text.

To remove a slide, delete its whole object. Delete its asset files only if no other slide
uses them. An empty `slides` array still supports front and back covers.

Configuration is read when the page starts. Reload after editing; modifying an array in
the browser console is not the supported way to rebuild the deck.

## Common problems

- **No new Index entry:** check that the object was added inside `slides`, then reload.
  Copying an image into the folder alone does not register a slide.
- **Placeholder or “Image unavailable”:** check the exact path, case, and extension.
  Try opening `http://localhost:8000/assets/slides/your-filename.jpg` directly.
- **The page stops initializing:** check for a missing comma, quote, or closing brace in
  `presentation.js`. The browser console can show the syntax error's location.
- **Old image still appears:** reload without cache, or give the replacement a new filename
  and update `src`.
- **Changes made using Edit disappear:** the dev editor previews images only until reload.
  For permanent changes, save the actual assets and configuration files. Leave `DEV_MODE`
  false unless you want those temporary editing controls.

When updating a hosted copy, include both `js/presentation.js` and the new image/text files
in the repository changes used by your existing deployment.
