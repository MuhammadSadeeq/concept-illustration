#!/usr/bin/env node
// Engine checks: every example builds cleanly, builds are deterministic, every kind renders in
// every theme, and common mistakes produce helpful errors.   node dev/test.mjs

import fs from 'node:fs';
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

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
