#!/usr/bin/env node
// Engine checks: every example builds cleanly, builds are deterministic, every kind renders in
// every theme, and common mistakes produce helpful errors.   node dev/test.mjs

import fs from 'node:fs';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as iso from '../skills/concept-illustration/scripts/isokit.mjs';
import { makeRecipes, RECIPE_NAMES } from '../skills/concept-illustration/scripts/lib/recipes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const examples = path.join(root, 'skills/concept-illustration/examples');
let passed = 0, failed = 0;
const ok = (name, cond, detail = '') => { if (cond) passed++; else { failed++; console.error(`✗ ${name} ${detail}`); } };
const api = { ...iso, recipes: makeRecipes(iso.scene) };

// examples build without warnings, deterministically, as well-formed SVG
for (const file of fs.readdirSync(examples).filter((f) => f.endsWith('.scene.mjs'))) {
  const mod = await import(pathToFileURL(path.join(examples, file)).href);
  const a = (await mod.default(api)).build(), b = (await mod.default(api)).build();
  ok(`${file} has no warnings`, !a.notes.some((n) => n.level === 'warn'), a.notes.filter((n) => n.level === 'warn').map((n) => n.msg).join(' | '));
  ok(`${file} is deterministic`, a.svg === b.svg);
  ok(`${file} is well formed`, a.svg.startsWith('<svg') && a.svg.endsWith('</svg>') && !/NaN|undefined|Infinity/.test(a.svg), (a.svg.match(/.{20}(NaN|undefined|Infinity).{20}/) || [''])[0]);
  ok(`${file} has balanced groups`, (a.svg.match(/<g[ >]/g) || []).length === (a.svg.match(/<\/g>/g) || []).length);
  ok(`${file} is under 120 KB`, a.bytes < 120000, `${a.bytes}`);
}

// every kind in every theme
for (const theme of ['aurora', 'paper', 'clay', 'sunset', 'neon', 'mint']) {
  for (const kind of iso.KIND_NAMES) {
    try {
      const s = iso.scene({ theme });
      s.add(kind, { at: [0, 0], label: kind });
      s.add(kind, { at: [5, 0], hero: true, scale: 0.8 });
      const svg = s.toSVG();
      ok(`${kind} in ${theme}`, !/NaN|undefined|Infinity/.test(svg), (svg.match(/.{30}(NaN|undefined|Infinity).{30}/) || [''])[0]);
    } catch (e) { ok(`${kind} in ${theme}`, false, e.message); }
  }
}

// every icon, token, link style
{
  const s = iso.scene({});
  iso.ICON_NAMES.forEach((icon, i) => s.add('tile', { at: [(i % 10) * 3, Math.floor(i / 10) * 3], icon }));
  ok('all icons render', !/NaN|undefined/.test(s.toSVG()));
  const t = iso.scene({});
  const a = t.add('cube', { at: [0, 0] }), b = t.add('cube', { at: [5, 0] }), c = t.add('cube', { at: [5, 5] });
  ['line', 'dashed', 'dotted', 'pipe', 'road'].forEach((style, i) => t.link(a, i % 2 ? b : c, { style, flow: i < 3 }));
  t.link(a, c, { arc: true });
  t.story([...iso.PACKET_NAMES.map((as) => t.send(a, b, { as })), t.send(a, c, { as: 'truck' }), t.send(a, c, { arc: true, stay: true, id: 'x' }), [t.pulse(b), t.glow(c)], t.tint(b, 'ok'), t.mark(b, 'check'), t.shake(c), t.lift(a, 1), t.drop(a), t.hide(a), t.show(a), t.say('hello'), t.wait(0.2)]);
  const r = t.build();
  ok('all tokens and steps render', !/NaN|undefined|Infinity/.test(r.svg), (r.svg.match(/.{30}(NaN|undefined|Infinity).{30}/) || [''])[0]);
  ok('loop length is positive', r.loop > 1);
}

// recipes
ok('seven recipes', RECIPE_NAMES.length === 7);
for (const bad of RECIPE_NAMES) {
  try { api.recipes[bad]({}); ok(`${bad} rejects an empty config`, false); } catch (e) { ok(`${bad} rejects an empty config`, /recipes\./.test(e.message)); }
}

// mistakes give useful messages
const throws = (name, fn, re) => { try { fn(); ok(name, false, 'did not throw'); } catch (e) { ok(name, re.test(e.message), e.message); } };
throws('unknown kind suggests', () => iso.scene({}).add('sever'), /Did you mean "server"/);
throws('unknown theme lists themes', () => iso.scene({ theme: 'zzz' }), /aurora/);
throws('unknown icon suggests', () => iso.scene({}).add('tile', { icon: 'lok' }), /Did you mean "lock"/);
throws('bad at explains', () => iso.scene({}).add('cube', { at: 'left' }), /\[x, y\]/);
throws('unknown method explains', () => iso.scene({}).animate(), /does not exist/);
throws('unknown colour lists roles', () => iso.scene({}).add('cube', { color: 'reddish' }), /accent/);
throws('story needs steps', () => iso.scene({}).story('go'), /array of steps/);
{
  const s = iso.scene({});
  const a = s.add('server', { position: { x: 0, y: 0 }, name: 'A' }), b = s.add('server', { at: [0.4, 0] });
  s.connect(a, b);
  const r = s.build();
  ok('aliases are accepted', a.label === 'A' && s.links.length === 1);
  ok('overlap is reported', r.notes.some((n) => n.code === 'overlap'));
  ok('alias is reported', r.notes.some((n) => n.code === 'alias'));
}
{
  const s = iso.scene({});
  const a = s.add('cube', { at: [0, 0] }), b = s.add('server', { at: [4, 0] }), c = s.add('cube', { at: [8, 0] });
  s.link(a, c);
  ok('link through an object is reported', s.build().notes.some((n) => n.code === 'link-through'));
}

// looks: every palette with every finish and floor, plus custom palettes
for (const look of iso.PALETTE_NAMES) for (const finish of iso.FINISH_NAMES) {
  try {
    const s = iso.scene({ look, finish, floor: iso.FLOOR_NAMES[(look.length + finish.length) % iso.FLOOR_NAMES.length], title: 't' });
    const a = s.add('server', { at: [0, 0], hero: true, label: 'A' }), b = s.add('laptop', { at: [4.5, 0], label: 'B' });
    s.link(a, b); s.story([s.send(a, b), s.mark(b, 'check')]);
    const svg = s.toSVG();
    ok(`${look}/${finish}`, !/NaN|undefined|Infinity/.test(svg), (svg.match(/.{30}(NaN|undefined|Infinity).{30}/) || [''])[0]);
  } catch (e) { ok(`${look}/${finish}`, false, e.message); }
}
{
  const s = iso.scene({ palette: { bg: '#0f172a', accent: '#f97316' }, finish: 'soft', floor: 'plate', title: 'custom' });
  s.add('cube', { at: [0, 0], hero: true });
  ok('custom palette from two colours', !/NaN|undefined/.test(s.toSVG()));
  const a = iso.scene({ title: 'How DNS works' }), b = iso.scene({ title: 'A bakery that delivers' });
  ok('a look is picked from the title when none is given', a.look && b.look && a.notes.some((n) => n.code === 'no-look'));
  ok('different titles can get different looks', new Set(['How DNS works', 'A bakery that delivers', 'Compound interest', 'Our onboarding flow', 'Vaccines', 'Queueing'].map((t) => iso.scene({ title: t }).look)).size >= 3);
}
throws('unknown finish lists finishes', () => iso.scene({ look: 'mint', finish: 'shiny' }), /solid/);
throws('custom palette needs bg and accent', () => iso.scene({ palette: { bg: '#fff' } }), /bg and accent/);

// objects that are not in the kit
{
  const s = iso.scene({ look: 'sand' });
  s.define('oven', (o, sh, K) => ({ parts: [sh.box({ w: 1.4, d: 1.2, h: 1.1, color: o.color, left: (fw, fh) => [{ t: 'rect', x: 0.2, y: 0.3, w: fw - 0.4, h: fh - 0.5, fill: K.hex('screen') }] }), sh.cyl({ x: -0.3, z: 1.1, r: 0.12, h: 0.4, color: 'dark' })] }));
  const oven = s.add('oven', { at: [0, 0], label: 'Oven', hero: true });
  const one = s.custom({ at: [4, 0], label: 'Loaf', parts: (sh) => [sh.prism({ plane: 'left', at: [0, -0.3, 0], depth: 0.6, color: '#d9a05b', outline: [[-0.4, 0], [0.4, 0], [0.4, 0.3], [-0.4, 0.3]] }), sh.sphere({ z: 0.5, r: 0.1 }), sh.cone({ x: 0.3, r: 0.1, h: 0.3 })] });
  const logo = s.svg('<circle cx="50" cy="50" r="40" fill="#f00"/>', { at: [8, 0], w: 1, h: 1, label: 'Logo' });
  s.story([s.move(one, [4, 3]), s.pulse(oven)]);
  const r = s.build();
  ok('custom kinds are measured', oven.w > 1 && oven.h > 1 && one.h > 0.2);
  ok('custom objects, raw svg and move render', !/NaN|undefined|Infinity/.test(r.svg) && r.svg.includes('<circle cx="50" cy="50" r="40"'));
}
throws('a builder must return parts', () => { const s = iso.scene({}); s.define('x', () => ({})); s.add('x'); }, /parts/);

// interactive page
{
  const { experienceHtml } = await import('../skills/concept-illustration/scripts/lib/experience.mjs');
  const s = iso.scene({ look: 'ocean', title: 'Interactive' });
  const a = s.add('laptop', { at: [0, 0], label: 'A', info: 'First <b>actor</b>' }), b = s.add('server', { at: [4.5, 0], label: 'B', hero: true });
  s.link(a, b); s.story([s.say('One'), s.send(a, b), s.say('Two'), s.mark(b, 'check')]);
  const r = s.build();
  ok('objects carry ids, labels and info', /data-obj="laptop1" data-label="A" data-info="First &lt;b&gt;actor&lt;\/b&gt;"/.test(r.svg));
  ok('chapters are recorded', /data-chapters="\[\{&quot;t&quot;/.test(r.svg));
  for (const mode of ['loop', 'step', 'scroll']) {
    const html = experienceHtml('demo', r, { mode });
    ok(`experience page (${mode})`, html.startsWith('<!doctype html>') && html.includes(`data-mode="${mode}"`) && html.includes('IsoExperience') && html.includes('<svg') && !/src="http|href="http/.test(html));
  }
}

// mechanisms: parts that move, fixed draw order, fading fills, hairline finish, translucency
{
  const { scene } = iso;
  const s = scene({ look: 'studio', title: 'Mechanism', loop: 4, pad: [10, 20, 30, 40] });
  const m = s.custom({ at: [0, 0], parts: (sh, K) => [
    sh.box({ w: 3, d: 1, h: 0.3, color: 'body' }),
    sh.box({ y: 2, w: 1, d: 3, h: 0.3, color: 'body' }),
    sh.group({ sort: false, parts: [
      sh.cyl({ z: 0.3, r: 0.1, h: 1, color: 'body2', anim: { type: 'move', by: [0, 0, 0.5], period: 2 } }),
      sh.cyl({ z: 0.3, r: 0.2, h: 0.4, color: 'body' }),
    ] }),
    sh.group({ anim: { type: 'keys', period: 4, keys: [{ at: 0, move: [-1, 0, 0], opacity: 0 }, { at: 0.5, move: [1, 0, 0], opacity: 1 }] }, parts: [sh.box({ z: 0.3, w: 0.4, d: 0.4, h: 0.4, color: 'accent' })] }),
    sh.decal({ plane: 'top', at: [0, 0, 1.4], size: [0.1, 0.1], items: [{ t: 'g', anim: { type: 'swing', from: -30, to: 30, period: 2 }, items: [{ t: 'poly', pts: [[0, 0], [2, -0.4], [2, 0.4]], fill: K.hex('gold'), fade: [0, 0, 2, 0] }] }] }),
  ] });
  const r = s.build();
  ok('a custom object with moving parts counts as motion', !r.notes.some((n) => n.code === 'static'));
  ok('keyed part animation compiles', /translate\([-\d.]+px,[-\d.]+px\);opacity:0/.test(r.svg));
  ok('fading fill makes a gradient', /<linearGradient[^>]*gradientUnits="userSpaceOnUse"[^>]*><stop offset="0" stop-color="#[0-9a-f]{6}" stop-opacity="1"\/><stop offset="1"[^>]*stop-opacity="0"/.test(r.svg));
  ok('swing rotates', /rotate\(-30deg\)/.test(r.svg) && /rotate\(30deg\)/.test(r.svg));
  ok('an L-shaped object throws an L-shaped shadow', !!m.res.shadow && m.res.shadow.rects.length === 2);
  ok('line finish is the studio default', s.theme.finish === 'line');
  const a = scene({ look: 'studio', title: 'Pad', pad: 10 }), b = scene({ look: 'studio', title: 'Pad', pad: [10, 110] });
  for (const q of [a, b]) q.add('cube', { at: [0, 0] });
  ok('pad takes [sides, top-and-bottom]', Math.abs((b.build().height - a.build().height) - 200) < 2 && Math.abs(b.build().width - a.build().width) < 2);

  const g = scene({ look: 'paper', title: 'Ghost' });
  g.add('cube', { at: [0, 0], label: 'Now' }); g.add('cube', { at: [3, 0], label: 'Next', ghost: true }); g.add('cube', { at: [6, 0], label: 'Glass', opacity: 0.5 });
  const gr = g.build();
  ok('ghost and translucent objects build', /stroke="#[0-9a-f]{6}" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="4 4"/.test(gr.svg) && gr.svg.includes('<g opacity="0.28">') && gr.svg.includes('<g opacity="0.5">'));

  const p = scene({ title: 'Brand colours only', palette: { accent: '#ff5a1f' } });
  p.add('cube', { at: [0, 0], hero: true });
  ok('palette without bg falls back to a look with that accent', p.theme.roles.accent.toLowerCase() === '#ff5a1f' && p.notes.some((n) => n.code === 'palette'));

  const t = scene({ look: 'mint', title: 'Scaled mover' });
  t.define('bobber', (o, sh) => ({ parts: [sh.box({ w: 1, d: 1, h: 0.2 }), sh.box({ z: 0.2, w: 0.5, d: 0.5, h: 0.5, color: 'accent', anim: { type: 'move', by: [0, 0, 1], period: 2 } })] }));
  const big = t.add('bobber', { at: [0, 0], scale: 2 });
  ok('moving parts scale with the object', big.parts[1].anim.by[2] === 2);
}

// working models: orbiting parts, alternating flow, light, callouts, custom objects in story steps
{
  const { scene } = iso;
  const s = scene({ look: 'ocean', title: 'Model', loop: 6 });
  s.define('spinner', (o, sh) => ({ parts: [
    sh.box({ w: 1, d: 1, h: 0.3, color: o.color }),
    sh.prism({ plane: 'right', at: [-0.5, 0, 1.2], outline: sh.outline.circle(0.05), depth: 1, color: 'gold', anim: { type: 'orbit', axis: 'x', r: 0.5, from: 90, period: 3 } }),
    sh.wire({ points: [[0, -1, 1], [0, 1, 1]], color: '#ffffff', dash: '2 6', opacity: 0.5, anim: { type: 'march', period: 1.5, len: 8, alternate: true } }),
    sh.glow({ z: 1.2, r: 1, color: 'gold', anim: { type: 'blink', period: 1.5 } }),
  ] }));
  const a = s.add('spinner', { at: [0, 0], label: 'A', hero: true }), b = s.add('cube', { at: [4.5, 0], label: 'B' });
  s.link(a, b, { arrow: false, flow: { alternate: true, period: 3 } });
  s.callout([0, 0, 1.8], 'Part', { rise: 40, length: 50 });
  s.story([s.say('A custom object takes every story step'), s.tint(a, 'ok'), s.pulse(a), s.wait(1)]);
  const r = s.build();
  ok('orbit compiles to two opposite turns', /rotate\(360deg\)/.test(r.svg) && /rotate\(-360deg\)/.test(r.svg) && /rotate\(90\)"><g style=/.test(r.svg));
  ok('alternating march', /infinite alternate both/.test(r.svg));
  ok('alternating flow moves dots both ways', (r.svg.match(/<circle r="2.6"/g) || []).length >= 2);
  ok('glow shape draws a light', /<radialGradient[^>]*><stop offset="0" stop-color="#ffffff"/.test(r.svg));
  ok('shape opacity', r.svg.includes('<g opacity="0.5">'));
  ok('a custom object can be tinted', !r.notes.some((n) => n.level === 'warn'));
  ok('callout with rise', /<path d="M[-\d.]+ [-\d.]+L[-\d.]+ [-\d.]+H[-\d.]+"/.test(r.svg));
  ok('dark looks are marked for review sheets', r.svg.includes('data-dark="1"'));
}

// one clock, checking tools and components
{
  const { scene } = iso;
  const { cropSvg } = await import('../skills/concept-illustration/scripts/render.mjs');
  const mk = (extra = () => {}) => {
    const s = scene({ look: 'studio', title: 'Clock', loop: 6 });
    const m = s.custom({ at: [0, 0], id: 'machine', parts: (sh) => [
      sh.box({ w: 4, d: 1.2, h: 0.3, color: 'body' }),
      sh.box({ name: 'gate', z: 0.3, w: 0.2, d: 1, h: 0.9, color: 'accent', anim: { type: 'keys', period: 6, keys: [{ at: 0, move: [0, 0, 0] }, { at: 0.5, move: [0, 0, 1] }, { at: 1, move: [0, 0, 0] }] } }),
      sh.sphere({ name: 'moon', z: 2, r: 0.15, color: 'accent2', anim: { type: 'orbit', axis: 'z', r: 1, period: 6, sense: 'ccw' } }),
      sh.box({ name: 'late', x: 1.5, z: 0.3, w: 0.3, d: 0.3, h: 0.3, anim: { type: 'move', by: [0, 0, 1], period: 6, hold: 0, delay: 1 } }),
      sh.box({ name: 'early', x: -1.5, z: 0.3, w: 0.3, d: 0.3, h: 0.3, anim: { type: 'move', by: [0, 0, 1], period: 6, hold: 0, phase: 0.25 } }),
    ] });
    extra(s, m);
    return s;
  };
  const r = mk((s, m) => {
    s.callout([0, 0, 2], 'Only for a while', { from: 2, until: 4 });
    s.story([s.say('First', { at: 0.5 }), s.say('Second', { at: 3 }), s.pulse(m, { at: 4 })]);
  }).build();
  // every repeating motion is timed from the moment the story starts
  const delays = [...r.svg.matchAll(/animation:[\w-]+ ([\d.]+)s [^;"]*? (-?[\d.]+)s infinite/g)].map((m) => +m[2]);
  ok('loops that share the scene clock start no later than the story', delays.length > 3 && delays.filter((d) => d > r.intro + 0.001).length === 0);
  ok('captions pinned with at: land on those seconds', /&quot;t&quot;:0.5,/.test(r.svg) && /&quot;t&quot;:3,/.test(r.svg));
  ok('a timed callout fades in and out', /Only for a while/.test(r.svg) && r.svg.split('Only for a while')[0].lastIndexOf('<g style="animation:') > r.svg.split('Only for a while')[0].length - 900);
  const motion = r.motion();
  ok('motion report lists the story and the parts', motion.timeline.some((t) => /caption "Second"/.test(t.text) && Math.abs(t.t0 - 3) < 1e-6) && motion.parts.some((l) => /machine › moon\s+circles the z axis anticlockwise/.test(l)) && motion.parts.some((l) => /gate/.test(l)));

  const facts = mk((s, m) => {
    s.expect(3, (at) => Math.abs(at('gate').z - 1.75) < 0.01, 'gate is fully up at half time');
    s.expect(1.5, (at) => at('moon').y < -0.99 && Math.abs(at('moon').x) < 0.01, 'anticlockwise in the picture: +x round to -y');
    s.expect(1, (at) => Math.abs(at('late').z - 0.45) < 0.01, 'a delayed part has not started after its delay');
    s.expect(1.5, (at) => Math.abs(at('early').z - 1.45) < 0.01, 'a part with phase 0.25 is a quarter period ahead');
    s.expect([0, 6], (at) => at(m).x === 0 && at('gate').z >= 0.74, 'ranges are checked throughout');
  }).build();
  ok('true expectations pass', !facts.notes.some((n) => n.code === 'expect'), facts.notes.map((n) => n.msg).join(' | '));
  const wrong = mk((s) => s.expect(3, (at) => at('gate').z < 1, 'gate is down at 3 s')).build();
  ok('a false expectation is reported with what was found', wrong.notes.some((n) => n.level === 'warn' && n.code === 'expect' && /gate at \(0, 0, 1\.75\)/.test(n.msg)));
  throws('expect names what exists', () => mk((s) => s.expect(1, (at) => at('nothing').x > 0)).build(), /Named parts: .*gate/);

  const c = scene({ look: 'ocean', title: 'Components', loop: 8, size: [640, 480] });
  c.custom({ at: [0, 0], id: 'rig', parts: (sh) => [
    sh.box({ w: 3, d: 2, h: 0.2, color: 'body', top: (fw, fh) => [
      { t: 'bar', x: 0.2, y: 0.2, w: 0.2, h: 1, fill: 'accent', levels: [[0, 0.2], [0.5, 0.9], [1, 0.2]] },
      { t: 'bar', x: 0.6, y: 0.2, w: 1, h: 0.2, fill: 'gold', level: 0.5, from: 'left' },
      { t: 'readout', x: 2, y: 1, size: 0.3, fill: 'paper', values: [[0, '0'], [0.5, '27']] },
    ] }),
    sh.stream({ points: [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]], closed: true, count: 12, period: 8, color: 'gold' }),
    sh.stream({ points: [[-2, 0, 1.5], [2, 0, 1.5]], mode: 'alternate', swing: 0.2, wavelength: 2, period: 2, count: 10 }),
    sh.stream({ points: [[-2, 0, 2], [2, 0, 2]], mode: 'zigzag', count: 6, period: 4 }),
    sh.arrow({ from: [0, 0, 2.4], to: [1.5, 0, 2.4], color: 'danger' }),
    sh.ripple({ z: 0.22, r: 0.8, count: 2 }),
    sh.sphere({ z: 3, r: 0.1, anim: { type: 'keys', period: 8, fade: true, keys: [{ at: 0, move: [0, 0, 0] }, { at: 1, move: [6, 0, 0] }] } }),
  ] });
  const cr = c.build();
  ok('size fixes the image size', cr.width === 640 && cr.height === 480 && /width="640" height="480"/.test(cr.svg));
  ok('streams share keyframes', (cr.svg.match(/@keyframes/g) || []).length < 40 && (cr.svg.match(/<circle r="2\.4"/g) || []).length >= 28, `${(cr.svg.match(/@keyframes/g) || []).length} keyframes`);
  ok('bar, readout and role colours in artwork', />27<\/text>/.test(cr.svg) && /step-end/.test(cr.svg) && /scale\(1,0\.9\)/.test(cr.svg) && !/fill="(accent|gold|paper|danger)"/.test(cr.svg));
  ok('arrow and ripple draw', /stroke-linejoin="round"\/>/.test(cr.svg) && /scale\(\.3\)/.test(cr.svg));
  ok('the frame holds a part over its whole travel', (() => { const vb = cr.svg.match(/viewBox="([-\d. ]+)"/)[1].split(' ').map(Number); const far = iso.scene ? 6 * 34.64 : 0; return vb[0] + vb[2] > far; })());
  ok('fade hides a jump at the restart', /0%\{opacity:0\}5%\{opacity:1\}95%\{opacity:1\}100%\{opacity:0\}/.test(cr.svg));
  ok('moving components count as motion', !cr.notes.some((n) => n.code === 'static'));
  const crop = cropSvg(cr.svg, { focus: 'rig', zoom: 2 });
  ok('cropSvg zooms on an object', /viewBox="[-\d. ]+" width="\d+" height="\d+"/.test(crop) && +crop.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/)[1] < +cr.svg.match(/viewBox="[-\d.]+ [-\d.]+ ([\d.]+)/)[1]);
  throws('cropSvg names the ids', () => cropSvg(cr.svg, { focus: 'nope' }), /Ids in this scene: rig/);
  const tiny = scene({ look: 'paper', title: 'Tiny' });
  tiny.custom({ at: [0, 0], parts: (sh) => [sh.box({ w: 1, d: 1, h: 1, left: () => [{ t: 'text', x: 0.5, y: 0.5, text: 'small', size: 0.12 }] })] });
  ok('unreadable text is flagged', tiny.build().notes.some((n) => n.code === 'text-small'));
}

// every example must be well-formed XML: used as <img>, an SVG is parsed strictly
{
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-xml-'));
  const files = [];
  for (const file of fs.readdirSync(examples).filter((f) => f.endsWith('.scene.mjs'))) {
    const mod = await import(pathToFileURL(path.join(examples, file)).href);
    const out = path.join(tmp, file.replace('.scene.mjs', '.svg'));
    fs.writeFileSync(out, (await mod.default(api)).build().svg);
    files.push(out);
  }
  const check = 'import sys, xml.dom.minidom\nbad = 0\nfor f in sys.argv[1:]:\n    try:\n        xml.dom.minidom.parse(f)\n    except Exception as e:\n        bad += 1; print(f, e)\nsys.exit(1 if bad else 0)\n';
  const r = spawnSync('python3', ['-I', '-c', check, ...files], { encoding: 'utf8' });
  if (r.error) console.log('(python3 not found: XML well-formedness not checked)');
  else ok('examples are well-formed XML', r.status === 0, (r.stdout || r.stderr).slice(0, 400));
  for (const f of files) ok(`no broken values in ${path.basename(f)}`, !/object Object|undefined|NaN/.test(fs.readFileSync(f, 'utf8')));
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
