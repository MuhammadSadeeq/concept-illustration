# Changelog

## 1.1.0 — 2026-11-23

Prompted by a review of 49 animations made with the skill, and by further rounds of testing with a small model.

### Changed (may affect scenes you already have)

- **One clock.** Moving parts, floats and flows now count from the moment the story starts, the same zero that captions and review sheets use. Before, parts of custom objects started when the page loaded and so ran ahead of the captions by the length of the intro (about 0.7 s). If a scene compensated for that by hand (a `phase`, shifted keys, or `s.wait` arithmetic), remove the compensation.
- The frame now takes in moving parts over their whole travel. Scenes that widened `pad` by hand to make room for a moving part can go back to the default.
- Object labels step aside while the camera is zoomed in.

### Added

- Checking: `s.expect(t, test, message)` states a fact about the motion and the build verifies it; `--motion` prints the story timeline and where each moving part is at every key moment; `--frames 2.3,2.6` takes chosen moments; `--trails` shows direction in a still; `--focus <id | x,y,z>` and `--zoom` look closely at one part. Shapes take `name`.
- A hint when a moving part passes through another shape at some moment of the loop.
- Timing: story steps take `at: seconds`; callouts take `from` and `until`; animations take `delay` (seconds later) beside `phase` (already ahead); `sense: 'cw' | 'ccw'` on anything that spins or orbits.
- Camera: `s.zoom(target, k, { hold })` moves in on an object or point and back out.
- `s.draw(shapes)`: shapes that are not objects (arrows, guides, particle paths) and so are never in anything's way. Link flows take `reverse`, `jitter` and `r`.
- A report item when an object moved with `s.move` ends up on the wrong side of the drawing order, and when a story overruns the `loop` asked for.
- `s.point(obj, 'name')` gives the position of a named shape, to aim a callout or end a link at a part. A hint when a callout's words sit on another object or callout.
- Series: `scene({ series })` shares a look, a size and custom kinds across a set of scenes.
- Components: `sh.stream` (many particles on a path: drift, alternate with an optional travelling wave, zigzag), `sh.arrow`, `sh.ripple`, `bar` and `readout` artwork, a `show` animation, `fade` on keyed parts. Artwork colours accept palette roles.
- Framing: `size: [w, h]` fixes the image size; the build prints the `<img>` tag.
- Hints for text too small to read, for labels that will be tiny on a phone, and for unusually large files (with what they are made of).
- Keys take `t: seconds`; `bar` and `readout` take `seconds: true`. `at()` in `s.expect` also returns `level`.
- Chosen frames and close-ups are written to `<name>.frames.png`, leaving the full sheet in place; wide scenes get larger tiles on the sheet.
- Examples: `sound-wave`, `electric-circuit`. A browser-driven test of the interactive page, and a test that the build-time checker agrees with a real browser.
- `references/checking.md`.

### Fixed

- A caption inside a group of steps could start later than the steps it describes.
- Labels now keep clear of objects that only appear later in the story.
- The overlap check counted the full height of an object sunk into the floor with `level`.

- `phase` was documented as "started later"; it runs a part ahead.
- `SKILL.md` is shorter: the mechanism example and the checking procedure moved into the references.

## 1.0.0 — 2026-11-22

First release: the isometric scene engine, fifty objects, seven recipes, 22 palettes × 6 finishes × 5 floors, custom objects and moving parts, mechanism vignettes, interactive output (`--experience`), seventeen examples.
