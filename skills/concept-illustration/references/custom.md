# Custom objects

The kit is a starting vocabulary. When the subject needs something it does not have (an oven, a syringe, a wind turbine, a product's own device), build it from the same shapes the kit is made of. A custom object gets the same lighting, shadows, labels and story steps as a built-in one.

Contents: [three ways in](#three-ways-in) · [shapes](#shapes) · [artwork on faces](#artwork-on-faces) · [moving parts](#moving-parts) (mechanisms and vignettes) · [your own SVG](#your-own-svg) · [worked examples](#worked-examples) · [making it look right](#making-it-look-right)

## Three ways in

```js
// 1. A reusable kind: define once, add many times, send as a token.
s.define('silo', (o, sh, K) => ({
  parts: [
    sh.cyl({ r: 0.6, h: 1.6, color: o.color }),
    sh.cone({ z: 1.6, r: 0.62, h: 0.5, color: 'accent' }),
  ],
}));
const a = s.add('silo', { at: [0, 0], label: 'Storage' });
s.send(a, b, { as: 'silo', scale: 0.3 });

// 2. A one-off object.
const crate = s.custom({ at: [4, 0], label: 'Crate', parts: (sh, K) => [sh.box({ w: 1, d: 1, h: 0.7, color: 'gold' })] });

// 3. Any SVG drawing, standing upright in the scene.
const logo = s.svg('<circle cx="50" cy="50" r="46" fill="#ff5a1f"/>', { at: [8, 0], w: 1.2, h: 1.2, label: 'Brand' });
```

The builder receives `o` (the options passed to `s.add`, with `color` and `accent` filled in), `sh` (the shapes below) and `K` (colours: `K.hex('accent')` gives a palette colour as hex, `K.mat('body').on` gives a readable ink colour for artwork on that surface, `K.theme.dark` tells you whether the look is dark).

Coordinates inside a builder are in grid cells **relative to the object's own origin**, which is the centre of its footprint on the floor. `x` runs toward the lower-right of the picture, `y` toward the lower-left, `z` up. Size is measured from the shapes; return `w`, `d`, `h` only to override it, and `round: true` for a circular footprint (rounder shadow and ripple).

## Shapes

| Shape | Call | Notes |
| --- | --- | --- |
| Block | `sh.box({ x, y, z, w, d, h, r, color, top, left, right })` | `x, y` is the centre of its footprint, `z` its underside. `w` along x, `d` along y, `h` up. `r` rounds the vertical edges. `top`, `left`, `right` take artwork |
| Cylinder | `sh.cyl({ x, y, z, r, h, color, top })` | Stands on its end. `x, y` is its centre, `z` its base |
| Upright slab | `sh.panel({ x, y, z, w, h, t, r, facing, color, face, outline })` | `x, y` is the centre of its bottom edge on the floor and `z` lifts it. `facing: 'left'` shows its front toward the lower-left, `'right'` toward the lower-right. `t` is thickness. `outline: [[a, b], ...]` replaces the rectangle with any flat shape (a across, b up, origin at bottom centre) |
| Extrusion | `sh.prism({ plane, at, outline, depth, color })` | Any outline pushed out of a plane: `'top'` rises from the floor, `'left'` comes toward the lower-left, `'right'` toward the lower-right |
| Ball | `sh.sphere({ x, y, z, r, color })` | `z` is the height of its centre |
| Cone or taper | `sh.cone({ x, y, z, r, r2, h, color })` | `r` at the bottom, `r2` at the top (0 for a point; larger than `r` for a funnel) |
| Faceted solid | `sh.mesh({ faces, color })` | Convex only. Each face is a list of `[x, y, z]` corners, counter-clockwise seen from outside |
| Thin line | `sh.wire({ points, color, width, dash })` | A cable, mast or beam through `[x, y, z]` points |
| Group | `sh.group({ parts, anim, sort })` | Shapes that move as one (`anim`), or that must be drawn in a fixed order (`sort: false`) |
| Light | `sh.glow({ x, y, z, r, color, strength })` | A soft ball of light at a point: a lit lamp, a spark, a hot spot. `r` is its reach in cells. Give it `anim: { type: 'blink' }` to make it pulse |
| Flat artwork | `sh.decal({ plane, at, items })` | Artwork lying on a plane anywhere in space |
| Raw SVG | `sh.raw({ x, y, z, svg, w, h })` | Markup drawn in screen pixels around a point; not foreshortened |

Outline helpers for `prism` and `panel`: `sh.outline.rect(w, d, radius)`, `sh.outline.circle(r)`, `sh.outline.ngon(sides, r)`, `sh.outline.gear(r, teeth)`, `sh.outline.blob([[cx, cy, r], ...])` (the outer edge of overlapping circles: clouds, puddles, foliage).

`color` is a palette role (`body` `body2` `muted` `dark` `paper` `screen` `accent` `accent2` `ok` `warn` `danger` `gold`) or a hex. Prefer roles: the object then follows whatever look the scene uses. Use a hex only for something whose colour is its identity (bread, a brand device).

Every shape also takes `anim` (see [moving parts](#moving-parts)) and `opacity` (0 to 1: glass, a faint guide, a field line). Shapes are drawn back to front automatically. Keep them from intersecting: stack with `z`, or set them side by side.

## Artwork on faces

`top`, `left`, `right` on a box, `top` on a cylinder and `face` on a panel take a list of flat items, or a function `(fw, fh) => items` that receives the face's width and height. Units are cells; `0.03` is about one pixel.

Where the origin is, as you look at the picture:

| Face | Origin | x runs | y runs | Size |
| --- | --- | --- | --- | --- |
| `left` (toward lower-left) | top-left corner | right | down | `w × h` |
| `right` (toward lower-right) | top-left corner | right | down | `d × h` |
| `top` | far corner | toward lower-right | toward lower-left | `w × d` |
| panel `face` | top-left corner | right | down | `w × h` |

Items:

```js
{ t: 'rect', x, y, w, h, r, fill, stroke, sw }            // r = corner radius
{ t: 'circle', cx, cy, r, fill, stroke, sw }
{ t: 'line', x1, y1, x2, y2, stroke, sw, dash: '0.08 0.05' }
{ t: 'poly', pts: [[x, y], ...], fill, stroke, open: true }
{ t: 'path', d: 'M0 0L1 1', fill, stroke, sw }           // SVG path data in cells
{ t: 'text', x, y, text: 'API', size: 0.3, fill, weight: 800 }   // x, y is the centre of the text
{ t: 'icon', name: 'lock', x, y, size: 0.5, color }       // any of the 95 icons, centred on x, y
{ t: 'g', tx, ty, rot, items: [...] }                     // a group, moved and turned
```

Any item also takes `fillOp` (fill opacity), `op` (opacity), `fade: [x1, y1, x2, y2]` (the fill fades out from the first point to the second) and `anim`.

Artwork on the two side faces reads naturally. Artwork on `top` lies on the floor plane: fine for panels, vents and round marks, poor for text and diagonal symbols.

## Moving parts

`anim` makes a part live. It goes on a piece of face artwork (an item), on a shape, or on a `sh.group` of shapes that move as one. Periods are in seconds and are adjusted so the scene still loops exactly.

Details, on artwork items:

| `anim` | Effect | Use for |
| --- | --- | --- |
| `{ type: 'blink', period: 2.4, min: 0.25, phase: 0.3 }` | Fades between full and `min` | Status lights, a glowing window, a cursor (`min: 0`). Also works on a shape |
| `{ type: 'spin', period: 8, dir: 1 }` on a `g` item | Turns about the group's own origin | Fans, dials, radar, wheels drawn flat, a sweeping beam |
| `{ type: 'march', period: 1.2, len: 0.6 }` on a dashed `line` | The dashes travel. `len` is one dash plus one gap. On a `sh.wire` the dash and `len` are in pixels. Add `alternate: true` and the dashes rock to and fro, at rest at each turn | Belts, cables carrying current, loading bars, field lines; alternating current |
| `{ type: 'ring', period: 2.4 }` on a `circle` | Grows and fades | Signals, ripples, a ping |

Mechanisms, on shapes, groups and artwork:

| `anim` | Effect |
| --- | --- |
| `{ type: 'move', by: [x, y, z], period: 3, hold: 0.15, ease: 'inOut', phase: 0 }` | There and back again, resting at each end. A piston, a lift, a drawer, a bobbing float |
| `{ type: 'swing', from: -20, to: 20, period: 3 }` on a `g` item | Rocks between two angles about the group's origin. A needle, a pendulum, a lever drawn on a face. `hold: 0, ease: 'sine'` gives a smooth pendulum |
| `{ type: 'orbit', axis: 'x', r: 0.6, from: 90, period: 3 }` on a shape or group | The shape circles the place where it is drawn, at radius `r`, about a line parallel to `axis` (`'x'`, `'y'` or `'z'`), starting at angle `from`. It keeps its own orientation, so it is exact for anything that looks the same all the way round its axis: a rod or wire parallel to the axis, a ball, a crank pin, a planet, a seat on a wheel |
| `{ type: 'keys', period: 5, phase: 0, keys: [...] }` | A scripted sequence, for anything with waits, different speeds or several stops |

Each key is `{ at, move, rotate, scale, opacity, ease }`. `at` runs from 0 to 1 across the period. `move` is `[x, y, z]` in cells from where the part was drawn (on a face artwork item: `[x, y]` in the face's own units). `move` and `opacity` work on shapes, groups and artwork items; `rotate` (degrees) and `scale` work on artwork items only. `ease` shapes the journey to the *next* key: `inOut` (default), `in` (gathers speed, for something falling or leaving), `out` (settles, for something arriving), `back` (overshoots and returns), `linear` (a belt).

```js
// a lift that waits, rises with its load, holds, and returns empty
sh.group({
  anim: { type: 'keys', period: 6, keys: [
    { at: 0,    move: [0, 0, 0] },
    { at: 0.2,  move: [0, 0, 0], ease: 'inOut' },   // wait at the bottom
    { at: 0.5,  move: [0, 0, 1.4] },                // rise
    { at: 0.75, move: [0, 0, 1.4], ease: 'in' },    // hold at the top
    { at: 0.95, move: [0, 0, 0] },                  // come back down
  ] },
  parts: [sh.box({ w: 1, d: 1, h: 0.12, color: 'accent' }), sh.box({ z: 0.12, w: 0.5, d: 0.5, h: 0.4, color: 'gold' })],
})
```

Rules that keep a mechanism convincing:

- **One clock.** Give every moving part the scene's `loop` as its `period`, and time them against each other with where their keys sit, or with `phase` (0 to 1: the same sequence, started later). A part with a different period drifts out of step.
- **Cause first.** The part that causes a movement finishes just before the part it affects starts: the gate is open before the parcel reaches it; the seal appears as the press lands.
- **Waits are part of the motion.** Repeat a key to hold still: two keys with the same `move` are a pause.
- **Draw a moving part where it starts.** Shapes are put in depth order once, from where they are drawn, and a part keeps that order as it moves. So draw a part behind anything it will pass behind, and express the rest of its journey with `move`. A part that would have to pass both behind and in front of the same shape needs a different route.
- **Parts that slide inside one another** (a ram in a sleeve, a drawer in a cabinet) cannot be ordered automatically. Put the shapes concerned in `sh.group({ sort: false, parts: [...] })` and list them back to front; they are then drawn exactly in that order.
- **Keep parts on top of a base in one group** (`sh.group({ parts: [beltA, beltB] })`) when moving parts ride over several base shapes, so the riders are always drawn above all of them.
- **Things that really turn.** A solid cannot be rotated, but a turning machine is made of two things that can be drawn exactly: artwork that spins in the plane facing along the axis (spokes, blades, the end of a frame: a `g` item with `spin` on a `sh.decal` whose plane faces along the axis: `'right'` for the x axis, `'left'` for y, `'top'` for z), and rods parallel to the axis that `orbit` it. Give both the same `period`, and start them together with `rot` on the artwork and `from` on the orbit. `examples/ac-generator.scene.mjs` builds a rotating coil and a crank this way.
- **One cause, many effects.** When several things follow one quantity (a current, a pressure, a load), run them all at the same `period` and set their phases from the physics: what is zero together starts together.
- **Fading out.** An artwork item with `fill` and `fade: [x1, y1, x2, y2]` is at full strength at the first point and gone at the second: light beams, glows, shadows, speed streaks.
- **Room to move.** The frame is cropped to the shapes at rest. If a part travels or sweeps beyond them, widen the scene's `pad`.
- A moving part has no shadow of its own, and the object's shadow follows only its still shapes.

Finished mechanisms to study: `examples/approval-press.scene.mjs` (keyed parts, a ram in a sleeve), `examples/parcel-sorter.scene.mjs` (parts sharing one clock with `phase`, artwork that turns), `examples/lighthouse.scene.mjs` (a fading beam that sweeps) and `examples/ac-generator.scene.mjs` (a labelled working model: a coil that turns, alternating current in the wires, a lamp and a meter in step with it).

For `spin`, put the rotating artwork in a group whose `tx`, `ty` is the centre of rotation and draw the items around `0, 0`:

```js
top: (fw, fh) => [{ t: 'g', tx: fw / 2, ty: fh / 2, anim: { type: 'spin', period: 3 },
  items: [0, 1, 2].map((i) => ({ t: 'g', rot: i * 120, items: [{ t: 'rect', x: -0.06, y: 0, w: 0.12, h: 0.42, r: 0.06, fill: K.hex('accent') }] })) }]
```

Whole objects move with story steps (`s.move`, `s.lift`, `s.grow`, `s.pop`) and `float: true`; see the main file.

## Your own SVG

`s.svg(markup, { at, w, h, label })` stands a drawing upright in the scene, facing the viewer. Draw it in a 100 × 100 box; it is scaled so that 100 units span `w` cells. It keeps its own colours and is not foreshortened, so it suits logos, characters, photographs traced to vector, or a hand-drawn hero.

To lay your own artwork flat on a surface instead, use a `path` item on a face.

## Worked examples

**A wind turbine** (tapered mast, hub, three turning blades):

```js
s.define('turbine', (o, sh, K) => ({
  round: true,
  parts: [
    sh.cyl({ r: 0.34, h: 0.08, color: 'dark' }),
    sh.cone({ z: 0.08, r: 0.14, r2: 0.06, h: 2.2, color: o.color }),
    sh.panel({ facing: 'left', z: 2.0, w: 0.5, h: 0.5, t: 0.24, outline: sh.outline.circle(0.2, 0, 0.25), color: 'body2',
      face: (fw, fh) => [{ t: 'g', tx: fw / 2, ty: fh / 2, anim: { type: 'spin', period: 4 },
        items: [0, 1, 2].map((i) => ({ t: 'g', rot: i * 120, items: [{ t: 'poly', pts: [[-0.05, 0], [0.05, 0], [0.02, -0.95], [-0.02, -0.95]], fill: K.hex('paper') }] })) }] }),
  ],
}));
```

**A syringe** (barrel, plunger, needle, lying along x):

```js
s.define('syringe', (o, sh, K) => ({
  parts: [
    sh.prism({ plane: 'right', at: [-0.7, 0, 0.3], outline: sh.outline.circle(0.2), depth: 1.1, color: 'paper' }),     // barrel, pushed out along x
    sh.prism({ plane: 'right', at: [-0.95, 0, 0.3], outline: sh.outline.circle(0.26), depth: 0.08, color: o.color }),  // plunger flange
    sh.prism({ plane: 'right', at: [-0.3, 0, 0.3], outline: sh.outline.circle(0.15), depth: 0.6, color: 'accent' }),   // the dose
    sh.wire({ points: [[0.4, 0, 0.3], [1.0, 0, 0.3]], color: K.hex('dark'), width: 2 }),                                 // needle
  ],
}));
```

**A storefront with an awning** (box, striped slab, door and window as face artwork):

```js
s.define('shop', (o, sh, K) => ({
  parts: [
    sh.box({ w: 1.8, d: 1.3, h: 1.2, color: o.color,
      left: (fw, fh) => [
        { t: 'rect', x: 0.15, y: 0.5, w: 0.5, h: fh - 0.5, r: 0.03, fill: K.hex('accent') },
        { t: 'rect', x: 0.8, y: 0.5, w: fw - 0.95, h: 0.45, r: 0.03, fill: K.hex('screen') },
      ] }),
    sh.box({ y: 0.85, z: 0.95, w: 1.9, d: 0.4, h: 0.07, color: 'accent', ao: false,
      top: (fw, fh) => [0, 1, 2, 3].map((i) => ({ t: 'rect', x: 0.24 + i * 0.48, y: 0, w: 0.24, h: fh, fill: '#ffffff', fillOp: 0.85 })) }),
  ],
}));
```

Every built-in object is written the same way. Read `scripts/lib/kit.mjs` for fifty more examples, from a `gear` to a `truck`.

## Making it look right

- **Silhouette first.** Block the object out of two or three shapes and build it. If it is not recognisable yet, detail will not save it; change the masses.
- **Real proportions, slightly chunky.** A footprint of about 1 to 2 cells and a height of 0.8 to 1.8 sits well beside the kit's objects.
- **One telling detail.** The oven's glowing window, the turbine's blades. Put it on a side face, where it reads.
- **Roles, not hexes**, so the object belongs to every look. In the `line` finish neutral roles are drawn almost white; a part that must read as solid there needs `dark`, `accent` or a hex.
- **Small things on big things.** Details between 0.05 and 0.3 cells read as detail; thinner than 0.03 disappears.
- **Check it alone**: build a scene with only the object in two looks (`--looks sand,neon`) before using it.
