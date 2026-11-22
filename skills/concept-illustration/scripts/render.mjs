#!/usr/bin/env node
// Rasterise a built scene: a still PNG, a contact sheet of frames across the loop, or a video.
//
//   node render.mjs scene.svg --png [--at 2.5] [--scale 2]
//   node render.mjs scene.svg --sheet [--frames 8]
//   node render.mjs scene.svg --mp4 | --webm | --gif [--fps 30] [--width 1280] [--loops 1] [--intro]
//
// Needs a browser engine: Playwright or Puppeteer if installed, otherwise any Chrome/Chromium/Edge
// binary (stills and sheets only). Video also needs ffmpeg on PATH.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

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

function pageHtml(svg, { bg = 'transparent', width, sheet } = {}) {
  const m = meta(svg);
  if (!sheet) {
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:${bg}}svg{display:block;width:${width}px;height:auto}</style></head><body>${svg}<script>${SEEK}</script></body></html>`;
  }
  const { frames, cols, cell } = sheet;
  const cells = sheet.times.map((t, i) => {
    // each copy needs its own ids so gradients and keyframes do not collide
    const copy = svg.replace(/iso[0-9a-z]+(?=[-"#.)\s])/g, (id) => `${id}f${i}`).replace('<svg ', `<svg data-t="${t.toFixed(3)}" `);
    return `<figure><div>${copy}</div><figcaption>${t.toFixed(1)}s</figcaption></figure>`;
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

function findChrome() {
  const names = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/opt/pw-browsers/chromium'];
  for (const n of names.filter(Boolean)) {
    if (path.isAbsolute(n)) { if (fs.existsSync(n) && fs.statSync(n).isFile()) return n; continue; }
    const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [n], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim().split('\n')[0];
  }
  return null;
}

async function withPage(viewport, scale, fn) {
  const eng = await loadEngine();
  if (!eng) return null;
  const launchOpts = { args: ['--no-sandbox', '--force-prefers-reduced-motion=0'] };
  if (eng.kind === 'puppeteer') { launchOpts.headless = 'new'; const exe = findChrome(); if (exe && !process.env.PUPPETEER_EXECUTABLE_PATH) launchOpts.executablePath = exe; }
  let browser;
  try { browser = await eng.mod.launch(launchOpts); } catch (e) {
    const exe = findChrome();
    if (!exe) throw e;
    browser = await eng.mod.launch({ ...launchOpts, executablePath: exe });
  }
  try {
    let page;
    if (eng.kind === 'playwright') page = await browser.newPage({ viewport, deviceScaleFactor: scale });
    else { page = await browser.newPage(); await page.setViewport({ ...viewport, deviceScaleFactor: scale }); }
    return await fn(page);
  } finally { await browser.close(); }
}

/** Still image at loop time t (or the motionless base state when t is null). */
export async function renderPng(svg, out, { at = null, scale = 2, width, bg = 'transparent', intro = false } = {}) {
  const m = meta(svg);
  const W = Math.round(width || m.w), H = Math.round((W * m.h) / m.w);
  const html = pageHtml(svg, { bg, width: W });
  const done = await withPage({ width: W, height: H }, scale, async (page) => {
    await page.setContent(html);
    if (at == null) await page.addStyleTag({ content: '*{animation:none!important}' });
    else await page.evaluate(([t, i]) => window.__seek(t, i), [at, intro]);
    await page.screenshot({ path: out, omitBackground: bg === 'transparent' });
    return true;
  });
  if (done) return out;
  // Fallback: a plain Chrome binary can still take one screenshot.
  const exe = findChrome();
  if (!exe) throw new Error('No browser engine found. Install one with "npm i -D playwright && npx playwright install chromium", or set CHROME_PATH to a Chrome/Chromium/Edge binary.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-'));
  const file = path.join(tmp, 'page.html');
  const seekNow = at == null ? '<style>*{animation:none!important}</style>' : `<script>addEventListener('load',()=>window.__seek(${at},${intro}))</script>`;
  fs.writeFileSync(file, html.replace('</body>', `${seekNow}</body>`));
  const r = spawnSync(exe, ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--force-device-scale-factor=${scale}`, `--window-size=${W},${H}`, '--default-background-color=00000000', `--screenshot=${path.resolve(out)}`, pathToFileURL(file).href], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`Chrome could not take the screenshot: ${(r.stderr || '').slice(0, 300)}`);
  return out;
}

/** One image holding several frames spread across the loop: the quickest way to check motion. */
export async function renderSheet(svg, out, { frames = 8, cols, cell } = {}) {
  const m = meta(svg);
  // Prefer the story's own key moments (tokens mid-flight, states just changed) over an even spread,
  // so short events are not missed between samples.
  const minGap = Math.max(0.4, m.loop / (frames * 2.5));
  const keys = ((svg.match(/data-keys="([^"]+)"/) || [, ''])[1]).split(' ').filter(Boolean).map(Number).sort((a, b) => a - b)
    .reduce((kept, t) => (kept.length && t - kept[kept.length - 1] < minGap ? kept : [...kept, t]), []); // drop near-duplicates
  let times = [];
  if (keys.length >= frames - 1) {
    times = [0];
    for (let i = 0; i < frames - 1; i++) times.push(keys[Math.round((i * (keys.length - 1)) / Math.max(1, frames - 2))]);
  } else {
    times = [0, ...keys];
    for (let i = 1; times.length < frames && i < frames * 4; i++) { const t = (m.loop * i) / (frames * 4); if (times.every((k) => Math.abs(k - t) > m.loop / (frames * 2))) times.push(t); }
  }
  times = [...new Set(times.map((t) => +t.toFixed(2)))].sort((a, b) => a - b);
  frames = times.length;
  cols = cols || (frames <= 4 ? 2 : frames <= 9 ? 3 : 4);
  cell = cell || (cols <= 2 ? 620 : cols === 3 ? 460 : 380);
  const rows = Math.ceil(frames / cols);
  const html = pageHtml(svg, { sheet: { frames, cols, cell, times } });
  const W = cols * cell + (cols + 1) * 8, H = Math.round(rows * ((cell * m.h) / m.w + 26) + (rows + 1) * 8);
  const done = await withPage({ width: W, height: H }, 1, async (page) => {
    await page.setContent(html);
    await page.evaluate(() => window.__seek(0, false));
    await page.screenshot({ path: out, fullPage: true });
    return true;
  });
  if (done) return out;
  const exe = findChrome();
  if (!exe) throw new Error('No browser engine found. Install one with "npm i -D playwright && npx playwright install chromium", or set CHROME_PATH to a Chrome/Chromium/Edge binary.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-'));
  const file = path.join(tmp, 'sheet.html');
  fs.writeFileSync(file, html.replace('</body>', `<script>addEventListener('load',()=>window.__seek(0,false))</script></body>`));
  const r = spawnSync(exe, ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${path.resolve(out)}`, pathToFileURL(file).href], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`Chrome could not take the screenshot: ${(r.stderr || '').slice(0, 300)}`);
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
    return `<figure><div>${svg.replace('<svg ', `<svg data-t="${t.toFixed(2)}" `)}</div><figcaption>${label}</figcaption></figure>`;
  }).join('');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:#16181d;font:600 13px system-ui,sans-serif;color:#cfd3dc}main{display:grid;grid-template-columns:repeat(${cols},${cell}px);gap:8px;padding:8px}figure{margin:0;background:#22252c;border-radius:6px;overflow:hidden}figure svg{display:block;width:100%;height:auto}figcaption{padding:5px 9px}</style></head><body><main>${cells}</main><script>${SEEK}</script></body></html>`;
  const W = cols * cell + (cols + 1) * 8, H = Math.round(rows * ((cell * m.h) / m.w + 30) + (rows + 1) * 8);
  const done = await withPage({ width: W, height: H }, 1, async (page) => {
    await page.setContent(html);
    await page.evaluate(() => window.__seek(0, false));
    await page.screenshot({ path: out, fullPage: true });
    return true;
  });
  if (done) return out;
  const exe = findChrome();
  if (!exe) throw new Error('No browser engine found. Install one with "npm i -D playwright && npx playwright install chromium", or set CHROME_PATH to a Chrome/Chromium/Edge binary.');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-'));
  const file = path.join(tmp, 'looks.html');
  fs.writeFileSync(file, html.replace('</body>', `<script>addEventListener('load',()=>window.__seek(0,false))</script></body>`));
  const r = spawnSync(exe, ['--headless=new', '--no-sandbox', '--hide-scrollbars', `--window-size=${W},${H}`, `--screenshot=${path.resolve(out)}`, pathToFileURL(file).href], { encoding: 'utf8' });
  if (r.status !== 0 || !fs.existsSync(out)) throw new Error(`Chrome could not take the screenshot: ${(r.stderr || '').slice(0, 300)}`);
  return out;
}

/** Frame-accurate video of the loop. format: mp4 | webm | gif */
export async function renderVideo(svg, out, { format = 'mp4', fps = 30, width = 1280, loops = 1, intro = false, bg } = {}) {
  const ff = spawnSync('ffmpeg', ['-version'], { encoding: 'utf8' });
  if (ff.status !== 0) throw new Error('ffmpeg was not found on PATH. Install ffmpeg to export video, or share the SVG itself (it already animates).');
  const m = meta(svg);
  let W = Math.round(Math.min(width, 1920)); W -= W % 2;
  let H = Math.round((W * m.h) / m.w); H -= H % 2;
  const total = (intro ? m.intro : 0) + m.loop * loops;
  const n = Math.round(total * fps);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-frames-'));
  // a transparent scene keeps its transparency in WebM; MP4 and GIF need a solid backdrop
  const background = bg || (format === 'webm' ? 'transparent' : (svg.match(/data-bg="(#[0-9a-fA-F]{6})"/) || [, '#ffffff'])[1]);
  const ok = await withPage({ width: W, height: H }, 1, async (page) => {
    await page.setContent(pageHtml(svg, { bg: background, width: W }));
    for (let i = 0; i < n; i++) {
      await page.evaluate(([t, wi]) => window.__seek(t, wi), [i / fps, intro]);
      await page.screenshot({ path: path.join(tmp, `f${String(i).padStart(5, '0')}.png`), omitBackground: background === 'transparent' });
    }
    return true;
  });
  if (!ok) throw new Error('Video export needs Playwright or Puppeteer: "npm i -D playwright && npx playwright install chromium".');
  const input = ['-y', '-framerate', String(fps), '-i', path.join(tmp, 'f%05d.png')];
  const args = format === 'gif'
    ? [...input, '-vf', `fps=${Math.min(fps, 25)},split[a][b];[a]palettegen=max_colors=160:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4`, '-loop', '0', out]
    : format === 'webm'
      ? [...input, '-c:v', 'libvpx-vp9', '-pix_fmt', 'yuva420p', '-b:v', '0', '-crf', '30', out]
      : [...input, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '18', '-movflags', '+faststart', out];
  const r = spawnSync('ffmpeg', args, { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${(r.stderr || '').split('\n').slice(-4).join(' ')}`);
  return out;
}

// ---------------------------------------------------------------- command line

async function main() {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith('--') && a.endsWith('.svg'));
  const flag = (n) => argv.includes(`--${n}`);
  const val = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d; };
  if (!file || flag('help')) {
    console.log('Usage: node render.mjs <scene.svg> --png [--at SEC] [--scale 2] | --sheet [--frames 8] | --mp4 | --webm | --gif [--fps 30] [--width 1280] [--loops 1] [--intro]');
    process.exit(file ? 0 : 1);
  }
  const svg = fs.readFileSync(file, 'utf8');
  const base = val('out', file.replace(/\.svg$/, ''));
  const stem = base.replace(/\.(png|mp4|webm|gif)$/, '');
  const made = [];
  if (flag('png')) made.push(await renderPng(svg, `${stem}.png`, { at: val('at') != null ? +val('at') : null, scale: +val('scale', 2), width: val('width') ? +val('width') : undefined, bg: val('bg', 'transparent') }));
  if (flag('sheet')) made.push(await renderSheet(svg, `${stem}.sheet.png`, { frames: +val('frames', 8) }));
  for (const f of ['mp4', 'webm', 'gif']) if (flag(f)) made.push(await renderVideo(svg, `${stem}.${f}`, { format: f, fps: +val('fps', 30), width: +val('width', 1280), loops: +val('loops', 1), intro: flag('intro'), bg: val('bg') }));
  if (!made.length) made.push(await renderPng(svg, `${stem}.png`, {}));
  for (const f of made) console.log(`wrote ${f}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => { console.error(`render: ${e.message}`); process.exit(1); });
}

export { here };
