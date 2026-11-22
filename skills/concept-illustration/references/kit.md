# Kit reference

Fifty object kinds, the icons and screen contents they can carry, and the tokens that travel between them. `node SKILL_DIR/scripts/build.mjs --list` prints the same lists from the engine itself. When none of these is the right object, build your own: see [custom.md](custom.md).

Contents: [choosing an object](#choosing-an-object) · [all kinds](#all-kinds) · [options shared by several kinds](#options-shared-by-several-kinds) · [icons](#icons) · [screen content](#screen-content) · [tokens](#tokens) · [combining objects](#combining-objects)

## Choosing an object

Pick the most literal object the viewer already knows. When the idea is abstract, pick by role:

| The thing is... | Use |
| --- | --- |
| Something that computes or serves | `server` `chip` `gear` |
| Something that stores | `database` `folder` `stack` `battery` |
| Something that waits or moves in line | `queue` `conveyor` |
| A person | `user` (several for a team) |
| An AI or automated actor | `robot` (has personality) `orb` (abstract intelligence) `chip` (a model) |
| A screen people use | `laptop` `phone` `monitor` `browser` |
| A piece of content | `document` `card` `bubble` `package` |
| Money or value | `coins` `gem` |
| A measurement | `bars` `clock` `battery` |
| Protection or restriction | `lock` `shield` `wall` |
| A place | `building` `house` `factory` `cloud` `globe` `pin` |
| An outcome or goal | `flag` `gem` `bulb` |
| A signal | `antenna` `sign` |
| Anything else | Your own object ([custom.md](custom.md)); failing that, a `tile` or `sign` with an icon |

Prefer one kind per meaning. If two objects are both servers, make both `server`; the viewer reads the repetition as "same sort of thing".

## All kinds

Sizes are footprint width × depth × height in cells, at `scale: 1`.

### Generic

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `tile` | 1.4 × 1.4 × 0.26 | `icon`, `text`, `size`, `w`, `d`, `h` | Icon or short text on a rounded slab. The universal stand-in |
| `cube` | 1 × 1 × 1 | `size`, `w`, `d`, `h`, `icon` (top), `text` (side), `radius` | Any block or module |
| `slab` | 2.4 × 2.4 × 0.18 | `w`, `d`, `h`, `icon`, `text`, `radius`, `iconAt: 'front'` | A layer or base of any size |
| `cylinder` | r 0.55, h 1 | `r`, `h`, `icon` | Tank, drum, pillar |
| `sphere` | r 0.5 | `r` | Node, particle |
| `platform` | 2 × 2 × 0.2 | `size`, `tiers` (1–3), `round`, `h` | Pedestal for a hero: `s.add('robot', { on: platform })` |
| `stairs` | 1.4 × n × 0.32n | `steps` (2–7), `dir: 'right' \| 'left'` | Climbs away from the viewer so every step shows |
| `stack` | 2.4 × 2.4 | `layers` (count or `[{ label, sub, color, icon }]`), `size`, `gap` | Floating layers as one object. For layers that animate separately use `recipes.layers` |
| `arrow` | 1.6 long | `dir: 'x' \| '-x' \| 'y' \| '-y'`, `length` | Solid arrow lying on the floor |

### Compute and data

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `server` | 1.15 × 1.15 × 1.6 | `units` (1–6, default 3) | Status lights blink |
| `database` | r 0.62, h 1.2 | `discs` (1–5, default 3) | |
| `chip` | 1.6 × 1.6 × 0.2 | `text` (default `'AI'`), `icon`, `size` | Dark body, gold pins |
| `queue` | 2.9 × 0.9 × 0.5 | `count` (2–8), `axis: 'x' \| 'y'` | Blocks in line; the last is accented |
| `conveyor` | 4 × 0.95 × 0.42 | `length`, `axis` | Belt moves. Send tokens along its top: `s.send([x0, y, 0.42], [x1, y, 0.42], { as: 'box' })` |
| `gear` | r 0.7 | `r`, `teeth`, `dir: 1 \| -1`, `speed` (seconds per turn) | Rotates. Mesh two by giving one `dir: -1` |
| `funnel` | 1.5 × 1.5 × 1.45 | | |
| `battery` | r 0.42, h 1.4 | `level` (0–1) | Turns red under 25% |

### Screens

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `laptop` | 1.5 × 1.05 × 1.05 | `ui`, `facing` | |
| `monitor` | 1.7 × 0.7 × 1.35 | `ui` (default `'dash'`), `facing` | |
| `phone` | 0.66 × 0.2 × 1.24 | `ui` (default `'chat'`), `facing`, `flat` | |
| `browser` | 2 × 0.3 × 1.6 | `ui` (default `'dash'`), `facing`, `w`, `h` | A window hovering above the floor |
| `card` | 1.6 × 1.1 × 0.07 | `ui`, `icon`, `w`, `d` | Lies flat. Lift it with `z` |
| `cursor` | 0.6 × 0.3 × 1.2 | `facing` | Pointer arrow |

### Content and value

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `document` | 0.86 × 0.3 × 1.24 | `facing`, `flat`, `stack` (1–4), `icon` | |
| `folder` | 1.15 × 0.4 × 0.96 | `facing` | |
| `package` | 1 × 1 × 0.8 | `size` | |
| `bubble` | 1.35 × 0.3 × 1.54 | `text`, `icon`, `w`, `facing` | With neither, shows three typing dots |
| `coins` | r 0.42 | `count` (1–8), `icon` | |
| `bars` | 2 × 0.8 × 1.4 | `values` (array of numbers) | The tallest bar is accented |
| `gem` | r 0.42, h 1.2 | `size` | Hovers |

### People and agents

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `user` | r 0.38, h 1.2 | `head` (colour) | Abstract figure. Body takes `color` |
| `robot` | 0.95 × 0.85 × 1.62 | `facing` | Eyes blink |
| `orb` | 1.2 × 1.2 × 1.5 | `r` | Sphere over a pedestal; glows on dark palettes |

### Places and scenery

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `building` | 1.3 × 1.3 × 2.5 | `floors` (2–8), `w` | Lit windows |
| `house` | 1.5 × 1.4 × 1.35 | `roof` (colour) | |
| `factory` | 2 × 1.5 × 2.2 | | Saw-tooth roof, chimney |
| `cloud` | 1.84 × 0.34 × 1.55 | `size`, `facing`, `flat` | Upright cloud. `flat: true` gives a slab that objects can stand on |
| `globe` | 1.2 × 1.2 × 1.6 | | |
| `pin` | r 0.3, h 1.25 | | |
| `tree` | r 0.45, h 1.5 | `size` | Use sparingly, as scenery |
| `sun` | r 0.5 | `r` | Rays turn. Raise it: `z: 2.2` |
| `truck` | 2.3 × 1 × 1.3 | | Faces +x. Also works as a travelling token |

### Meaning

| Kind | Size | Own options | Notes |
| --- | --- | --- | --- |
| `sign` | 0.92 wide, 1.4 high | `icon`, `text`, `shape: 'circle' \| 'square' \| 'hex'`, `size`, `facing` | A badge on a pole. Takes any icon or up to 3 characters |
| `lock` | 0.95 × 0.5 × 1.2 | `facing` | |
| `shield` | 0.96 × 0.3 × 1.4 | `icon` (default `'check'`), `facing` | |
| `wall` | 2 × 0.32 × 1.15 | `w`, `h`, `axis`, `icon` | A barrier. `icon: 'flame'` for a firewall |
| `clock` | 1.1 × 0.4 × 1.26 | `facing` | Hand turns |
| `bulb` | r 0.38, h 1.3 | | |
| `flag` | 0.4 × 0.4 × 1.5 | `facing` | |
| `antenna` | 0.7 × 0.7 × 1.9 | | Rings pulse |

## Options shared by several kinds

- **`facing`**: `'left'` (default) turns the front toward the lower-left of the picture, `'right'` toward the lower-right. Point screens and signs toward the object they relate to, or toward the centre of the scene.
- **`color`** recolours the body; **`accent`** recolours details. Both take a role or a hex. `hero: true` sets `color: 'accent'` for you.
- **`icon`** takes any name from the list below. **`text`** takes a few characters and overrides `icon`.

## Icons

95 line icons. Use them on `tile`, `sign`, `cube`, `chip`, `card`, `slab`, `shield`, `bubble`, `wall`, `coins`, as screen content (`ui: 'icon:lock'`) and as story badges (`s.mark(obj, 'lock')`).

- **Actions**: `check` `x` `plus` `minus` `play` `pause` `stop` `sync` `swap` `download` `upload` `send` `share` `search` `filter` `power` `trash`
- **Arrows**: `arrow-right` `arrow-left` `arrow-up` `arrow-down` `trend` `cursor`
- **People and talk**: `user` `users` `chat` `mail` `bell` `mic` `heart` `star`
- **Technology**: `server` `database` `cloud` `cpu` `code` `terminal` `bug` `branch` `link` `wifi` `plug` `phone` `monitor` `grid` `layers` `hash`
- **Security**: `lock` `unlock` `key` `shield` `eye` `warning`
- **Content**: `file` `folder` `image` `video` `book` `camera` `tag` `box` `gift`
- **Business**: `chart` `pie` `cart` `card` `dollar` `bank` `scale` `truck` `calendar` `clock` `target` `trophy` `flag`
- **Ideas and AI**: `sparkles` `brain` `bulb` `atom` `rocket` `bolt` `gear` `wrench`
- **World**: `globe` `home` `pin` `sun` `moon` `leaf` `flame` `drop` `battery`
- **Status**: `info` `question` `dots`

Icons on a top face lie on the floor plane, so diagonal strokes look horizontal or vertical. Shapes that depend on a diagonal (`check`, `x`) read better on an upright `sign` or as a `s.mark` badge.

## Screen content

`ui` fills the screen of `laptop`, `monitor`, `phone`, `browser` and the face of `card`.

| `ui` | Shows |
| --- | --- |
| `'lines'` | A heading and paragraph lines |
| `'code'` | Indented coloured code lines |
| `'chart'` | Rising bars |
| `'dash'` | Two stat cards over a bar chart |
| `'chat'` | Alternating message bubbles |
| `'list'` | Bulleted rows |
| `'image'` | A picture placeholder |
| `'play'` | A play button |
| `'login'` | An avatar, two fields and a button |
| `'blank'` | Nothing |
| `'icon:<name>'` | One icon, centred |
| `'text:<short>'` | A few characters, centred |

Choose the content that tells what the screen is for: `code` for a developer, `chat` for a conversation, `dash` for monitoring.

## Tokens

What travels in `s.send(a, b, { as })`:

| Token | Reads as |
| --- | --- |
| `dot` (default) | A signal, a request, a unit of data. Glows on dark palettes |
| `doc` | A document, a page, a response with content |
| `cube` | A block of data, an encrypted or opaque payload |
| `box` | A package, a build artefact, goods |
| `coin` | Money, a credit, a token of value |
| `mail` | A message, a notification, an order |
| `gem` | A result, something valuable or finished |
| any kind, including your own | `as: 'truck'`, `as: 'user'`, `as: 'oven'` with `scale` (default 0.5) |

`color` tints a token: `s.send(a, b, { as: 'cube', color: 'danger' })`.

## Combining objects

- **Pedestal**: `const base = s.add('platform', { at: [0, 0] }); s.add('orb', { on: base, hero: true });` Link to the platform, not to the object standing on it, so links meet the floor cleanly.
- **Group**: several of one kind in a `s.zone` reads as a cluster: `s.grid(3, 2)` of `server` inside a zone labelled `REGION`.
- **Annotation**: a small `sign` beside an object adds a meaning without a new actor: a `sign` with `icon: 'lock'` next to a `database`.
- **Height as hierarchy**: put the thing in charge on a `platform` with `tiers: 2`.
- **Scenery**: one to three `tree` objects or a `cloud` give a place without adding meaning. Keep them away from links and leave them unlabelled.
