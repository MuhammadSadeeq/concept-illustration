// A small Chrome DevTools Protocol client over --remote-debugging-pipe, so stills, sheets and video
// need only a Chrome, Chromium or Edge binary: no Playwright, no Puppeteer, no WebSocket.
// It offers the few page methods render.mjs uses, with the same names as Playwright's.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export async function launchChrome(exe) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-chrome-'));
  const proc = spawn(exe, ['--headless=new', '--no-sandbox', '--remote-debugging-pipe', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (d) => { stderr = (stderr + d).slice(-2000); });
  const out = proc.stdio[3], inp = proc.stdio[4];
  let seq = 0, parts = [], dead = null;
  const pending = new Map(), handlers = new Set();
  const dispatch = (msg) => {
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.timer);
      if (msg.error) p.reject(new Error(`${p.method}: ${msg.error.message}`)); else p.resolve(msg.result);
    } else for (const h of handlers) h(msg);
  };
  // messages end with a NUL byte; a screenshot arrives in many chunks, so join them only once it is whole
  inp.on('data', (chunk) => {
    for (let end = chunk.indexOf(0); end >= 0; end = chunk.indexOf(0)) {
      parts.push(chunk.subarray(0, end));
      const text = Buffer.concat(parts).toString('utf8');
      parts = []; chunk = chunk.subarray(end + 1);
      dispatch(JSON.parse(text));
    }
    if (chunk.length) parts.push(chunk);
  });
  const fail = (why) => { dead = dead || new Error(why); for (const p of pending.values()) p.reject(dead); pending.clear(); };
  proc.on('exit', (code) => fail(`Chrome exited (code ${code}). ${stderr.split('\n').filter(Boolean).slice(-2).join(' ')}`));
  proc.on('error', (e) => fail(`Chrome could not start: ${e.message}`));
  out.on('error', () => {});
  // no call may hang the build: a page that stops painting fails with a message instead
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    if (dead) return reject(dead);
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`Chrome did not answer ${method} within 60 s.`)); }, 60000);
    timer.unref();
    pending.set(id, { resolve, reject, method, timer });
    out.write(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }) + '\0');
  });

  async function newPage({ width, height, scale = 1 }) {
    const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
    const call = (m, p) => send(m, p, sessionId);
    const errors = [];
    handlers.add((msg) => {
      if (msg.sessionId !== sessionId || msg.method !== 'Runtime.exceptionThrown') return;
      const d = msg.params.exceptionDetails;
      for (const fn of errors) fn(new Error((d.exception && d.exception.description) || d.text));
    });
    await call('Page.enable'); await call('Runtime.enable');
    let size = { width, height };
    const setSize = (w, h) => { size = { width: w, height: h }; return call('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: scale, mobile: false }); };
    await setSize(width, height);
    // a renderer must see the animation: never let the machine's reduced-motion setting switch it off
    await call('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'no-preference' }] });
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'iso-page-'));
    let n = 0;
    const page = {
      on(event, fn) { if (event === 'pageerror') errors.push(fn); },
      async evaluate(fn, arg) {
        const expression = typeof fn === 'function' ? `(${fn})(${arg === undefined ? '' : JSON.stringify(arg)})` : String(fn);
        const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
        if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
        return r.result.value;
      },
      async setContent(html) {
        // a file, not a data: URL, which Chrome caps at 2 MB (a sheet of a large scene is bigger)
        const file = path.join(tmp, `p${n++}.html`);
        fs.writeFileSync(file, html);
        const loaded = new Promise((done, fail) => {
          const timer = setTimeout(() => { handlers.delete(h); fail(new Error('Chrome did not finish loading the page within 60 s.')); }, 60000);
          const h = (msg) => { if (msg.sessionId === sessionId && msg.method === 'Page.loadEventFired') { handlers.delete(h); clearTimeout(timer); done(); } };
          handlers.add(h);
        });
        await call('Page.navigate', { url: pathToFileURL(file).href });
        await loaded;
        await page.evaluate(() => document.fonts.ready.then(() => true));
      },
      addStyleTag({ content }) { return page.evaluate((css) => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); return true; }, content); },
      async screenshot({ path: file, omitBackground = false, fullPage = false, type = 'png' } = {}) {
        if (fullPage) {
          const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
          if (h !== size.height) await setSize(size.width, h);
        }
        if (omitBackground) await call('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
        const { data } = await call('Page.captureScreenshot', { format: type, optimizeForSpeed: true, ...(type === 'jpeg' ? { quality: 92 } : {}) });
        if (omitBackground) await call('Emulation.setDefaultBackgroundColorOverride', {});
        const bytes = Buffer.from(data, 'base64');
        if (file) fs.writeFileSync(file, bytes);
        return bytes;
      },
      close: () => { fs.rmSync(tmp, { recursive: true, force: true }); return send('Target.closeTarget', { targetId }).catch(() => {}); },
    };
    return page;
  }

  async function close() {
    await send('Browser.close').catch(() => {});
    await new Promise((done) => { if (proc.exitCode != null) done(); else { proc.once('exit', done); setTimeout(() => { proc.kill('SIGKILL'); done(); }, 3000).unref(); } });
    fs.rmSync(profile, { recursive: true, force: true });
  }

  // fails fast if this binary does not start or does not speak the protocol
  try { await send('Browser.getVersion'); } catch (e) { proc.kill('SIGKILL'); throw e; }
  return { newPage, close };
}
