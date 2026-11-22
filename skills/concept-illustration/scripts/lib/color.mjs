// Colour maths in OKLab / OKLCH. Tones for lit faces are derived here so that
// every surface in a scene comes from one perceptual model instead of hand-picked hexes.

const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function parseHex(hex) {
  let h = String(hex).trim().replace('#', '');
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(h)) throw new Error(`Invalid colour "${hex}". Use a hex colour like #4f7cff.`);
  return [parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255];
}

export const isHex = (v) => typeof v === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim());

const toLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function rgbToLab([r, g, b]) {
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function labToLinRgb([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

const inGamut = (rgb) => rgb.every((c) => c >= -0.0005 && c <= 1.0005);

function lchToHex(L, C, H) {
  L = clamp(L, 0, 1);
  const hr = (H * Math.PI) / 180;
  let lo = 0, hi = Math.max(0, C), rgb = labToLinRgb([L, hi * Math.cos(hr), hi * Math.sin(hr)]);
  if (!inGamut(rgb)) {
    // Reduce chroma until the colour fits sRGB: keeps hue and lightness intact.
    for (let i = 0; i < 18; i++) {
      const mid = (lo + hi) / 2;
      rgb = labToLinRgb([L, mid * Math.cos(hr), mid * Math.sin(hr)]);
      if (inGamut(rgb)) lo = mid; else hi = mid;
    }
    rgb = labToLinRgb([L, lo * Math.cos(hr), lo * Math.sin(hr)]);
  }
  return '#' + rgb.map((c) => Math.round(clamp(toSrgb(clamp(c))) * 255).toString(16).padStart(2, '0')).join('');
}

export function toLch(hex) {
  const [L, a, b] = rgbToLab(parseHex(hex));
  const C = Math.hypot(a, b);
  let H = (Math.atan2(b, a) * 180) / Math.PI;
  if (H < 0) H += 360;
  return { l: L, c: C, h: C < 0.004 ? 0 : H };
}

export const fromLch = ({ l, c, h }) => lchToHex(l, c, h);

/** Shift a colour: dl adds lightness, ck multiplies chroma, dh rotates hue (degrees). */
export function adjust(hex, { dl = 0, ck = 1, dh = 0, l, c } = {}) {
  const o = toLch(hex);
  return lchToHex(l ?? o.l + dl, c ?? o.c * ck, o.h + dh);
}

/** Perceptual mix of two colours (t = 0 gives a, t = 1 gives b). */
export function mix(a, b, t = 0.5) {
  const A = rgbToLab(parseHex(a)), B = rgbToLab(parseHex(b));
  const m = A.map((v, i) => v + (B[i] - v) * t);
  const C = Math.hypot(m[1], m[2]);
  let H = (Math.atan2(m[2], m[1]) * 180) / Math.PI;
  return lchToHex(m[0], C, H < 0 ? H + 360 : H);
}

/** Weighted mix of several colours: [[hex, weight], ...]. */
export function blend(list) {
  let sum = 0;
  const acc = [0, 0, 0];
  for (const [hex, w] of list) {
    if (w <= 0) continue;
    const lab = rgbToLab(parseHex(hex));
    acc[0] += lab[0] * w; acc[1] += lab[1] * w; acc[2] += lab[2] * w; sum += w;
  }
  if (!sum) return list[0][0];
  const m = acc.map((v) => v / sum);
  let H = (Math.atan2(m[2], m[1]) * 180) / Math.PI;
  return lchToHex(m[0], Math.hypot(m[1], m[2]), H < 0 ? H + 360 : H);
}

export function rgba(hex, alpha = 1) {
  const [r, g, b] = parseHex(hex).map((c) => Math.round(c * 255));
  return alpha >= 1 ? hex : `rgba(${r},${g},${b},${+alpha.toFixed(3)})`;
}

export function luminance(hex) {
  const [r, g, b] = parseHex(hex).map(toLin);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a, b) {
  const la = luminance(a), lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Pick whichever of two inks reads better on a surface. */
export const readableOn = (surface, light = '#ffffff', dark = '#0f1222') =>
  contrast(surface, light) >= contrast(surface, dark) ? light : dark;
