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
for (const theme of iso.THEME_NAMES) {
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
throws('unknown theme lists themes', () => iso.scene({ theme: 'neon' }), /aurora/);
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

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
