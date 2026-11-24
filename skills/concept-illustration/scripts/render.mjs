#!/usr/bin/env node
// Rasterise a built scene: a still PNG, a contact sheet of frames across the loop, or a video.
//
//   node render.mjs scene.svg --png [--at 2.5] [--scale 2]
//   node render.mjs scene.svg --sheet [--frames 8]
//   node render.mjs scene.svg --mp4 | --webm | --gif [--draft] [--fps 30] [--width 1280] [--loops 1] [--intro]
//
// Needs any Chrome, Chromium or Edge binary (found on PATH, in the usual install places and in the
// Playwright, Puppeteer and agent-browser caches; CHROME_PATH overrides). Playwright or Puppeteer is
// used only when no binary is found. Video also needs ffmpeg on PATH.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn, spawnSync } from 'node:child_process';
import { launchChrome } from './lib/cdp.mjs';
import { fileURLToPath } from 'node:url';
import { proj } from './lib/geom.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));

function meta(svg) {
  const num = (re, d) => { const m = svg.match(re); return m ? +m[1] : d; };
  const vb = (svg.match(/viewBox="([^"]+)"/) || [, '0 0 800 600'])[1].split(/\s+/).map(Number);
  return { loop: num(/data-loop="([\d.]+)"/, 6), intro: num(/data-intro="([\d.]+)"/, 0), w: vb[2], h: vb[3] };
}

const SEEK = `
window.__seek = (t, withIntro) => {
  for (const svg of document.querySelectorAll('svg[data-loop]')) {
    const intro = +svg.dataset.intro || 0, loop = +svg.dataset.loop || 6;
    const base = withIntro ? 0 : intro + loop;
    const tt = svg.dataset.t != null ? +svg.dataset.t : t;
    for (const a of svg.getAnimations({ subtree: true })) { a.pause(); a.currentTime = (base + tt) * 1000; }
  }
};`;

/**
 * Crop a built SVG for a closer look. focus: an object id (data-obj), or a world point [x, y, z];
 * zoom: how much closer than the whole picture (with an object id and no zoom, the object fills the frame).
 */
export function cropSvg(svg, { focus = null, zoom = null } = {}) {
  const vb = (svg.match(/viewBox="([^"]+)"/) || [, '0 0 800 600'])[1].split(/\s+/).map(Number);
  let cx = vb[0] + vb[2] / 2, cy = vb[1] + vb[3] / 2, w = vb[2], h = vb[3];
  if (Array.isArray(focus)) { [cx, cy] = proj(focus[0] || 0, focus[1] || 0, focus[2] || 0); }
  else if (focus) {
    const m = svg.match(new RegExp(`data-obj="${String(focus).replace(/[^\w-]/g, '')}"[^>]*data-box="([^"]+)"`));
    if (!m) {
      const ids = [...svg.matchAll(/data-obj="([^"]+)"/g)].map((x) => x[1]);
      throw new Error(`--focus: no object with id "${focus}". Ids in this scene: ${ids.join(', ') || 'none'}. Or give a point: --focus x,y,z`);
    }
    const b = m[1].split(' ').map(Number);
    cx = (b[0] + b[2]) / 2; cy = (b[1] + b[3]) / 2;
    if (!zoom) { const side = Math.max(b[2] - b[0], b[3] - b[1]) * 1.5 + 30; w = side * (vb[2] / vb[3] > 1 ? 1.25 : 1); h = side; }
  }
  if (zoom) { w = vb[2] / zoom; h = vb[3] / zoom; }
  const box = [cx - w / 2, cy - h / 2, w, h].map((v) => +v.toFixed(1));
  return svg.replace(/viewBox="[^"]+" width="[\d.]+" height="[\d.]+"/, `viewBox="${box.join(' ')}" width="${Math.round(w)}" height="${Math.round(h)}"`);
}

// A transparent scene is reviewed on a page of the tone it was designed for, never on the sheet's own dark frame.
const tileBg = (svg) => (String(svg).match(/data-bg="(#[0-9a-fA-F]{6})"/) || [])[1] || (/data-dark="1"/.test(String(svg)) ? '#14161b' : '#ffffff');

function pageHtml(svg, { bg = 'transparent', width, sheet } = {}) {
  const m = meta(svg);
  if (!sheet) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}svg{display:block;width:${width}px;height:auto}</style></head><body>${svg}<script>${SEEK}</script></body></html>`;
  }
  const { frames, cols, cell } = sheet;
  const cells = sheet.times.map((t, i) => {
    // each copy needs its own ids so gradients and keyframes do not collide
    const reid = (tag) => svg.replace(/iso[0-9a-z]+(?=[-"#.)\s])/g, (id) => `${id}${tag}`);
    const copy = reid(`f${i}`).replace('<svg ', `<svg data-t="${t.toFixed(3)}" `);
    // motion trails: the same frame a few moments earlier, laid faintly over this one, so a still shows
    // which way things are going. Blending keeps everything that has not moved exactly as it was.
    let ghosts = '';
    if (sheet.trails) {
      const blend = /data-dark="1"/.test(svg) ? 'lighten' : 'darken';
      [0.5, 0.32, 0.18].forEach((op, k) => {
        const tg = (((t - ((k + 1) * sheet.trails) / 3) % m.loop) + m.loop) % m.loop;
        ghosts += reid(`f${i}g${k}`).replace('<svg ', `<svg data-t="${tg.toFixed(3)}" style="position:absolute;left:0;top:0;mix-blend-mode:${blend};opacity:${op}" `);
      });
    }
    return `<figure><div style="position:relative;background:${tileBg(svg)}">${copy}${ghosts}</div><figcaption>${t.toFixed(sheet.exact ? 2 : 1)}s${sheet.trails ? ' · trails show where things were just before' : ''}</figcaption></figure>`;
  }).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#16181d;font:600 13px system-ui,sans-serif;color:#cfd3dc}main{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;padding:8px}figure{margin:0;background:#22252c;border-radius:6px;overflow:hidden}figure svg{display:block;width:100%;height:auto}figcaption{padding:4px 8px}</style></head><body><main>${cells}</main><script>${SEEK}</script></body></html>`;
}

async function loadEngine() {
  const tries = [createRequire(path.join(process.cwd(), 'x.js')), createRequire(import.meta.url)];
  for (const dir of (process.env.NODE_PATH || '').split(path.delimiter).filter(Boolean)) tries.push(createRequire(path.join(dir, 'x.js')));
  for (const name of ['playwright', 'playwright-core', 'puppeteer', 'puppeteer-core']) {
    for (const req of tries) {
      try {
        const mod = req(name);
        const kind = name.startsWith('playwright') ? 'playwright' : 'puppeteer';
        return { kind, mod: kind === 'playwright' ? mod.chromium : mod.default || mod };
      } catch { /* try the next one */ }
    }
  }
  return null;
}

// Browsers that tools such as Playwright, Puppeteer and agent-browser download into a cache, not onto PATH.
function cachedChromes() {
  const home = os.homedir(), found = [];
  const caches = [
    [path.join(home, '.cache', 'ms-playwright'), /^chromium(_headless_shell)?-\d+$/, ['chrome-linux64/chrome', 'chrome-linux/chrome', 'chrome-linux/headless_shell', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']],
    [path.join(home, 'Library', 'Caches', 'ms-playwright'), /^chromium-\d+$/, ['chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-mac-arm64/Chromium.app/Contents/MacOS/Chromium']],
    [path.join(home, '.cache', 'puppeteer', 'chrome'), /./, ['chrome-linux64/chrome', 'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing', 'chrome-win64/chrome.exe']],
    [path.join(home, '.agent-browser', 'browsers'), /^chrom/, ['chrome', 'chrome-linux64/chrome']],
  ];
  for (const [dir, re, exes] of caches) {
    let names = [];
    try { names = fs.readdirSync(dir).filter((n) => re.test(n)).sort().reverse(); } catch { continue; }
    for (const n of names) for (const e of exes) found.push(path.join(dir, n, e));
  }
  return found;
}

export function findChrome() {
  const names = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'chrome', 'microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium', ...cachedChromes()];
  for (const n of names.filter(Boolean)) {
    if (path.isAbsolute(n)) { if (fs.existsSync(n) && fs.statSync(n).isFile()) return n; continue; }
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [n], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split('\n')[0];
  }
  return null;
}

const NO_BROWSER = 'No Chrome, Chromium or Edge found. Install one (for example "npx @puppeteer/browsers install chrome@stable", which prints where it put it) and set CHROME_PATH to it. The SVG and the pages do not need it.';

/** What this machine can render, in one line, for the build report. */
export async function setupLine() {
  const exe = findChrome(), ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status === 0;
  const browser = exe ? `Chrome at ${exe}` : (await loadEngine()) ? 'Playwright or Puppeteer' : null;
  if (!browser) return `Render setup: ${NO_BROWSER}`;
  return `Render setup: ${browser} for --png, --sheet and video${ff ? ', ffmpeg for video.' : '. ffmpeg is not on PATH, so --mp4, --gif and --webm will fail until it is installed.'}`;
}

/**
 * Runs fn(page) in a headless browser. A Chrome binary is driven directly over its DevTools pipe
 * (no packages needed, and several times faster per frame); Playwright or Puppeteer is the fallback.
 */
export async function withPage(viewport, scale, fn) {
  const exe = findChrome();
  let direct = null;
  if (exe) {
    try { direct = await launchChrome(exe); } catch (e) { if (!(await loadEngine())) throw new Error(`Could not drive ${exe}: ${e.message}`); }
  }
  if (direct) {
    try { return await fn(await direct.newPage({ ...viewport, scale })); } finally { await direct.close(); }
  }
  const eng = await loadEngine();
  if (!eng) return null;
  const launchOpts = { args: ['--no-sandbox'], ...(exe ? { executablePath: exe } : {}) };
  if (eng.kind === 'puppeteer') launchOpts.headless = 'new';
  const browser = await eng.mod.launch(launchOpts);
  try {
    let page;
    if (eng.kind === 'playwright') page = await browser.newPage({ viewport, deviceScaleFactor: scale, reducedMotion: 'no-preference' });
    else { page = await browser.newPage(); await page.setViewport({ ...viewport, deviceScaleFactor: scale }); await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'no-preference' }]); }
    return await fn(page);
  } finally { await browser.close(); }
}

// A page that shows the scene without its animation would give a sheet or a video of one still frame.
async function mustAnimate(page, svg) {
  if (!/@keyframes/.test(svg)) return;
  if (await page.evaluate(() => document.getAnimations().length)) return;
  throw new Error('The browser drew the scene without animation (it reports prefers-reduced-motion: reduce, or animations are disabled), so every frame would be the same. Use a Chrome without --force-prefers-reduced-motion and without reduced motion turned on.');
}

/** Still image at loop time t (or the motionless base state when t is null). */
export async function renderPng(svg, out, { at = null, scale = 2, width, bg = 'transparent', intro = false } = {}) {
  const m = meta(svg);
  const W = Math.round(width || m.w), H = Math.round((W * m.h) / m.w);
  const html = pageHtml(svg, { bg, width: W });
  const done = await withPage({ width: W, height: H }, scale, async (page) => {
    await page.setContent(html);
    if (at == null) await page.addStyleTag({ content: '*{animation:none!important}' });
    else { await mustAnimate(page, svg); await page.evaluate(([t, i]) => window.__seek(t, i), [at, intro]); }
    await page.screenshot({ path: out, omitBackground: bg === 'transparent' });
    return true;
  });
  if (!done) throw new Error(NO_BROWSER);
  return out;
}

/**
 * The moments a sheet shows: the story's own key moments (tokens mid-flight, states just changed)
 * rather than an even spread, so short events are not missed between samples. --layout uses the same.
 */
export function sheetTimes(svg, frames = 8) {
  const m = meta(svg);
  const minGap = Math.max(0.4, m.loop / (frames * 2.5));
  const keys = ((svg.match(/data-keys="([^"]+)"/) || [, ''])[1]).split(' ').filter(Boolean).map(Number).sort((a, b) => a - b)
    .reduce((kept, t) => (kept.length && t - kept[kept.length - 1] < minGap ? kept : [...kept, t]), []); // drop near-duplicates
  let times = [];
  if (keys.length >= frames - 1) {
    times = [0];
    for (let i = 0; i < frames - 1; i++) times.push(keys[Math.round((i * (keys.length - 1)) / Math.max(1, frames - 2))]);
  } else {
    times = [0, ...keys];
    // fill the widest gaps first, so the extra frames spread over the whole loop
    while (times.length < frames) {
      const s = [...times, m.loop].sort((a, b) => a - b);
      let gi = 0;
      for (let i = 1; i < s.length; i++) if (s[i] - s[i - 1] > s[gi + 1] - s[gi]) gi = i - 1;
      if (s[gi + 1] - s[gi] < 0.5) break;
      times.push((s[gi] + s[gi + 1]) / 2);
    }
  }
  return times;
}

/** One image holding several frames spread across the loop: the quickest way to check motion. */
export async function renderSheet(svg, out, { frames = 8, cols, cell, times: asked = null, trails = 0 } = {}) {
  const m = meta(svg);
  // frames at chosen times (on the scene clock) replace the automatic choice
  const exact = Array.isArray(asked) && asked.length > 0;
  let times = exact ? asked.map((t) => ((t % m.loop) + m.loop) % m.loop) : sheetTimes(svg, frames);
  times = [...new Set(times.map((t) => +t.toFixed(2)))].sort((a, b) => a - b);
  frames = times.length;
  if (exact && frames <= 4) { cols = cols || Math.min(2, frames); cell = cell || (frames <= 2 ? 760 : 620); } // a few chosen frames are shown large
  if (m.w > 900 && !cols) { cols = frames <= 2 ? 1 : 2; cell = cell || (cols === 1 ? 1100 : 760); } // a wide scene needs wide tiles to stay readable
  cols = cols || (frames <= 4 ? 2 : frames <= 9 ? 3 : 4);
  cell = cell || (cols <= 2 ? 620 : cols === 3 ? 460 : 380);
  const rows = Math.ceil(frames / cols);
  const html = pageHtml(svg, { sheet: { frames, cols, cell, times, trails, exact } });
  const W = cols * cell + (cols + 1) * 8, H = Math.round(rows * ((cell * m.h) / m.w + 26) + (rows + 1) * 8);
  const done = await withPage({ width: W, height: H }, 1, async (page) => {
    await page.setContent(html);
    await mustAnimate(page, svg);
    await page.evaluate(() => window.__seek(0, false));
    await page.screenshot({ path: out, fullPage: true });
    return true;
  });
  if (!done) throw new Error(NO_BROWSER);
  return out;
}

/** Several builds of one scene side by side (for comparing looks). items: [{ label, svg }] */
export async function renderGrid(items, out, { cols, cell } = {}) {
  cols = cols || (items.length <= 4 ? 2 : 3);
  cell = cell || (cols === 2 ? 620 : 460);
  const m = meta(items[0].svg);
  const rows = Math.ceil(items.length / cols);
  const cells = items.map(({ label, svg }) => {
    const keys = ((svg.match(/data-keys="([^"]+)"/) || [, ''])[1]).split(' ').filter(Boolean).map(Number).sort((a, b) => a - b);
    const t = keys.length ? keys[Math.floor(keys.length / 2)] + 0.3 : meta(svg).loop * 0.4; // just after a key moment, so the caption has settled
    return `<figure><div style="background:${tileBg(svg)}">${svg.replace('<svg ', `<svg data-t="${t.toFixed(2)}" `)}</div><figcaption>${label}</figcaption></figure>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#16181d;font:600 13px system-ui,sans-serif;color:#cfd3dc}main{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;padding:8px}figure{margin:0;background:#22252c;border-radius:6px;overflow:hidden}figure svg{display:block;width:100%;height:auto}figcaption{padding:5px 9px}</style></head><body><main>${cells}</main><script>${SEEK}</script></body></html>`;
  const W = cols * cell + (cols + 1) * 8, H = Math.round(rows * ((cell * m.h) / m.w + 30) + (rows + 1) * 8);
  const done = await withPage({ width: W, height: H }, 1, async (page) => {
    await page.setContent(html);
    await page.evaluate(() => window.__seek(0, false));
    await page.screenshot({ path: out, fullPage: true });
    return true;
  });
  if (!done) throw new Error(NO_BROWSER);
  return out;
}

/**
 * Frame-accurate video of the loop. format: mp4 | webm | gif.
 * Frames go straight from the browser into ffmpeg; nothing is written to disk but the video.
 * draft: a quick small preview (640 wide, 15 fps) to check timing; export the full size once, at the end.
 */
export async function renderVideo(svg, out, { format = 'mp4', fps, width, loops = 1, intro = false, bg, draft = false } = {}) {
  if (spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' }).status !== 0) throw new Error('ffmpeg was not found on PATH. Install ffmpeg to export video, or share the SVG itself (it already animates).');
  fps = fps || (draft ? 15 : 30);
  const m = meta(svg);
  let W = Math.round(Math.min(width || (draft ? 640 : 1280), 1920)); W -= W % 2;
  let H = Math.round((W * m.h) / m.w); H -= H % 2;
  const n = Math.round(((intro ? m.intro : 0) + m.loop * loops) * fps);
  // a transparent scene keeps its transparency in WebM; MP4 and GIF need a solid backdrop
  const background = bg || (format === 'webm' ? 'transparent' : (svg.match(/data-bg="(#[0-9a-fA-F]{6})"/) || [, '#ffffff'])[1]);
  const input = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-c:v', 'png', '-framerate', String(fps), '-i', '-'];
  const args = format === 'gif'
    ? [...input, '-vf', `fps=${Math.min(fps, 25)},split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0', out]
    : format === 'webm'
      ? [...input, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', out]
      : [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out];
  const ok = await withPage({ width: W, height: H }, 1, async (page) => {
    await page.setContent(pageHtml(svg, { bg: background, width: W }));
    await mustAnimate(page, svg);
    const ff = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
    let err = '';
    ff.stderr.on('data', (d) => { err = (err + d).slice(-1500); });
    const done = new Promise((resolve) => ff.on('close', resolve));
    ff.stdin.on('error', () => {});
    for (let i = 0; i < n && ff.exitCode == null; i++) {
      await page.evaluate(([t, wi]) => window.__seek(t, wi), [i / fps, intro]);
      const png = await page.screenshot({ omitBackground: background === 'transparent' });
      // wait for ffmpeg to take more, or to quit; drop both listeners either way so they do not pile up frame after frame
      if (!ff.stdin.write(png)) await new Promise((go) => { const on = () => { ff.stdin.off('drain', on); ff.off('close', on); go(); }; ff.stdin.once('drain', on); ff.once('close', on); });
    }
    ff.stdin.end();
    if ((await done) !== 0) throw new Error(`ffmpeg failed: ${err.trim().split('\n').slice(-3).join(' ')}`);
    return true;
  });
  if (!ok) throw new Error(NO_BROWSER);
  return out;
}

// ---------------------------------------------------------------- command line

async function main() {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--') && a.endsWith('.svg'));
  const flag = (n) => argv.includes(`--${n}`);
  const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  if (!file || flag('help')) {
    console.log('Usage: node render.mjs <scene.svg> --png [--at SEC] [--scale 2] | --sheet [--frames 8] | --mp4 | --webm | --gif [--draft] [--fps 30] [--width 1280] [--loops 1] [--intro]');
    process.exit(file ? 0 : 1);
  }
  const svg = fs.readFileSync(file, 'utf8');
  const base = val('out', file.replace(/\.svg$/, ''));
  const stem = base.replace(/\.(png|mp4|webm|gif)$/, '');
  const made = [];
  if (flag('png')) made.push(await renderPng(svg, `${stem}.png`, { at: val('at') != null ? +val('at') : null, scale: +val('scale', 2), width: val('width') ? +val('width') : undefined, bg: val('bg', 'transparent') }));
  if (flag('sheet')) made.push(await renderSheet(svg, `${stem}.sheet.png`, { frames: +val('frames', 8) }));
  const draft = flag('draft');
  for (const f of ['mp4', 'webm', 'gif']) if (flag(f)) made.push(await renderVideo(svg, `${stem}${draft ? '.draft' : ''}.${f}`, { format: f, draft, fps: val('fps') ? +val('fps') : undefined, width: val('width') ? +val('width') : undefined, loops: +val('loops', 1), intro: flag('intro'), bg: val('bg') }));
  if (!made.length) made.push(await renderPng(svg, `${stem}.png`, {}));
  for (const f of made) console.log(`wrote ${f}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`render: ${e.message}`); process.exit(1); });
}

export { here };
