# Recipes

A recipe turns a short config into a complete scene: objects placed, links drawn, a story written and timed. Start from one whenever the idea has one of these seven shapes: [pipeline](#pipeline) · [hub](#hub) · [layers](#layers) · [cycle](#cycle) · [fanout](#fanout) · [growth](#growth) · [steps](#steps).

```js
export default ({ recipes }) => recipes.pipeline({
  look: 'paper',
  title: 'From commit to production',
  stages: [
    { kind: 'laptop', label: 'Commit', ui: 'code' },
    { kind: 'gear',   label: 'Build' },
    { kind: 'shield', label: 'Test' },
    { kind: 'server', label: 'Production', hero: true },
  ],
});
```

Rules shared by all recipes:

- Every recipe accepts every scene option alongside its own: `look`, `finish`, `floor`, `palette`, `accent`, `accent2`, `title`, `heading`, `subheading`, `background`, `bg`, `detail`, `aspect`, `pad`, `loop`, `intro`, `font`. Choose the look for the subject every time; a recipe decides the layout, not the art direction.
- A `kind` may be one you defined yourself. Because `s.define` needs the scene first, add custom objects after the recipe returns, or build that scene by hand.
- An item is `{ kind, label, sub, ...any option of that kind or of s.add }`, so `hero: true`, `color`, `scale`, `icon` and `ui` all work on an item. A plain string is shorthand for a `tile` with that label. Without `kind` you get a `tile`, so give it an `icon`.
- `say: '...'` on an item sets the caption shown when the story reaches it. An item without `say` keeps the previous caption.
- A recipe returns an ordinary scene. Keep adding to it before returning:

```js
export default ({ recipes }) => {
  const s = recipes.hub({ /* ... */ });
  s.zone({ around: s.objects, label: 'PARTNERS', style: 'dashed' });
  return s;
};
```

## pipeline

Stages in order; a token travels through them.

```js
recipes.pipeline({
  stages: [                       // 2 to 8
    { kind: 'laptop', label: 'Order', say: 'A customer places an order', emits: 'mail' },
    { kind: 'factory', label: 'Pack', emits: 'box' },
    { kind: 'truck', label: 'Ship', emits: 'box' },
    { kind: 'house', label: 'Deliver', hero: true, mark: 'check' },
  ],
  token: 'dot',                   // default token for every hop
  wrap: 4,                        // stages per row; more than 5 stages wrap into two rows by default
  gap: 4.4,                       // distance between stages
  done: 'check',                  // badge on the last stage (false for none)
});
```

Per stage: `emits` is the token that leaves it (change it when the thing changes form); `mark` pops a badge when the token arrives.

Returns the scene with `s.objects` (the stage handles, in order).

## hub

One thing in the middle, others around it.

```js
recipes.hub({
  center: { kind: 'chip', label: 'Gateway', text: 'API' },   // becomes the hero on a pedestal
  spokes: [                       // 2 to 8
    { kind: 'database', label: 'Orders' },
    { kind: 'coins', label: 'Billing' },
    { kind: 'user', label: 'Accounts' },
  ],
  mode: 'both',                   // 'both': all in, then all out · 'out' · 'in' · 'each': one round trip at a time
  say: ['Every service talks to the gateway', 'and the gateway answers each one'],
  radius: 4.6,
  platform: true,                 // false to stand the centre on the floor
});
```

Use `mode: 'out'` for broadcasting or distribution, `'in'` for collection or aggregation, `'each'` when the order of the conversations matters (four spokes or fewer).

Returns `s.objects` (spokes) and `s.center`.

## layers

Slabs stacked in the air, listed from the top down. Each lifts in turn while its caption shows.

```js
recipes.layers({
  layers: [                       // 2 to 6, top first
    { label: 'Interface', sub: 'what people see', icon: 'cursor', say: 'People only meet the top layer' },
    { label: 'Logic', sub: 'rules and decisions', icon: 'gear' },
    { label: 'Data', sub: 'what is remembered', icon: 'database' },
  ],
  focus: 0,                       // index of the accented layer
  direction: 'down',              // order of the walk-through: 'down' or 'up'
  size: 3, gap: 0.95,
});
```

Returns `s.objects` (layers, top first).

## cycle

A loop that returns to its start. A token goes round continuously.

```js
recipes.cycle({
  stages: [                       // 3 to 6
    { kind: 'cube', label: 'Build', icon: 'wrench', say: 'Build the smallest useful thing' },
    { kind: 'bars', label: 'Measure' },
    { kind: 'bulb', label: 'Learn' },
    { kind: 'document', label: 'Plan' },
  ],
  center: { kind: 'gear', color: 'accent' },   // optional object in the middle
  token: 'dot',
});
```

Four stages form a square with straight links; other counts form a ring. Returns `s.objects` and `s.center`.

## fanout

One source feeding many targets, or many feeding one.

```js
recipes.fanout({
  source: { kind: 'user', label: 'Clients' },
  router: { kind: 'cube', label: 'Load balancer', icon: 'share' },   // optional; becomes the hero
  targets: [                      // 2 to 6
    { kind: 'server', label: 'Server A' },
    { kind: 'server', label: 'Server B' },
    { kind: 'server', label: 'Server C' },
  ],
  mode: 'all',                    // 'all': to every target at once · 'each': one after another
  reverse: false,                 // true: targets send inward and one result comes out
  say: ['Requests arrive at one address', 'and are shared between servers'],
});
```

`reverse: true` tells an aggregation story. The `targets` become the many senders, the `router` is where they meet, and the `source` receives the one result:

```js
recipes.fanout({
  reverse: true,
  targets: [{ kind: 'card', label: 'Email' }, { kind: 'bubble', label: 'Chat' }, { kind: 'phone', label: 'Reviews' }],
  router: { kind: 'funnel', label: 'Triage' },
  source: { kind: 'bars', label: 'Roadmap' },
});
```

Returns `s.objects` (targets), `s.source`, `s.router`.

## growth

A quantity that grows or shrinks. Bars rise out of the floor one after another, climbing up and to the right.

```js
recipes.growth({
  values: [                       // 2 to 8: numbers, or items with a label and caption
    { value: 1000, label: 'Start', say: 'You put away $1,000' },
    { value: 1403, label: 'Year 5' },
    { value: 1967, label: 'Year 10', say: 'Each year is worked out on more money' },
    { value: 3870, label: 'Year 20' },
  ],
  prefix: '$', suffix: '',        // how values are written under the labels
  token: 'coin',                  // optional: something hops from each bar to the next
  baseline: 0,                    // the value drawn as zero height
  focus: 3,                       // index of the accented bar (default: the last)
  done: 'trend',                  // badge at the end: an icon name, 'peak' to badge the tallest, or false
});
```

Bar heights are proportional to the values, so the picture is honest about the numbers; very small values keep a minimum height so they still read as bars. The scene is compact and roughly square: leave `aspect` unset. Returns `s.objects` (the bars).

## steps

A climb, one level at a time. A figure hops up the stairs to a flag.

```js
recipes.steps({
  steps: [                        // 2 to 7, lowest first
    { label: 'Learn', sub: 'follow along', say: 'First you follow instructions' },
    { label: 'Practise', sub: 'build small things' },
    { label: 'Ship', sub: 'release real work' },
    { label: 'Teach', sub: 'explain it to others' },
  ],
  climber: 'user',                // any kit kind
  goal: 'flag',                   // any kit kind, or false
});
```

Returns the scene with `s.stairs`.

## When no recipe fits

Write the scene directly. The examples folder has finished custom scenes for the shapes recipes do not cover:

| Example | Shape |
| --- | --- |
| `examples/request-lifecycle.scene.mjs` | A row with a change of state halfway and a second pass |
| `examples/agent-loop.scene.mjs` | A hero with helpers and round trips that end in a result |
| `examples/encryption.scene.mjs` | A U-shaped route, a token that changes form, an onlooker |
| `examples/parcel-journey.scene.mjs` | A physical journey with a vehicle driving a road |
| `examples/photosynthesis.scene.mjs` | Inputs converging on a hero, outputs leaving it |
| `examples/sync-badge.scene.mjs` | A small transparent component with continuous flow and no story |

Recipe examples: `ci-pipeline`, `app-layers`, `feedback-loop`, `load-balancer`, `compound-growth`, `learning-path`.
