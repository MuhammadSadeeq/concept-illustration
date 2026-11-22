# Design guide

How to decide what the picture is, before and while you build it. The engine guarantees correct geometry, lighting and colour harmony. It cannot guarantee that the picture says something. This guide covers that part.

Contents: [finding the picture](#finding-the-picture) · [from abstract to concrete](#from-abstract-to-concrete) · [composition](#composition) · [depth](#depth) · [colour](#colour) · [words](#words) · [motion](#motion) · [themes](#themes) · [small components](#small-components) · [review](#review)

## Finding the picture

A concept illustration is an argument made with objects. It succeeds when someone who sees it for three seconds can say what it claims.

1. **Write the claim.** One sentence with a subject, a verb and a visible result. "A queue lets a slow worker fall behind without losing any job."
2. **Find the moment.** Which instant of that sentence would make a good photograph? Usually it is the moment just after the cause and just before the effect: jobs piling up in the queue while one is being worked on. That frame is your still.
3. **Find the change.** What is different between the start and the end? Something arrived, something was transformed, a state flipped, a count grew. That difference is your story.
4. **Cut.** List what you planned to draw. Remove anything the sentence does not mention. Three well-chosen objects explain more than nine.

If you cannot write the claim, you do not understand the idea well enough to draw it yet. Ask the user, or read the source material, before placing a single object.

**Test:** cover the labels. Can you still tell which object is the actor, which is acted on, and which way things flow? If not, the composition is relying on text.

## From abstract to concrete

Abstract ideas need a stand-in that people already know. Choose the stand-in by what the thing *does* in your sentence.

| What it does | Stand-in |
| --- | --- |
| Keeps things | `database` `folder` `battery` a zone |
| Transforms things | `gear` `factory` `funnel` `chip` |
| Decides | `robot` `orb` `sign` with `question` |
| Guards | `lock` `shield` `wall` |
| Waits in order | `queue` `conveyor` |
| Carries | a token on a link, `truck`, `cloud` |
| Observes or measures | `monitor` `bars` `clock` `sign` with `eye` |
| Is the goal | `flag` `gem` `sign` with `check` |
| Is a person or a role | `user`, coloured per role |
| Is a place or boundary | a zone, `building`, `cloud`, `globe` |

Guidelines:

- **Keep one metaphor.** If the system is a postal service, everything is post: `mail`, `truck`, `house`. Do not mix in a factory halfway.
- **Say where a metaphor stops.** If the stand-in implies something untrue (a `truck` suggests slowness), pick another or note it in a caption.
- **Same kind, same meaning.** Two things of the same sort use the same object; different sorts use different objects.
- **Quantities need a real scale.** If exact numbers matter, use `recipes.growth` or `bars` with real `values`, or state the number in a label. A bigger cube is decoration, not data.
- **Change over time is motion.** For a quantity that grows, let it grow: `recipes.growth`, or objects created with `level: 0` and raised with `s.grow`.
- **Wide ranges stay honest.** When the last value is fifty times the first, the first bars will be short. That contrast is the message; do not rescale it away. Put the numbers in the labels so the small ones can still be read.

## Composition

**One focal point.** Mark exactly one object `hero: true`. Place it at the centre of the scene or at the end of the flow. Raise it on a `platform` when it governs the others, or enlarge it with `scale: 1.2` to `1.4`.

**Read along x.** Viewers read left to right and top to bottom. A row along `x` runs from the upper-left to the lower-right, which matches both. Put the first actor at small `x` and the result at large `x`.

**Stay on the grid.** Whole and half cells only. Shared `x` or shared `y` between linked objects gives straight links; straight links give calm.

**Spacing.** 4 to 5 cells between centres. Equal gaps read as "equal steps"; a larger gap reads as a boundary. Use that on purpose.

**Proven layouts** (copy the coordinates):

```
Row of three        [0,0]  [4.5,0]  [9,0]
Two lanes           [0,0]  [4.5,0]  [9,0]   and   [0,4.5]  [4.5,4.5]  [9,4.5]
L shape             [0,0]  [4.5,0]  [9,0]  [9,4.5]
U shape             [0,0]  [4.5,0]  [9,0]  [9,4.5]  [4.5,4.5]
Hub                 centre [0,0], others from s.ring(n, { r: 4.6 })
Fan-in              sources [0,-4.5] [0,0] [0,4.5], hero [5,0], result [10,0]; links to the hero with route: 'straight'
Hero on pedestal    platform at [0,0], hero with on: platform
Before and after    zone A around [0,0]..[4,4], zone B around [7,0]..[11,4]
```

**Group with zones.** A `s.zone` around related objects says "these belong together" or "this is one environment". Label it in capitals with one or two words.

**Leave room.** The floor around the objects is part of the picture. A scene that fills its frame edge to edge feels like a diagram; one with air feels like an illustration.

**Count.** 3 to 5 objects for a component or a card, 5 to 9 for a hero or an explainer. Above 9, split the idea.

## Depth

Isometric space has no perspective, so depth comes only from overlap and position.

- **Back is up.** Small `x + y` is far, large is near. Tall things belong at the back, low things at the front.
- **Do not let things hide each other.** If a tall object stands directly in front of a short one, swap them or move one sideways.
- **Height is hierarchy.** Raised = important or governing. Sunk or flat = foundation.
- **Lift to separate.** A `browser`, `bubble`, `gem` or `cloud` hovering above the floor reads as "not a physical machine": information, an idea, a service.
- **Links live on the floor.** Route them around objects, never under. Use `arc: true` only for things that genuinely skip over (radio, a call, a jump).

## Colour

Each theme is a complete, tuned palette. Your decisions are about meaning.

- **Neutral by default.** Most objects keep the default `color`. Sameness lets the one coloured thing stand out.
- **Accent means "look here".** It belongs to the hero and to the tokens that carry the story.
- **`accent2` means "the other kind".** Use it for a contrasting party (a second team, the response as opposed to the request).
- **`ok`, `warn`, `danger` mean state.** Apply them with `s.tint` and `s.mark` when something succeeds, degrades or fails. Never use them as decoration.
- **Brand colour.** Pass `accent: '#hex'`. The theme derives lit and shaded tones from it. Very light or very dark brand colours lose their shading; choose a mid-tone from the brand palette.
- **At most three hues** in view at any time, not counting neutrals.
- **Some kinds colour a part themselves** (`bars` accents its tallest bar, `stairs` its top step). When such an object is also the hero, that part switches to `accent2` so it still stands out.

## Words

- **Label = noun, 1 to 3 words.** "Edge cache", not "The edge cache server".
- **`sub` = one short qualifier.** "close to the visitor".
- **Caption = a sentence about now.** "The edge has no copy yet, so it fetches one." Under 60 characters. Present tense. No full stop needed.
- **Captions carry the argument.** Read them in order with the picture hidden: they should tell the idea by themselves.
- **Do not label scenery**, and do not label what its shape already names when the caption mentions it.
- **Use the user's vocabulary.** If they call it a "workspace", the label says "Workspace".

## Motion

Motion is for showing cause and effect. Everything else is noise.

**Structure of a good loop**

1. *Rest* (0.3 s): the complete still, so the viewer can orient.
2. *Trigger*: the first token leaves, or the first object pulses.
3. *Chain*: each arrival causes the next thing. Never start an effect before its cause has arrived.
4. *Result*: a visible, persistent change: `tint`, `mark`, `pop`.
5. *Hold* (about 1 s): let the result be read.
6. Reset. The engine restores every changed state invisibly at the loop point.

**Principles**

- **One actor at a time.** The eye follows one moving thing. Run steps together only when simultaneity is the point (a fan-out, a broadcast).
- **Tokens keep their identity.** What leaves is what arrives. If the thing is transformed at a stop, send a different token onward (`doc` in, `box` out).
- **Arrivals land.** The engine bounces the receiver automatically; add `s.pulse` when the receiver then does work, `s.shake` when it refuses.
- **Persistent beats transient.** A colour change that stays teaches more than a flash that is gone.
- **Pace.** A hop takes about a second. A loop of 6 to 12 seconds holds attention; past 16 seconds viewers leave before the result.
- **Ambient motion is seasoning.** One floating hero, one flowing link. If the story is rich, use no ambient motion at all.
- **Still first.** With motion off (reduced-motion settings, PDF export, a thumbnail) the picture shows the resting state with tokens parked along their routes. Make sure that frame alone makes the claim.

**Things that pile up.** To show a backlog, a queue filling or stock accumulating, place the items as separate small objects with `hidden: true` and reveal them one by one as tokens arrive (`s.pop`), then remove them as they are taken (`s.hide`). A count that visibly changes explains waiting far better than a label that says so.

**Choosing between a story and a flow**

| Use | When |
| --- | --- |
| `s.story([...])` | The idea is a sequence: first this, then that, therefore this |
| `flow: true` on links | The idea is a steady state: traffic is always moving, things stay in sync |
| Neither | The idea is a structure. A still is the right answer; add `float: true` on the hero at most |

## Themes

Choose by where the image will live and what the subject feels like.

| Theme | Background | Use it for | Avoid it for |
| --- | --- | --- | --- |
| `aurora` | Dark indigo | Product pages, technology, anything that should glow | Printed pages, playful subjects |
| `carbon` | Dark graphite | Infrastructure, hardware, security, finance | Warm or human stories |
| `paper` | Cool off-white, outlined | Documentation, tutorials, technical blogs | Dramatic hero images |
| `mono` | White, black line | Print, academic and formal documents | Scenes that depend on colour for state |
| `clay` | Pale lilac, soft | Onboarding, education, consumer products | Dense technical diagrams |
| `sunset` | Warm peach to pink | Marketing, people, logistics, optimistic tone | Sober or cautionary subjects |
| `blueprint` | Drafting blue, outlined | Architecture, plans, "how it is built" | Stories about people |

Dark page → dark theme, light page → light theme. For a page with both modes, build twice (`--theme`) and swap with a `<picture>` element or CSS.

## Small components

For an animated component inside a card, a feature grid or a button-sized slot:

- 2 to 4 objects, no captions, at most one label.
- `background: false` so it sits on the page's own surface (a card, a tinted section), and `intro: false` so it is ready immediately. The card itself (border, radius, padding) belongs to the page's CSS, not to the scene. If the surface colour is known and fixed, `bg: '#ffffff'` also works.
- Without a background choose a theme whose text reads on the surface: `paper`, `mono`, `clay`, `sunset` on light; `aurora`, `carbon`, `blueprint` on dark.
- `pad: 24` to crop tightly.
- Prefer a continuous `flow` or a 3 to 5 second story. Long narratives do not work at small size.
- Check it at its real display width. Below about 360 px wide, drop labels entirely and let the surrounding page text name things.

## Review

Look at the sheet, or the preview, and answer honestly:

1. In three seconds, what does this picture claim? Is that the sentence you wrote?
2. Where does the eye go first? Is that the hero?
3. Is there any object you could delete without losing the claim? Delete it.
4. Is there any label you could delete? Delete it.
5. Does each motion have a cause you can see?
6. Does the last frame before the loop restarts show the result?
7. Would it still make sense as a still, in greyscale?

Then fix the weakest answer and build again. Two passes of this review improve a scene more than any added detail.
