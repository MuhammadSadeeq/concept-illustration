#!/usr/bin/env node
// Rebuilds everything under gallery/ from the examples and the engine.
//   node dev/build-gallery.mjs            SVGs only
//   node dev/build-gallery.mjs --posters  also PNG posters (needs a browser engine)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as iso from '../skills/concept-illustration/scripts/isokit.mjs';
import { makeRecipes } from '../skills/concept-illustration/scripts/lib/recipes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skill = path.join(root, 'skills/concept-illustration');
const out = path.join(root, 'gallery');
fs.mkdirSync(out, { recursive: true });

const write = (name, svg) => { fs.writeFileSync(path.join(out, name), svg); console.log(`${name.padEnd(34)} ${(svg.length / 1024).toFixed(0)} KB`); };

// 1. every example
const dir = path.join(skill, 'examples');
for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.scene.mjs')).sort()) {
  const mod = await import(pathToFileURL(path.join(dir, file)).href);
  const s = await mod.default({ ...iso, recipes: makeRecipes(iso.scene) });
  const r = s.build();
  const bad = r.notes.filter((n) => n.level === 'warn');
  if (bad.length) { console.error(`${file}: ${bad.map((n) => n.msg).join(' | ')}`); process.exitCode = 1; }
  write(file.replace('.scene.mjs', '.svg'), r.svg);
}

// 2. one scene in nine different looks (palette : finish : floor)
const LOOKS = ['aurora', 'neon', 'plum:soft:plate', 'forest', 'sand', 'mint', 'lemon', 'paper', 'noir'];
for (const spec of LOOKS) {
  const [look, finish, floor] = spec.split(':');
  const s = iso.scene({ look, finish, floor, title: `${spec} look`, pad: 40, intro: false });
  const a = s.add('laptop', { at: [0, 0], ui: 'code' });
  const base = s.add('platform', { at: [4.4, 0], size: 2.2 });
  const b = s.add('server', { on: base, hero: true });
  const c = s.add('database', { at: [8.8, 0] });
  const d = s.add('browser', { at: [4.4, 4.2] });
  s.link(a, base); s.link(base, c, { style: 'dashed', flow: true }); s.link(base, d);
  s.story([s.send(a, base), s.pulse(b), s.send(base, d, { as: 'doc' }), s.mark(d, 'check'), s.wait(0.8)]);
  write(`look-${look}.svg`, s.build().svg);
}

// 3. the whole kit on one sheet
{
  const s = iso.scene({ theme: 'clay', title: 'Every object in the kit', pad: 36, intro: false });
  // lay the objects out on a grid that is rectangular on screen (rows run along the floor diagonal)
  const cols = 10, a = 2.05, b = 4.1;
  iso.KIND_NAMES.forEach((k, i) => { const c = i % cols, r = Math.floor(i / cols); s.add(k, { at: [c * a + r * b, r * b - c * a], label: k }); });
  write('kit.svg', s.build().svg);
}

// 4. one interactive page, to open locally
{
  const { experienceHtml } = await import('../skills/concept-illustration/scripts/lib/experience.mjs');
  const mod = await import(pathToFileURL(path.join(dir, 'request-lifecycle.scene.mjs')).href);
  const r = (await mod.default({ ...iso, recipes: makeRecipes(iso.scene) })).build();
  write('request-lifecycle.experience.html', experienceHtml('request-lifecycle', r, { mode: 'step' }));
}

if (process.argv.includes('--posters')) {
  const { renderPng } = await import('../skills/concept-illustration/scripts/render.mjs');
  for (const name of ['request-lifecycle', 'agent-loop']) {
    await renderPng(fs.readFileSync(path.join(out, `${name}.svg`), 'utf8'), path.join(out, `${name}.png`), { at: 5.2, scale: 2 });
    console.log(`${name}.png`);
  }
}
