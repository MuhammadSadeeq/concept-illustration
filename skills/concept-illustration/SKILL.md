---
name: concept-illustration
description: Create polished isometric 3D illustrations and motion graphics that make an idea visible - animated explainer scenes, diagrams of how something works, hero visuals, and small animated components for pages, docs, READMEs, slides and video. Output is one self-contained animated SVG (plus optional PNG, GIF, MP4). Use whenever the user asks to illustrate, visualize, diagram, animate or explain a concept, process, system, architecture, workflow, data flow or product feature, or asks for an isometric, 3D-style or motion graphic.
license: MIT
compatibility: Requires Node.js 18 or newer to run the bundled engine. No packages to install. PNG and video export additionally use Playwright, Puppeteer or any Chrome binary, and ffmpeg for video.
---

# Concept Illustration

Turn an idea into an isometric scene that moves. You write a short scene script; the bundled engine handles projection, lighting, shadows, depth order, colour, labels and animation, and emits a single animated SVG that plays anywhere without JavaScript.

Your job is the thinking a renderer cannot do: decide what the picture says, which few objects say it, and what happens in what order.

In every command below, replace `SKILL_DIR` with the absolute path of the folder that contains this file.

## Quick start

1. Write `<name>.scene.mjs` where the image will live in the user's project (for example beside the docs page or in the site's image folder):

```js
export default ({ scene }) => {
  const s = scene({ theme: 'aurora', title: 'How a cache speeds up a website' });

  const user   = s.add('laptop',   { at: [0, 0],   label: 'Visitor' });
  const cache  = s.add('server',   { at: [4.5, 0], label: 'Cache', hero: true });
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

3. Read the report. Fix everything under **FIX THESE**, weigh everything under **CONSIDER**, and rebuild. A clean report ends with `No problems found by the checker.` Then look at the sheet if you can view images: the checker verifies layout, not whether the picture makes its point.

Do not `import` the engine in the scene script; the build passes it in. Always `return s`.

## Workflow

Follow these steps in order. Steps 1 and 2 decide the quality of the result; do not skip them.

### 1. Say the idea as one visual sentence

Write one sentence of the form **who or what → does what → to what → with what visible result**.

- "A visitor's request reaches a nearby cache, which answers without going to the far-away origin."
- "Feedback from four channels flows into one tool, and one ranked roadmap comes out."

Every noun in the sentence is a candidate object. Every verb is a candidate step in the story. Anything that is not in the sentence stays out of the picture. Simplify the real system until it fits one sentence, and keep the simplification honest. If the idea needs two sentences, make two scenes.

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
| A change of form | Row with a different token per hop | `s.send(..., { as })` |

A recipe builds a complete animated scene from a short config and is the fastest route to a good result. See [recipes](references/recipes.md). Write a custom scene when no recipe fits.

### 3. Cast 3 to 9 objects

Choose the most literal object available for each noun. One object is the **hero**: give it `hero: true`, and `scale: 1.2` to `1.4` if it needs more presence. Everything else stays neutral.

| Group | Kinds |
| --- | --- |
| Compute and data | `server` `database` `chip` `queue` `conveyor` `gear` `funnel` `battery` |
| Screens | `laptop` `monitor` `phone` `browser` `card` `cursor` |
| Content | `document` `folder` `package` `bubble` `coins` `bars` `gem` |
| People and agents | `user` `robot` `orb` |
| Places | `building` `house` `factory` `cloud` `globe` `pin` `tree` `sun` `truck` |
| Meaning | `lock` `shield` `wall` `clock` `bulb` `flag` `antenna` `sign` |
| Generic | `tile` (icon on a slab) `cube` `slab` `cylinder` `sphere` `platform` `stairs` `stack` `arrow` |

No fitting kind? Use `tile` or `sign` with one of 95 icons: `s.add('tile', { icon: 'cart', label: 'Checkout' })`. A `tile` lays its icon flat on the floor, which distorts shapes built on diagonals: for `check`, `x` and arrows use an upright `sign` instead. Run `node SKILL_DIR/scripts/build.mjs --list` to print every kind, its options, every icon, theme and token. Details in [kit](references/kit.md).

Every kind accepts these options: `at`, `on`, `label`, `sub`, `hero`, `color` (a role such as `accent`, `accent2`, `ok`, `warn`, `danger`, `gold`, or a hex), `scale`, `hidden`, `level`, `float`, `labelSide`.

### 4. Place objects on the floor grid

```
              far corner
                 ◇
       +y  ↙          ↘  +x
(toward lower-left)   (toward lower-right)        z is up
```

- `at: [x, y]` is the centre of an object, in grid cells. `+x` runs to the lower-right of the picture, `+y` to the lower-left.
- Put the main flow along `x`: `[0,0] → [4.5,0] → [9,0]` runs from the upper-left of the picture down to the lower-right, which is how people read. Use `y` for parallel lanes: `[0,4.5]`, `[4.5,4.5]`.
- Keep centres **4 to 5 cells apart**. Closer than 3 and things collide.
- Give linked objects the **same x or the same y** so links run straight.
- Tall objects go at the back (small `x + y`), low ones at the front, so nothing hides anything.
- Stack with `on:` instead of computing heights: `s.add('robot', { on: platform })`.
- Helpers return positions: `s.row(n, { at, gap, axis })`, `s.grid(cols, rows, { at, gap })`, `s.ring(n, { at, r })`.
- Group related objects with `s.zone({ around: [a, b], label: 'CLOUD', style: 'outline' })`.

### 5. Connect

```js
s.link(a, b)                                  // solid line with an arrowhead at b
s.link(a, b, { style: 'dashed' })             // 'line' | 'dashed' | 'dotted' | 'pipe' | 'road'
s.link(a, b, { arrow: 'both' })               // true | 'both' | false
s.link(a, b, { flow: true })                  // dots stream along it forever (for always-on traffic)
s.link(a, b, { route: 'straight' })           // 'auto' | 'x' | 'y' | 'straight'   (or via: [[x, y], ...])
s.link(a, b, { arc: true })                   // a hop through the air: wireless, a call, a jump
s.link(a, b, { label: 'HTTPS', dim: true })   // small caption; dim fades a secondary link
```

Only draw links that carry meaning. One link between two objects serves traffic in both directions. `a` and `b` may also be points `[x, y]`.

### 6. Tell one story

`s.story([...])` plays its steps in order and loops. A nested array runs its steps together.

| Step | Meaning |
| --- | --- |
| `s.send(a, b, { as, color, label, count, scale })` | A token travels from a to b along the link between them. `as`: `dot` `doc` `cube` `box` `coin` `mail` `gem`, or any kit kind such as `'truck'`. `label` is a word that rides above it. `count: 3` sends three tokens one after another |
| `s.pulse(obj)` | Ripple and bounce: this just acted |
| `s.glow(obj)` | Light the floor under it for a moment |
| `s.tint(obj, 'ok')` | Change colour to show a new state: `ok` `warn` `danger` `accent` `accent2` |
| `s.mark(obj, 'check')` | Pop a badge above it: `check` `x` `warning` `lock` `bolt`, any icon |
| `s.pop(obj)` / `s.show(obj)` / `s.hide(obj)` | Reveal or remove (create the object with `hidden: true` to reveal it later) |
| `s.grow(obj)` | Rise out of the floor to full height (create the object with `level: 0`); `s.grow(obj, 0.4)` for part of the way |
| `s.lift(obj, 0.5)` / `s.drop(obj)` | Raise and lower |
| `s.shake(obj)` | Rejected, blocked, failed |
| `s.say('…')` | Set the caption under the scene. It stays until the next `say` |
| `s.wait(1)` | Hold |

Rules for a story that explains:

- **Cause, then effect.** A token arrives, then the receiver reacts (`pulse`, `tint`, `mark`, `pop`, `grow`).
- **One thing moves at a time** unless things truly happen together.
- **Change the token when the thing changes**: a request goes out as `dot`, the answer comes back as `doc`.
- **End on the result and hold it**: finish with `mark`, `tint` or `pop`, then `s.wait(1)`.
- 6 to 14 steps, 3 to 5 different captions of under 60 characters, a loop of 6 to 12 seconds.
- Send tokens only between objects that have a link, so viewers see the route.
- State changes reset by themselves when the loop restarts.

For calm, always-on scenes skip the story: use `flow: true` on links and `float: true` on the hero.

### 7. Choose the look

| Theme | Feel | Good for |
| --- | --- | --- |
| `aurora` | Deep indigo, glowing accents | Technology, product heroes, dark pages |
| `carbon` | Graphite with one warm signal | Hardware, infrastructure, serious tone |
| `paper` | Ink outlines on cool paper | Docs, tutorials, light pages |
| `mono` | Black line on white | Print, long documents, minimal brands |
| `clay` | Soft matte forms, broad shadows | Friendly products, onboarding, education |
| `sunset` | Warm light, long coloured shadows | Marketing, stories about people and places |
| `blueprint` | White line on drafting blue | Plans, engineering, how-it-is-built |

- Dark page → dark theme. Light page → light theme. For a page with both modes build the same script twice: once as written, once with `--theme aurora --out dark` (any theme name), and deliver both files. [Delivery](references/delivery.md) shows the markup that swaps them.
- Brand colour: `scene({ theme: 'clay', accent: '#ff5a1f' })`.
- To sit on the page's own surface (a card, a coloured section): `background: false`. To match a known surface colour instead: `bg: '#ffffff'`.
- `title` is the accessible name and is not drawn. For a visible title use `heading` (and `subheading`).
- `aspect: '16:9'` pads the frame to a ratio. It adds margin and does not enlarge anything, so use it only when the scene is already wide (a row of four or more objects); a compact scene would shrink to the middle of the frame.

### 8. Build, check, fix

```bash
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --sheet        # SVG + preview + key-frame sheet + report
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --png --at 3   # one still at 3 s
node SKILL_DIR/scripts/build.mjs <name>.scene.mjs --mp4          # or --gif, --webm
```

- An error names the line of your script and suggests the fix. Correct it and rebuild.
- **FIX THESE** items are real defects (collisions, hidden links, overlapping labels). Resolve all of them.
- **CONSIDER** items are judgement calls. Act on them unless you have a reason not to.
- The sheet shows the moments that matter: the resting state first (that is the still frame), then tokens in mid-flight and states just after they change. Add `--frames 12` for more. If you can view images, check it against the quality bar below. If you cannot, rely on the report and keep the scene simple.
- `--sheet`, `--png` and video need a browser engine (Playwright, Puppeteer or any Chrome); video also needs ffmpeg. If they are missing the SVG and preview are still written: deliver those.

### 9. Deliver

Give the user the `.svg` and tell them how to place it:

```html
<img src="how-a-cache-works.svg" alt="How a cache speeds up a website" style="max-width:100%;height:auto">
```

It animates inside `<img>`, inline in HTML, in Markdown and in READMEs. Paste the file's contents inline when the page should style or pause it. Keep the `.scene.mjs` next to it as the editable source. More in [delivery](references/delivery.md).

## Quality bar

Before you hand it over, every line must be true:

- The still frame alone tells the idea; motion only confirms it.
- One object is clearly the most important, and the eye lands on it first.
- 3 to 9 objects, each one needed. Nothing decorative that could be mistaken for meaning.
- Every label is 1 to 3 words. No two labels touch. No label sits on an object.
- Links run straight or turn once. None passes under an object.
- The story has a beginning, a change and a result, and the result is held before the loop restarts.
- Colour means something: neutral for context, accent for the hero, `ok` / `warn` / `danger` for a state or for an actor that is itself good, risky or harmful. Never as decoration.
- The build report shows nothing under FIX THESE.

## Mistakes to avoid

- Adding objects because the kit has them. Empty floor is part of the composition.
- Labelling everything. Label what the viewer cannot identify.
- Making everything float, glow or pulse. Motion on everything is motion on nothing.
- Several heroes, or several unrelated accent colours.
- Captions that restate the label. A caption says what is happening now.
- Positions like `[1.3, 2.7]`. Stay on whole or half cells so things line up.
- Inventing methods. The API is exactly what this file and [api](references/api.md) list; a wrong name fails with a suggestion.

## Reference

| File | Read it when |
| --- | --- |
| [references/api.md](references/api.md) | You need an option not shown above |
| [references/kit.md](references/kit.md) | Choosing objects, icons, screen content, tokens |
| [references/recipes.md](references/recipes.md) | Using or adapting a recipe |
| [references/design.md](references/design.md) | Turning a hard or abstract idea into a picture; composition, colour and motion craft |
| [references/delivery.md](references/delivery.md) | Embedding in a site or framework, export formats, accessibility |
| [examples/](examples/) | Twelve finished scenes to copy from, one per pattern |
