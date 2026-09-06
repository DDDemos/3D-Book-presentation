# Add website links and copyable text

[Documentation index](README.md) · [Adding slides](adding-slides.md)

Each slide can show one website, one text resource, or both. Attach them inside that slide's
`resources` array in [js/presentation.js](../js/presentation.js). This explicit association
keeps the content together when you move the slide. Names and page numbers are not used to
find matching files.

## Add a website

1. Find the slide object you want to attach the website to.
2. Add a `resources` array inside its braces, or add the URL item to its existing array.
3. Set `label` to the visible heading and `url` to the complete HTTP or HTTPS address:

   ```js
   resources: [
     {
       type: "url",
       label: "Open the example website",
       url: "https://example.com",
     },
   ],
   ```

4. Save, reload, and navigate to the slide. The URL has a copy icon and an external-link
   icon. Copy keeps the configured URL; the external-link icon opens a new tab.

Include `https://` or `http://`; a bare `example.com` is not a valid external-link address.
Unsupported addresses remain copyable but do not get an external-link action.

## Add a prompt or other text

1. Create a plain-text file in `assets/text/`, for example `first-app-prompt.txt`.
2. Paste the complete text into it and save as UTF-8. Keep all the paragraphs, indentation,
   and line breaks you want copied. A 1,000-word prompt can go in a single file; you do not
   need to truncate it yourself. Use a text editor, not a Word document renamed to `.txt`.
3. In the intended slide's `resources` array, add:

   ```js
   {
     type: "text",
     label: "Build your first app",
     src: "./assets/text/first-app-prompt.txt",
   },
   ```

4. Save both files and reload. Open the slide and wait for the text to load.
5. Click its copy icon, wait for **Copied**, and paste into a text editor to check the whole
   prompt. If it is long, use **Show full text** to read the full scrollable version.

The text is literal: HTML, Markdown, and code are not executed or formatted. The application
preserves the full loaded text, including whitespace, when copying. Only the preview is
limited to about eight lines; a bottom fade appears when it overflows. `description` is
separate reading-view metadata and does not become a copyable prompt.

## Put both on the same slide

This is a complete slide object to insert into the existing `slides` array. Create the
image and text files at these example paths first, or change the paths to your own files:

```js
{
  src: "./assets/slides/building-your-first-app.jpg",
  title: "Building your first app",
  description: "The first exercise: use a prompt to build a small application.",
  resources: [
    {
      type: "url",
      label: "Example website",
      url: "https://example.com",
    },
    {
      type: "text",
      label: "Build your first app",
      src: "./assets/text/first-app-prompt.txt",
    },
  ],
},
```

The website always appears above the text, regardless of array order. Both are visible
together, with separate copy icons. Configure at most one item of each type; if you supply
more, only the first URL and the first text item are displayed. A URL written inside a
prompt remains ordinary text; add a `type: "url"` item to get the external-link icon.

The [README example](../README.md#prompts-text-and-website-links) demonstrates both using
[example-prompt.txt](../assets/text/example-prompt.txt) and example.com. The active workshop
deck contains image pages; attach resources explicitly to add copy and external-link controls.

## Update or remove resources

To change a prompt, edit its `.txt` file or change the item's `src`. To change a website,
edit `url`. Edit `label` to change either heading. Successful text loads are cached for
the current page session, so reload after updating a file; navigating away and back is
not enough. If the browser still serves an old file, reload without cache or rename it
and update the path.

Remove an item to keep only the website or only the text. Remove `resources`, or use
`resources: []`, to remove the panel entirely. To move the resources to another slide,
move their objects into that slide's array. To reorder slides while keeping associations,
move each whole slide object, including its resources.

## Check the result

- The toolbar's panel icon hides or restores the resources. Hiding persists across slides
  and reading/3D switches until restored, and resets on reload. If a configured resource is
  missing from view, check this toggle. Its full text remains available when shown again.
- On desktop widths above 960px, the panel sits to the right of the book. On narrower
  screens it sits below; scroll the presentation area to reach it.
- Check the panel heading matches the slide, then navigate to a slide without resources
  and confirm its panel disappears. Also try an Index jump and **Reading view**.
- Check each icon's tooltip and keyboard access. Website actions remain usable while
  text is loading, including if that text fails to load.
- If text shows **Retry**, check its path and capitalization, save the file, and retry.
  Failed requests and the 10-second timeout do not block slide navigation. Keep files
  alongside the presentation to avoid cross-origin fetch restrictions.
- If copying is denied, the full text is selected in a manual-copy field. Use your
  device's normal copy command. Automatic clipboard access normally needs HTTPS or
  localhost and browser permission.
