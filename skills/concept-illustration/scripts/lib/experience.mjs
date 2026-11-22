// Wrap a built scene in a self-contained interactive page: the SVG inline, the runtime script
// inline, a little page CSS. Nothing is fetched from anywhere.

import fs from 'node:fs';

export const EXPERIENCE_MODES = ['loop', 'step', 'scroll'];

const RUNTIME = new URL('../runtime/iso-experience.js', import.meta.url);
const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const rgb = (hex) => (hex.length === 4 ? hex.replace(/[0-9a-f]/gi, '$&$&') : hex).match(/[0-9a-f]{2}/gi).map((h) => parseInt(h, 16));
const isDark = (hex) => { const [r, g, b] = rgb(hex); return 0.299 * r + 0.587 * g + 0.114 * b < 128; };
const mix = (hex, toward, amount) => `#${rgb(hex).map((v) => Math.round(v + (toward - v) * amount).toString(16).padStart(2, '0')).join('')}`;

// The page sits a step behind the scene's backdrop, so the figure reads as a card on it. A
// transparent scene has no backdrop; its page takes the tone the scene's labels were drawn for.
function pageColours(svg) {
  const bg = (svg.slice(0, svg.indexOf('>')).match(/\sdata-bg="([^"]*)"/) || [])[1];
  const ink = (svg.match(/<text[^>]*\sfill="([^"]*)"/) || [])[1];
  let dark = false;
  let page = '#fff';
  if (HEX.test(bg || '')) {
    dark = isDark(bg);
    page = dark ? mix(bg, 0, 0.4) : mix(bg, 255, 0.6);
  } else if (HEX.test(ink || '') && !isDark(ink)) {
    dark = true;
    page = '#111318';
  }
  return `:root{color-scheme:${dark ? 'dark' : 'light'}}body{background:${page}}`;
}

export function experienceHtml(name, result, opts = {}) {
  const mode = EXPERIENCE_MODES.includes(opts.mode) ? opts.mode : 'loop';
  // the scene's own title is already escaped for markup
  const title = (result.svg.match(/<title[^>]*>([^<]+)<\/title>/) || [])[1] || esc(name);
  const ratio = (result.width / result.height || 1.4).toFixed(4);
  // a literal closing tag inside the script would end it early
  const runtime = fs.readFileSync(RUNTIME, 'utf8').replace(/<\/script/gi, '<\\/script');
  const flags = `${opts.controls === false ? ' data-controls="false"' : ''}${opts.hotspots === false ? ' data-hotspots="false"' : ''}`;
  // loop and step fit the whole figure in the window; in scroll mode the figure sets the page height
  const layout = mode === 'scroll'
    ? 'main{max-width:1040px;margin:0 auto;padding:0 16px}'
    : `body{display:grid;place-items:center;min-height:100vh;min-height:100svh}main{box-sizing:border-box;width:min(100%,1040px,calc((100vh - 120px)*${ratio} + 32px));min-width:min(100%,320px);padding:16px}`;
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
${pageColours(result.svg)}
html,body{margin:0}
${layout}
figure{margin:0}
figure svg{display:block;width:100%;height:auto}
</style></head><body>
<main><figure data-iso-experience data-mode="${mode}"${flags}>${result.svg}</figure></main>
<script>
${runtime}</script>
</body></html>
`;
}
