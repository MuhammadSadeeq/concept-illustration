# Checking a scene

The build checks layout by itself. It cannot check meaning: that a current flows the right way, that a ring lies flat, that a caption arrives with the thing it describes. Those are the mistakes that survive into finished work, so check them deliberately. None of this needs you to judge a small picture by eye.

Contents: [what the build finds by itself](#what-the-build-finds-by-itself) · [the procedure](#the-procedure) · [reading the motion](#reading-the-motion) · [looking closely](#looking-closely) · [stating facts](#stating-facts) · [mistakes that keep happening](#mistakes-that-keep-happening)

## What the build finds by itself

Every build prints a report. **FIX THESE** are defects; **CONSIDER** are judgement calls.

| It finds | Code |
| --- | --- |
| Objects that intersect, links that run under objects or kink, labels that collide | `overlap` `link-through` `kink` `label-overlap` |
| Crowding, no focal point, nothing moving, hidden things never shown | `crowded` `no-hero` `static` `never-shown` |
| Captions too short to read or too long | `caption-rushed` `caption-long` |
| A moving part that passes through another shape at some moment of the loop | `passes-through` |
| Text on a face too small to read; labels that will be tiny on a phone | `text-small` `phone-text` |
| A file much larger than usual, and what it is made of | `large` |
| A fact you stated with `s.expect` that is not true | `expect` |

## The procedure

1. Build with `--sheet` and clear everything under FIX THESE.
2. Run `--motion` and read it against your visual sentence: is each thing going the way the sentence says, and does each caption start when its subject does?
3. For anything that turns, flows or travels in a direction that matters, look at it with `--trails`, at the moment it matters, close up.
4. Write down the two or three facts the picture depends on as `s.expect` lines and leave them in the script. They are checked on every build from then on.

## Reading the motion

```bash
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --motion
```

```
MOTION  (scene clock: 0 s is when the story starts. +x is toward the lower right of the picture, +y toward the lower left, +z up)

  Story
      0.40 – 0.40   caption "A request arrives"
      0.52 – 1.80   send laptop1 → gate2
      3.00 – 4.10   zoom in 2.4× on gate2

  Parts that move by themselves
    machine › gate   keyed sequence, every 6 s
          0.00 s  at (0, 0, 0.75)
          1.80 s  at (0, 0, 0.75)  held
          2.70 s  at (0, 0, 1.75)  moved 1 up the picture
    machine › moon   circles the z axis anticlockwise as it appears in the picture, radius 1, once every 6 s
```

Positions are in cells. Give the shapes that matter a `name: '…'` so the report can call them something better than `shape#3`.

## Looking closely

```bash
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet --frames 2.3,2.6            # exactly these moments, shown large
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet --frames 2.3,2.6 --trails   # with a faint trail behind whatever moved
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet --focus gate2               # cropped to one object (ids are in --motion)
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet --focus 1.5,0,1 --zoom 3    # three times closer, around a point
```

A trail shows where each thing was in the last 0.3 seconds (`--trails 0.6` for longer), so a single still frame shows which way it is going. Times are seconds on the scene clock, the same clock as captions and `at:`.

## Stating facts

```js
s.expect(3, (at) => at('electron').x < 0, 'the electron is left of the nucleus at 3 s');
s.expect([0, 12], (at) => at('head').z > 0.5, 'the head never touches the platter');
s.expect(1.5, (at) => at('moon').y < 0, 'anticlockwise seen from above: a quarter turn from +x is toward -y');
s.expect(2.7, (at) => at('gate').z - at('parcel').z > 0.9, 'the gate is clear of the parcel when it passes');
```

`at(name)` gives `{ x, y, z, opacity, angle }` at that moment for an object (its id, or the handle `s.add` returned) or a shape with `name: '…'`. A range `[from, to]` is checked at every moment in it. The build uses the same easing and timing the browser will; a fact that is false appears under FIX THESE with the values found:

```
✗ [expect] Not true at 1 s: the parcel has passed the gate by 1 s. Found: parcel at (-0.65, 0, 0.45).
```

Good facts to state: which side of something a thing is on at a moment; that two parts never meet; that a part has arrived before the caption that describes it; the sense of a rotation.

## Mistakes that keep happening

- **A rotation going the wrong way.** +x round to +y is clockwise seen from above. Use `sense: 'cw'` or `'ccw'`, which mean what they say as the turn appears in the picture, and read the sense back in `--motion`.
- **Rings standing up when they should lie down.** Ripples, orbits seen from above and sound spreading over the ground belong on `plane: 'top'`. On `'left'` or `'right'` they stand on a wall and read as hoops.
- **A caption out of step with the picture.** Pin it: `s.say('…', { at: 2.7 })`, with the time taken from `--motion`.
- **A label for something that is not there yet.** `s.callout(…, { from, until })` shows it only while the thing exists.
- **A part at rest inside another** (a head on its hub, a piston through its cylinder wall). The `passes-through` hint catches the ones that happen during the motion; check the rest pose in the first frame of the sheet.
- **Many small things reading as one lump.** Nine nuclei in a row 0.2 cells apart are a bar. Space repeated things at least their own width apart, or stagger them in depth.
- **`phase` used to mean "later".** `phase` runs a part ahead; `delay` (seconds) makes it later.
