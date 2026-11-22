# concept-illustration

An agent skill that turns ideas into richly detailed isometric illustrations that move.

Ask your coding agent to *"illustrate how our cache works"* or *"make a hero animation for the landing page"*. It decides what the picture should say and how it should look for that subject, writes a short scene script, and the bundled engine draws and animates it. You get one self-contained animated SVG that plays anywhere, and optionally an interactive, step-through version.

<p align="center">
  <img src="gallery/request-lifecycle.svg" alt="An animated isometric scene: a visitor's request reaches an edge cache, which fetches a page from the origin once and then answers by itself" width="720">
</p>

## Install

```bash
npx skills add MuhammadSadeeq/concept-illustration
```

Works with any agent that supports skills. The only requirement is Node.js 18 or newer; there is nothing else to install.

## What it makes

Every image below is a single SVG file animated with plain CSS. No JavaScript runs on the page. Each was art-directed for its subject: no two share a look.

<table>
  <tr>
    <td width="50%"><img src="gallery/encryption.svg" alt="A message is locked, crosses the internet past an onlooker, and is unlocked by the receiver"><br><sub><b>End-to-end encryption</b> · abyss palette, ring floor</sub></td>
    <td width="50%"><img src="gallery/bakery-delivery.svg" alt="An order reaches a bakery's oven, a loaf appears and is carried to a house"><br><sub><b>Fresh bread, delivered</b> · lemon palette, flat finish, custom oven and loaf</sub></td>
  </tr>
  <tr>
    <td><img src="gallery/parcel-journey.svg" alt="An order goes to a warehouse and a truck drives the parcel to a house"><br><sub><b>From order to doorstep</b> · sand palette on a raised plate</sub></td>
    <td><img src="gallery/agent-loop.svg" alt="An AI agent on a pedestal calling tools and memory, then writing an answer"><br><sub><b>How an AI agent works through a task</b> · plum palette, soft finish</sub></td>
  </tr>
  <tr>
    <td><img src="gallery/compound-growth.svg" alt="Bars rising one after another as savings grow with compound interest"><br><sub><b>Compound interest</b> · sky palette, growth recipe</sub></td>
    <td><img src="gallery/photosynthesis.svg" alt="Sunlight, water and air flowing into a leaf, and sugar and oxygen leaving it"><br><sub><b>Photosynthesis</b> · mint palette</sub></td>
  </tr>
  <tr>
    <td><img src="gallery/ci-pipeline.svg" alt="A commit moving through build, test and production"><br><sub><b>From commit to production</b> · paper palette, outline finish</sub></td>
    <td><img src="gallery/learning-path.svg" alt="A figure climbing four steps toward a flag"><br><sub><b>From beginner to expert</b> · blueprint palette</sub></td>
  </tr>
  <tr>
    <td><img src="gallery/load-balancer.svg" alt="A load balancer handing requests to three servers in turn"><br><sub><b>Load balancing</b> · carbon palette</sub></td>
    <td><img src="gallery/feedback-loop.svg" alt="A token circling through build, measure, learn and plan"><br><sub><b>Build, measure, learn</b> · sunset palette, flat finish</sub></td>
  </tr>
</table>

## One scene, many looks

A look is three independent choices: a **palette** (21 built in, or any brand colours), a **finish** (solid, soft, outline, flat, neon) and a **floor** (grid, dots, a raised plate, rings, none). Every combination is coherent because all tones are derived from the palette in a perceptual colour space. There is no default look: the skill directs the agent to choose for the subject, and a scene that chooses nothing gets one picked from its title.

<table>
  <tr>
    <td><img src="gallery/look-aurora.svg" alt="aurora look"></td>
    <td><img src="gallery/look-neon.svg" alt="neon look"></td>
    <td><img src="gallery/look-plum.svg" alt="plum look on a plate"></td>
  </tr>
  <tr>
    <td><img src="gallery/look-forest.svg" alt="forest look"></td>
    <td><img src="gallery/look-sand.svg" alt="sand look"></td>
    <td><img src="gallery/look-mint.svg" alt="mint look"></td>
  </tr>
  <tr>
    <td><img src="gallery/look-lemon.svg" alt="lemon look"></td>
    <td><img src="gallery/look-paper.svg" alt="paper look"></td>
    <td><img src="gallery/look-noir.svg" alt="noir look"></td>
  </tr>
</table>

`--looks` renders a scene in several looks side by side so the choice can be made by eye.

## How it works

The agent does not draw. It decides what the picture says, then describes it:

```js
export default ({ scene }) => {
  const s = scene({ look: 'ocean', floor: 'plate', title: 'How a cache speeds up a website' });

  const user   = s.add('laptop',   { at: [0, 0],   label: 'Visitor', ui: 'image' });
  const cache  = s.add('server',   { at: [4.5, 0], label: 'Cache', hero: true });
  const origin = s.add('database', { at: [9, 0],   label: 'Origin' });

  s.link(user, cache);
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

```bash
node skills/concept-illustration/scripts/build.mjs cache.scene.mjs --sheet
```

The engine takes it from there:

- **Geometry and light.** True isometric projection, exact depth ordering, three-tone shading, a contact shadow and a cast shadow per object, rim light, depth haze.
- **Detail.** Sockets where links start, trails behind moving tokens, bursts on state badges, motes of light around a glowing hero, blinking status lights, glare and live content on screens.
- **Layout.** Connectors route along the floor grid and stop where an object's outline begins. Labels pick the side with room. The frame crops to the content.
- **Motion.** A story of cause and effect compiles to CSS keyframes. Tokens pass correctly behind and in front of objects. Loops close exactly, so exported video and GIFs never jump.
- **A checker.** Every build reports collisions, hidden links, overlapping labels, crowding and missing focus, each with the fix.

## Not limited to the kit

Fifty objects and ninety-five icons cover a lot, and the skill tells the agent to go past them whenever the subject needs it:

- **Any object.** `s.define` builds new objects from the same shapes the kit uses (blocks, cylinders, extrusions, cones, spheres, artwork on faces, moving parts). The bakery scene above defines its own oven and loaf in twenty lines.
- **Any drawing.** `s.svg` stands arbitrary SVG artwork in the scene.
- **Real movement.** Objects slide, rise out of the floor, lift, appear and change state; tokens can be any object.
- **Experiences.** `--experience step` produces an interactive page where a reader walks through the story one caption at a time; `scroll` ties it to the page scroll; objects answer a hover or tap with a detail card. Open [`gallery/request-lifecycle.experience.html`](gallery/request-lifecycle.experience.html) locally to try one.

## Built to work with small models

Good illustration needs judgement that small models do not reliably have. The skill moves the mechanical judgement into the engine and spends the instructions on the decisions that matter: what the picture claims, what it should feel like, which object is the hero, what happens in what order.

- **Recipes** for seven common shapes (pipeline, hub, layers, cycle, fan-out, growth, steps) turn a ten-line config into a finished scene.
- **Forgiving input.** Near-miss option names are accepted, typos get a "did you mean", and errors name the line.
- **Tested the hard way.** Unseen briefs, from OAuth to vaccines to a bakery's delivery flow, were given to a small, fast model with nothing but this skill. Every run built clean on the first attempt; their feedback shaped the instructions.

## The kit

<p align="center"><img src="gallery/kit.svg" alt="All fifty objects in the kit" width="900"></p>

## Output

| File | Use |
| --- | --- |
| `name.svg` | The deliverable. Animates in `<img>`, inline, in Markdown and in READMEs. Honours reduced-motion settings |
| `name.experience.html` | Optional interactive page: step-through, scroll-driven, hover details |
| `name.html` | A preview with play, pause and scrub |
| `name.sheet.png` · `name.looks.png` | Key frames of the loop, and the scene in several looks, for review |
| `name.png` · `name.mp4` · `name.gif` · `name.webm` | Optional exports (need a Chrome-family browser; video needs ffmpeg) |

A small transparent component for a feature card is the same thing with `background: false`:

<p align="center"><img src="gallery/sync-badge.svg" alt="A phone and a laptop kept in sync through a cloud" width="380"></p>

## Repository layout

```
skills/concept-illustration/
  SKILL.md            what the agent reads first
  references/         design guide, custom objects, API, kit, recipes, delivery
  examples/           finished scenes, one per pattern
  scripts/            the engine (zero dependencies), build and render commands
gallery/              built examples used in this README
dev/                  tests and the gallery builder
```

## Development

```bash
npm test             # examples, every object, every look, error messages
npm run gallery      # rebuild gallery/ from the examples
npm run list         # print every object, icon, look, token and recipe
```

## License

MIT
