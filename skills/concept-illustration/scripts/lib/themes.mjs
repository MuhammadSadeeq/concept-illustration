// Themes: every colour, line weight, shadow and background a scene uses comes from here.
// A theme lists a few surface "roles"; lit-face tones are derived from each role.

import { adjust, mix, toLch, fromLch, readableOn, isHex, contrast } from './color.mjs';

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";

export const THEMES = {
  // Deep indigo night with glowing accents. The default for technology and product stories.
  aurora: {
    dark: true,
    bg: { type: 'radial', from: '#232a5c', to: '#0b0e22' },
    floor: { grid: 'lines', color: '#a9b4ff', alpha: 0.13, spot: '#6f7dff', spotAlpha: 0.16 },
    ink: '#0a0d20', outline: 0, rim: 0.6,
    shade: { top: 0.105, left: 0, right: -0.085, hue: 10, chroma: 1.05, tint: '#1b1f7a', tintLeft: 0.05, tintRight: 0.16, ao: 0.3 },
    shadow: { kind: 'soft', color: '#04061a', alpha: 0.6, blur: 7 },
    glow: 0.55,
    roles: {
      body: '#434b86', body2: '#59639f', dark: '#191e40', muted: '#2c3362', paper: '#e9ecff', screen: '#11152f',
      accent: '#8170ff', accent2: '#34e2c4', ok: '#3fe0a0', warn: '#ffbd4f', danger: '#ff6382', gold: '#ffd166',
    },
    text: { color: '#f1f3ff', muted: '#a3acdf', halo: '#0d1028' },
    link: { color: '#9aa5ff', alpha: 0.75, width: 2 },
    zone: { fill: '#8f9bff', fillAlpha: 0.07, stroke: '#aab4ff', strokeAlpha: 0.32 },
    radius: 0.07,
  },

  // Neutral graphite with one warm signal colour. Serious, editorial, hardware-like.
  carbon: {
    dark: true,
    bg: { type: 'radial', from: '#2a2d34', to: '#101114' },
    floor: { grid: 'dots', color: '#ffffff', alpha: 0.16, spot: '#ffffff', spotAlpha: 0.05 },
    ink: '#0b0c0e', outline: 0, rim: 0.5,
    shade: { top: 0.1, left: 0, right: -0.075, hue: 0, chroma: 1, tint: '#000000', tintLeft: 0, tintRight: 0.12, ao: 0.32 },
    shadow: { kind: 'soft', color: '#000000', alpha: 0.55, blur: 7 },
    glow: 0.45,
    roles: {
      body: '#4a4e58', body2: '#636874', dark: '#1b1d22', muted: '#34373f', paper: '#ecedf0', screen: '#15161a',
      accent: '#ffab2e', accent2: '#6fd3ff', ok: '#58d68d', warn: '#ffd24a', danger: '#ff6b5e', gold: '#ffc94d',
    },
    text: { color: '#f4f5f7', muted: '#a4a8b3', halo: '#131417' },
    link: { color: '#c9ccd4', alpha: 0.7, width: 2 },
    zone: { fill: '#ffffff', fillAlpha: 0.05, stroke: '#ffffff', strokeAlpha: 0.25 },
    radius: 0.05,
  },

  // Clean ink outlines on cool paper with a single accent. Friendly, technical, great in documents.
  paper: {
    dark: false,
    bg: { type: 'flat', from: '#f5f6f8', to: '#f5f6f8' },
    floor: { grid: 'dots', color: '#1d2433', alpha: 0.2, spot: '#ffffff', spotAlpha: 0 },
    ink: '#1d2433', outline: 1.5, rim: 0,
    shade: { top: 0.03, left: -0.012, right: -0.06, hue: 0, chroma: 1, tint: '#3a4a7a', tintLeft: 0.02, tintRight: 0.07, ao: 0 },
    shadow: { kind: 'soft', color: '#1d2433', alpha: 0.13, blur: 4 },
    glow: 0,
    roles: {
      body: '#fbfcfe', body2: '#e8ecf4', dark: '#1d2433', muted: '#dce1ec', paper: '#ffffff', screen: '#1d2433',
      accent: '#3f66ff', accent2: '#ff8a3d', ok: '#27b36a', warn: '#ffb020', danger: '#ef4a5f', gold: '#ffc94d',
    },
    text: { color: '#1d2433', muted: '#5d667a', halo: '#f5f6f8' },
    link: { color: '#1d2433', alpha: 1, width: 1.6 },
    zone: { fill: '#1d2433', fillAlpha: 0.035, stroke: '#1d2433', strokeAlpha: 0.55 },
    radius: 0.05,
  },

  // Pure black line on white. Prints well, sits quietly inside long documents.
  mono: {
    dark: false,
    bg: { type: 'flat', from: '#ffffff', to: '#ffffff' },
    floor: { grid: 'none', color: '#111111', alpha: 0.14, spot: '#ffffff', spotAlpha: 0 },
    ink: '#141414', outline: 1.6, rim: 0,
    shade: { top: 0.0, left: -0.03, right: -0.09, hue: 0, chroma: 1, tint: '#000000', tintLeft: 0, tintRight: 0, ao: 0 },
    shadow: { kind: 'soft', color: '#000000', alpha: 0.1, blur: 3.5 },
    glow: 0,
    roles: {
      body: '#ffffff', body2: '#ededed', dark: '#141414', muted: '#dddddd', paper: '#ffffff', screen: '#141414',
      accent: '#141414', accent2: '#8c8c8c', ok: '#141414', warn: '#8c8c8c', danger: '#141414', gold: '#bdbdbd',
    },
    text: { color: '#141414', muted: '#666666', halo: '#ffffff' },
    link: { color: '#141414', alpha: 1, width: 1.6 },
    zone: { fill: '#000000', fillAlpha: 0.03, stroke: '#141414', strokeAlpha: 0.6 },
    radius: 0.04,
  },

  // Soft matte forms with broad shadows on a pale lilac ground. Calm, premium, approachable.
  clay: {
    dark: false,
    bg: { type: 'radial', from: '#f7f7fd', to: '#dfe2f2' },
    floor: { grid: 'none', color: '#5b63b0', alpha: 0.12, spot: '#ffffff', spotAlpha: 0.7 },
    ink: '#2b2f55', outline: 0, rim: 0.9,
    shade: { top: 0.035, left: -0.04, right: -0.105, hue: 8, chroma: 1.12, tint: '#5a5fd0', tintLeft: 0.05, tintRight: 0.12, ao: 0.14 },
    shadow: { kind: 'soft', color: '#3c4190', alpha: 0.26, blur: 9 },
    glow: 0.25,
    roles: {
      body: '#f3f4fb', body2: '#dfe3f5', dark: '#2b2f55', muted: '#cfd4ec', paper: '#ffffff', screen: '#262a4f',
      accent: '#6a5cf0', accent2: '#ff7a59', ok: '#2fc48d', warn: '#ffb648', danger: '#f25577', gold: '#ffc857',
    },
    text: { color: '#262a4f', muted: '#6c7199', halo: '#eef0fa' },
    link: { color: '#6f76b8', alpha: 0.9, width: 2.2 },
    zone: { fill: '#ffffff', fillAlpha: 0.55, stroke: '#8f96d6', strokeAlpha: 0.35 },
    radius: 0.14,
  },

  // Warm light, coloured shadows and long flat cast shadows. Bold, optimistic, poster-like.
  sunset: {
    dark: false,
    bg: { type: 'linear', from: '#ffe7d6', to: '#ffc9d6' },
    floor: { grid: 'none', color: '#b0457a', alpha: 0.14, spot: '#fff4ea', spotAlpha: 0.6 },
    ink: '#3a1d4f', outline: 0, rim: 0.7,
    shade: { top: 0.03, left: -0.05, right: -0.13, hue: 14, chroma: 1.25, tint: '#c0347e', tintLeft: 0.1, tintRight: 0.24, ao: 0.1 },
    shadow: { kind: 'cast', color: '#a1306f', alpha: 0.2, blur: 0 },
    glow: 0.2,
    roles: {
      body: '#fff5ec', body2: '#ffd9c2', dark: '#3a1d4f', muted: '#f6c3bd', paper: '#ffffff', screen: '#35184a',
      accent: '#ff5433', accent2: '#7a3df0', ok: '#12b886', warn: '#ffa51f', danger: '#e8305f', gold: '#ffbf2f',
    },
    text: { color: '#3a1d4f', muted: '#8b5a86', halo: '#ffe0d6' },
    link: { color: '#7a3d74', alpha: 0.85, width: 2.2 },
    zone: { fill: '#ffffff', fillAlpha: 0.4, stroke: '#c0347e', strokeAlpha: 0.3 },
    radius: 0.08,
  },

  // White line work on drafting blue. Reads as a plan, a schematic, an engineering explanation.
  blueprint: {
    dark: true,
    bg: { type: 'linear', from: '#1648b0', to: '#0d2f7d' },
    floor: { grid: 'lines', color: '#ffffff', alpha: 0.14, spot: '#ffffff', spotAlpha: 0.06 },
    ink: '#e8f1ff', outline: 1.35, rim: 0,
    shade: { top: 0.045, left: 0, right: -0.04, hue: 0, chroma: 1, tint: '#06205e', tintLeft: 0, tintRight: 0.1, ao: 0 },
    shadow: { kind: 'soft', color: '#041a52', alpha: 0.4, blur: 5 },
    glow: 0.3,
    roles: {
      body: '#1f55c2', body2: '#2c66d8', dark: '#0a2466', muted: '#1a48a6', paper: '#e8f1ff', screen: '#0a2466',
      accent: '#ffd84a', accent2: '#7ef0ff', ok: '#7dffb2', warn: '#ffd84a', danger: '#ff8f8f', gold: '#ffd84a',
    },
    text: { color: '#f0f6ff', muted: '#b4cbf5', halo: '#113a94' },
    link: { color: '#e8f1ff', alpha: 0.95, width: 1.5 },
    zone: { fill: '#ffffff', fillAlpha: 0.05, stroke: '#e8f1ff', strokeAlpha: 0.6 },
    radius: 0.04,
  },
};

export const THEME_NAMES = Object.keys(THEMES);
export const ROLE_NAMES = Object.keys(THEMES.aurora.roles);

export function resolveTheme(name = 'aurora', overrides = {}) {
  const base = THEMES[name];
  if (!base) throw new Error(`Unknown theme "${name}". Choose one of: ${THEME_NAMES.join(', ')}.`);
  const t = JSON.parse(JSON.stringify(base));
  t.name = name;
  t.font = overrides.font === 'mono' ? MONO : overrides.font || FONT;
  t.mono = MONO;
  for (const k of ['accent', 'accent2']) {
    if (overrides[k]) {
      if (!isHex(overrides[k])) throw new Error(`"${k}" must be a hex colour like #ff5a1f, got "${overrides[k]}".`);
      t.roles[k] = overrides[k];
    }
  }
  if (overrides.bg && isHex(overrides.bg)) t.bg = { type: 'flat', from: overrides.bg, to: overrides.bg };
  t._mats = new Map();
  return t;
}

/** Tones for one surface colour under this theme's light. */
export function material(theme, color = 'body') {
  const key = color;
  if (theme._mats.has(key)) return theme._mats.get(key);
  let base = theme.roles[color];
  if (!base) {
    if (!isHex(color)) throw new Error(`Unknown colour "${color}". Use a role (${ROLE_NAMES.join(', ')}) or a hex colour.`);
    base = color;
  }
  const s = theme.shade;
  const o = toLch(base);
  const lift = o.l > 0.9 ? Math.min(s.top, 0.995 - o.l) : s.top;
  let top = fromLch({ l: Math.min(0.995, o.l + lift), c: o.c * 0.94, h: o.h - s.hue * 0.35 });
  let left = fromLch({ l: o.l + s.left, c: o.c, h: o.h });
  let right = fromLch({ l: Math.max(0.05, o.l + s.right), c: o.c * s.chroma, h: o.h + s.hue });
  if (s.tintLeft) left = mix(left, s.tint, s.tintLeft);
  if (s.tintRight) right = mix(right, s.tint, s.tintRight);
  const under = adjust(right, { dl: -0.06 });
  const lt = toLch(top);
  const m = {
    key, base, top, left, right, under,
    rim: fromLch({ l: Math.min(0.995, lt.l + (theme.dark ? 0.16 : 0.05)), c: lt.c * 0.7, h: lt.h }),
    deep: adjust(right, { dl: theme.dark ? -0.07 : -0.09 }),
    topLight: fromLch({ l: Math.min(0.997, lt.l + (theme.dark ? 0.035 : 0.012)), c: lt.c, h: lt.h }),
    topShade: fromLch({ l: lt.l - (theme.dark ? 0.03 : 0.022), c: lt.c, h: lt.h }),
    on: readableOn(top, '#ffffff', theme.dark ? '#0b0e22' : theme.ink),
    onSide: readableOn(left, '#ffffff', theme.dark ? '#0b0e22' : theme.ink),
    ink: theme.ink,
  };
  // Outlined themes: an outline needs to stay visible against the surface it encloses.
  if (theme.outline && contrast(m.ink, left) < 1.6) m.ink = readableOn(left, '#ffffff', '#141414');
  theme._mats.set(key, m);
  return m;
}

/** Tone for an arbitrary unit normal, blended from the three lit faces. */
export function toneFor(mat, n, blendFn) {
  const wx = Math.max(n[0], 0) ** 2, wy = Math.max(n[1], 0) ** 2, wz = Math.max(n[2], 0) ** 2;
  const neg = Math.min(n[0], 0) ** 2 + Math.min(n[1], 0) ** 2;
  const under = Math.min(n[2], 0) ** 2;
  return blendFn([[mat.right, wx + neg * 0.9], [mat.left, wy], [mat.top, wz], [mat.under, under + neg * 0.25]]);
}
