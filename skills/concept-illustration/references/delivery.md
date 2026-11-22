# Delivery

How to hand over a finished scene and how it behaves once it is placed.

Contents: [what the build produces](#what-the-build-produces) · [placing the SVG](#placing-the-svg) · [frameworks](#frameworks) · [controlling playback](#controlling-playback) · [light and dark](#light-and-dark) · [raster and video](#raster-and-video) · [accessibility](#accessibility) · [size and performance](#size-and-performance) · [when Node is not available](#when-node-is-not-available)

## What the build produces

| File | What it is |
| --- | --- |
| `<name>.svg` | The deliverable. Self-contained: shapes, gradients and CSS animation in one file. No scripts, no external requests |
| `<name>.html` | A preview with play, pause, scrub and backdrop controls. For checking, not for shipping |
| `<name>.sheet.png` | Frames across the loop (`--sheet`). For checking motion |
| `<name>.png` | A still (`--png`). A poster, a social image, a fallback |
| `<name>.mp4` `.gif` `.webm` | One loop as video (`--mp4`, `--gif`, `--webm`) |
| `<name>.scene.mjs` | The source. Keep it with the output so the scene can be edited and rebuilt |

Tell the user which file to use where, and that the `.scene.mjs` is the editable source.

## Placing the SVG

**As an image.** Simplest and safest. Animates in every modern browser, in Markdown renderers and in GitHub READMEs.

```html
<img src="/img/how-a-cache-works.svg" alt="A cache answering requests so the origin does not have to" width="640" height="500" style="max-width:100%;height:auto">
```

```markdown
![How a cache speeds up a website](docs/how-a-cache-works.svg)
```

Set `width` and `height` to the size the build reports (or the same ratio) to avoid layout shift.

**Inline.** Paste the file's contents into the page when you need to style it, pause it, or let it use the page's web font. Ids inside each SVG are derived from its content, so several scenes can share a page without colliding.

```html
<figure class="illustration">
  <!-- contents of how-a-cache-works.svg -->
</figure>
<style>
  .illustration svg { width: 100%; height: auto; display: block; }
</style>
```

**As a CSS background.** Works, animates, but has no alternative text. Use only for decoration.

**In slides and documents.** Tools that cannot animate SVG show the resting state, which is designed to stand alone. For motion in slides, export `--mp4` or `--gif`.

## Frameworks

The SVG is static markup, so nothing has to run on the client.

**React / Next.js**: import it as an image, or inline it once at build time.

```jsx
import cache from './how-a-cache-works.svg';            // with the default image loader

export function CacheFigure() {
  return <img src={cache.src ?? cache} alt="How a cache speeds up a website" style={{ maxWidth: '100%', height: 'auto' }} />;
}
```

To inline in React, read the file on the server and render it with `dangerouslySetInnerHTML`; do not hand-convert the markup to JSX (hundreds of attributes would need renaming).

```jsx
import fs from 'node:fs';
const svg = fs.readFileSync('public/img/how-a-cache-works.svg', 'utf8');   // server component or build step
export const CacheFigure = () => <figure dangerouslySetInnerHTML={{ __html: svg }} />;
```

**Vue / Svelte / Astro**: `<img src>` as above, or the framework's raw import (`?raw`) with `v-html` / `{@html}` / `set:html`.

**Building scenes at runtime.** The engine is dependency-free ES modules and runs in the browser. Import `scripts/isokit.mjs`, build the scene in response to data or input, and assign `scene.build().svg` to an element. Use this for scenes that change with user input; for fixed illustrations ship the built SVG.

## Controlling playback

Inline SVGs can be controlled from the page.

```js
const svg = document.querySelector('.illustration svg');

// pause and resume
svg.classList.toggle('is-paused');

// play only while visible
new IntersectionObserver(([e]) => svg.classList.toggle('is-paused', !e.isIntersecting)).observe(svg);

// jump to a time in the loop (seconds)
const { loop, intro } = svg.dataset;
for (const a of svg.getAnimations({ subtree: true })) a.currentTime = (+intro + +loop + 2.5) * 1000;
```

`data-loop` holds the loop length and `data-intro` the length of the one-time entrance. To build without the entrance, pass `intro: false` to `scene()`.

An `<img>` cannot be paused from the page. To restart one, reassign its `src`.

## Light and dark

Build the scene twice and let the browser choose:

```bash
node SKILL_DIR/scripts/build.mjs cache.scene.mjs --look paper  --out img/light
node SKILL_DIR/scripts/build.mjs cache.scene.mjs --look aurora --out img/dark
```

```html
<picture>
  <source srcset="img/dark/cache.svg" media="(prefers-color-scheme: dark)">
  <img src="img/light/cache.svg" alt="How a cache speeds up a website">
</picture>
```

For a scene that must sit on an arbitrary surface, build with `background: false` and choose a palette whose text colour reads on that surface: a light palette on a light surface, a dark one on a dark surface.

## Raster and video

```bash
node SKILL_DIR/scripts/build.mjs cache.scene.mjs --png --at 4 --scale 2    # still at 4 s, 2× density
node SKILL_DIR/scripts/build.mjs cache.scene.mjs --mp4 --width 1920        # one loop, 30 fps
node SKILL_DIR/scripts/build.mjs cache.scene.mjs --gif --width 800         # for places that accept only GIF
node SKILL_DIR/scripts/build.mjs cache.scene.mjs --webm                    # keeps transparency when background: false
```

- Video frames are captured by seeking the animation, not by recording the screen, so they are exact and the loop closes without a jump. Add `--loops 2` to repeat, `--intro` to include the entrance.
- Pick `--at` for a poster where the story is at its most informative moment, usually just before the result.
- Raster output needs a browser engine. The tool looks for Playwright or Puppeteer in the project, then for a Chrome, Chromium or Edge binary (`CHROME_PATH` overrides). Video additionally needs `ffmpeg`. If neither is present, deliver the SVG and say so; do not fake a raster.

## Accessibility

- Always pass `title` to `scene()`: it becomes the SVG's accessible name. The description defaults to the list of labels; pass `desc` to write a better one that states the claim.
- With `<img>`, write an `alt` that says what the picture shows, not "illustration of".
- The SVG honours `prefers-reduced-motion`: animation stops and the resting state is shown, with travelling tokens parked on their routes.
- Captions are real text and can be selected and translated. Keep the same explanation in the surrounding page text, because a caption is only visible for part of the loop.
- Do not rely on colour alone for state: pair `s.tint(obj, 'ok')` with `s.mark(obj, 'check')`.
- Nothing strobes: state changes fade or spring in once and then hold.

## Size and performance

- A typical scene is 20 to 80 KB uncompressed and about a fifth of that with gzip or brotli.
- Animation uses only `transform`, `opacity` and `stroke-dashoffset`, which browsers composite cheaply.
- Soft shadows use an SVG blur filter. On pages with many scenes visible at once, pause the ones off screen (see above) or build with `shadows: false`.
- Each object adds 1 to 4 KB; a `building` or `browser` is at the high end.

## When Node is not available

The engine needs a JavaScript runtime. Without Node, run it in a browser instead: serve the skill folder and the scene over HTTP and open a page like this.

```html
<!doctype html>
<div id="stage"></div>
<script type="module">
  import { scene } from './scripts/isokit.mjs';
  const s = scene({ look: 'aurora', title: 'Example' });
  const a = s.add('laptop', { at: [0, 0], label: 'Client' });
  const b = s.add('server', { at: [4.5, 0], label: 'Server', hero: true });
  s.link(a, b);
  s.story([s.send(a, b), s.pulse(b), s.wait(1)]);
  const out = s.build();
  document.getElementById('stage').innerHTML = out.svg;
  console.table(out.notes);                       // the same report the command line prints
</script>
```

Save the generated markup (`document.querySelector('svg').outerHTML`) as the `.svg` deliverable.

If no JavaScript can run at all, do not attempt to hand-write isometric geometry at this level of finish. Say that the scene script is ready and needs one command to build, and give the user the script and the command.
