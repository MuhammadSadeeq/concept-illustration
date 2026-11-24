#!/usr/bin/env node
// Build a scene script into a self-contained animated SVG, a preview page and a report.
//
//   node build.mjs my.scene.mjs                 -> my.svg + my.html (next to the script)
//   node build.mjs my.scene.mjs --sheet         -> also my.sheet.png (frames across the loop)
//   node build.mjs my.scene.mjs --png --at 2.5  -> also my.png (still at 2.5s; omit --at for the resting state)
//     review options: --frames 2.3,2.6 (those moments) · --trails (show direction of motion) · --focus <id | x,y,z> · --zoom 3
//   node build.mjs my.scene.mjs --motion        -> print where every moving part is, and which way it goes
//   node build.mjs my.scene.mjs --layout [2,4.5] -> print where each thing is on screen, its size and what hides it
//   node build.mjs my.scene.mjs --mp4 | --gif | --webm  (--draft: small and quick, written to my.draft.mp4)
//   node build.mjs my.scene.mjs --looks          -> also my.looks.png (the scene in several looks)
//   node build.mjs my.scene.mjs --experience step -> also my.experience.html (interactive)
//   node build.mjs --list                       -> every object kind, icon, theme and token
//
// A scene script is an ES module whose default export receives the API and returns a scene:
//   export default ({ scene }) => { const s = scene({ look: 'aurora' }); ...; return s; };

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import * as iso from './isokit.mjs';
import { makeRecipes, RECIPE_NAMES } from './lib/recipes.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };

function list() {
  const pad = (s, n) => s + ' '.repeat(Math.max(1, n - s.length));
  console.log('OBJECT KINDS  s.add(kind, { at: [x, y], label, ... })\n');
  for (const k of iso.KIND_NAMES) console.log(`  ${pad(k, 11)}${iso.KIT[k].desc}${iso.KIT[k].opts ? `  [${iso.KIT[k].opts.split(' ').join(', ')}]` : ''}`);
  console.log('\nLOOKS  scene({ look, finish, floor })   or   scene({ palette: { bg, accent, accent2 }, finish, floor })\n');
  for (const k of iso.PALETTE_NAMES) console.log(`  ${pad(k, 11)}${pad(iso.PALETTES[k].finish + ' / ' + iso.PALETTES[k].floor, 18)}${iso.PALETTES[k].mood}`);
  console.log(`\nFINISHES`);
  for (const k of iso.FINISH_NAMES) console.log(`  ${pad(k, 11)}${iso.FINISHES[k]}`);
  console.log(`\nFLOORS`);
  for (const k of iso.FLOOR_NAMES) console.log(`  ${pad(k, 11)}${iso.FLOORS[k]}`);
  console.log('');
  console.log(`COLOURS  ${iso.ROLE_NAMES.join(', ')}  (or any hex)`);
  console.log(`TOKENS   ${iso.PACKET_NAMES.join(', ')}  (s.send(a, b, { as }))`);
  console.log(`RECIPES  ${RECIPE_NAMES.join(', ')}`);
  console.log(`\nICONS\n  ${iso.ICON_NAMES.join(', ')}`);
}

function previewHtml(name, r) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${name} · preview</title>
<style>
:root{color-scheme:light dark}html,body{height:100%;margin:0}
body{display:grid;grid-template-rows:1fr auto;background:#17181c;color:#d7dae2;font:500 13px/1.4 system-ui,-apple-system,"Segoe UI",sans-serif}
.stage{display:grid;place-items:center;padding:24px;min-height:0;transition:background .2s}
.stage svg{max-width:100%;max-height:calc(100vh - 110px);width:auto;height:auto;border-radius:10px}
.stage.light{background:#f3f4f6}.stage.check{background:conic-gradient(#d9dce3 25%,#fff 0 50%,#d9dce3 0 75%,#fff 0) 0 0/22px 22px}
.bar{display:flex;gap:10px;align-items:center;padding:10px 16px;background:#202228;border-top:1px solid #30333b;flex-wrap:wrap}
button,select{font:inherit;color:inherit;background:#2b2e36;border:1px solid #3a3e48;border-radius:7px;padding:6px 11px;cursor:pointer}
button:hover,select:hover{border-color:#6b7286}input[type=range]{flex:1;min-width:160px;accent-color:#8b93ff}
.t{font-variant-numeric:tabular-nums;min-width:86px}.sp{opacity:.6}
</style></head><body>
<div class="stage" id="stage">${r.svg}</div>
<div class="bar">
  <button id="play" aria-label="Play or pause">Pause</button>
  <button id="restart">Restart</button>
  <input id="scrub" type="range" min="0" max="${r.loop}" step="0.01" value="0" aria-label="Loop position">
  <span class="t" id="time">0.00 / ${r.loop.toFixed(1)}s</span>
  <select id="bg" aria-label="Backdrop"><option value="">Dark backdrop</option><option value="light">Light backdrop</option><option value="check">Checkerboard</option></select>
  <span class="sp">${r.width}×${r.height} · ${(r.bytes / 1024).toFixed(0)} KB · ${r.objects} objects</span>
</div>
<script>
const svg=document.querySelector('#stage svg'),loop=+svg.dataset.loop,intro=+svg.dataset.intro;
const anims=()=>svg.getAnimations({subtree:true});let playing=true;
const scrub=document.getElementById('scrub'),time=document.getElementById('time'),play=document.getElementById('play');
function seek(t){for(const a of anims()){a.pause();a.currentTime=(intro+loop+t)*1000}}
function tick(){if(playing){const a=anims()[0];if(a&&a.currentTime!=null){const t=(((a.currentTime/1000-intro)%loop)+loop)%loop;if(a.currentTime/1000>=intro){scrub.value=t;time.textContent=t.toFixed(2)+' / '+loop.toFixed(1)+'s'}}}requestAnimationFrame(tick)}
play.onclick=()=>{playing=!playing;play.textContent=playing?'Pause':'Play';for(const a of anims())playing?a.play():a.pause()};
scrub.oninput=()=>{playing=false;play.textContent='Play';seek(+scrub.value);time.textContent=(+scrub.value).toFixed(2)+' / '+loop.toFixed(1)+'s'};
document.getElementById('restart').onclick=()=>{playing=true;play.textContent='Pause';for(const a of anims()){a.currentTime=0;a.play()}};
document.getElementById('bg').onchange=(e)=>{document.getElementById('stage').className='stage '+e.target.value};
tick();
</script></body></html>`;
}

async function main() {
  if (flag('list')) return list();
  const file = argv.find((a) => !a.startsWith('--') && /\.(mjs|js)$/.test(a));
  if (!file || flag('help')) {
    console.log('Usage: node build.mjs <name>.scene.mjs [--out DIR] [--sheet] [--looks [a,b,c]] [--png [--at SEC]] [--motion] [--layout [SEC,SEC]] [--mp4|--gif|--webm [--draft]] [--look NAME] [--finish NAME] [--floor NAME] [--experience [loop|step|scroll]] [--no-html]\n       node build.mjs --list');
    process.exit(file ? 0 : 1);
  }
  const abs = path.resolve(file);
  if (!fs.existsSync(abs)) throw new Error(`Scene script not found: ${file}`);
  const mod = await import(pathToFileURL(abs).href + `?t=${Date.now()}`);
  const over = {};
  if (val('look') || val('theme')) { over.look = val('look') || val('theme'); over.theme = undefined; over.palette = undefined; }
  if (val('finish')) over.finish = val('finish');
  if (val('floor')) over.floor = val('floor');
  const sceneFn = (o = {}) => iso.scene({ ...o, ...over });
  const api = { ...iso, scene: sceneFn, recipes: makeRecipes(sceneFn), shapes: iso.SHAPES };
  let s = mod.default ?? mod.scene;
  if (typeof s === 'function') s = await s(api);
  if (!s || typeof s.build !== 'function') throw new Error(`${path.basename(file)} must default-export a function that returns a scene:\n  export default ({ scene }) => { const s = scene({ theme: 'aurora' }); /* ... */ return s; };`);
  const r = s.build();

  const outDir = path.resolve(val('out', path.dirname(abs)));
  fs.mkdirSync(outDir, { recursive: true });
  const name = path.basename(abs).replace(/(\.scene)?\.(mjs|js)$/, '');
  const svgPath = path.join(outDir, `${name}.svg`);
  const firstBuild = !fs.existsSync(svgPath);
  fs.writeFileSync(svgPath, r.svg);
  const made = [svgPath];
  if (!flag('no-html')) { const p = path.join(outDir, `${name}.html`); fs.writeFileSync(p, previewHtml(name, r)); made.push(p); }

  // --experience [loop|step|scroll]: an interactive page with controls, chapters and hover cards
  if (flag('experience')) {
    const mode = val('experience', 'loop');
    if (!['loop', 'step', 'scroll'].includes(mode)) throw new Error(`--experience takes loop, step or scroll, got "${mode}".`);
    try {
      const { experienceHtml } = await import('./lib/experience.mjs');
      const p = path.join(outDir, `${name}.experience.html`);
      fs.writeFileSync(p, experienceHtml(name, r, { mode }));
      made.push(p);
    } catch (e) {
      console.log(`\n! Could not write the interactive page: ${e.code === 'ERR_MODULE_NOT_FOUND' ? 'this copy of the skill has no scripts/lib/experience.mjs' : e.message}`);
    }
  }

  // --looks [a,b,c]: the same scene in several looks on one sheet, to choose between them by eye
  if (flag('looks')) {
    const asked = (val('looks') || '').split(',').map((x) => x.trim()).filter(Boolean);
    const pool = ['aurora', 'mint', 'sand', 'plum', 'sky', 'lemon', 'ocean', 'paper', 'forest', 'blossom', 'carbon', 'grape'];
    const names = asked.length ? asked : [s.look, ...pool.filter((n) => n !== s.look)].filter(Boolean).slice(0, 6);
    const items = [];
    for (const spec of names) {
      const [look, finish, floor] = spec.split(':');
      const fn = (o = {}) => iso.scene({ ...o, look, theme: undefined, palette: undefined, finish: finish || undefined, floor: floor || undefined });
      let v = mod.default ?? mod.scene;
      if (typeof v === 'function') v = await v({ ...iso, scene: fn, recipes: makeRecipes(fn), shapes: iso.SHAPES });
      items.push({ label: spec, svg: v.build().svg });
    }
    try {
      const R = await import('./render.mjs');
      made.push(await R.renderGrid(items, path.join(outDir, `${name}.looks.png`)));
    } catch (e) { console.log(`\n! Could not render the looks sheet: ${e.message}`); }
  }

  const wantsRaster = ['png', 'sheet', 'mp4', 'gif', 'webm'].some(flag);
  let videoNote = '', setupShown = false;
  if (wantsRaster) {
    const R = await import('./render.mjs');
    try {
      // a closer look: --focus <object id | x,y,z> and/or --zoom 3 crop every raster output
      const nums = (v) => String(v).split(',').map(Number);
      const focusArg = val('focus'), zoomArg = +val('zoom', 0) || null;
      const focus = focusArg ? (/^-?[\d.]+(,-?[\d.]+)+$/.test(focusArg) ? nums(focusArg) : focusArg) : null;
      const view = focus || zoomArg ? R.cropSvg(r.svg, { focus, zoom: zoomArg }) : r.svg;
      // --frames 12 asks for that many frames; --frames 2.3,2.6 or --frames 4.0 (a decimal point, or --at 2.3,2.6) asks for those moments
      const fr = val('frames', '8'), at = val('at');
      const times = /[,.]/.test(fr) ? nums(fr) : at && /,/.test(at) ? nums(at) : null;
      if (times && times.some((t) => !Number.isFinite(t))) throw new Error(`--frames ${fr}: give moments in seconds, such as --frames 2.3,2.6 (or a single moment with a decimal point: --frames 4.0).`);
      if (!times && !(Number.isInteger(+fr) && +fr > 0)) throw new Error(`--frames ${fr}: give a number of frames (--frames 12) or moments in seconds (--frames 2.3,2.6).`);
      // the whole-loop sheet keeps its name; chosen moments and close-ups go to their own file beside it
      const sheetName = times || focus || zoomArg ? `${name}.frames.png` : `${name}.sheet.png`;
      if (flag('sheet')) made.push(await R.renderSheet(view, path.join(outDir, sheetName), { frames: times ? times.length : +fr, times, trails: flag('trails') ? +val('trails') || 0.3 : 0 }));
      if (flag('png')) made.push(await R.renderPng(view, path.join(outDir, `${name}.png`), { at: at != null && !/,/.test(at) ? +at : null, scale: +val('scale', 2) }));
      // --draft: a small, quick video to check timing, kept apart from the final one
      const draft = flag('draft');
      for (const f of ['mp4', 'gif', 'webm']) if (flag(f)) {
        const t0 = Date.now();
        made.push(await R.renderVideo(r.svg, path.join(outDir, `${name}${draft ? '.draft' : ''}.${f}`), { format: f, draft, fps: val('fps') ? +val('fps') : undefined, width: val('width') ? +val('width') : undefined, loops: +val('loops', 1), intro: flag('intro') }));
        videoNote = `video: ${((Date.now() - t0) / 1000).toFixed(0)} s to render${draft ? ' (draft)' : ''}`;
      }
    } catch (e) {
      console.log(`\n! Could not rasterise: ${e.message}`);
      // when the machine is the problem, say what it has
      if (/chrome|browser|ffmpeg|playwright|puppeteer/i.test(e.message)) {
        setupShown = true;
        const line = await R.setupLine();
        if (!line.includes(e.message)) console.log(`  ${line}`);
      }
    }
  }

  const rel = (p) => path.relative(process.cwd(), p) || p;
  console.log(`\n✓ ${name}: ${r.width}×${r.height}, ${r.objects} objects, ${r.loop.toFixed(1)}s loop, ${(r.bytes / 1024).toFixed(0)} KB`);
  for (const p of made) console.log(`  ${rel(p)}`);
  if (videoNote) console.log(`  ${videoNote}`);
  // the first build of a scene says what this machine can render, before a long render can fail
  if (firstBuild && !setupShown) { try { console.log(`  ${await (await import('./render.mjs')).setupLine()}`); } catch { /* the SVG is what matters */ } }
  if (made.some((p) => p.endsWith('.svg'))) console.log(`  embed: <img src="${name}.svg" width="${r.width}" height="${r.height}" alt="…" style="max-width:100%;height:auto">${s.opts.size ? '' : '   (size: [w, h] in scene() keeps these numbers fixed between builds)'}`);
  const warns = r.notes.filter((n) => n.level === 'warn'), hints = r.notes.filter((n) => n.level === 'hint');
  if (warns.length) { console.log(`\nFIX THESE (${warns.length}):`); for (const n of warns) console.log(`  ✗ [${n.code}] ${n.msg}`); }
  if (hints.length) { console.log(`\nCONSIDER (${hints.length}):`); for (const n of hints) console.log(`  · [${n.code}] ${n.msg}`); }
  if (!warns.length && !hints.length) console.log('\nNo problems found by the checker.');
  if (flag('motion')) {
    // what moves, when, and which way: a check on direction and timing that needs no picture
    const m = r.motion();
    console.log('\nMOTION  (scene clock: 0 s is when the story starts. +x is toward the lower right of the picture, +y toward the lower left, +z up)');
    if (m.timeline.length) { console.log('\n  Story'); for (const st of [...m.timeline].sort((p, q) => p.t0 - q.t0)) console.log(`    ${st.t0.toFixed(2).padStart(6)} – ${st.t1.toFixed(2).padEnd(6)} ${st.text}`); }
    if (m.parts.length) { console.log('\n  Parts that move by themselves'); for (const line of m.parts) console.log(`  ${line}`); }
    if (m.flows.length) { console.log('\n  Links with a flow'); for (const line of m.flows) console.log(`    ${line}`); }
    if (!m.timeline.length && !m.parts.length && !m.flows.length) console.log('  Nothing moves.');
  }
  if (flag('layout')) {
    // the picture in words: where each thing is, how big, and what hides it, at the sheet's moments or chosen ones
    const { sheetTimes } = await import('./render.mjs');
    const asked = val('layout');
    const times = asked ? asked.split(',').map(Number) : sheetTimes(r.svg, 8);
    if (times.some((t) => !Number.isFinite(t))) throw new Error(`--layout ${asked}: give moments in seconds, such as --layout 2.3,4.5, or no value for the sheet's moments.`);
    const L = r.layout, fr = L.frame, k = r.width / (fr.x1 - fr.x0), FW = fr.x1 - fr.x0, FH = fr.y1 - fr.y0;
    const px = (v, o) => Math.round((v - o) * k), pc = (v) => `${Math.round(v * 100)} %`;
    const chapters = JSON.parse(((r.svg.match(/data-chapters="([^"]+)"/) || [, '[]'])[1]).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'));
    console.log(`\nLAYOUT  (the picture is ${r.width}×${Math.round(FH * k)} px without the caption strip; x from its left edge, y from its top; size is the larger side as a share of the picture's width)`);
    for (const t of times) {
      const { items } = L.at(((t % r.loop) + r.loop) % r.loop);
      const cap = chapters.filter((c) => c.t <= t + 1e-6).pop();
      const shown = items.filter((it) => it.opacity >= 0.15), gone = items.filter((it) => it.opacity < 0.15 && it.kind === 'object');
      console.log(`\n  at ${t.toFixed(2)} s${cap ? `   caption: "${cap.text}"` : ''}`);
      for (const it of shown) {
        const b = it.box, name = it.kind === 'object' && it.ob.label ? `${it.id} "${it.ob.label}"` : it.id;
        const off = b.x1 < fr.x0 || b.x0 > fr.x1 || b.y1 < fr.y0 || b.y0 > fr.y1 ? '   OUT OF FRAME' : b.x0 < fr.x0 - 1 || b.x1 > fr.x1 + 1 || b.y0 < fr.y0 - 1 || b.y1 > fr.y1 + 1 ? '   cut by the frame edge' : '';
        console.log(`    ${name.padEnd(30)} x ${px(b.x0, fr.x0)}–${px(b.x1, fr.x0)}  y ${px(b.y0, fr.y0)}–${px(b.y1, fr.y0)}  size ${pc(Math.max(b.x1 - b.x0, b.y1 - b.y0) / FW)}${it.opacity < 0.95 ? `  opacity ${it.opacity.toFixed(2)}` : ''}${it.hidden > 0.05 ? `  ${pc(it.hidden)} hidden behind ${it.by.slice(0, 3).join(', ')}` : ''}${off}`);
      }
      if (gone.length) console.log(`    not shown: ${gone.map((it) => it.id).join(', ')}`);
      const f = L.fill(((t % r.loop) + r.loop) % r.loop);
      if (Number.isFinite(f.span.x0)) console.log(`    the drawing spans x ${pc((f.span.x0 - fr.x0) / FW)}–${pc((f.span.x1 - fr.x0) / FW)}, y ${pc((f.span.y0 - fr.y0) / FH)}–${pc((f.span.y1 - fr.y0) / FH)} of the picture, and its shapes cover ${pc(f.share)} of it`);
    }
    if (L.continuous) console.log('\n  Flows, particles, floating and artwork that turns or blinks move as well; they are not listed.');
  }
  if (!wantsRaster) console.log('\nNext: look at the result. Add --sheet to get frames across the loop as one PNG.');
  if (flag('strict') && warns.length) process.exit(2);
}

main().catch((e) => {
  const file = argv.find((a) => !a.startsWith('--') && /\.(mjs|js)$/.test(a));
  const where = file && e.stack ? (e.stack.split('\n').find((l) => l.includes(path.basename(file))) || '').match(/:(\d+):\d+\)?$/) : null;
  console.error(`\n✗ ${e.message}${where ? `\n  at ${path.basename(file)} line ${where[1]}` : ''}`);
  if (process.env.ISO_DEBUG) console.error(e.stack);
  process.exit(1);
});
