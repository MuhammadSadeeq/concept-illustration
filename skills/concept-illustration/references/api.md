# API reference

Everything a scene script can call. A scene script is an ES module:

```js
export default ({ scene, recipes }) => {
  const s = scene({ theme: 'aurora' });
  // ...
  return s;
};
```

Contents: [scene](#scene) · [objects](#objects) · [layout helpers](#layout-helpers) · [links](#links) · [zones, floor text, callouts](#zones-floor-text-callouts) · [story](#story) · [ambient motion](#ambient-motion) · [command line](#command-line) · [using the engine from code](#using-the-engine-from-code)

## Coordinates

- Units are grid cells. One cell is 40 units of the SVG's `viewBox`; a label is 14 units tall.
- `+x` runs toward the lower-right of the picture, `+y` toward the lower-left, `z` is up.
- The viewer looks from `(+x, +y, +z)`. Larger `x + y` is nearer the viewer and is drawn in front.
- `at: [x, y]` is the centre of an object's footprint. `at: [x, y, z]` also lifts it.
- The picture is cropped to its content automatically. Coordinates may be negative.

## scene

`scene(options)` creates a scene.

| Option | Default | Meaning |
| --- | --- | --- |
| `theme` | `'aurora'` | `aurora` `carbon` `paper` `mono` `clay` `sunset` `blueprint` |
| `accent`, `accent2` | from theme | Hex colours that replace the theme's two accents |
| `title` | | Accessible name of the image. It is not drawn; use `heading` for visible text |
| `desc` | from labels | Accessible long description |
| `heading`, `subheading` | | Visible title block at the top-left |
| `background` | `true` | `false` makes the scene transparent, to sit on the page's own surface |
| `bg` | from theme | A hex colour for a flat background, to match a known surface such as a white card |
| `grid` | from theme | `true`, `false`, `'lines'` or `'dots'` |
| `aspect` | natural | Pad the frame to a ratio: `'16:9'`, `'1:1'`, `'4:3'`, or a number. Adds margin only; the scene keeps its size |
| `pad` | `56` | Margin around the content, in viewBox units |
| `loop` | story length | Minimum loop length in seconds |
| `intro` | `true` | Objects rise into place once when the image loads |
| `shadows` | `true` | Ground shadows |
| `font` | system sans | A CSS `font-family`, or `'mono'` |
| `id` | from content | Prefix for ids inside the SVG |

## Objects

`s.add(kind, options)` places an object and returns a handle. Kinds and their own options are in [kit.md](kit.md).

Options every kind accepts:

| Option | Meaning |
| --- | --- |
| `at` | `[x, y]` or `[x, y, z]` |
| `on` | Another object: stand centred on top of it |
| `z` | Extra lift, in cells |
| `scale` | Uniform size factor |
| `label`, `sub` | Label and smaller second line |
| `labelSide` | `'below'` (default) `'above'` `'left'` `'right'`. Without it, the side with free room is chosen |
| `hero` | The focal object: accent colour and a pool of light |
| `color` | Surface colour: a role or a hex |
| `accent` | Detail colour (lights, icons): a role or a hex |
| `hidden` | Start invisible; reveal with `s.pop` or `s.show` |
| `level` | `0` to `1`: how much of the object stands above the floor at the start. `level: 0` with `s.grow` makes it rise |
| `float` | `true` or `{ amp, period }`: hover gently |
| `glow` | `true` or a colour: light the floor under it |
| `badge` | A number or short text shown as a chip beside the label |
| `shadow` | `false` removes its shadow |
| `id` | Name used in the build report |

Colour roles: `body` `body2` `muted` `dark` `paper` `screen` (neutrals) · `accent` `accent2` (emphasis) · `ok` `warn` `danger` (state) · `gold`.

The handle exposes `x`, `y`, `z`, `w`, `d`, `h` (size in cells) and `top` (`[x, y, z]` of its top centre).

## Layout helpers

Each returns an array of `[x, y]` positions.

```js
const [p1, p2, p3] = s.row(3, { at: [0, 0], gap: 4.5, axis: 'x' });   // axis 'x' or 'y'
const cells = s.grid(3, 2, { at: [0, 0], gap: [4.5, 4] });            // row by row
const around = s.ring(5, { at: [0, 0], r: 4.6, start: -90 });          // degrees
```

## Links

`s.link(a, b, options)` draws a connector on the floor and returns a handle. `a` and `b` are objects or points `[x, y]`.

| Option | Default | Meaning |
| --- | --- | --- |
| `style` | `'line'` | `'line'` `'dashed'` `'dotted'` `'pipe'` (thick tube) `'road'` (asphalt with a centre line) |
| `arrow` | `true` | `true` (at b), `'both'`, `false` |
| `route` | `'auto'` | `'auto'` straight when aligned, otherwise one or two turns · `'x'` leave along x then turn · `'y'` leave along y then turn · `'straight'` a direct diagonal |
| `via` | | Waypoints `[[x, y], ...]` to steer around something |
| `arc` | | `true` or a height in cells: a hop through the air from top to top |
| `flow` | | `true` or `{ count, speed, color }`: dots stream along the link continuously |
| `label` | | Small caption at the middle |
| `dim` | | Draw the line fainter, for secondary links. Its label keeps full strength |
| `color`, `width` | from theme | Overrides |
| `z` | `0` | Height of the route above the floor |

One link serves both directions: `s.send(b, a)` rides a link drawn with `s.link(a, b)`.

A link that meets an object on a far side stops where the object's outline begins, so its arrowhead stays visible.

## Zones, floor text, callouts

```js
s.zone({ around: [a, b], label: 'PRIVATE NETWORK', style: 'outline', pad: 0.8 });
s.zone({ from: [0, 3], to: [9, 6], style: 'plate', color: 'muted' });
```

Zone styles: `'plate'` (a raised slab), `'outline'`, `'dashed'`, `'tint'`. The label lies on the floor along whichever edge is free.

```js
s.text('STAGING', { at: [0, 2.2], size: 0.42 });        // text lying on the floor, reading along x
s.callout([4.5, 0, 1.9], 'Hot path', { sub: '2 ms', side: 'right' });   // leader line to a point in space
```

## Story

`s.story(steps, options)` defines one loop. `steps` is an array: items run in order; a nested array runs its items together; an array nested inside that runs in order again.

```js
s.story([
  s.send(a, b),
  [s.send(b, c), s.send(b, d)],          // together
  [[s.send(c, e), s.pulse(e)], s.glow(d)], // a sequence running beside a single step
  s.wait(1),
]);
```

Story options: `speed` (cells per second for tokens, default 3.4), `gap` (pause between steps, default 0.12), `hold` (pause before the loop restarts, default 0.9).

| Step | Options | What it shows |
| --- | --- | --- |
| `s.send(a, b, o)` | `as` token, `color`, `label`, `count`, `stagger`, `speed`, `arc`, `route`, `via`, `stay`, `id`, `scale`, `react: false` | A token travels a to b. It follows the link between them (in either direction); with no link it crosses open floor and the report says so. `label` is a word that rides above the token once it has left the sender. The receiver gives a small bounce on arrival |
| `s.pulse(obj, o)` | `color` | Ripple on the floor and a bounce |
| `s.glow(obj, o)` | `color`, `keep: true` | Floor light fades in, holds, fades out (or stays with `keep`) |
| `s.tint(obj, color)` | | Cross-fade to another colour until the loop restarts |
| `s.mark(obj, icon, o)` | `color`, `keep: false` | Badge pops above the object and stays until the loop restarts |
| `s.pop(obj)` | | Reveal a `hidden` object with a spring |
| `s.show(obj)`, `s.hide(obj)` | | Fade in, fade out |
| `s.grow(obj, to)` | | Rise out of the floor to the fraction `to` (default 1) of its height. Create the object with `level: 0`. A lower `to` sinks it again |
| `s.lift(obj, dz)`, `s.drop(obj)` | | Raise by `dz` cells and stay; return |
| `s.shake(obj)` | | Quick side-to-side shake |
| `s.say(text)` | | Set the caption. Takes no time; the caption stays until the next `say` |
| `s.wait(seconds)` | | Hold |

Every step also accepts `dur` (seconds) and `delay` (seconds after its normal start; useful inside a parallel group to stagger).

Tokens for `as`: `dot` (default, glowing) `doc` `cube` `box` `coin` `mail` `gem`, or any kit kind (`'truck'`, `'user'`, `'package'`, ...). `scale` resizes any token: built-in tokens default to 1, kit kinds to 0.5.

`count` sends that many tokens in a row, `stagger` seconds apart (default 0.22): a burst, a batch, a stream.

`stay: true` keeps a token at its destination. Give successive hops of one traveller the same `id` so each hop replaces the last:

```js
s.send(a, b, { as: 'user', stay: true, id: 'traveller' }),
s.send(b, c, { as: 'user', stay: true, id: 'traveller' }),
```

Whatever a story changes (colour, visibility, height) returns to its starting state in the last half second of the loop, so the loop is seamless.

## Ambient motion

Motion that runs independently of the story:

- `float: true` on an object, or `s.float(obj, { amp: 7, period: 4 })`: a slow hover. Use on the hero or on things that really hang in the air. More than three floating objects makes a scene restless.
- `flow: true` on a link: a continuous stream of dots.
- Some kinds animate by themselves: status lights on `server`, eyes on `robot`, `gear` rotation, `clock` hands, `conveyor` belt, `antenna` rings, `sun` rays, typing dots on `bubble`.

Ambient periods are snapped so the whole picture repeats exactly once per loop: exported GIFs and videos loop without a jump.

## Command line

```bash
node SKILL_DIR/scripts/build.mjs <file>.scene.mjs [options]
```

| Option | Effect |
| --- | --- |
| `--out DIR` | Write outputs to DIR (default: next to the script) |
| `--sheet` `--frames N` | Also write `<name>.sheet.png`: up to N frames (default 8) taken at the story's key moments |
| `--png` `--at SEC` `--scale N` | Also write `<name>.png`. Without `--at` it shows the resting state |
| `--mp4` `--gif` `--webm` | Also write a video of one loop. `--fps 30` `--width 1280` `--loops 1` `--intro` |
| `--theme NAME` | Build with another theme without editing the script |
| `--no-html` | Skip the preview page |
| `--strict` | Exit with code 2 when the report contains FIX THESE items |
| `--list` | Print every kind, option, icon, theme, colour role, token and recipe |

`node SKILL_DIR/scripts/render.mjs <file>.svg --png | --sheet | --mp4 | --gif | --webm` rasterises an SVG that is already built.

Raster output uses Playwright or Puppeteer when the project has one, otherwise any Chrome, Chromium or Edge binary (set `CHROME_PATH` if it is not on `PATH`). Video needs ffmpeg.

## Using the engine from code

The engine is plain ES modules with no dependencies. It runs in Node and in the browser.

```js
import { scene } from 'SKILL_DIR/scripts/isokit.mjs';

const s = scene({ theme: 'paper' });
// ... add, link, story ...
const { svg, width, height, loop, notes } = s.build();   // notes: [{ level, code, msg }]
document.querySelector('#stage').innerHTML = svg;         // or fs.writeFileSync('out.svg', svg)
```

Building is deterministic: the same script always yields the same SVG.

## What the checker covers

The report is produced from the scene's geometry: objects that intersect, links that run under objects or kink, labels that collide, hidden objects never revealed, crowding, missing focal point, missing motion, extreme proportions and over-long loops. It does not judge whether the picture makes its point, and it does not inspect every frame of the animation. Use the sheet or the preview for that.
