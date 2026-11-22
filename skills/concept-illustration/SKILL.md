---
name: concept-illustration
description: Create richly detailed isometric 3D illustrations, motion graphics and interactive scenes that make an idea visible - animated explainers, diagrams of how something works, hero visuals, step-through and scroll-driven experiences, and small animated components for pages, docs, READMEs, slides and video. Output is a self-contained animated SVG (plus optional interactive page, PNG, GIF, MP4). Use whenever the user asks to illustrate, visualize, diagram, animate or explain a concept, process, system, architecture, workflow, data flow or product feature, or asks for an isometric, 3D-style or motion graphic.
license: MIT
compatibility: Requires Node.js 18 or newer to run the bundled engine. No packages to install. PNG and video export additionally use Playwright, Puppeteer or any Chrome binary, and ffmpeg for video.
---

# Concept Illustration

Turn an idea into an isometric scene with depth, detail and motion. You write a short scene script; the bundled engine handles projection, lighting, layered shadows, depth order, colour, labels and animation, and emits a single animated SVG that plays anywhere without JavaScript.

The engine supplies the craft. You supply the taste: what the picture says, what it looks like for *this* subject, which objects carry it, and what happens in what order. Three commitments decide the result:

- **Specific, not generic.** The look, the objects and the story come from this subject and this audience. Two different briefs must never come out looking alike.
- **Built, not assembled.** The kit, the recipes and the looks are a vocabulary, not a boundary. When the subject needs an object, a motion or an interaction that is not listed here, build it. [Going beyond](#going-beyond) shows how.
- **Detailed, with restraint.** Depth, shadow and small visual cues make a scene feel real; one focal point keeps it readable.

In every command below, replace `SKILL_DIR` with the absolute path of the folder that contains this file.

## Quick start

1. Write `<name>.scene.mjs` where the image will live in the user's project:

```js
export default ({ scene }) => {
  const s = scene({ look: 'ocean', floor: 'plate', title: 'How a cache speeds up a website' });

  const user   = s.add('laptop',   { at: [0, 0],   label: 'Visitor', ui: 'image' });
  const cache  = s.add('server',   { at: [4.5, 0], label: 'Cache', hero: true, info: 'Keeps a copy close to the visitor' });
  const origin = s.add('database', { at: [9, 0],   label: 'Origin' });

  s.link(user, cache);                          // a link carries tokens in both directions
  s.link(cache, origin, { style: 'dashed' });

  s.story([
    s.say('A visitor asks for a page'),
    s.send(user, cache),
    s.say('The cache fetches it once'),
    s.send(cache, origin),
    s.send(origin, cache, { as: 'doc' }),
    s.tint(cache, 'ok'),
    s.say('and answers everyone after that'),
    s.send(cache, user, { as: 'doc' }),
    s.mark(user, 'check'),
    s.wait(1),
  ]);
  return s;
};
```

2. Build it:

```bash
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet
```

This writes `<name>.svg` (the deliverable), `<name>.html` (a preview with a scrubber) and `<name>.sheet.png` (key frames of the loop) next to the script, or into `--out DIR`, then prints a report.

3. Read the report. Fix everything under **FIX THESE**, weigh everything under **CONSIDER**, and rebuild. A clean report ends with `No problems found by the checker.` Then look at the sheet if you can view images: the checker verifies layout, not whether the picture is good.

Do not `import` the engine in the scene script; the build passes it in. Always `return s`.

## Workflow

### 1. Say the idea as one visual sentence

Write one sentence: **who or what → does what → to what → with what visible result**. "Feedback from four channels flows into one tool, and one ranked roadmap comes out."

Every noun is a candidate object, every verb a candidate story step, and anything not in the sentence stays out. Simplify the real system until it fits, and keep the simplification honest. Two sentences means two scenes.

### 2. Pick the shape of the idea

| The idea is about | Shape | Start from |
| --- | --- | --- |
| Steps that happen in order | Row along x | `recipes.pipeline` |
| One thing serving or coordinating many | Hub with spokes | `recipes.hub` |
| Many feeding one, or one feeding many | Fan | `recipes.fanout` (`reverse: true` for many into one) |
| Things built on top of each other | Stacked layers | `recipes.layers` |
| A loop that feeds itself | Ring | `recipes.cycle` |
| A quantity that grows or shrinks | Rising bars | `recipes.growth` |
| Progress through levels | Staircase | `recipes.steps` |
| Before and after, with and without | Two zones side by side | `s.zone` twice |
| One mechanism that *is* the idea (a gate, a press, a valve, a sorter) | A vignette: a single object whose parts move | [Vignettes](#vignettes) |
| Anything else | Your own composition | the steps below |

[Recipes](references/recipes.md) give a finished scene from a short config. They are starting points: a recipe returns an ordinary scene, so add scenery, zones, custom objects and extra story steps to make it this subject's picture rather than the recipe's.

### 3. Art-direct the look

A look is three independent choices. Make each one on purpose, from the subject, the brand and the page it will sit on. There is no default: if you choose nothing, one is picked from the title and the report tells you to decide.

| Choice | Options |
| --- | --- |
| `look` (palette) | Dark: `aurora` `carbon` `abyss` `plum` `forest` `ember` `ocean` `noir` `blueprint` `neon` · Light: `paper` `studio` `mono` `clay` `sunset` `mint` `sand` `sky` `blossom` `lemon` `slate` `grape` |
| `finish` | `solid` shaded with rim light · `soft` round and diffuse · `outline` ink lines · `line` white forms in hairlines with one colour · `flat` poster tones with long shadows · `neon` glowing edges |
| `floor` | `grid` · `dots` · `plate` (a raised slab: a diorama) · `rings` · `none` |

```js
scene({ look: 'mint', finish: 'soft', floor: 'plate' })                    // any combination works
scene({ look: 'paper', accent: '#f97316' })                               // a built-in look with the brand's accent
scene({ palette: { bg: '#0f172a', accent: '#f97316', accent2: '#22d3ee' }, finish: 'solid' })   // a look of your own: needs bg and accent
```

- Start from mood: `node SKILL_DIR/scripts/build.mjs --list` prints every look with the moods it suits. A health blog is not a data-centre dashboard; a children's lesson is not an investor deck.
- Match the page: dark page → dark palette, light page → light. One brand colour → `accent: '#hex'` on a built-in look. A full brand scheme → `palette`.
- To choose by eye, render candidates side by side: `--looks mint,sand:flat,sky:outline:plate` writes `<name>.looks.png`.
- Vary. If you made a scene earlier in this project, do not reuse its look unless the two belong to one series. Within a series, keep one look and vary composition.
- `background: false` sits on the page's own surface; `bg: '#ffffff'` matches a known surface colour. `title` is the accessible name and is not drawn; `heading` draws a visible title.

More in [design](references/design.md).

### 4. Cast the objects

How many depends on the job: **5 to 9** for a hero scene or explainer, **2 to 4** for a small component, **1** for a vignette. Choose the most literal object for each noun. One is the **hero**: `hero: true`, and `scale: 1.2` to `1.4` if it needs presence.

| Group | Kinds |
| --- | --- |
| Compute and data | `server` `database` `chip` `queue` `conveyor` `gear` `funnel` `battery` |
| Screens | `laptop` `monitor` `phone` `browser` `card` `cursor` |
| Content | `document` `folder` `package` `bubble` `coins` `bars` `gem` |
| People and agents | `user` `robot` `orb` |
| Places | `building` `house` `factory` `cloud` `globe` `pin` `tree` `sun` `truck` |
| Meaning | `lock` `shield` `wall` `clock` `bulb` `flag` `antenna` `sign` |
| Generic | `tile` (icon on a slab) `cube` `slab` `cylinder` `sphere` `platform` `stairs` `stack` `arrow` |

**If the right object is not in the kit, build it.** A bakery needs an oven, a clinic needs a syringe, a farm needs a silo. A generic tile with an icon is the last resort, not the first:

```js
s.define('oven', (o, sh, K) => ({ parts: [
  sh.box({ w: 1.5, d: 1.3, h: 1.25, r: 0.1, color: o.color,
    left: (fw, fh) => [                                             // artwork on the face toward the lower-left
      { t: 'rect', x: 0.16, y: 0.34, w: fw - 0.32, h: fh - 0.5, r: 0.08, fill: K.hex('screen') },
      { t: 'rect', x: 0.26, y: 0.46, w: fw - 0.52, h: fh - 0.74, r: 0.05, fill: K.hex('accent'), anim: { type: 'blink', period: 2.2, min: 0.55 } },
    ] }),
  sh.cyl({ x: -0.4, y: -0.3, z: 1.25, r: 0.14, h: 0.5, color: 'dark' }),   // chimney
] }));
s.add('oven', { at: [4.5, 0], label: 'Bakery', hero: true });
```

[Custom objects](references/custom.md) explains the shapes (`box` `cyl` `panel` `prism` `sphere` `cone` `mesh` `decal` `raw` `wire`), face artwork, and how to place any SVG.

Every kind, built-in or yours, accepts: `at`, `on`, `label`, `sub`, `info` (detail text for interactive output), `hero`, `color` (a role such as `accent`, `accent2`, `ok`, `warn`, `danger`, `gold`, or a hex), `accent` (the colour of its details), `scale`, `hidden`, `level`, `float`, `labelSide`, `opacity` (see-through), `ghost: true` (faint, with a dashed footprint: something planned, missing or removed). Options and icons per kind are in [kit](references/kit.md) and `--list`.

The accent colour belongs to the hero. Where a supporting object shows a lot of it (a `house` roof, a `truck` cab), quieten it with `accent: 'muted'`.

### 5. Compose in depth

```
              far corner
                 ◇
       +y  ↙          ↘  +x
(toward lower-left)   (toward lower-right)        z is up
```

- `at: [x, y]` is the centre of an object, in grid cells. A row along `x` runs from the upper-left of the picture to the lower-right, the way people read. Use `y` for parallel lanes.
- Centres **4 to 5 cells apart**; under 3 they collide. Linked objects share an `x` or a `y` so links run straight.
- **Three depths.** Tall or scenic things at the back (small `x + y`), the actors in the middle, low things and tokens in front. Nothing hides anything.
- **Height is hierarchy.** Stand the hero on a `platform`; float information (`browser`, `bubble`, `cloud`) above the floor with `z`.
- **A sense of place.** One to three unlabelled scenery objects (`tree`, `building`, `cloud`, your own) tell where this happens. Keep them clear of links.
- Stack with `on:`. Group with `s.zone({ around: [a, b], label: 'CLOUD', style: 'outline' })`. Position helpers: `s.row`, `s.grid`, `s.ring`.

### 6. Connect

```js
s.link(a, b)                                  // solid line, arrowhead at b, a small socket at a
s.link(a, b, { style: 'dashed' })             // 'line' | 'dashed' | 'dotted' | 'pipe' | 'road'
s.link(a, b, { arrow: 'both' })               // true | 'both' | false
s.link(a, b, { flow: true })                  // dots stream along it forever
s.link(a, b, { route: 'straight' })           // 'auto' | 'x' | 'y' | 'straight'   (or via: [[x, y], ...])
s.link(a, b, { arc: true })                   // a hop through the air
s.link(a, b, { label: 'HTTPS', dim: true })   // small caption; dim fades a secondary link
```

Draw only links that carry meaning. One link serves both directions. Ends may be points `[x, y]`.

### 7. Choreograph one story

`s.story([...])` plays its steps in order and loops. A nested array runs its steps together.

| Step | Meaning |
| --- | --- |
| `s.send(a, b, { as, color, label, count, scale })` | A token travels a to b along their link, leaving a short trail. `as`: `dot` `doc` `cube` `box` `coin` `mail` `gem`, or any kind, including your own, such as `'truck'` |
| `s.move(obj, [x, y])` | The object itself slides across the floor and stays |
| `s.pulse(obj)` · `s.glow(obj)` · `s.shake(obj)` | It acted · it is lit · it refused |
| `s.tint(obj, 'ok')` | New state by colour: `ok` `warn` `danger` `accent` `accent2` |
| `s.mark(obj, 'check')` | A badge pops above it with a small burst: any icon |
| `s.pop(obj)` · `s.show(obj)` · `s.hide(obj)` | Reveal or remove (create with `hidden: true`) |
| `s.grow(obj)` | Rise out of the floor. Create it with `level: 0`, which leaves it sunk out of sight. Suits flat-topped things (`bars`, `building`, `cylinder`, `cube`, `stack`); for anything else use `hidden: true` and `s.pop` |
| `s.lift(obj, 0.5)` · `s.drop(obj)` | Raise and lower |
| `s.say('…')` | Caption under the scene; stays until the next `say` |
| `s.wait(1)` | Hold |

- **Cause, then effect.** A token arrives; then the receiver reacts.
- **One actor at a time**, unless simultaneity is the point.
- **The token is the thing.** Change `as` when the thing changes: a request leaves as `dot`, the answer returns as `doc`.
- **End on the result and hold it**: `mark`, `tint`, `pop` or `grow`, then `s.wait(1)`.
- 6 to 14 steps, 3 to 5 captions under 60 characters, a loop of 6 to 12 seconds. Changes reset themselves at the loop.
- Steady states need no story: `flow: true` on links and `float: true` on the hero.

### 8. Check the detail

The engine adds these by itself: a contact shadow and a cast shadow per object, rim light, depth haze, sockets where links start, trails behind tokens, bursts on badges, motes of light around a glowing hero, status lights, screen glare and live screen content. Your part:

- Give screens the content that says what they are for: `ui: 'code' | 'chart' | 'dash' | 'chat' | 'list' | 'image' | 'login' | 'play'`.
- Put the telling detail on the hero (a custom face, an icon, a `sub` label) and leave supporting objects plain.
- Add `info: '…'` to the objects a viewer might want explained; it becomes a hover card in the interactive output.
- For a small component in a card or a button-sized slot use `detail: 'clean'`, 2 to 4 objects and no captions.
- `pad` is the margin around the content in pixels: one number, or `[sides, top-and-bottom]`. Widen it when a part swings or travels outside its object.

### 9. Build, check, fix

```bash
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet                  # SVG + preview + key frames + report
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --looks                  # the scene in six looks, to compare
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --experience step        # interactive page: 'loop' | 'step' | 'scroll'
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --png --at 3             # one still; also --mp4 --gif --webm
```

- An error names the line of your script and suggests the fix.
- **FIX THESE** are defects: resolve all. **CONSIDER** are judgement calls: act unless you have a reason.
- The sheet shows the resting state first, then tokens in mid-flight and states just after they change (`--frames 12` for more). If you can view images, judge it against the quality bar. If you cannot, rely on the report and keep the scene simple.
- Raster outputs need a browser engine (Playwright, Puppeteer or any Chrome); video also needs ffmpeg. Without them the SVG and pages are still written.

### 10. Deliver

```html
<img src="how-a-cache-works.svg" alt="How a cache speeds up a website" style="max-width:100%;height:auto">
```

The SVG animates in `<img>`, inline, in Markdown and in READMEs, and stops for people who prefer reduced motion. Keep the `.scene.mjs` beside it as the editable source. For light and dark pages build twice (`--look paper`, then `--look aurora --out dark`). [Delivery](references/delivery.md) covers frameworks, interactive embedding, video and accessibility.

## Going beyond

The best result is often something this file does not list. You are expected to go there.

- **New objects.** `s.define` and `s.custom` build anything from shapes; `s.svg(markup, { at, w, h })` stands any drawing in the scene. Use them whenever the kit's nearest match would be a compromise. See [custom](references/custom.md).
- **New motion.** Combine steps into behaviour the kit does not name: a queue that fills (`pop` hidden items as tokens arrive, `hide` them as they are taken), a machine that assembles (`grow` parts in turn), a handover (`move` an object between two places), a comparison (two zones running in parallel). Parts of your own objects can animate with `anim`: `blink`, `spin`, `march`, `ring` for details; `move`, `swing` and keyframed `keys` for parts that slide, lift, turn and wait.
- **Experiences, not only loops.** `--experience step` lets a reader walk through the story one caption at a time; `scroll` ties the story to the page scroll; every object with `info` answers a hover or tap. Use them for teaching, onboarding and product tours. See [delivery](references/delivery.md).
- **Mechanisms.** When how a thing works is the idea, build the thing and let its parts act it out: see [Vignettes](#vignettes).
- **Series.** For several related ideas, make several scenes with one look and one cast, so they read as chapters.
- **Other tools.** If the idea is not spatial at all (a precise chart, a timeline of dates, a table), say so and use the right form instead of forcing it into isometric.

### Vignettes

A vignette is one object, drawn large, whose parts play the idea on a loop: a press that stamps each document (approval), a turntable that shares parcels between two lanes (routing), a lighthouse sweeping its beam (monitoring). There are no labels, links or captions; the mechanism is the explanation. It suits hero slots, feature cards and anywhere a diagram would be too much.

```js
export default ({ scene }) => {
  const s = scene({ look: 'studio', title: 'A gate that opens for each request', loop: 4, pad: 40 });
  const P = 4; // one clock for every moving part
  s.custom({ at: [0, 0], parts: (sh, K) => [
    sh.box({ w: 3.6, d: 1.6, h: 0.3, r: 0.2, color: 'body' }),                       // the track
    sh.box({ y: -0.64, z: 0.3, w: 0.3, d: 0.2, h: 1.9, r: 0.05, color: 'body' }),    // two posts
    sh.box({ y: 0.64, z: 0.3, w: 0.3, d: 0.2, h: 1.9, r: 0.05, color: 'body' }),
    sh.box({ z: 2.2, w: 0.3, d: 1.48, h: 0.16, r: 0.05, color: 'body' }),            // and a beam
    // the request: arrives, waits at the gate, passes once it is open
    sh.box({ x: -1.4, z: 0.3, w: 0.44, d: 0.44, h: 0.32, r: 0.08, color: 'body2', anim: { type: 'keys', period: P, keys: [
      { at: 0, move: [0, 0, 0], opacity: 0 }, { at: 0.08, move: [0.1, 0, 0], opacity: 1, ease: 'out' },
      { at: 0.28, move: [0.95, 0, 0] }, { at: 0.5, move: [0.95, 0, 0] },
      { at: 0.8, move: [2.7, 0, 0], opacity: 1 }, { at: 0.88, move: [2.9, 0, 0], opacity: 0 }] } }),
    // the gate: waits for the request, lifts, holds, closes behind it
    sh.box({ z: 0.3, w: 0.2, d: 1.04, h: 0.9, r: 0.06, color: 'accent', anim: { type: 'keys', period: P, keys: [
      { at: 0, move: [0, 0, 0] }, { at: 0.32, move: [0, 0, 0] },
      { at: 0.46, move: [0, 0, 0.95] }, { at: 0.78, move: [0, 0, 0.95], ease: 'in' },
      { at: 0.92, move: [0, 0, 0] }] } }),
  ] });
  return s;
};
```

- Choose a mechanism the viewer knows from the physical world, and reduce it to two to five parts.
- One clock: give every moving part the same `period` (the scene's `loop`), and offset with `phase` or with where its keys sit. Something must visibly cause each movement.
- Let it breathe: wait, move with weight (`ease: 'in'` to fall, `'out'` to settle, `'back'` to overshoot), hold the result, return.
- One colour for the part that matters; everything else neutral. The `studio` look with its `line` finish was made for this; `sand`, `mint` and the dark looks work as well.
- Study `examples/approval-press.scene.mjs`, `examples/parcel-sorter.scene.mjs` and `examples/lighthouse.scene.mjs`, and read [custom](references/custom.md#moving-parts) for every motion type.

## Quality bar

Before you hand it over, every line must be true:

- The still frame alone tells the idea; motion confirms it.
- The look was chosen for this subject and is not the one you used last time.
- One object is clearly the most important, and the eye lands on it first.
- Every object is needed (5 to 9 in a scene, 2 to 4 in a component, 1 in a vignette), and each is the right object, not the nearest available one.
- The scene has depth: something behind, something in front, heights that differ.
- Every label is 1 to 3 words. No two labels touch. No label sits on an object.
- Links run straight or turn once. None passes under an object.
- The story has a beginning, a change and a result, and the result is held before the loop restarts. In a vignette, every movement has a visible cause.
- Colour means something: neutral for context, accent for the hero, `ok` / `warn` / `danger` for a state or for an actor that is itself good, risky or harmful.
- The build report shows nothing under FIX THESE.

## Mistakes to avoid

- Reaching for the same look, the same recipe and the same three objects every time.
- Using a `tile` with an icon where a real object would take ten lines to build.
- Adding objects because the kit has them. Empty floor is part of the composition.
- Making everything float, glow or pulse. Motion on everything is motion on nothing.
- Several heroes, or several unrelated accent colours.
- Captions that restate the label. A caption says what is happening now.
- A `tile` icon built on diagonals (`check`, `x`, arrows): it lies flat and distorts. Use an upright `sign`.
- Positions like `[1.3, 2.7]`. Stay on whole or half cells.
- Inventing methods. A wrong name fails with a suggestion; the full list is in [api](references/api.md).

## Reference

| File | Read it when |
| --- | --- |
| [references/design.md](references/design.md) | Choosing a look, composing with depth, pacing motion: the taste behind every decision |
| [references/custom.md](references/custom.md) | The kit lacks the object, or you want your own artwork or part animation |
| [references/api.md](references/api.md) | You need an option not shown above |
| [references/kit.md](references/kit.md) | Choosing built-in objects, icons, screen content, tokens |
| [references/recipes.md](references/recipes.md) | Using or adapting a recipe |
| [references/delivery.md](references/delivery.md) | Embedding, interactive experiences, export formats, accessibility |
| [examples/](examples/) | Finished scenes to study, one per pattern |
