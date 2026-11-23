# API reference

Everything a scene script can call. A scene script is an ES module:

```js
export default ({ scene, recipes, shapes }) => {
  const s = scene({ look: 'ocean' });
  // ...
  return s;
};
```

Contents: [scene](#scene) · [looks](#looks) · [objects](#objects) · [custom objects](#custom-objects) · [layout helpers](#layout-helpers) · [links](#links) · [zones, floor text, callouts](#zones-floor-text-callouts) · [story](#story) · [ambient motion](#ambient-motion) · [command line](#command-line) · [using the engine from code](#using-the-engine-from-code)

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
| `look` | picked from the title | A palette name (see [looks](#looks)). `theme` is accepted as a synonym |
| `finish` | the palette's own | `solid` `soft` `outline` `line` `flat` `neon` |
| `floor` | the palette's own | `grid` `dots` `plate` `rings` `none` |
| `palette` | | Your own colours instead of a named look: `{ bg, accent, accent2, surface, ink }`. `bg` and `accent` are required; a dark `bg` gives a dark look |
| `accent`, `accent2` | from the look | Hex colours that replace the look's two accents and keep everything else. The usual way to apply one brand colour |
| `detail` | `'rich'` | `'clean'` drops the small cues (sockets, trails, bursts, motes) for small components |
| `haze` | from the look | `false` to turn the depth haze off, or a strength from 0 to 0.4 |
| `title` | | Accessible name of the image. It is not drawn; use `heading` for visible text |
| `desc` | from labels | Accessible long description |
| `heading`, `subheading` | | Visible title block at the top-left |
| `background` | `true` | `false` makes the scene transparent, to sit on the page's own surface |
| `bg` | from the look | A hex colour for a flat background, to match a known surface such as a white card |
| `grid` | from the floor | `true`, `false`, `'lines'` or `'dots'`: overrides the floor's pattern |
| `aspect` | natural | Pad the frame to a ratio: `'16:9'`, `'1:1'`, `'4:3'`, or a number. Adds margin only; the scene keeps its size |
| `pad` | `56` | Margin around the content, in viewBox units (pixels at natural size): a number, `[sides, top-and-bottom]` or `[top, right, bottom, left]`. The frame is cropped to objects at rest, so widen it when a part swings or travels beyond its object |
| `loop` | story length | Minimum loop length in seconds |
| `intro` | `true` | Objects rise into place once when the image loads |
| `shadows` | `true` | Ground shadows |
| `font` | system sans | `'mono'`, `'serif'`, `'round'`, or any CSS `font-family` |
| `id` | from content | Prefix for ids inside the SVG |

## Looks

A look is a palette, a finish and a floor. Any combination is valid.

| Palette | Natural finish / floor | Mood |
| --- | --- | --- |
| `aurora` | solid / grid | technology, night, glow |
| `carbon` | solid / dots | hardware, serious, industrial |
| `abyss` | solid / rings | deep sea, data, calm intensity |
| `plum` | soft / plate | creative, nightlife, bold |
| `forest` | solid / plate | nature, sustainability, growth |
| `ember` | flat / none | warmth, craft, energy |
| `ocean` | solid / grid | trust, networks, scale |
| `noir` | outline / dots | editorial, stark, cinematic |
| `blueprint` | outline / grid | plans, engineering, schematics |
| `neon` | neon / grid | futuristic, electric |
| `paper` | outline / dots | documentation, clarity, technical |
| `studio` | line / none | product, minimal, precise: white forms, hairlines, one colour |
| `mono` | outline / none | print, formal, minimal |
| `clay` | soft / none | friendly product, calm, premium |
| `sunset` | flat / none | optimistic, people, marketing |
| `mint` | soft / plate | fresh, health, sustainability |
| `sand` | solid / plate | craft, travel, heritage |
| `sky` | solid / grid | open, airy, trustworthy |
| `blossom` | soft / rings | care, community, lifestyle |
| `lemon` | flat / dots | playful, education, poster |
| `slate` | outline / grid | reports, operations, neutral |
| `grape` | flat / plate | imaginative, playful tech |

The first ten are dark, the rest light.

| Finish | Surfaces |
| --- | --- |
| `solid` | Three shaded tones with a rim light. The all-round choice |
| `soft` | Rounder, lower contrast, diffuse shadows. Friendly and premium |
| `outline` | Shaded tones inside ink outlines. Technical and editorial |
| `line` | Near-white surfaces drawn in hairlines; only accent-coloured parts carry colour. Minimal, for vignettes and product pages |
| `flat` | Poster tones with long hard shadows. Bold and graphic |
| `neon` | Dark surfaces with glowing edges. Needs a dark palette |

With `palette: { bg, accent }` every other tone (surfaces, ink, text, shadows, state colours) is derived from those two; a dark `bg` gives a dark look.

When neither `look` nor `palette` is given, a palette is picked from the scene's `title` so that different subjects look different, and the report asks you to choose one deliberately.

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
| `info` | One or two sentences about the object. Shown as a card on hover or tap in the interactive output, and stored in the SVG as `data-info` |
| `hidden` | Start invisible; reveal with `s.pop` or `s.show` |
| `level` | `0` to `1`: how much of the object stands above the floor at the start; the rest is sunk out of sight. `level: 0` with `s.grow` makes it rise out of the floor. Suits flat-topped objects (`bars`, `building`, `cylinder`, `cube`, `stack`, `database`); for others use `hidden` and `s.pop` |
| `float` | `true` or `{ amp, period }`: hover gently |
| `glow` | `true` or a colour: light the floor under it |
| `badge` | A number or short text shown as a chip beside the label |
| `shadow` | `false` removes its shadow |
| `opacity` | `0` to `1`: a see-through object. Glass, something starting up, something secondary |
| `ghost` | `true`: drawn faint with a dashed footprint and no shadow. Something planned, missing, removed or optional |
| `id` | Name used in the build report |

Colour roles: `body` `body2` `muted` `dark` `paper` `screen` (neutrals) · `accent` `accent2` (emphasis) · `ok` `warn` `danger` (state) · `gold`.

The handle exposes `x`, `y`, `z`, `w`, `d`, `h` (size in cells) and `top` (`[x, y, z]` of its top centre).

## Custom objects

```js
s.define('oven', (o, sh, K) => ({ parts: [ sh.box({ w: 1.5, d: 1.3, h: 1.2, color: o.color }) ] }));   // a new kind
s.add('oven', { at: [4.5, 0], label: 'Bakery' });
s.custom({ at: [9, 0], label: 'Crate', parts: (sh, K) => [ sh.box({ w: 1, d: 1, h: 0.7 }) ] });          // a one-off
s.svg('<circle cx="50" cy="50" r="46" fill="#f50"/>', { at: [0, 4], w: 1.2, h: 1.2 });                  // any SVG, upright
```

Shapes, face artwork and part animation are described in [custom.md](custom.md). Custom kinds accept every common option and work as tokens in `s.send(a, b, { as: 'oven', scale: 0.4 })`.

A builder may also return `w`, `d`, `h` (to override the measured size), `round: true` (a circular footprint) and `shadow: { w, d }`, `{ r }` or `{ soft: true }`. Without `shadow`, the shadow follows the floor outline of the object's still shapes, so an L-shaped object throws an L-shaped shadow.

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
| `flow` | | `true` or `{ count, speed, color }`: dots stream along the link continuously. `'alternate'` or `{ alternate: true, period, swing, phase }`: the dots rock to and fro in step instead (alternating current, a tide, a two-way exchange); `swing` is how far each way, in cells |
| `label` | | Small caption at the middle |
| `dim` | | Draw the line fainter, for secondary links. Its label keeps full strength |
| `color`, `width` | from the look | Overrides |
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
s.callout([0, 0, 2], 'Coil', { rise: 70, length: 40 });                // text lifted 70 px clear of the point
```

Callouts name the parts of one object, where labels name whole objects. `side` is `'right'` or `'left'`; `rise` lifts the text above the point (negative lowers it) and `length` sets how far the leader runs sideways, both in pixels. Use them to move text onto empty background.

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
| `s.move(obj, [x, y], o)` | `speed`, `ease` | Slide the object across the floor to a new place and leave it there. Its label and shadow travel with it. It keeps its original place in the depth order, so move it across open floor rather than behind other objects |
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
- `anim` on a shape or a piece of face artwork in a custom object: `blink`, `spin`, `march`, `ring`, `move`, `swing`, `keys`. See [custom.md](custom.md#moving-parts).
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
| `--look NAME` `--finish NAME` `--floor NAME` | Build with another look without editing the script |
| `--looks [a,b,c]` | Also write `<name>.looks.png`: the scene in several looks side by side. Each entry is `palette`, `palette:finish` or `palette:finish:floor`. Without a list, six varied palettes |
| `--experience [loop\|step\|scroll]` | Also write `<name>.experience.html`: an interactive page with controls, chapters and hover cards |
| `--no-html` | Skip the preview page |
| `--strict` | Exit with code 2 when the report contains FIX THESE items |
| `--list` | Print every kind, option, icon, look, finish, floor, colour role, token and recipe |

`node SKILL_DIR/scripts/render.mjs <file>.svg --png | --sheet | --mp4 | --gif | --webm` rasterises an SVG that is already built.

Raster output uses Playwright or Puppeteer when the project has one, otherwise any Chrome, Chromium or Edge binary (set `CHROME_PATH` if it is not on `PATH`). Video needs ffmpeg.

## Using the engine from code

The engine is plain ES modules with no dependencies. It runs in Node and in the browser.

```js
import { scene } from 'SKILL_DIR/scripts/isokit.mjs';

const s = scene({ look: 'paper' });
// ... add, link, story ...
const { svg, width, height, loop, notes } = s.build();   // notes: [{ level, code, msg }]
document.querySelector('#stage').innerHTML = svg;         // or fs.writeFileSync('out.svg', svg)
```

Building is deterministic: the same script always yields the same SVG.

## What the checker covers

The review sheet (`--sheet`) shows each frame on the scene's own background; a scene built with `background: false` is shown on white or near-black to match its look. Add `--frames 12` when something quick, such as a burst of tokens, falls between the frames.

The report is produced from the scene's geometry: objects that intersect, links that run under objects or kink, labels that collide, hidden objects never revealed, crowding, missing focal point, missing motion, extreme proportions and over-long loops. It does not judge whether the picture makes its point, and it does not inspect every frame of the animation. Use the sheet or the preview for that.
