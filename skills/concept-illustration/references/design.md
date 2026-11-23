# Design guide

Taste is a series of decisions made for a reason. This guide gives the reasons. The engine guarantees correct geometry, lighting and harmony inside whatever you choose; it cannot choose for you, and it cannot tell whether the picture says anything.

Contents: [finding the picture](#finding-the-picture) · [art direction](#art-direction) · [from abstract to concrete](#from-abstract-to-concrete) · [composition in depth](#composition-in-depth) · [detail and micro cues](#detail-and-micro-cues) · [colour](#colour) · [words](#words) · [motion](#motion) · [variety](#variety) · [small components](#small-components) · [review](#review)

## Finding the picture

A concept illustration is an argument made with objects. It works when someone who sees it for three seconds can say what it claims.

1. **Write the claim.** One sentence with a subject, a verb and a visible result. "A queue lets a slow worker fall behind without losing any job."
2. **Find the moment.** Which instant of that sentence would make the best photograph? Usually just after the cause and just before the effect: jobs piling up while one is being worked on. That frame is your still.
3. **Find the change.** What differs between start and end? Something arrived, was transformed, flipped state, grew. That difference is your story.
4. **Cut.** Remove anything the sentence does not mention.

If you cannot write the claim, you do not understand the idea well enough to draw it yet. Read the source material or ask.

**Test:** cover the labels. Can you still tell the actor, the thing acted on, and the direction of flow? If not, the composition is leaning on text.

## Art direction

Decide the look before placing an object. Ask four questions.

**1. What does the subject feel like?** Not the industry, the feeling. Urgent or calm, precise or warm, playful or grave, natural or engineered.

| Feeling | Palettes to start from | Finish |
| --- | --- | --- |
| Precise, technical, trustworthy | `ocean` `sky` `slate` `paper` `blueprint` | `solid`, `outline` |
| Powerful, nocturnal, cutting-edge | `aurora` `abyss` `neon` `carbon` | `solid`, `neon` |
| Warm, human, hand-made | `sand` `ember` `sunset` `blossom` | `soft`, `flat` |
| Fresh, healthy, growing | `mint` `forest` `sky` | `soft`, `solid` |
| Playful, young, energetic | `lemon` `grape` `sunset` `plum` | `flat`, `soft` |
| Calm, premium, considered | `clay` `sand` `mint` `plum` | `soft` |
| Formal, printed, archival | `mono` `noir` `slate` `paper` | `outline` |
| Minimal, product-like, quietly confident | `studio` `mono` `clay` | `line`, `soft` |

**2. Where will it live?** A dark page needs a dark palette and a light page a light one, or the image becomes a rectangle stuck on the page. If the page colour is known use `bg`; if the image should float on the page use `background: false`.

**3. Is there a brand?** Then the brand decides. For one brand colour keep a built-in look and set `accent: '#hex'`; for a full scheme pass `palette: { bg, accent, accent2 }` (it needs `bg` and `accent`). Choose a mid-tone from the brand palette for the accent: very light or very dark colours lose their shading.

**4. What should the finish say?**

- `solid`: the object is real and has weight. The natural choice for hero images.
- `soft`: friendly, touchable, premium. Rounder corners, diffuse shadows.
- `outline`: this is a drawing that explains. Best beside text, in documentation, where precision matters more than atmosphere.
- `line`: almost nothing but form. White surfaces, hairlines, generous rounding, and colour only where you put the accent. It rewards few objects and exact proportions, and punishes clutter. The natural finish for a vignette.
- `flat`: bold and graphic, like a poster or an editorial spot. Long cast shadows give direction and energy.
- `neon`: light itself is the material. For futuristic or electric subjects on dark palettes only.

And the floor: `plate` turns the scene into a self-contained diorama with an edge, a thickness and its own shadow (good for a hero or a card). `grid` says engineered space. `dots` is quieter. `rings` radiate from the centre and suit hubs and broadcasts. `none` lets light and shadow do everything and suits soft and flat finishes.

Any palette works with any finish and floor. If two candidates both seem right, render them: `--looks mint:soft:plate,sand:flat,sky:outline` and choose with your eyes.

## From abstract to concrete

Abstract ideas need a stand-in that people already know. Choose it by what the thing *does* in your sentence.

| What it does | Stand-in |
| --- | --- |
| Keeps things | `database` `folder` `battery`, a zone, your own vault or shelf |
| Transforms things | `gear` `factory` `funnel` `chip`, your own machine |
| Decides | `robot` `orb`, a `sign` with `question` |
| Guards | `lock` `shield` `wall` |
| Waits in order | `queue` `conveyor` |
| Carries | a token on a link, `truck`, `cloud` |
| Observes or measures | `monitor` `bars` `clock`, a `sign` with `eye` |
| Is the goal | `flag` `gem`, a `sign` with `check` |
| Is a person or a role | `user`, coloured per role |
| Is a place or boundary | a zone, `building`, `cloud`, `globe` |

- **Literal beats clever.** If the subject has a real object, show that object. If the kit lacks it, build it (see [custom](custom.md)): a syringe for a vaccine, an oven for a bakery, a ballot box for an election.
- **Keep one metaphor.** If the system is a postal service, everything is post. Do not mix in a factory halfway.
- **Say where a metaphor stops**, in a caption, when it implies something untrue.
- **Same kind, same meaning.** Two things of one sort use one object.
- **Quantities need a real scale.** Use `recipes.growth` or `bars` with real values, or put the number in a label. A bigger cube is decoration, not data. When the last value is fifty times the first, the first bars will be short: that contrast is the message, so keep it and put the numbers in the labels.
- **Change over time is motion.** If something grows, let it grow (`level: 0` then `s.grow`). If something piles up, let it pile up: hidden items revealed one by one with `s.pop` and removed with `s.hide`.

## Composition in depth

**One focal point.** Exactly one `hero`. Place it at the centre or at the end of the flow; raise it on a `platform` when it governs the others, or give it `scale: 1.2` to `1.4`.

**Three planes.** A flat row of equal objects is a diagram. A scene has a back, a middle and a front:

- *Back* (small `x + y`): the tallest things and the scenery. A `building`, trees, a `cloud` on `z`.
- *Middle*: the actors and the links between them.
- *Front* (large `x + y`): low things, tokens, the result.

Differences in height matter as much as position: a tall hero, mid-height helpers, flat tiles. If every object is the same height the scene reads as a list.

**Read along x.** A row along `x` runs from upper-left to lower-right, matching both left-to-right and top-to-bottom reading.

**Stay on the grid.** Whole and half cells. Linked objects share an `x` or a `y`. Straight links are calm; a kinked link looks like a mistake.

**Spacing carries meaning.** 4 to 5 cells between centres. Equal gaps say "equal steps". A larger gap or a zone boundary says "a different place".

**Proven layouts**

```
Row of three        [0,0]  [4.5,0]  [9,0]
Two lanes           [0,0]  [4.5,0]  [9,0]   and   [0,4.5]  [4.5,4.5]  [9,4.5]
L shape             [0,0]  [4.5,0]  [9,0]  [9,4.5]
U shape             [0,0]  [4.5,0]  [9,0]  [9,4.5]  [4.5,4.5]
Hub                 centre [0,0], others from s.ring(n, { r: 4.6 })
Fan-in              sources [0,-4.5] [0,0] [0,4.5], hero [5,0], result [10,0]; links with route: 'straight'
Hero on pedestal    platform at [0,0], hero with on: platform
Before and after    zone A around [0,0]..[4,4], zone B around [7,0]..[11,4]
With scenery        actors on y = 0; two or three trees or buildings at y = -3, between the actors
```

Do not use the same layout twice in a row. A second scene in a series can run along `y` instead of `x`, or change shape entirely.

**Leave room.** Empty floor is part of the picture. 3 to 5 objects for a component, 5 to 9 for a hero. Above 9, split the idea.

## Detail and micro cues

Detail is what makes a scene feel made rather than generated. It also has a hierarchy: the hero gets the most, the helpers little, the scenery none.

**What the engine adds by itself** (so do not fake these):

- A tight contact shadow where each object meets the floor and a softer shadow thrown away from the light, longer for taller objects.
- Rim light on upper edges, darker bases, a haze that pushes the far side back.
- A small socket where each link leaves an object, and an arrowhead that stops at the object's outline.
- A trail behind each travelling token, a bounce where it lands, a burst of rays around each badge.
- Motes of light drifting up around a glowing hero.
- Status lights that blink out of step, glare on glass, cursors, typing dots and breathing chart bars on screens.

**What you add:**

- **The right screen.** `ui: 'code'` on the developer's laptop, `'chat'` on the support phone, `'dash'` on the operations monitor. A screen with generic lines says nothing.
- **A second line** (`sub`) on the hero and on anything ambiguous: "close to the visitor", "7% a year".
- **State you can see.** A `sign` beside an object, a `tint`, a `mark`. Never leave a state to the caption alone.
- **Counts that are true.** Three servers when there are three; a `queue` whose `count` matches the story.
- **Your own telling detail** on a custom object: the oven's glowing window, the turbine's turning blades. One per object.
- **Scenery with a job.** Trees for outdoors, a building for a city, a cloud for "hosted": one to three items, unlabelled, at the back.

**When to hold back.** For anything under about 400 px wide use `detail: 'clean'`: small cues turn to noise at that size.

## Colour

Each palette is tuned as a whole. Your decisions are about meaning.

- **Neutral by default.** Most objects keep the default colour. Sameness lets one coloured thing stand out.
- **Accent means "look here".** The hero and the tokens that carry the story.
- **`accent2` means "the other kind".** A contrasting party, the response as opposed to the request.
- **`ok`, `warn`, `danger` mean state**, or an actor that is itself good, risky or harmful (a virus, an attacker). Never decoration.
- **At most three hues** in view, not counting neutrals.
- Some kinds colour a part themselves (`bars` its tallest bar, `stairs` its top step); when such an object is the hero that part switches to `accent2`.

## Words

- **Label = noun, 1 to 3 words.** "Edge cache".
- **`sub` = one short qualifier.** "close to the visitor".
- **Caption = a sentence about now.** Present tense, under 60 characters. Read the captions in order with the picture hidden: they should tell the idea by themselves.
- **`info` = one or two sentences** for a reader who hovers: what it is and why it matters here.
- **Use the user's vocabulary.** If they say "workspace", the label says "Workspace".
- Do not label scenery.

## Motion

Motion shows cause and effect. Everything else is noise.

**Structure of a loop**

1. *Rest* (0.3 s): the whole still, so the viewer can orient.
2. *Trigger*: the first token leaves, or the first object pulses.
3. *Chain*: each arrival causes the next thing. Never start an effect before its cause arrives.
4. *Result*: a visible change that stays: `tint`, `mark`, `pop`, `grow`.
5. *Hold* (about 1 s): let it be read.
6. Reset: the engine restores every changed state invisibly.

**Choreography**

- **One actor at a time.** The eye follows one moving thing. Run steps together only when simultaneity is the point.
- **Tokens keep their identity.** What leaves is what arrives. If the thing is transformed at a stop, a different token goes on.
- **Vary the rhythm.** Three hops of identical length feel mechanical. Follow a quick hop with a longer one, a pause with a burst (`count: 3`), a build-up with a held result.
- **Stagger what happens together.** In a parallel group give each step `delay: i * 0.12`: a wave reads better than a volley.
- **Persistent beats transient.** A colour change that stays teaches more than a flash.
- **Direction matters.** Main flow along `x`. A return trip visibly comes back the same way with a different token.
- **Pace.** A hop takes about a second. 6 to 12 seconds per loop; past 16 the viewer leaves before the result.
- **Ambient motion is seasoning.** One floating hero or one flowing link. With a rich story, none.
- **Words and picture together.** A caption that arrives a second before or after the thing it describes is worse than no caption. Pin captions to the moments they describe (`{ at: seconds }`) and read the timeline printed by `--motion` to confirm.
- **Direction is content.** Which way a current flows, a planet turns or a wave travels is part of what the picture claims. Decide it from the subject, state it, and check it; never leave it to how the axes happen to run.
- **Still first.** With motion off (reduced-motion settings, a PDF, a thumbnail) the picture shows the resting state with tokens parked on their routes. That frame must make the claim.

**Story, flow or stillness?**

| Use | When |
| --- | --- |
| `s.story([...])` | The idea is a sequence: first this, then that, therefore this |
| `flow: true` on links | The idea is a steady state: traffic always moving, things staying in sync |
| Neither | The idea is a structure. Float the hero at most |
| `--experience step` | The reader needs to control the pace: teaching, onboarding, a product tour |
| `--experience scroll` | The scene accompanies a long article and should advance with it |

## Vignettes

Sometimes the clearest picture of an idea is one small machine doing one thing. A vignette has a single object, no labels, no links and no captions; its parts act the idea out on a loop. A press stamps each document: approval. A turntable shares parcels between two lanes: routing. A lighthouse sweeps its beam: watching.

Choose it when the idea is a *behaviour* that has a physical cousin (filter, gate, sort, press, lift, pour, lock, scan, balance, merge), and when the slot is a hero, a feature card or a section opener rather than a diagram.

- **Find the cousin.** Ask what real mechanism already does this. A rate limiter is a turnstile. A cache is a shelf beside a door. A retry is a ball that rolls back down a ramp. A queue is a chute.
- **Reduce it.** Two to five parts: what stays still, what moves, what is acted upon. If you need a label to explain a part, the mechanism is wrong or too detailed.
- **Make the object plausible.** Parts must be held by something: a head needs a ram, a gate needs posts, a belt needs a bed. A part floating in the air breaks the illusion at once.
- **One colour.** The part that does the work takes the accent; the thing it acts on takes a second, quieter colour at most; everything else is neutral.
- **Choreograph weight.** Things wait, then move, then rest. Heavy things gather speed going down (`ease: 'in'`) and settle (`'out'`); light things can overshoot (`'back'`); belts and sweeps are `linear`. Hold the result long enough to be seen: at least half a second.
- **Cause first.** The gate is open before the parcel arrives. The seal appears as the head lands, not after.
- **Generous frame.** The object should take about half the frame's width, with calm space around it.

A vignette is not a smaller diagram. If the idea has three named actors exchanging things, it is a scene, and labels will serve it better.

**Working models.** Science and engineering subjects often need both: the machine itself, moving truthfully, and the names of its parts. Build the machine as a custom object with real moving parts, stand it in a scene, name whole objects with labels and parts of the machine with `s.callout`, and let two to four captions walk through the cause and effect. Get the relationships right before the polish: what turns together shares a period, what peaks together shares a phase, and what is zero at the same instant starts at the same instant. A model that moves correctly teaches even with the captions off.

## Variety

Sameness is the commonest failure of generated illustration. Guard against it deliberately.

- **Never start from the last scene's look.** Choose again from the subject.
- **Rotate the big decisions**: dark or light, finish, floor, layout shape, which object is tall, and the form itself: a labelled scene, a recipe, a vignette, an interactive walk-through.
- **Build at least one object for the subject** whenever the kit's nearest match is generic.
- **Change the hero.** It is not always a server in the middle. It can be the person, the result, the thing that changes.
- **In a series**, hold the look and the cast constant and vary composition and story, so the pieces are siblings, not twins.

## Small components

For an animated component inside a card, a feature grid or a button-sized slot:

- 2 to 4 objects, no captions, at most one label, `detail: 'clean'`.
- `background: false` to sit on the page's own surface, `intro: false` to be ready at once, `pad: 24` to crop tightly. The card itself (border, radius, padding) belongs to the page's CSS.
- A continuous `flow` or a 3 to 5 second story.
- Without a background choose a palette whose text reads on the surface.

## Review

Look at the sheet or the preview and answer honestly:

1. In three seconds, what does this picture claim? Is that the sentence you wrote?
2. Where does the eye go first? Is that the hero?
3. Would a stranger guess the subject from the look alone? If it could be about anything, the art direction is generic.
4. Is there depth: a back, a middle, a front, different heights?
5. Is any object the nearest available one rather than the right one? Build the right one.
6. Could you delete an object or a label without losing the claim? Delete it.
7. Does each motion have a cause you can see? Does the last frame before the loop restarts show the result? Is every moving part held by something?
8. Would it still work as a still, in greyscale?

Fix the weakest answer and build again. Two passes of this review improve a scene more than any added detail.
