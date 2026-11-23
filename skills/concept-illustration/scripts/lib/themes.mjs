// Looks. A look is three independent choices:
//   palette  the colours (a named one, or any background + accent you supply)
//   finish   how surfaces are rendered (solid, soft, outline, flat, neon)
//   floor    what the scene stands on (grid, dots, plate, rings, none)
// Every tone a scene uses is derived here from those choices, so any combination is coherent.

import { adjust, mix, toLch, fromLch, readableOn, isHex, contrast } from './color.mjs';

const FONT = "Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const MONO = "ui-monospace, 'SF Mono', 'JetBrains Mono', Menlo, Consolas, monospace";
const SERIF = "'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, 'Times New Roman', serif";
const ROUND = "'Nunito', 'Quicksand', ui-rounded, 'SF Pro Rounded', 'Hiragino Maru Gothic ProN', system-ui, sans-serif";

/**
 * Palettes. bg is the page, surface the default object colour, ink the darkest line/text colour,
 * accent the focal colour, accent2 its counterpart. finish and floor are the palette's natural
 * pairing and can be overridden per scene.
 */
export const PALETTES = {
  // ---- dark
  aurora:    { bg: '#141a3d', surface: '#434b86', ink: '#0a0d20', accent: '#8170ff', accent2: '#34e2c4', finish: 'solid', floor: 'grid', mood: 'technology, night, glow' },
  carbon:    { bg: '#1b1d22', surface: '#4a4e58', ink: '#0b0c0e', accent: '#ffab2e', accent2: '#6fd3ff', finish: 'solid', floor: 'dots', mood: 'hardware, serious, industrial' },
  abyss:     { bg: '#062a30', surface: '#1f5f66', ink: '#03161a', accent: '#ff7a59', accent2: '#5ef2d6', finish: 'solid', floor: 'rings', mood: 'deep sea, data, calm intensity' },
  plum:      { bg: '#24122e', surface: '#5a3a6e', ink: '#12081a', accent: '#ff5fa2', accent2: '#ffd166', finish: 'soft', floor: 'plate', mood: 'creative, nightlife, bold' },
  forest:    { bg: '#10261c', surface: '#2f5a45', ink: '#07140e', accent: '#9be564', accent2: '#ffd27a', finish: 'solid', floor: 'plate', mood: 'nature, sustainability, growth' },
  ember:     { bg: '#241410', surface: '#5b3a30', ink: '#120906', accent: '#ff7a3d', accent2: '#ffd9a0', finish: 'flat', floor: 'none', mood: 'warmth, craft, energy' },
  ocean:     { bg: '#0b2545', surface: '#25508a', ink: '#051226', accent: '#4cc9f0', accent2: '#ffd166', finish: 'solid', floor: 'grid', mood: 'trust, networks, scale' },
  noir:      { bg: '#111112', surface: '#3a3a3d', ink: '#050505', accent: '#f4f4f5', accent2: '#ff4d4d', finish: 'outline', floor: 'dots', mood: 'editorial, stark, cinematic' },
  blueprint: { bg: '#123c96', surface: '#1f55c2', ink: '#06205e', accent: '#ffd84a', accent2: '#7ef0ff', finish: 'outline', floor: 'grid', mood: 'plans, engineering, schematics' },
  neon:      { bg: '#0b0b1a', surface: '#1b1b3a', ink: '#05050f', accent: '#00e5ff', accent2: '#ff3df2', finish: 'neon', floor: 'grid', mood: 'futuristic, electric, synth' },
  // ---- light
  studio:    { bg: '#f4f4f2', surface: '#ffffff', ink: '#1c1c1c', accent: '#1f8f8f', accent2: '#f2784b', finish: 'line', floor: 'none', mood: 'refined line art, product detail, quiet confidence' },
  paper:     { bg: '#f5f6f8', surface: '#fbfcfe', ink: '#1d2433', accent: '#3f66ff', accent2: '#ff8a3d', finish: 'outline', floor: 'dots', mood: 'documentation, clarity, technical' },
  mono:      { bg: '#ffffff', surface: '#ffffff', ink: '#141414', accent: '#141414', accent2: '#8c8c8c', finish: 'outline', floor: 'none', mood: 'print, formal, minimal' },
  clay:      { bg: '#eceef8', surface: '#f3f4fb', ink: '#262a4f', accent: '#6a5cf0', accent2: '#ff7a59', finish: 'soft', floor: 'none', mood: 'friendly product, calm, premium' },
  sunset:    { bg: '#ffe7d6', bg2: '#ffc9d6', surface: '#fff5ec', ink: '#3a1d4f', accent: '#ff5433', accent2: '#7a3df0', finish: 'flat', floor: 'none', mood: 'optimistic, people, marketing' },
  mint:      { bg: '#e2f3ea', surface: '#f7fcf9', ink: '#12392b', accent: '#18a36b', accent2: '#ff7a59', finish: 'soft', floor: 'plate', mood: 'fresh, health, sustainability' },
  sand:      { bg: '#f1e9db', surface: '#fbf6ec', ink: '#3b2a1f', accent: '#d9622b', accent2: '#1f8a8a', finish: 'solid', floor: 'plate', mood: 'craft, travel, heritage' },
  sky:       { bg: '#e3efff', surface: '#f7fbff', ink: '#14254a', accent: '#2f6bff', accent2: '#ffb703', finish: 'solid', floor: 'grid', mood: 'open, airy, trustworthy' },
  blossom:   { bg: '#fbe9ee', surface: '#fff7f9', ink: '#4a1f3a', accent: '#e8457a', accent2: '#2bb3a3', finish: 'soft', floor: 'rings', mood: 'care, community, lifestyle' },
  lemon:     { bg: '#fbf3c9', surface: '#fffdf0', ink: '#2a2a1f', accent: '#ff5a36', accent2: '#2a6fdb', finish: 'flat', floor: 'dots', mood: 'playful, education, poster' },
  slate:     { bg: '#e9edf2', surface: '#f8fafc', ink: '#1f2937', accent: '#ef4444', accent2: '#2563eb', finish: 'outline', floor: 'grid', mood: 'reports, operations, neutral' },
  grape:     { bg: '#efe7ff', surface: '#faf7ff', ink: '#2b1a52', accent: '#7c3aed', accent2: '#f59e0b', finish: 'flat', floor: 'plate', mood: 'imaginative, playful tech' },
};

export const FINISHES = {
  solid:   'Shaded faces with rim light and layered shadows. The all-round finish.',
  soft:    'Rounder forms, gentler shading, broad diffuse shadows. Friendly and premium.',
  outline: 'Even ink lines with quiet fills. Technical and crisp (white lines on dark palettes).',
  line:    'Hairline strokes, white forms, generous rounding, almost no shadow. For single-object vignettes.',
  flat:    'Three flat tones per object and long cast shadows. Graphic, like a poster.',
  neon:    'Dark bodies edged in light with strong glow. For dark palettes.',
};
export const FLOORS = {
  grid:  'Fine grid lines fading into the distance.',
  dots:  'A field of dots.',
  plate: 'The whole scene stands on one raised slab, like a diorama.',
  rings: 'Concentric rings spreading from the centre.',
  none:  'Open ground with only light and shadow.',
};

export const PALETTE_NAMES = Object.keys(PALETTES);
export const FINISH_NAMES = Object.keys(FINISHES);
export const FLOOR_NAMES = Object.keys(FLOORS);
export const THEME_NAMES = PALETTE_NAMES; // a look is named after its palette
export const THEMES = PALETTES;
export const ROLE_NAMES = ['body', 'body2', 'dark', 'muted', 'paper', 'screen', 'accent', 'accent2', 'ok', 'warn', 'danger', 'gold'];

// Looks offered when a scene does not choose one. Specialised looks (mono, noir, blueprint, neon) are left out.
const ROTATION = ['aurora', 'clay', 'mint', 'studio', 'ocean', 'sand', 'plum', 'sky', 'forest', 'sunset', 'abyss', 'blossom', 'carbon', 'grape', 'paper', 'ember', 'lemon', 'slate'];

export function pickLook(seed) {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) { h ^= seed.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return ROTATION[(h >>> 0) % ROTATION.length];
}

function shading(finish, dark) {
  switch (finish) {
    case 'soft': return dark
      ? { outline: 0, rim: 0.7, radius: 0.16, glow: 0.5, flat: false, shade: { top: 0.09, left: 0, right: -0.07, hue: 8, chroma: 1.05, tintLeft: 0.04, tintRight: 0.12, ao: 0.22 }, shadow: { kind: 'soft', alpha: 0.5, blur: 11, reach: 1.25 } }
      : { outline: 0, rim: 0.9, radius: 0.16, glow: 0.25, flat: false, shade: { top: 0.03, left: -0.035, right: -0.095, hue: 8, chroma: 1.1, tintLeft: 0.05, tintRight: 0.11, ao: 0.13 }, shadow: { kind: 'soft', alpha: 0.32, blur: 11, reach: 1.25 } };
    case 'line': return dark
      ? { outline: 1.1, rim: 0, radius: 0.2, glow: 0.2, flat: true, shade: { top: 0.02, left: 0, right: -0.02, hue: 0, chroma: 1, tintLeft: 0, tintRight: 0.04, ao: 0 }, shadow: { kind: 'soft', alpha: 0.25, blur: 6, reach: 0.6 } }
      : { outline: 1.1, rim: 0, radius: 0.2, glow: 0, flat: true, shade: { top: 0, left: -0.006, right: -0.028, hue: 0, chroma: 1, tintLeft: 0, tintRight: 0.02, ao: 0 }, shadow: { kind: 'soft', alpha: 0.07, blur: 6, reach: 0.6 } };
    case 'outline': return dark
      ? { outline: 1.4, rim: 0, radius: 0.04, glow: 0.3, flat: true, shade: { top: 0.045, left: 0, right: -0.04, hue: 0, chroma: 1, tintLeft: 0, tintRight: 0.1, ao: 0 }, shadow: { kind: 'soft', alpha: 0.4, blur: 5, reach: 0.8 } }
      : { outline: 1.5, rim: 0, radius: 0.05, glow: 0, flat: true, shade: { top: 0.03, left: -0.012, right: -0.06, hue: 0, chroma: 1, tintLeft: 0.02, tintRight: 0.07, ao: 0 }, shadow: { kind: 'soft', alpha: 0.13, blur: 4, reach: 0.8 } };
    case 'flat': return dark
      ? { outline: 0, rim: 0, radius: 0.04, glow: 0.3, flat: true, shade: { top: 0.13, left: 0.02, right: -0.09, hue: 14, chroma: 1.15, tintLeft: 0.05, tintRight: 0.2, ao: 0 }, shadow: { kind: 'cast', alpha: 0.36, blur: 0, reach: 1 } }
      : { outline: 0, rim: 0, radius: 0.05, glow: 0.18, flat: true, shade: { top: 0.03, left: -0.055, right: -0.14, hue: 14, chroma: 1.25, tintLeft: 0.1, tintRight: 0.24, ao: 0 }, shadow: { kind: 'cast', alpha: 0.2, blur: 0, reach: 1 } };
    case 'neon':
      return { outline: 1.5, rim: 0, radius: 0.05, glow: 0.85, flat: true, shade: { top: 0.05, left: 0, right: -0.035, hue: 0, chroma: 1, tintLeft: 0, tintRight: 0.08, ao: 0 }, shadow: { kind: 'soft', alpha: 0.5, blur: 8, reach: 0.9 } };
    default: return dark
      ? { outline: 0, rim: 0.6, radius: 0.07, glow: 0.55, flat: false, shade: { top: 0.105, left: 0, right: -0.085, hue: 10, chroma: 1.05, tintLeft: 0.05, tintRight: 0.16, ao: 0.3 }, shadow: { kind: 'soft', alpha: 0.58, blur: 7, reach: 1 } }
      : { outline: 0, rim: 0.85, radius: 0.08, glow: 0.22, flat: false, shade: { top: 0.035, left: -0.04, right: -0.105, hue: 8, chroma: 1.12, tintLeft: 0.05, tintRight: 0.12, ao: 0.16 }, shadow: { kind: 'soft', alpha: 0.36, blur: 8, reach: 1 } };
  }
}

/**
 * Build the full theme for a scene.
 * opts: look | theme (palette name), palette (name or { bg, surface, ink, accent, accent2 }),
 *       finish, floor, accent, accent2, bg, font
 */
export function resolveTheme(nameOrOpts = 'aurora', maybeOpts = {}) {
  const opts = typeof nameOrOpts === 'object' ? nameOrOpts : { ...maybeOpts, look: nameOrOpts };
  let name = opts.look || opts.theme || (typeof opts.palette === 'string' ? opts.palette : null) || 'aurora';
  let p;
  if (opts.palette && typeof opts.palette === 'object') {
    const c = opts.palette;
    if (!isHex(c.bg || '') || !isHex(c.accent || '')) throw new Error('A custom palette needs at least bg and accent as hex colours: palette: { bg: "#0f172a", accent: "#f97316" }.');
    for (const k of ['surface', 'ink', 'accent2', 'bg2']) if (c[k] != null && !isHex(c[k])) throw new Error(`palette.${k} must be a hex colour, got "${c[k]}".`);
    p = { finish: 'solid', floor: 'grid', ...c };
    name = c.name || 'custom';
  } else {
    if (!PALETTES[name]) throw new Error(`Unknown look "${name}". Choose one of: ${PALETTE_NAMES.join(', ')}; or pass palette: { bg, accent }.`);
    p = { ...PALETTES[name] };
  }
  for (const k of ['accent', 'accent2']) {
    if (opts[k]) {
      if (!isHex(opts[k])) throw new Error(`"${k}" must be a hex colour like #ff5a1f, got "${opts[k]}".`);
      p[k] = opts[k];
    }
  }
  if (opts.bg) {
    if (!isHex(opts.bg)) throw new Error(`"bg" must be a hex colour, got "${opts.bg}".`);
    p.bg = opts.bg; p.bg2 = null; p.flatBg = true;
  }
  const finish = opts.finish || p.finish || 'solid';
  if (!FINISHES[finish]) throw new Error(`Unknown finish "${finish}". Choose one of: ${FINISH_NAMES.join(', ')}.`);
  const floor = opts.floor || p.floor || 'grid';
  if (!FLOORS[floor]) throw new Error(`Unknown floor "${floor}". Choose one of: ${FLOOR_NAMES.join(', ')}.`);

  const bgL = toLch(p.bg).l;
  const dark = bgL < 0.5;
  const S = shading(finish === 'neon' && !dark ? 'outline' : finish, dark);
  const lined = S.outline > 0;

  const ink = p.ink || (dark ? adjust(p.bg, { l: 0.1 }) : adjust(p.bg, { l: 0.24, ck: 1.4 }));
  let surface = p.surface || (dark ? adjust(p.bg, { dl: 0.2, ck: 1.1 }) : adjust(p.bg, { l: 0.975, ck: 0.5 }));
  const accent2 = p.accent2 || adjust(p.accent, { dh: 150, dl: dark ? 0.08 : -0.02 });
  if (finish === 'neon' && dark) surface = adjust(p.bg, { dl: 0.07, ck: 1.2 });
  if (lined && dark && finish !== 'neon') surface = adjust(p.bg, { dl: 0.07, ck: 1.05 });

  const text = dark ? adjust(p.bg, { l: 0.965, ck: 0.3 }) : ink;
  const line = finish === 'neon' && dark ? mix(p.accent, '#ffffff', 0.35) : lined ? (dark ? adjust(p.bg, { l: 0.93, ck: 0.35 }) : ink) : ink;

  const t = {
    name, finish, floorKind: floor, dark,
    bg: p.flatBg || (name === 'mono')
      ? { type: 'flat', from: p.bg, to: p.bg }
      : p.bg2
        ? { type: 'linear', from: p.bg, to: p.bg2 }
        : { type: 'radial', from: adjust(p.bg, { dl: dark ? 0.085 : 0.03, ck: dark ? 1.2 : 0.8 }), to: adjust(p.bg, { dl: dark ? -0.035 : -0.045, ck: dark ? 1 : 1.3 }) },
    floor: {
      grid: floor === 'grid' ? 'lines' : floor === 'dots' ? 'dots' : 'none',
      plate: floor === 'plate', rings: floor === 'rings',
      color: dark ? adjust(p.bg, { l: 0.82, ck: 0.9 }) : ink,
      alpha: dark ? 0.13 : lined ? 0.2 : 0.13,
      spot: dark ? mix(p.accent, adjust(p.bg, { dl: 0.25 }), 0.45) : '#ffffff',
      spotAlpha: dark ? 0.15 : bgL > 0.985 ? 0 : 0.6,
    },
    ink: line, outline: S.outline, rim: S.rim, flat: S.flat, radius: S.radius, glow: S.glow,
    shade: { ...S.shade, tint: p.shadowTint || (dark ? adjust(p.bg, { l: 0.2, ck: 1.7 }) : adjust(p.accent, { l: 0.5, ck: 0.85 })) },
    shadow: { ...S.shadow, color: dark ? adjust(p.bg, { l: 0.07, ck: 1.2 }) : adjust(mix(p.bg, p.accent, 0.25), { l: 0.36, ck: 1.6 }) },
    haze: dark ? 0.2 : 0.12,
    roles: {
      body: surface,
      body2: dark ? adjust(surface, { dl: 0.085 }) : adjust(surface, { dl: -0.07, ck: 1.7 }),
      muted: dark ? adjust(surface, { dl: -0.085 }) : adjust(surface, { dl: -0.115, ck: 1.9 }),
      dark: dark ? adjust(surface, { dl: -0.19, ck: 0.9 }) : ink,
      paper: dark ? adjust(p.bg, { l: 0.945, ck: 0.3 }) : '#ffffff',
      screen: dark ? adjust(p.bg, { l: 0.165, ck: 0.95 }) : adjust(ink, { l: Math.min(toLch(ink).l, 0.25) }),
      floor: dark ? adjust(p.bg, { dl: 0.07, ck: 1.2 }) : mix(p.bg, '#ffffff', 0.6),
      accent: p.accent, accent2,
      ok: dark ? '#3fe0a0' : '#27b36a', warn: dark ? '#ffbd4f' : '#ffb020', danger: dark ? '#ff6382' : '#ef4a5f', gold: dark ? '#ffd166' : '#ffc94d',
    },
    text: { color: text, muted: mix(text, p.bg, dark ? 0.38 : 0.42), halo: floor === 'plate' ? (dark ? adjust(p.bg, { dl: 0.07, ck: 1.2 }) : mix(p.bg, '#ffffff', 0.6)) : p.bg },
    link: lined ? { color: line, alpha: dark ? 0.95 : 1, width: 1.6 } : dark ? { color: mix(text, p.accent, 0.42), alpha: 0.78, width: 2 } : { color: mix(ink, p.accent, 0.38), alpha: 0.9, width: 2.2 },
    zone: dark
      ? { fill: text, fillAlpha: 0.06, stroke: text, strokeAlpha: lined ? 0.6 : 0.32 }
      : lined ? { fill: ink, fillAlpha: 0.035, stroke: ink, strokeAlpha: 0.55 } : { fill: '#ffffff', fillAlpha: 0.5, stroke: mix(ink, p.accent, 0.4), strokeAlpha: 0.35 },
  };
  if (name === 'mono') Object.assign(t.roles, { ok: '#141414', warn: '#8c8c8c', danger: '#141414', gold: '#bdbdbd' });
  t.font = opts.font === 'mono' ? MONO : opts.font === 'serif' ? SERIF : opts.font === 'round' ? ROUND : opts.font || FONT;
  t.mono = MONO;
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
    on: readableOn(top, '#ffffff', theme.dark ? '#0b0e22' : theme.text.color),
    onSide: readableOn(left, '#ffffff', theme.dark ? '#0b0e22' : theme.text.color),
    ink: theme.ink,
  };
  // Hairline finish: a coloured form is edged in a deeper shade of its own colour, not in black.
  if (theme.finish === 'line' && o.c > 0.05) m.ink = fromLch({ l: Math.max(0.2, o.l - 0.2), c: o.c * 1.05, h: o.h });
  // Outlined finishes: an outline has to stay visible against the surface it encloses.
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
