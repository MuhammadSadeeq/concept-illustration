// The object kit: ready-made isometric objects built from the primitives.
// Sizes are in grid cells. Every builder returns { parts, w, d, h } plus optional extras.

import { rectOutline, circleOutline, UNIT, SPHERE_K, proj } from './geom.mjs';
import { rgba, mix, adjust, isHex } from './color.mjs';
import { ICONS } from './icons.mjs';

// ---------------------------------------------------------------- helpers

const call = (v, a, b) => (typeof v === 'function' ? v(a, b) : v);

/** Upright block standing on the floor. top/left/right draw flat artwork on its faces. */
export function box({ x = 0, y = 0, z = 0, w = 1, d = 1, h = 1, r = 0, color = 'body', top, left, right, ...rest }) {
  const decals = [];
  if (top) decals.push({ plane: 'top', o: [x - w / 2, y - d / 2, z + h], items: call(top, w, d) });
  if (left) decals.push({ plane: 'left', o: [x - w / 2, y + d / 2, z + h], items: call(left, w, h) });
  if (right) decals.push({ plane: 'right', o: [x + w / 2, y + d / 2, z + h], items: call(right, d, h) });
  return { t: 'prism', plane: 'top', o: [x, y, z], pts: rectOutline(w, d, r), depth: h, color, decals, ...rest };
}

export function cyl({ x = 0, y = 0, z = 0, r = 0.5, h = 1, color = 'body', top, ...rest }) {
  const decals = [];
  if (top) decals.push({ plane: 'top', o: [x - r, y - r, z + h], items: call(top, 2 * r, 2 * r) });
  return { t: 'prism', plane: 'top', o: [x, y, z], pts: circleOutline(r), depth: h, color, decals, ...rest };
}

/**
 * Upright slab. facing 'left' looks toward the lower-left of the picture, 'right' toward the lower-right.
 * (x, y) is the centre of the slab's footprint, z its bottom edge. `outline` replaces the rectangle.
 */
export function panel({ x = 0, y = 0, z = 0, w = 1, h = 1, t = 0.08, r = 0, facing = 'left', color = 'body', face, outline, ...rest }) {
  const pts = outline || rectOutline(w, h, r, 0, h / 2);
  const decals = [];
  if (facing === 'left') {
    if (face) decals.push({ plane: 'left', o: [x - w / 2, y + t / 2, z + h], items: call(face, w, h) });
    return { t: 'prism', plane: 'left', o: [x, y - t / 2, z], pts, depth: t, color, decals, ...rest };
  }
  if (face) decals.push({ plane: 'right', o: [x + t / 2, y + w / 2, z + h], items: call(face, w, h) });
  return { t: 'prism', plane: 'right', o: [x - t / 2, y, z], pts, depth: t, color, decals, ...rest };
}

/** Outer boundary of a set of overlapping circles (a soft blob such as a cloud). */
function blobOutline(circles, n = 64) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const ux = Math.cos(a), uy = Math.sin(a);
    let best = 0;
    for (const [cx, cy, r] of circles) {
      const b = ux * cx + uy * cy;
      const disc = b * b - (cx * cx + cy * cy - r * r);
      if (disc >= 0) best = Math.max(best, b + Math.sqrt(disc));
    }
    pts.push([ux * best, uy * best]);
  }
  return pts;
}

function gearOutline(r, teeth = 10, depth = 0.2) {
  const pts = [];
  const ri = r * (1 - depth);
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2, s = (Math.PI * 2) / teeth;
    for (const [k, rad] of [[0.0, ri], [0.16, r], [0.46, r], [0.62, ri]]) pts.push([Math.cos(a + s * k) * rad, Math.sin(a + s * k) * rad]);
  }
  return pts;
}

const pathOf = (pts) => 'M' + pts.map((p) => `${+p[0].toFixed(3)} ${+p[1].toFixed(3)}`).join('L') + 'Z';

const icon = (name, fw, fh, color, k = 0.6, extra = {}) => ({ t: 'icon', name, x: fw / 2, y: fh / 2, size: Math.min(fw, fh) * k, color, ...extra });
const led = (cx, cy, color, phase = 0, r = 0.04) => ({ t: 'circle', cx, cy, r, fill: color, anim: { type: 'blink', phase, period: 2.4 } });

// ---------------------------------------------------------------- screen artwork

/** Content for a screen or window face. Light marks on a dark surface, or ink on paper. */
function ui(kind, fw, fh, K, { accent = 'accent', dark = true, pad = 0.1 } = {}) {
  const A = K.hex(accent), A2 = K.hex('accent2');
  const base = dark ? '#ffffff' : K.theme.dark ? '#1a2040' : K.theme.ink;
  const soft = (a) => rgba(base, dark ? a : a * 0.75);
  const x0 = pad, y0 = pad, w = fw - pad * 2, h = fh - pad * 2;
  const it = [];
  const line = (x, y, len, color, t = 0.05) => it.push({ t: 'rect', x, y, w: Math.max(0.02, len), h: t, r: t / 2, fill: color });
  if (kind && kind.startsWith('icon:')) {
    it.push(icon(kind.slice(5), fw, fh, A, 0.5));
    return it;
  }
  if (kind && kind.startsWith('text:')) {
    it.push({ t: 'text', x: fw / 2, y: fh / 2, text: kind.slice(5), size: Math.min(fh * 0.34, (fw * 1.5) / Math.max(2, kind.length - 5)), fill: A, weight: 800 });
    return it;
  }
  switch (kind) {
    case 'code': {
      const rows = Math.max(3, Math.floor(h / 0.13));
      const pat = [[0, 0.5, A], [0.12, 0.62, soft(0.5)], [0.12, 0.4, A2], [0.24, 0.5, soft(0.5)], [0.12, 0.3, soft(0.35)], [0, 0.42, A], [0.12, 0.55, soft(0.5)]];
      for (let i = 0; i < rows; i++) {
        const [ind, len, c] = pat[i % pat.length];
        line(x0 + ind * w, y0 + i * (h / rows) + 0.02, len * w, c, 0.045);
        if (i === rows - 1) it.push({ t: 'rect', x: x0 + (ind + len) * w + 0.03, y: y0 + i * (h / rows), w: 0.045, h: 0.085, fill: A, anim: { type: 'blink', period: 1.1, min: 0 } });
      }
      break;
    }
    case 'chart': {
      const vals = [0.35, 0.55, 0.45, 0.8, 0.65, 1];
      const bw = w / (vals.length * 1.6);
      vals.forEach((v, i) => it.push({ t: 'rect', x: x0 + i * (w / vals.length) + bw * 0.3, y: y0 + h * (1 - v * 0.85), w: bw, h: h * v * 0.85, r: 0.025, fill: i === vals.length - 1 ? A : soft(0.42), ...(i === vals.length - 1 ? { anim: { type: 'blink', period: 2.2, min: 0.55 } } : {}) }));
      it.push({ t: 'line', x1: x0, y1: y0 + h, x2: x0 + w, y2: y0 + h, stroke: soft(0.3), sw: 0.02 });
      break;
    }
    case 'dash': {
      const cw = (w - 0.08) / 2;
      it.push({ t: 'rect', x: x0, y: y0, w: cw, h: h * 0.34, r: 0.04, fill: soft(0.16) });
      it.push({ t: 'rect', x: x0 + cw + 0.08, y: y0, w: cw, h: h * 0.34, r: 0.04, fill: soft(0.16) });
      line(x0 + 0.06, y0 + 0.07, cw * 0.4, soft(0.5), 0.04);
      line(x0 + 0.06, y0 + h * 0.2, cw * 0.62, A, 0.07);
      line(x0 + cw + 0.14, y0 + 0.07, cw * 0.4, soft(0.5), 0.04);
      line(x0 + cw + 0.14, y0 + h * 0.2, cw * 0.5, A2, 0.07);
      const vals = [0.4, 0.62, 0.5, 0.85, 0.7, 1, 0.8];
      const gy = y0 + h * 0.44, gh = h * 0.56;
      vals.forEach((v, i) => it.push({ t: 'rect', x: x0 + i * (w / vals.length) + 0.02, y: gy + gh * (1 - v), w: w / vals.length - 0.05, h: gh * v, r: 0.02, fill: i === 5 ? A : soft(0.3), ...(i === 5 ? { anim: { type: 'blink', period: 2.4, min: 0.55 } } : {}) }));
      it.push({ t: 'circle', cx: x0 + w - 0.05, cy: y0 + 0.07, r: 0.03, fill: K.hex('ok'), anim: { type: 'blink', period: 1.4, min: 0.2 } });
      break;
    }
    case 'chat': {
      const bh = Math.min(0.2, h / 4.2);
      it.push({ t: 'rect', x: x0, y: y0, w: w * 0.62, h: bh, r: bh / 2, fill: soft(0.3) });
      it.push({ t: 'rect', x: x0 + w * 0.3, y: y0 + bh * 1.35, w: w * 0.7, h: bh, r: bh / 2, fill: A });
      it.push({ t: 'rect', x: x0, y: y0 + bh * 2.7, w: w * 0.48, h: bh, r: bh / 2, fill: soft(0.3) });
      for (let k = 0; k < 3; k++) it.push({ t: 'circle', cx: x0 + w * 0.14 + k * w * 0.1, cy: y0 + bh * 3.2, r: bh * 0.16, fill: soft(0.9), anim: { type: 'blink', period: 1.2, phase: k * 0.16, min: 0.25 } });
      break;
    }
    case 'list': {
      const rows = Math.max(2, Math.min(5, Math.floor(h / 0.2)));
      for (let i = 0; i < rows; i++) {
        const y = y0 + i * (h / rows) + 0.03;
        it.push({ t: 'circle', cx: x0 + 0.06, cy: y + 0.04, r: 0.045, fill: i === 0 ? A : soft(0.4) });
        line(x0 + 0.18, y + 0.015, w * (0.7 - (i % 3) * 0.14), soft(i === 0 ? 0.75 : 0.4), 0.05);
      }
      break;
    }
    case 'image': {
      it.push({ t: 'rect', x: x0, y: y0, w, h, r: 0.05, fill: soft(0.14) });
      it.push({ t: 'circle', cx: x0 + w * 0.72, cy: y0 + h * 0.3, r: Math.min(w, h) * 0.11, fill: A2 });
      it.push({ t: 'poly', pts: [[x0, y0 + h], [x0 + w * 0.34, y0 + h * 0.42], [x0 + w * 0.56, y0 + h * 0.74], [x0 + w * 0.72, y0 + h * 0.56], [x0 + w, y0 + h]], fill: A, fillOp: 0.85 });
      break;
    }
    case 'play': {
      it.push({ t: 'circle', cx: fw / 2, cy: fh / 2, r: Math.min(w, h) * 0.3, fill: A });
      const s = Math.min(w, h) * 0.13;
      it.push({ t: 'poly', pts: [[fw / 2 - s * 0.7, fh / 2 - s], [fw / 2 + s, fh / 2], [fw / 2 - s * 0.7, fh / 2 + s]], fill: '#ffffff' });
      break;
    }
    case 'login': {
      it.push({ t: 'circle', cx: fw / 2, cy: y0 + h * 0.2, r: Math.min(w, h) * 0.13, fill: soft(0.35) });
      it.push({ t: 'rect', x: x0 + w * 0.12, y: y0 + h * 0.44, w: w * 0.76, h: h * 0.13, r: 0.04, fill: soft(0.2) });
      it.push({ t: 'rect', x: x0 + w * 0.12, y: y0 + h * 0.62, w: w * 0.76, h: h * 0.13, r: 0.04, fill: soft(0.2) });
      it.push({ t: 'rect', x: x0 + w * 0.12, y: y0 + h * 0.82, w: w * 0.76, h: h * 0.15, r: 0.05, fill: A });
      break;
    }
    case 'blank':
      break;
    case 'lines':
    default: {
      line(x0, y0 + 0.02, w * 0.46, A, 0.08);
      const rows = Math.max(2, Math.min(6, Math.floor((h - 0.22) / 0.15)));
      const widths = [0.92, 0.74, 0.86, 0.55, 0.8, 0.62];
      for (let i = 0; i < rows; i++) line(x0, y0 + 0.24 + i * ((h - 0.24) / rows), w * widths[i % widths.length], soft(0.42), 0.05);
    }
  }
  return it;
}

/** A dark screen inset with content, for devices. */
function screenFace(kind, K, accent, bezel = 0.06) {
  return (fw, fh) => [
    { t: 'rect', x: bezel, y: bezel, w: fw - bezel * 2, h: fh - bezel * 2, r: 0.05, fill: K.hex('screen') },
    { t: 'g', tx: bezel, ty: bezel, items: ui(kind, fw - bezel * 2, fh - bezel * 2, K, { accent, dark: true, pad: 0.1 }) },
    // a soft diagonal glare so the glass reads as glass
    K.theme.outline ? null : { t: 'poly', pts: [[fw * 0.52, bezel], [fw - bezel, bezel], [fw - bezel, fh * 0.62]], fill: '#ffffff', fillOp: 0.055 },
    { t: 'circle', cx: fw / 2, cy: bezel / 2, r: 0.012, fill: rgba('#ffffff', 0.5) },
  ];
}

// ---------------------------------------------------------------- builders

const B = {};
const def = (name, meta, build) => { B[name] = { ...meta, build }; };

def('cube', { desc: 'Plain block. Any module, unit, container or abstract "thing".', opts: 'size w d h icon text radius' }, (o, K) => {
  const w = o.w ?? o.size ?? 1, d = o.d ?? o.size ?? 1, h = o.h ?? o.size ?? 1;
  const m = K.mat(o.color);
  return {
    w, d, h,
    parts: [box({
      w, d, h, r: o.radius ?? K.theme.radius, color: o.color,
      top: o.icon ? (fw, fh) => [icon(o.icon, fw, fh, o.color === 'body' || o.color === 'body2' ? K.hex(o.accent) : m.on, 0.56)] : null,
      left: o.text ? (fw, fh) => [{ t: 'text', x: fw / 2, y: fh / 2, text: o.text, size: Math.min(fh * 0.42, (fw * 1.5) / Math.max(2, o.text.length)), fill: m.onSide, weight: 800 }]
        : (fw, fh) => (fw > 0.6 && fh > 0.6 ? [{ t: 'rect', x: 0.12, y: 0.12, w: fw - 0.24, h: fh - 0.24, r: 0.05, stroke: rgba(m.onSide, 0.13), sw: 0.025 }, { t: 'circle', cx: 0.22, cy: 0.22, r: 0.03, fill: rgba(m.onSide, 0.25) }] : []),
      right: (fw, fh) => (fw > 0.6 && fh > 0.6 ? [0, 1].map((i) => ({ t: 'rect', x: fw * 0.3, y: fh * 0.42 + i * 0.12, w: fw * 0.4, h: 0.04, r: 0.02, fill: rgba(m.onSide, 0.16) })) : []),
    })],
  };
});

def('tile', { desc: 'Low rounded slab with an icon on top. The quickest way to stand for any idea.', opts: 'icon text size w d h' }, (o, K) => {
  const w = o.size ?? o.w ?? 1.4, d = o.d ?? w, h = o.h ?? 0.26;
  const m = K.mat(o.color);
  const neutral = ['body', 'body2', 'paper', 'muted'].includes(o.color);
  return {
    w, d, h,
    parts: [box({
      w, d, h, r: Math.min(w, d) * 0.17, color: o.color,
      top: (fw, fh) => [
        { t: 'rect', x: fw * 0.12, y: fh * 0.12, w: fw * 0.76, h: fh * 0.76, r: fw * 0.1, stroke: rgba(m.on, 0.14), sw: 0.025 },
        o.text ? { t: 'text', x: fw / 2, y: fh / 2, text: o.text, size: Math.min(fh * 0.36, (fw * 1.3) / Math.max(2, o.text.length)), fill: neutral ? K.hex(o.accent) : m.on, weight: 800 }
          : icon(o.icon || 'sparkles', fw, fh, neutral ? K.hex(o.accent) : m.on, 0.6, { sw: 2.4 }),
      ],
    })],
  };
});

def('slab', { desc: 'Flat rounded plate of any size. A layer, a surface, a base, a board.', opts: 'w d h icon text radius iconAt' }, (o, K) => {
  const w = o.w ?? 2.4, d = o.d ?? w, h = o.h ?? 0.18;
  const m = K.mat(o.color);
  const neutral = ['body', 'body2', 'paper', 'muted'].includes(o.color);
  const ink = neutral ? K.hex(o.accent) : m.on;
  return {
    w, d, h,
    parts: [box({
      w, d, h, r: o.radius ?? Math.min(0.26, w / 5, d / 5), color: o.color, ao: false,
      top: o.icon || o.text ? (fw, fh) => {
        const front = o.iconAt === 'front'; // the corner nearest the viewer stays visible when slabs are stacked
        const cx = front ? fw - 0.62 : fw / 2, cy = front ? fh - 0.62 : fh / 2;
        return [o.text ? { t: 'text', x: cx, y: cy, text: o.text, size: Math.min(0.42, fh * 0.3, (fw * 1.3) / Math.max(2, o.text.length)), fill: ink, weight: 800 } : { t: 'icon', name: o.icon, x: cx, y: cy, size: front ? 0.56 : Math.min(0.9, Math.min(fw, fh) * 0.34), color: ink }];
      } : null,
    })],
  };
});

def('cylinder', { desc: 'Plain cylinder: tank, drum, pillar, token.', opts: 'r h icon' }, (o, K) => {
  const r = o.r ?? 0.55, h = o.h ?? 1;
  const m = K.mat(o.color);
  return { w: r * 2, d: r * 2, h, round: true, parts: [cyl({ r, h, color: o.color, top: o.icon ? (fw, fh) => [icon(o.icon, fw, fh, m.on, 0.5)] : null })] };
});

def('server', { desc: 'Rack server with drive bays and blinking status lights. Compute, backend, a service.', opts: 'units' }, (o, K) => {
  const n = Math.max(1, Math.min(6, o.units ?? 3));
  const w = 1.15, d = 1.15, bay = 0.46, h = n * bay + 0.2;
  const m = K.mat(o.color), A = K.hex(o.accent);
  return {
    w, d, h,
    parts: [box({
      w, d, h, r: K.theme.radius, color: o.color,
      left: (fw) => {
        const it = [];
        for (let i = 0; i < n; i++) {
          const y = 0.12 + i * bay;
          it.push({ t: 'rect', x: 0.1, y, w: fw - 0.2, h: bay - 0.1, r: 0.05, fill: m.deep, stroke: K.theme.outline ? m.ink : null, sw: 0.03 });
          it.push(led(0.22, y + (bay - 0.1) / 2, A, i * 0.37));
          it.push({ t: 'rect', x: 0.36, y: y + (bay - 0.1) / 2 - 0.022, w: 0.2, h: 0.044, r: 0.02, fill: rgba(m.onSide, 0.28) });
          it.push({ t: 'rect', x: fw - 0.44, y: y + (bay - 0.1) / 2 - 0.022, w: 0.24, h: 0.044, r: 0.02, fill: rgba(m.onSide, 0.16) });
        }
        return it;
      },
      right: (fw, fh) => {
        const it = [];
        const rows = Math.floor((fh - 0.3) / 0.11);
        for (let i = 0; i < rows; i++) it.push({ t: 'rect', x: 0.2, y: 0.18 + i * 0.11, w: fw - 0.4, h: 0.035, r: 0.017, fill: rgba(K.theme.outline ? m.ink : m.deep, K.theme.outline ? 0.55 : 0.9) });
        return it;
      },
      top: (fw, fh) => [
        { t: 'rect', x: 0.14, y: 0.14, w: fw - 0.28, h: fh - 0.28, r: 0.06, stroke: rgba(m.on, 0.14), sw: 0.025 },
        ...[0, 1, 2, 3].map((i) => ({ t: 'line', x1: 0.3, y1: 0.34 + i * 0.13, x2: fw - 0.3, y2: 0.34 + i * 0.13, stroke: rgba(m.on, 0.2), sw: 0.04, dash: '0.07 0.05', style: 'stroke-linecap:butt' })),
        { t: 'rect', x: 0.3, y: fh - 0.34, w: 0.2, h: 0.05, r: 0.025, fill: A, anim: { type: 'blink', period: 3, min: 0.4 } },
      ],
    })],
  };
});

def('database', { desc: 'Stacked storage discs. Data at rest: a database, a store, a bucket.', opts: 'discs' }, (o, K) => {
  const n = Math.max(1, Math.min(5, o.discs ?? 3));
  const r = 0.62, dh = 0.36, gap = 0.07;
  const parts = [];
  const m = K.mat(o.color);
  for (let i = 0; i < n; i++) {
    const z = i * (dh + gap);
    if (i > 0) parts.push(cyl({ r: r - 0.05, z: z - gap, h: gap, color: o.accent, rim: false, ao: false }));
    parts.push(cyl({ r, z, h: dh, color: o.color, top: i === n - 1 ? (fw) => [{ t: 'circle', cx: fw / 2, cy: fw / 2, r: fw * 0.3, stroke: rgba(m.on, 0.16), sw: 0.03 }, { t: 'circle', cx: fw / 2, cy: fw / 2, r: fw * 0.1, fill: rgba(m.on, 0.1) }] : null }));
    const f = r * 0.7071 + 0.012, A = K.hex(o.accent);
    parts.push({ t: 'raw', at: [f, f, z + dh * 0.55], box: { x0: f - 0.02, y0: f - 0.02, z0: z + dh * 0.5, x1: f, y1: f, z1: z + dh * 0.6 }, svg: (ctx) => `<circle r="2.3" fill="${A}" style="${ctx.animStyle({ type: 'blink', period: 2.6, phase: i * 0.3, min: 0.3 })}"/><rect x="-16" y="-1.2" width="9" height="2.4" rx="1.2" fill="${rgba(m.onSide, 0.25)}"/>` });
  }
  return { w: r * 2, d: r * 2, h: n * dh + (n - 1) * gap, round: true, parts };
});

def('laptop', { desc: 'Open laptop. A person at work, a client, a developer.', opts: 'ui facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const W = 1.5, D = 1.05, t = 0.06;
  const m = K.mat(o.color);
  const keys = (fw, fh) => {
    const along = L ? fw : fh, across = L ? fh : fw;
    const kb = { t: 'rect', x: 0.1, y: 0.12, w: fw - 0.2, h: fh - 0.24, r: 0.04, fill: rgba(m.deep, 0.9) };
    const keyTone = rgba(m.on, K.theme.outline ? 0.35 : 0.2);
    const rows = [];
    for (let r = 0; r < 3; r++) {
      const q = 0.2 + r * 0.115;
      rows.push(L ? { t: 'line', x1: 0.17, y1: q, x2: fw - 0.17, y2: q, stroke: keyTone, sw: 0.07, dash: '0.075 0.035', style: 'stroke-linecap:butt' }
        : { t: 'line', x1: q, y1: 0.17, x2: q, y2: fh - 0.17, stroke: keyTone, sw: 0.07, dash: '0.075 0.035', style: 'stroke-linecap:butt' });
    }
    const padW = along * 0.26, padH = across * 0.2;
    const pad = L ? { t: 'rect', x: (fw - padW) / 2, y: fh - padH - 0.16, w: padW, h: padH, r: 0.03, fill: rgba(m.on, 0.14) }
      : { t: 'rect', x: fw - padH - 0.16, y: (fh - padW) / 2, w: padH, h: padW, r: 0.03, fill: rgba(m.on, 0.14) };
    return [kb, ...rows, pad];
  };
  const base = box({ w: L ? W : D, d: L ? D : W, h: 0.07, r: 0.06, color: o.color, top: keys });
  const scr = panel({ facing: L ? 'left' : 'right', x: L ? 0 : -D / 2 + t / 2, y: L ? -D / 2 + t / 2 : 0, z: 0.07, w: W, h: 0.98, t, r: 0.06, color: o.color, face: screenFace(o.ui || 'lines', K, o.accent) });
  return { w: L ? W : D, d: L ? D : W, h: 1.05, parts: [base, scr] };
});

def('monitor', { desc: 'Desktop display on a stand. Dashboards, admin consoles, monitoring.', opts: 'ui facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const W = 1.7, H = 1.05;
  const parts = [
    cyl({ r: 0.34, h: 0.05, color: o.color }),
    box({ w: 0.12, d: 0.12, z: 0.05, h: 0.32, color: o.color, ao: false }),
    panel({ facing: L ? 'left' : 'right', z: 0.3, w: W, h: H, t: 0.08, r: 0.07, color: o.color, y: L ? 0.04 : 0, x: L ? 0 : 0.04, face: screenFace(o.ui || 'dash', K, o.accent) }),
  ];
  return { w: L ? W : 0.68, d: L ? 0.68 : W, h: 1.35, parts, shadow: { w: L ? W * 0.9 : 0.7, d: L ? 0.7 : W * 0.9 } };
});

def('phone', { desc: 'Smartphone standing upright (or flat: true). Mobile users, apps, notifications.', opts: 'ui facing flat' }, (o, K) => {
  const L = o.facing !== 'right';
  const W = 0.66, H = 1.24;
  if (o.flat) return { w: W, d: H, h: 0.07, parts: [box({ w: W, d: H, h: 0.07, r: 0.1, color: o.color, top: screenFace(o.ui || 'list', K, o.accent, 0.05) })] };
  return { w: L ? W : 0.2, d: L ? 0.2 : W, h: H, parts: [panel({ facing: L ? 'left' : 'right', w: W, h: H, t: 0.08, r: 0.1, color: o.color, face: screenFace(o.ui || 'chat', K, o.accent, 0.05) })], shadow: { w: L ? W : 0.3, d: L ? 0.3 : W } };
});

def('browser', { desc: 'Floating app window. A website, web app, product UI, a page.', opts: 'ui facing w h' }, (o, K) => {
  const L = o.facing !== 'right';
  const W = o.w ?? 2.0, H = o.h ?? 1.4, z = 0.22;
  const col = o.color === 'body' ? 'paper' : o.color;
  const m = K.mat(col);
  const A = K.hex(o.accent);
  const face = (fw, fh) => [
    { t: 'path', d: `M0.07 0.26V0.07h${fw - 0.14}v0.19z`, fill: rgba(m.onSide, 0.07) },
    { t: 'circle', cx: 0.17, cy: 0.165, r: 0.04, fill: K.hex('danger') },
    { t: 'circle', cx: 0.3, cy: 0.165, r: 0.04, fill: K.hex('warn') },
    { t: 'circle', cx: 0.43, cy: 0.165, r: 0.04, fill: K.hex('ok') },
    { t: 'rect', x: 0.58, y: 0.115, w: fw - 0.78, h: 0.1, r: 0.05, fill: rgba(m.onSide, 0.1) },
    { t: 'g', tx: 0.07, ty: 0.3, items: ui(o.ui || 'dash', fw - 0.14, fh - 0.37, K, { accent: o.accent, dark: m.onSide === '#ffffff', pad: 0.1 }) },
  ];
  return {
    w: L ? W : 0.3, d: L ? 0.3 : W, h: H + z, floatZ: z,
    parts: [panel({ facing: L ? 'left' : 'right', z, w: W, h: H, t: 0.07, r: 0.08, color: col, face })],
    shadow: { w: L ? W * 0.92 : 0.4, d: L ? 0.4 : W * 0.92, soft: true },
    glowColor: A,
  };
});

def('card', { desc: 'Flat floating card. A record, a message, a layer of information.', opts: 'ui icon w d' }, (o, K) => {
  const w = o.w ?? 1.6, d = o.d ?? 1.1;
  const col = o.color === 'body' ? 'paper' : o.color;
  const m = K.mat(col);
  return {
    w, d, h: 0.07,
    parts: [box({ w, d, h: 0.07, r: 0.12, color: col, ao: false, top: (fw, fh) => (o.icon ? [icon(o.icon, fw, fh, K.hex(o.accent), 0.5)] : ui(o.ui || 'lines', fw, fh, K, { accent: o.accent, dark: m.on === '#ffffff', pad: 0.16 })) })],
  };
});

def('document', { desc: 'Sheet of paper with text lines (stack: n for a pile). Files, content, reports, contracts.', opts: 'facing flat stack icon' }, (o, K) => {
  const L = o.facing !== 'right';
  const W = 0.86, H = 1.12, n = Math.max(1, Math.min(4, o.stack ?? 1));
  const col = o.color === 'body' ? 'paper' : o.color;
  const m = K.mat(col);
  const face = (fw, fh) => (o.icon ? [icon(o.icon, fw, fh, K.hex(o.accent), 0.5)] : ui('lines', fw, fh, K, { accent: o.accent, dark: m.onSide === '#ffffff', pad: 0.13 }));
  const parts = [];
  if (o.flat) {
    for (let i = 0; i < n; i++) parts.push(box({ w: W, d: H, h: 0.035, z: i * 0.05, x: i * 0.04, y: -i * 0.04, r: 0.03, color: col, ao: false, top: i === n - 1 ? face : null }));
    return { w: W, d: H, h: n * 0.05, parts };
  }
  for (let i = n - 1; i >= 0; i--) {
    const off = i * 0.13;
    parts.push(panel({ facing: L ? 'left' : 'right', w: W, h: H, t: 0.045, r: 0.04, z: 0.12 + i * 0.05, color: col, x: L ? i * 0.07 : -off, y: L ? -off : i * 0.07, face: i === 0 ? face : null }));
  }
  return { w: L ? W : 0.3, d: L ? 0.3 : W, h: H + 0.12, parts, shadow: { w: L ? W * 0.9 : 0.36, d: L ? 0.36 : W * 0.9, soft: true } };
});

def('folder', { desc: 'File folder with a sheet inside. Collections, projects, archives.', opts: 'facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const W = 1.15, H = 0.82;
  const col = o.color === 'body' ? 'gold' : o.color;
  const tab = [[-W / 2, 0], [W / 2, 0], [W / 2, H - 0.12], [W / 2 - 0.08, H], [0.02, H], [-0.1, H + 0.12], [-W / 2 + 0.08, H + 0.12], [-W / 2, H + 0.04]];
  const front = [[-W / 2, 0], [W / 2, 0], [W / 2, H - 0.16], [W / 2 - 0.08, H - 0.08], [-W / 2 + 0.08, H - 0.08], [-W / 2, H - 0.16]];
  const P = (pts, t, off, color) => panel({ facing: L ? 'left' : 'right', outline: pts, w: W, h: H, t, color, x: L ? 0 : off, y: L ? off : 0 });
  return {
    w: L ? W : 0.4, d: L ? 0.4 : W, h: H + 0.14,
    parts: [P(tab, 0.07, -0.11, col), P(rectOutline(W - 0.2, H - 0.02, 0.03, 0, (H + 0.1) / 2), 0.03, -0.02, 'paper'), P(front, 0.07, 0.09, col)],
  };
});

def('package', { desc: 'Sealed parcel. A deliverable, an artifact, a shipment, a bundle.', opts: 'size' }, (o, K) => {
  const s = o.size ?? 1, h = s * 0.8;
  const col = o.color === 'body' ? 'gold' : o.color;
  const m = K.mat(col);
  const tape = rgba(K.theme.outline ? m.ink : m.deep, K.theme.outline ? 0.85 : 0.75);
  return {
    w: s, d: s, h,
    parts: [box({
      w: s, d: s, h, r: 0.03, color: col,
      top: (fw, fh) => [{ t: 'rect', x: 0, y: fh / 2 - 0.07, w: fw, h: 0.14, fill: tape }],
      left: (fw, fh) => [{ t: 'rect', x: fw * 0.14, y: fh * 0.34, w: fw * 0.34, h: fh * 0.4, r: 0.02, fill: K.mat('paper').left }, { t: 'rect', x: fw * 0.2, y: fh * 0.46, w: fw * 0.22, h: 0.03, fill: rgba(K.theme.ink, 0.5) }, { t: 'rect', x: fw * 0.2, y: fh * 0.56, w: fw * 0.15, h: 0.03, fill: rgba(K.theme.ink, 0.35) }],
      right: (fw, fh) => [{ t: 'rect', x: fw / 2 - 0.07, y: 0, w: 0.14, h: fh * 0.34, fill: tape }],
    })],
  };
});

def('chip', { desc: 'Processor chip with pins. Compute, a model, an engine, "the brain".', opts: 'text icon size' }, (o, K) => {
  const s = o.size ?? 1.3, h = 0.2, pin = 0.16;
  const col = o.color === 'body' ? 'dark' : o.color;
  const m = K.mat(col), A = K.hex(o.accent);
  const pinColor = K.hex('gold');
  const pins = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const p = pin + (i + 0.5) * (s / n);
    pins.push({ t: 'rect', x: p - 0.035, y: 0, w: 0.07, h: pin + 0.05, r: 0.02, fill: pinColor });
    pins.push({ t: 'rect', x: p - 0.035, y: s + pin - 0.05, w: 0.07, h: pin + 0.05, r: 0.02, fill: pinColor });
    pins.push({ t: 'rect', y: p - 0.035, x: 0, h: 0.07, w: pin + 0.05, r: 0.02, fill: pinColor });
    pins.push({ t: 'rect', y: p - 0.035, x: s + pin - 0.05, h: 0.07, w: pin + 0.05, r: 0.02, fill: pinColor });
  }
  return {
    w: s + pin * 2, d: s + pin * 2, h, glowColor: A,
    parts: [
      { t: 'decal', plane: 'top', o: [-s / 2 - pin, -s / 2 - pin, 0.03], size: [s + pin * 2, s + pin * 2], items: pins },
      box({
        w: s, d: s, h, z: 0.02, r: 0.08, color: col,
        top: (fw, fh) => [
          { t: 'rect', x: 0.14, y: 0.14, w: fw - 0.28, h: fh - 0.28, r: 0.07, stroke: rgba(A, 0.7), sw: 0.03 },
          o.icon ? icon(o.icon, fw, fh, A, 0.42) : { t: 'text', x: fw / 2, y: fh / 2, text: o.text ?? 'AI', size: Math.min(0.4, (fw * 0.9) / Math.max(2, (o.text ?? 'AI').length)), fill: A, weight: 800 },
          { t: 'circle', cx: 0.25, cy: 0.25, r: 0.035, fill: rgba(m.on, 0.5) },
        ],
      }),
    ],
    shadow: { w: s, d: s },
  };
});

def('user', { desc: 'Abstract person. A customer, visitor, teammate, any human actor.', opts: 'head' }, (o, K) => {
  const col = o.color === 'body' ? 'accent' : o.color;
  return {
    w: 0.76, d: 0.76, h: 1.2, round: true,
    parts: [
      { t: 'cone', o: [0, 0, 0], r0: 0.38, r1: 0.2, h: 0.56, color: col },
      cyl({ r: 0.215, z: 0.56, h: 0.045, color: o.head || 'paper', ao: false, rim: false }),
      { t: 'sphere', c: [0, 0, 0.9], r: 0.25, color: o.head || 'paper' },
    ],
    shadow: { r: 0.38 },
  };
});

def('cloud', { desc: 'Cloud. The cloud, the internet, a hosted service. flat: true makes a slab that objects can sit on.', opts: 'size flat facing' }, (o, K) => {
  const k = o.size ?? 1;
  const col = o.color === 'body' ? 'paper' : o.color;
  if (o.flat) {
    const circles = [[-0.7, 0.0, 0.55], [0, -0.22, 0.72], [0.7, 0.02, 0.56], [0, 0.26, 0.62]].map((c) => c.map((v) => v * k));
    const pts = blobOutline(circles, 72);
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs), d = Math.max(...ys) - Math.min(...ys);
    return { w, d, h: 0.3 * k, parts: [{ t: 'prism', plane: 'top', o: [0, 0, 0], pts, depth: 0.3 * k, color: col, ao: false }], shadow: { w: w * 0.8, d: d * 0.8, soft: true, round: true } };
  }
  const L = o.facing !== 'right';
  const circles = [[-0.52, -0.02, 0.4], [0.0, 0.24, 0.52], [0.52, 0.04, 0.38], [0, -0.1, 0.5]];
  const floorB = -0.34;
  const pts = blobOutline(circles, 80).map(([a, b]) => [a * k, (Math.max(b, floorB) - floorB) * k]);
  const W = 1.84 * k, H = 1.1 * k, z = 0.45;
  return {
    w: L ? W : 0.34, d: L ? 0.34 : W, h: H + z, floatZ: z,
    parts: [panel({ facing: L ? 'left' : 'right', outline: pts, w: W, h: H, t: 0.3 * k, z, color: col })],
    shadow: { w: L ? W * 0.8 : 0.5, d: L ? 0.5 : W * 0.8, soft: true, round: true },
  };
});

def('sphere', { desc: 'Plain ball. A particle, a node, a planet, an abstract unit.', opts: 'r' }, (o) => {
  const r = o.r ?? 0.5;
  return { w: r * 2, d: r * 2, h: r * 2, round: true, parts: [{ t: 'sphere', c: [0, 0, r * SPHERE_K * 0.82], r, color: o.color }], shadow: { r: r * 0.8 } };
});

def('orb', { desc: 'Glowing sphere above a pedestal. An AI core, intelligence, energy, the "magic" step.', opts: 'r' }, (o, K) => {
  const col = o.color === 'body' ? 'accent' : o.color;
  const r = o.r ?? 0.44;
  return {
    w: 1.2, d: 1.2, h: 1.5, round: true, glowColor: K.hex(col),
    parts: [
      cyl({ r: 0.6, h: 0.12, color: 'dark' }),
      cyl({ r: 0.42, z: 0.12, h: 0.06, color: 'body2', top: (fw) => [{ t: 'circle', cx: fw / 2, cy: fw / 2, r: fw * 0.3, fill: rgba(K.hex(col), 0.55) }, { t: 'circle', cx: fw / 2, cy: fw / 2, r: fw * 0.42, stroke: rgba(K.hex(col), 0.8), sw: 0.03 }] }),
      { t: 'sphere', c: [0, 0, 0.95], r, color: col },
    ],
    shadow: { r: 0.6 },
  };
});

def('sign', { desc: 'Icon badge on a pole. Marks a state or meaning: lock, warning, check, bolt, any icon.', opts: 'icon text shape size facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'accent' : o.color;
  const m = K.mat(col);
  const S = o.size ?? 0.92, z = 0.5;
  const outline = o.shape === 'square' ? rectOutline(S, S, 0.2, 0, S / 2) : o.shape === 'hex' ? Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2 + Math.PI / 6) * S * 0.56, S / 2 + Math.sin((i / 6) * Math.PI * 2 + Math.PI / 6) * S * 0.56]) : circleOutline(S / 2, 0, S / 2);
  const face = (fw, fh) => [o.text ? { t: 'text', x: fw / 2, y: fh / 2, text: o.text, size: Math.min(0.4, (fw * 0.9) / Math.max(1.6, o.text.length)), fill: m.onSide, weight: 800 } : icon(o.icon || 'check', fw, fh, m.onSide, 0.62, { sw: 2.8 })];
  return {
    w: L ? S : 0.3, d: L ? 0.3 : S, h: S + z, glowColor: K.hex(col),
    parts: [
      cyl({ r: 0.16, h: 0.05, color: 'dark' }),
      box({ w: 0.06, d: 0.06, z: 0.05, h: z - 0.02, color: 'dark', ao: false, rim: false }),
      panel({ facing: L ? 'left' : 'right', outline, w: S, h: S, t: 0.14, z, color: col, face }),
    ],
    shadow: { r: 0.2 },
  };
});

def('platform', { desc: 'Pedestal to stand a hero object on (use on: platform).', opts: 'size tiers round h' }, (o, K) => {
  const s = o.size ?? 2, tiers = Math.max(1, Math.min(3, o.tiers ?? 1)), th = o.h ?? 0.2;
  const parts = [];
  for (let i = 0; i < tiers; i++) {
    const k = s - i * 0.36;
    const last = i === tiers - 1;
    const m = K.mat(last ? o.color : 'muted');
    const trim = last ? (fw, fh) => (o.round
      ? [{ t: 'circle', cx: fw / 2, cy: fh / 2, r: fw / 2 - 0.16, stroke: rgba(K.hex(o.accent), 0.55), sw: 0.03 }]
      : [{ t: 'rect', x: 0.16, y: 0.16, w: fw - 0.32, h: fh - 0.32, r: 0.14, stroke: rgba(K.hex(o.accent), 0.55), sw: 0.03 },
        ...[[0.3, 0.3], [fw - 0.3, 0.3], [0.3, fh - 0.3], [fw - 0.3, fh - 0.3]].map(([cx, cy]) => ({ t: 'circle', cx, cy, r: 0.035, fill: rgba(m.on, 0.22) }))]) : null;
    parts.push(o.round ? cyl({ r: k / 2, z: i * th, h: th, color: last ? o.color : 'muted', top: trim }) : box({ w: k, d: k, z: i * th, h: th, r: 0.2, color: last ? o.color : 'muted', top: trim }));
  }
  return { w: s, d: s, h: tiers * th, round: !!o.round, parts };
});

def('gear', { desc: 'Turning cog. A process, automation, configuration, "how it works".', opts: 'r teeth dir speed' }, (o, K) => {
  const r = o.r ?? 0.7, teeth = o.teeth ?? 10, h = 0.16;
  const m = K.mat(o.color === 'body' ? 'body2' : o.color);
  const d = pathOf(gearOutline(r, teeth));
  const spin = { type: 'spin', period: o.speed ?? 8, dir: o.dir ?? 1 };
  const layer = (z, fill, extra = []) => ({ t: 'decal', plane: 'top', o: [0, 0, z], size: [0.01, 0.01], items: [{ t: 'g', anim: spin, items: [{ t: 'path', d, fill, stroke: K.theme.outline ? m.ink : null, sw: K.theme.outline / UNIT }, ...extra] }] });
  const hub = [
    { t: 'circle', cx: 0, cy: 0, r: r * 0.5, stroke: rgba(m.on, 0.2), sw: 0.03 },
    { t: 'circle', cx: 0, cy: 0, r: r * 0.24, fill: m.deep, stroke: K.theme.outline ? m.ink : null, sw: K.theme.outline / UNIT },
    { t: 'circle', cx: r * 0.5, cy: 0, r: 0.045, fill: rgba(m.on, 0.35) },
  ];
  const mid = [];
  for (let i = 1; i < 4; i++) mid.push(layer((h * i) / 4, m.right));
  return { w: r * 2, d: r * 2, h, round: true, parts: [layer(0.005, m.under), ...mid, layer(h, m.top, hub)], box: { x0: -r, y0: -r, z0: 0, x1: r, y1: r, z1: h }, shadow: { r: r * 0.92 } };
});

def('coins', { desc: 'Stack of coins. Money, cost, credits, value, tokens.', opts: 'count icon' }, (o, K) => {
  const n = Math.max(1, Math.min(8, o.count ?? 4)), r = 0.42, ch = 0.11;
  const col = o.color === 'body' ? 'gold' : o.color;
  const m = K.mat(col);
  const parts = [];
  for (let i = 0; i < n; i++) {
    parts.push(cyl({ r, z: i * (ch + 0.015), h: ch, color: col, ao: false, x: (i % 2) * 0.03, top: i === n - 1 ? (fw) => [{ t: 'circle', cx: fw / 2, cy: fw / 2, r: fw * 0.36, stroke: rgba(m.on, 0.35), sw: 0.03 }, icon(o.icon || 'dollar', fw, fw, rgba(m.on, 0.7), 0.46)] : null }));
  }
  return { w: r * 2, d: r * 2, h: n * (ch + 0.015), round: true, parts };
});

def('bars', { desc: '3D bar chart. Metrics, growth, comparison, analytics.', opts: 'values' }, (o, K) => {
  const vals = o.values ?? [0.4, 0.65, 0.5, 1];
  const n = vals.length, bw = 0.3, gap = 0.16, W = n * bw + (n + 1) * gap, D = 0.8, hmax = 1.35;
  const max = Math.max(...vals) || 1;
  const parts = [box({ w: W, d: D, h: 0.08, r: 0.08, color: 'muted' })];
  vals.forEach((v, i) => parts.push(box({ w: bw, d: 0.42, h: Math.max(0.08, (v / max) * hmax), x: -W / 2 + gap + bw / 2 + i * (bw + gap), z: 0.08, r: 0.03, color: v === max ? o.accent : o.color })));
  return { w: W, d: D, h: hmax + 0.08, parts };
});

def('building', { desc: 'Office tower with lit windows. A company, an organisation, a data centre, a city.', opts: 'floors w' }, (o, K) => {
  const floors = Math.max(2, Math.min(8, o.floors ?? 5));
  const w = o.w ?? 1.3, d = w, fh0 = 0.42, h = floors * fh0 + 0.22;
  const m = K.mat(o.color);
  const lit = K.hex('gold'), A = K.hex(o.accent);
  const wins = (seed) => (fw, fh) => {
    const it = [];
    const cols = Math.max(2, Math.round(fw / 0.36));
    const cw = (fw - 0.2) / cols;
    for (let r = 0; r < floors; r++) for (let c = 0; c < cols; c++) {
      const on = (r * 7 + c * 3 + seed) % 5 < 2;
      it.push({ t: 'rect', x: 0.1 + c * cw + cw * 0.14, y: 0.16 + r * fh0, w: cw * 0.72, h: fh0 * 0.56, r: 0.025, fill: on ? ((r + c + seed) % 3 === 0 ? A : lit) : m.deep, fillOp: on ? 0.95 : 1 });
    }
    return it;
  };
  return {
    w, d, h: h + 0.16,
    parts: [
      box({ w, d, h, r: 0.04, color: o.color, left: (fw, fh) => [...wins(1)(fw, fh).filter((it) => !(it.y > fh - 0.5 && Math.abs(it.x + it.w / 2 - fw / 2) < 0.3)), { t: 'rect', x: fw / 2 - 0.17, y: fh - 0.42, w: 0.34, h: 0.42, r: 0.03, fill: A }, { t: 'rect', x: fw / 2 - 0.26, y: fh - 0.5, w: 0.52, h: 0.06, r: 0.02, fill: rgba(m.onSide, 0.5) }], right: wins(4) }),
      box({ w: w * 0.42, d: d * 0.42, h: 0.16, z: h, x: -w * 0.12, y: -d * 0.12, color: 'body2', ao: false }),
      { t: 'line', pts: [[w * 0.22, d * 0.2, h], [w * 0.22, d * 0.2, h + 0.5]], stroke: K.hex('dark'), sw: 1.6 },
      { t: 'raw', at: [w * 0.22, d * 0.2, h + 0.52], box: { x0: w * 0.2, y0: d * 0.18, z0: h + 0.48, x1: w * 0.24, y1: d * 0.22, z1: h + 0.56 }, svg: (ctx) => `<circle r="2.6" fill="${K.hex('danger')}" style="${ctx.animStyle({ type: 'blink', period: 1.8, min: 0.15 })}"/>` },
    ],
  };
});

def('house', { desc: 'Small house with a pitched roof. Home, a small business, a local node.', opts: 'roof' }, (o, K) => {
  const w = 1.3, d = 1.2, h = 0.8, rh = 0.55, e = 0.1;
  const m = K.mat(o.color);
  const A = K.hex(o.accent);
  const x0 = -w / 2 - e, x1 = w / 2 + e, y0 = -d / 2 - e, y1 = d / 2 + e;
  const A0 = [x0, y0, h], A1 = [x1, y0, h], A2 = [x1, y1, h], A3 = [x0, y1, h], R0 = [x0, 0, h + rh], R1 = [x1, 0, h + rh];
  const roof = {
    t: 'mesh', color: o.roof || 'accent',
    faces: [
      [R0, R1, A2, A3], // slope facing the viewer's left
      [A1, A2, R1], // gable facing the viewer's right
      [R1, R0, A0, A1], // far slope
      [A3, A0, R0], // far gable
    ],
    rimEdges: [[A3, A2, R1]],
  };
  return {
    w: w + e * 2, d: d + e * 2, h: h + rh,
    parts: [
      box({ w, d, h, color: o.color, left: (fw, fh) => [{ t: 'rect', x: fw * 0.38, y: fh * 0.38, w: fw * 0.24, h: fh * 0.62, r: 0.03, fill: A }, { t: 'circle', cx: fw * 0.57, cy: fh * 0.72, r: 0.025, fill: '#ffffff' }], right: (fw, fh) => [{ t: 'rect', x: fw * 0.3, y: fh * 0.3, w: fw * 0.4, h: fh * 0.36, r: 0.03, fill: m.deep }, { t: 'line', x1: fw * 0.5, y1: fh * 0.3, x2: fw * 0.5, y2: fh * 0.66, stroke: m.right, sw: 0.03 }] }),
      roof,
    ],
    shadow: { w, d },
  };
});

def('factory', { desc: 'Factory with a saw-tooth roof and chimney. Production, manufacturing, a build system, a source of goods.', opts: '' }, (o, K) => {
  const w = 2.0, d = 1.5, h = 0.85, t = 0.42, n = 3;
  const m = K.mat(o.color);
  const A = K.hex(o.accent);
  const pts = [[-w / 2, 0], [w / 2, 0], [w / 2, h]];
  for (let i = n; i > 0; i--) { const x1 = -w / 2 + (i * w) / n, x0 = x1 - w / n; pts.push([x1, h + t], [x0, h]); }
  const windows = (fw, fh) => {
    const it = [];
    for (let i = 0; i < 4; i++) it.push({ t: 'rect', x: 0.2 + i * 0.42, y: fh - 0.62, w: 0.26, h: 0.26, r: 0.03, fill: i === 1 ? K.hex('gold') : m.deep });
    return it;
  };
  return {
    w, d, h: h + t + 0.9,
    parts: [
      { t: 'prism', plane: 'left', o: [0, -d / 2, 0], pts, depth: d, color: o.color, decals: [{ plane: 'left', o: [-w / 2, d / 2, h], items: [...windows(w, h), { t: 'rect', x: w - 0.5, y: h - 0.5, w: 0.3, h: 0.5, r: 0.02, fill: A }] }] },
      cyl({ r: 0.15, x: -w / 2 + 0.3, y: -d / 2 + 0.34, z: h, h: 1.2, color: o.accent, ao: false }),
      cyl({ r: 0.17, x: -w / 2 + 0.3, y: -d / 2 + 0.34, z: h + 1.2, h: 0.08, color: 'dark', ao: false }),
    ],
    shadow: { w, d },
  };
});

def('sun', { desc: 'Sun with turning rays (place it high with z). Energy, light, daytime, a natural source.', opts: 'r' }, (o, K) => {
  const col = o.color === 'body' ? 'gold' : o.color;
  const r = o.r ?? 0.5, cz = 0.8;
  const R = r * UNIT * SPHERE_K;
  const hex = K.hex(col);
  const rays = (ctx) => `<g style="${ctx.animStyle({ type: 'spin', period: 24 })}">${Array.from({ length: 10 }, (_, i) => `<path d="M0 ${-(R + 7).toFixed(1)}V${-(R + 17).toFixed(1)}" transform="rotate(${i * 36})" stroke="${hex}" stroke-width="3.4" stroke-linecap="round"/>`).join('')}</g>`;
  return {
    w: r * 2, d: r * 2, h: cz + r, round: true, floatZ: cz, glowColor: hex,
    parts: [{ t: 'raw', at: [0, 0, cz], box: { x0: -r, y0: -r, z0: cz - r, x1: r, y1: r, z1: cz + r }, svg: rays }, { t: 'sphere', c: [0, 0, cz], r, color: col }],
    shadow: { r: r * 0.7, soft: true },
  };
});

def('tree', { desc: 'Small conifer. Nature, growth, sustainability, or quiet scenery.', opts: 'size' }, (o) => {
  const k = o.size ?? 1;
  const col = o.color === 'body' ? 'ok' : o.color;
  return {
    w: 0.9 * k, d: 0.9 * k, h: 1.5 * k, round: true,
    parts: [
      cyl({ r: 0.08 * k, h: 0.32 * k, color: 'dark', ao: false }),
      { t: 'cone', o: [0, 0, 0.26 * k], r0: 0.46 * k, r1: 0, h: 0.66 * k, color: col },
      { t: 'cone', o: [0, 0, 0.66 * k], r0: 0.36 * k, r1: 0, h: 0.58 * k, color: col },
      { t: 'cone', o: [0, 0, 1.02 * k], r0: 0.25 * k, r1: 0, h: 0.46 * k, color: col },
    ],
    shadow: { r: 0.36 * k },
  };
});

def('robot', { desc: 'Friendly robot. An AI agent, an assistant, a bot, automation with personality.', opts: 'facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const A = K.hex(o.accent);
  const eyes = (fw, fh) => [
    { t: 'rect', x: fw * 0.14, y: fh * 0.24, w: fw * 0.72, h: fh * 0.5, r: 0.12, fill: K.hex('screen') },
    { t: 'circle', cx: fw * 0.36, cy: fh * 0.47, r: 0.075, fill: A, anim: { type: 'blink', period: 3.2, min: 0.15 } },
    { t: 'circle', cx: fw * 0.64, cy: fh * 0.47, r: 0.075, fill: A, anim: { type: 'blink', period: 3.2, min: 0.15 } },
  ];
  const chest = (fw, fh) => [{ t: 'circle', cx: fw / 2, cy: fh * 0.45, r: 0.09, fill: A, anim: { type: 'blink', period: 1.6, min: 0.45 } }];
  return {
    w: 0.95, d: 0.85, h: 1.62, glowColor: A,
    parts: [
      box({ w: 0.72, d: 0.6, h: 0.56, r: 0.12, color: o.color, left: L ? chest : null, right: L ? null : chest }),
      cyl({ r: 0.13, z: 0.56, h: 0.08, color: 'dark', ao: false, rim: false }),
      box({ w: 0.95, d: 0.82, z: 0.64, h: 0.7, r: 0.16, color: o.color, left: L ? eyes : null, right: L ? null : eyes }),
      box({ w: 0.045, d: 0.045, z: 1.34, h: 0.2, color: 'dark', ao: false, rim: false }),
      { t: 'sphere', c: [0, 0, 1.6], r: 0.075, color: o.accent },
    ],
    shadow: { w: 0.8, d: 0.7 },
  };
});

def('lock', { desc: 'Padlock. Security, encryption, privacy, access control.', opts: 'facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'accent' : o.color;
  const m = K.mat(col);
  const W = 0.95, D = 0.5, H = 0.72;
  const R = 0.3, ri = 0.17, leg = 0.16;
  const arch = [[-R, 0], [-R, leg]];
  for (let i = 1; i < 12; i++) arch.push([Math.cos(Math.PI - (i / 12) * Math.PI) * R, leg + Math.sin(Math.PI - (i / 12) * Math.PI) * R]);
  arch.push([R, leg], [R, 0], [ri, 0], [ri, leg]);
  for (let i = 1; i < 12; i++) arch.push([Math.cos((i / 12) * Math.PI) * ri, leg + Math.sin((i / 12) * Math.PI) * ri]);
  arch.push([-ri, leg], [-ri, 0]);
  const hole = (fw, fh) => [{ t: 'circle', cx: fw / 2, cy: fh * 0.42, r: 0.09, fill: m.deep }, { t: 'rect', x: fw / 2 - 0.035, y: fh * 0.42, w: 0.07, h: fh * 0.3, r: 0.03, fill: m.deep }];
  return {
    w: L ? W : D, d: L ? D : W, h: H + leg + R,
    parts: [
      panel({ facing: L ? 'left' : 'right', outline: arch, w: R * 2, h: leg + R, t: 0.13, z: H - 0.02, color: 'body2' }),
      box({ w: L ? W : D, d: L ? D : W, h: H, r: 0.1, color: col, left: L ? hole : null, right: L ? null : hole }),
    ],
  };
});

def('gem', { desc: 'Faceted crystal. Value, quality, a reward, a premium tier, a unique asset.', opts: 'size' }, (o, K) => {
  const k = o.size ?? 1;
  const col = o.color === 'body' ? 'accent2' : o.color;
  const r = 0.42 * k, z0 = 0.3, zm = z0 + 0.62 * k, zt = z0 + 0.92 * k, rt = r * 0.6;
  const ring = (rad, z) => Array.from({ length: 6 }, (_, i) => [Math.cos((i / 6) * Math.PI * 2) * rad, Math.sin((i / 6) * Math.PI * 2) * rad, z]);
  const mid = ring(r, zm), top = ring(rt, zt);
  const faces = [];
  for (let i = 0; i < 6; i++) {
    const j = (i + 1) % 6;
    faces.push([[0, 0, z0], mid[j], mid[i]]);
    faces.push([mid[i], mid[j], top[j], top[i]]);
  }
  faces.push([...top]);
  return { w: r * 2, d: r * 2, h: zt, round: true, floatZ: z0, glowColor: K.hex(col), parts: [{ t: 'mesh', color: col, faces }], shadow: { r: r * 0.7, soft: true } };
});

def('wall', { desc: 'Brick wall. A firewall, a barrier, a boundary, a blocker.', opts: 'w h axis icon' }, (o, K) => {
  const along = o.axis === 'y' ? 'y' : 'x';
  const W = o.w ?? 2, H = o.h ?? 1.15, T = 0.32;
  const col = o.color === 'body' ? 'accent2' : o.color;
  const m = K.mat(col);
  const bricks = (fw, fh) => {
    const it = [];
    const rows = Math.round(fh / 0.24);
    const rh = fh / rows;
    const line = rgba(K.theme.outline ? m.ink : m.deep, K.theme.outline ? 0.8 : 0.7);
    for (let r = 1; r < rows; r++) it.push({ t: 'line', x1: 0, y1: r * rh, x2: fw, y2: r * rh, stroke: line, sw: 0.025 });
    for (let r = 0; r < rows; r++) for (let x = (r % 2 ? 0.25 : 0.5); x < fw - 0.05; x += 0.5) it.push({ t: 'line', x1: x, y1: r * rh, x2: x, y2: (r + 1) * rh, stroke: line, sw: 0.025 });
    if (o.icon) {
      it.push({ t: 'circle', cx: fw / 2, cy: fh / 2, r: 0.32, fill: K.hex('screen') });
      it.push(icon(o.icon, fw, fh, K.hex('warn'), 0.4));
    }
    return it;
  };
  const isX = along === 'x';
  return { w: isX ? W : T, d: isX ? T : W, h: H, parts: [box({ w: isX ? W : T, d: isX ? T : W, h: H, r: 0.02, color: col, left: isX ? bricks : null, right: isX ? null : bricks })] };
});

def('bubble', { desc: 'Speech bubble. A message, a prompt, a reply, a conversation.', opts: 'text icon w facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'paper' : o.color;
  const m = K.mat(col);
  const W = o.w ?? 1.35, H = 0.84, tail = 0.2, z = 0.5;
  const pts = rectOutline(W, H, 0.24, 0, tail + H / 2);
  pts.push([-W * 0.3, tail], [-W * 0.34, 0], [-W * 0.1, tail]);
  const A = K.hex(o.accent);
  const face = (fw, fh) => {
    const cy = (fh - tail) / 2;
    if (o.text) return [{ t: 'text', x: fw / 2, y: cy, text: o.text, size: Math.min(0.32, (fw * 1.25) / Math.max(3, o.text.length)), fill: m.onSide === '#ffffff' ? '#ffffff' : K.theme.dark ? '#1a2040' : K.theme.ink, weight: 700 }];
    if (o.icon) return [{ t: 'icon', name: o.icon, x: fw / 2, y: cy, size: 0.46, color: A }];
    return [0, 1, 2].map((i) => ({ t: 'circle', cx: fw / 2 + (i - 1) * 0.24, cy, r: 0.07, fill: A, anim: { type: 'blink', period: 1.2, phase: i * 0.16, min: 0.25 } }));
  };
  return {
    w: L ? W : 0.3, d: L ? 0.3 : W, h: H + tail + z, floatZ: z,
    parts: [panel({ facing: L ? 'left' : 'right', outline: pts, w: W, h: H + tail, t: 0.1, z, color: col, face })],
    shadow: { r: 0.3, soft: true },
  };
});

def('clock', { desc: 'Clock with moving hands. Time, scheduling, latency, deadlines, cron.', opts: 'facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'paper' : o.color;
  const m = K.mat(col);
  const R = 0.56, z = 0.14;
  const ink = m.onSide === '#ffffff' ? '#ffffff' : K.theme.dark ? '#1a2040' : K.theme.ink;
  const face = (fw, fh) => {
    const it = [{ t: 'circle', cx: fw / 2, cy: fh / 2, r: R * 0.84, stroke: rgba(ink, 0.2), sw: 0.03 }];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      it.push({ t: 'line', x1: fw / 2 + Math.cos(a) * R * 0.7, y1: fh / 2 + Math.sin(a) * R * 0.7, x2: fw / 2 + Math.cos(a) * R * 0.8, y2: fh / 2 + Math.sin(a) * R * 0.8, stroke: rgba(ink, i % 3 ? 0.3 : 0.7), sw: 0.03 });
    }
    it.push({ t: 'g', tx: fw / 2, ty: fh / 2, rot: 60, items: [{ t: 'line', x1: 0, y1: 0, x2: 0, y2: -R * 0.4, stroke: ink, sw: 0.06 }] });
    it.push({ t: 'g', tx: fw / 2, ty: fh / 2, anim: { type: 'spin', period: 6 }, items: [{ t: 'line', x1: 0, y1: 0.06, x2: 0, y2: -R * 0.64, stroke: K.hex(o.accent), sw: 0.045 }] });
    it.push({ t: 'circle', cx: fw / 2, cy: fh / 2, r: 0.05, fill: ink });
    return it;
  };
  return {
    w: L ? R * 2 : 0.4, d: L ? 0.4 : R * 2, h: R * 2 + z,
    parts: [box({ w: L ? 0.7 : 0.34, d: L ? 0.34 : 0.7, h: z + 0.04, r: 0.05, color: 'dark' }), panel({ facing: L ? 'left' : 'right', outline: circleOutline(R, 0, R), w: R * 2, h: R * 2, t: 0.16, z, color: col, face })],
    shadow: { w: L ? 0.9 : 0.4, d: L ? 0.4 : 0.9 },
  };
});

def('pin', { desc: 'Map pin. A location, a region, a destination, "here".', opts: '' }, (o) => {
  const col = o.color === 'body' ? 'danger' : o.color;
  return { w: 0.6, d: 0.6, h: 1.25, round: true, parts: [{ t: 'cone', o: [0, 0, 0.04], r0: 0.02, r1: 0.24, h: 0.72, color: col }, { t: 'sphere', c: [0, 0, 0.94], r: 0.3, color: col }], shadow: { r: 0.16 } };
});

def('shield', { desc: 'Shield with a check mark. Protection, trust, compliance, verification.', opts: 'icon facing' }, (o, K) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'accent' : o.color;
  const m = K.mat(col);
  const W = 0.96, H = 1.12, z = 0.28;
  const pts = [[-W / 2, H * 0.94], [-W * 0.2, H], [0, H * 0.96], [W * 0.2, H], [W / 2, H * 0.94], [W / 2, H * 0.5]];
  for (let i = 1; i <= 8; i++) pts.push([Math.cos((i / 8) * (Math.PI / 2)) * (W / 2), H * 0.5 * (1 - Math.sin((i / 8) * (Math.PI / 2)))]);
  for (let i = 7; i >= 0; i--) pts.push([-Math.cos((i / 8) * (Math.PI / 2)) * (W / 2), H * 0.5 * (1 - Math.sin((i / 8) * (Math.PI / 2)))]);
  const face = (fw, fh) => [{ t: 'icon', name: o.icon || 'check', x: fw / 2, y: fh * 0.45, size: 0.62, color: m.onSide, sw: 3 }];
  return {
    w: L ? W : 0.3, d: L ? 0.3 : W, h: H + z, floatZ: z, glowColor: K.hex(col),
    parts: [panel({ facing: L ? 'left' : 'right', outline: pts, w: W, h: H, t: 0.16, z, color: col, face })],
    shadow: { r: 0.3, soft: true },
  };
});

def('globe', { desc: 'Globe on a stand. The world, the internet, global reach, regions.', opts: '' }, (o, K) => {
  const col = o.color === 'body' ? 'accent' : o.color;
  const m = K.mat(col);
  const r = 0.56, cz = 0.92, R = r * UNIT * SPHERE_K;
  const line = rgba(m.on, K.theme.outline ? 0.85 : 0.42);
  const sw = K.theme.outline || 1.1;
  return {
    w: 1.2, d: 1.2, h: 1.6, round: true, glowColor: K.hex(col),
    parts: [
      cyl({ r: 0.4, h: 0.08, color: 'dark' }),
      cyl({ r: 0.07, z: 0.08, h: 0.3, color: 'dark', ao: false, rim: false }),
      { t: 'sphere', c: [0, 0, cz], r, color: col, shine: false },
      { t: 'raw', at: [0, 0, cz], box: { x0: -r, y0: -r, z0: cz - r, x1: r, y1: r, z1: cz + r }, svg: `<g fill="none" stroke="${line}" stroke-width="${sw}"><ellipse rx="${(R * 0.99).toFixed(1)}" ry="${(R * 0.36).toFixed(1)}"/><ellipse rx="${(R * 0.42).toFixed(1)}" ry="${(R * 0.99).toFixed(1)}"/><path d="M${(-R * 0.86).toFixed(1)} ${(-R * 0.5).toFixed(1)}Q0 ${(-R * 0.22).toFixed(1)} ${(R * 0.86).toFixed(1)} ${(-R * 0.5).toFixed(1)}M${(-R * 0.86).toFixed(1)} ${(R * 0.5).toFixed(1)}Q0 ${(R * 0.78).toFixed(1)} ${(R * 0.86).toFixed(1)} ${(R * 0.5).toFixed(1)}M0 ${(-R).toFixed(1)}V${R.toFixed(1)}"/></g>` },
    ],
    shadow: { r: 0.42 },
  };
});

def('conveyor', { desc: 'Moving belt. A pipeline, a queue, a production line, continuous delivery.', opts: 'length axis' }, (o, K) => {
  const isX = o.axis !== 'y';
  const Lg = o.length ?? 4, Wd = 0.95, H = 0.42;
  const m = K.mat(o.color);
  const belt = K.hex('screen');
  const stripe = rgba('#ffffff', K.theme.dark ? 0.2 : 0.28);
  const top = (fw, fh) => {
    const it = [{ t: 'rect', x: 0.08, y: 0.08, w: fw - 0.16, h: fh - 0.16, r: 0.05, fill: belt }];
    const march = { type: 'march', period: 1.2, len: 0.6 };
    if (isX) it.push({ t: 'line', x1: 0.14, y1: fh / 2, x2: fw - 0.14, y2: fh / 2, stroke: stripe, sw: fh - 0.34, dash: '0.08 0.52', anim: march, style: 'stroke-linecap:butt' });
    else it.push({ t: 'line', x1: fw / 2, y1: 0.14, x2: fw / 2, y2: fh - 0.14, stroke: stripe, sw: fw - 0.34, dash: '0.08 0.52', anim: march, style: 'stroke-linecap:butt' });
    return it;
  };
  const side = (fw, fh) => {
    const it = [];
    for (let x = 0.3; x < fw - 0.2; x += 0.5) it.push({ t: 'circle', cx: x, cy: fh * 0.5, r: 0.09, fill: m.deep, stroke: rgba(m.onSide, 0.25), sw: 0.025 });
    return it;
  };
  return { w: isX ? Lg : Wd, d: isX ? Wd : Lg, h: H, surfaceZ: H, parts: [box({ w: isX ? Lg : Wd, d: isX ? Wd : Lg, h: H, r: 0.08, color: o.color, top, left: isX ? side : null, right: isX ? null : side })] };
});

def('arrow', { desc: 'Solid arrow lying on the floor (dir: x, -x, y, -y). Direction, a transition, "leads to".', opts: 'dir length' }, (o) => {
  const col = o.color === 'body' ? 'accent' : o.color;
  const Lg = o.length ?? 1.6, ws = 0.32, wh = 0.78, hl = 0.6;
  let pts = [[-Lg / 2, -ws / 2], [Lg / 2 - hl, -ws / 2], [Lg / 2 - hl, -wh / 2], [Lg / 2, 0], [Lg / 2 - hl, wh / 2], [Lg / 2 - hl, ws / 2], [-Lg / 2, ws / 2]];
  const dir = o.dir || 'x';
  if (dir === '-x') pts = pts.map(([a, b]) => [-a, b]);
  if (dir === 'y') pts = pts.map(([a, b]) => [b, a]);
  if (dir === '-y') pts = pts.map(([a, b]) => [b, -a]);
  const alongX = dir === 'x' || dir === '-x';
  return { w: alongX ? Lg : wh, d: alongX ? wh : Lg, h: 0.12, parts: [{ t: 'prism', plane: 'top', o: [0, 0, 0], pts, depth: 0.12, color: col, ao: false }], shadow: { w: alongX ? Lg * 0.8 : ws, d: alongX ? ws : Lg * 0.8 } };
});

def('stack', { desc: 'Floating layers, one above another. An architecture, a tech stack, levels of abstraction.', opts: 'layers size gap' }, (o, K) => {
  const layers = o.layers ?? 3;
  const list = typeof layers === 'number' ? Array.from({ length: layers }, () => ({})) : layers;
  const s = o.size ?? 2.4, th = 0.18, gap = o.gap ?? 0.42;
  const parts = [], callouts = [];
  list.forEach((ly, i) => {
    const z = i * (th + gap);
    const color = ly.color || (i === list.length - 1 ? o.accent : i % 2 ? 'body2' : o.color);
    const m = K.mat(color);
    parts.push(box({ w: s, d: s, z, h: th, r: 0.24, color, ao: false, top: ly.icon ? (fw, fh) => [icon(ly.icon, fw, fh, rgba(m.on, 0.9), 0.3)] : null }));
    if (ly.label) callouts.push({ at: [s / 2, -s / 2, z + th / 2], text: ly.label, sub: ly.sub, side: 'right' });
  });
  return { w: s, d: s, h: list.length * (th + gap) - gap, parts, callouts };
});

def('funnel', { desc: 'Funnel. Filtering, narrowing down, conversion, many in and few out.', opts: '' }, (o, K) => {
  const col = o.color === 'body' ? 'accent' : o.color;
  const m = K.mat(col);
  return {
    w: 1.5, d: 1.5, h: 1.45, round: true,
    parts: [
      cyl({ r: 0.36, h: 0.07, color: 'dark' }),
      cyl({ r: 0.13, z: 0.07, h: 0.5, color: col, ao: false }),
      { t: 'cone', o: [0, 0, 0.55], r0: 0.13, r1: 0.74, h: 0.86, color: col },
      { t: 'decal', plane: 'top', o: [-0.6, -0.6, 1.412], size: [1.2, 1.2], items: [{ t: 'circle', cx: 0.6, cy: 0.6, r: 0.6, fill: m.deep }, { t: 'circle', cx: 0.6, cy: 0.6, r: 0.2, fill: rgba('#000000', 0.25) }] },
    ],
    shadow: { r: 0.45 },
  };
});

def('stairs', { desc: 'Rising steps (they climb up and to the right). Progress, levels, maturity, growth.', opts: 'steps dir' }, (o) => {
  const n = Math.max(2, Math.min(7, o.steps ?? 4));
  const right = o.dir !== 'left'; // 'right': climbs toward the upper-right; 'left': toward the upper-left
  const run = 1.0, wd = 1.4, rise = 0.32;
  const parts = [], tops = [];
  for (let i = 0; i < n; i++) {
    const c = ((n - 1) * run) / 2 - i * run; // the lowest step is nearest the viewer
    const hh = (i + 1) * rise;
    parts.push(box({ w: right ? wd : run, d: right ? run : wd, h: hh, x: right ? 0 : c, y: right ? c : 0, color: i === n - 1 ? o.accent : o.color }));
    tops.push([right ? 0 : c, right ? c : 0, hh]);
  }
  return { w: right ? wd : n * run, d: right ? n * run : wd, h: n * rise, parts, tops };
});

def('flag', { desc: 'Flag on a pole. A goal, a milestone, a finish line, a claimed position.', opts: 'facing' }, (o) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'accent' : o.color;
  const fl = [[0, 0], [0.62, 0.1], [0.5, 0.24], [0.62, 0.4], [0, 0.46]];
  return {
    w: 0.4, d: 0.4, h: 1.5, round: true,
    parts: [cyl({ r: 0.17, h: 0.06, color: 'dark' }), cyl({ r: 0.035, z: 0.06, h: 1.42, color: 'body2', ao: false, rim: false }), panel({ facing: L ? 'left' : 'right', outline: fl, w: 0.62, h: 0.46, t: 0.04, z: 0.98, x: L ? 0.03 : 0, y: L ? 0 : -0.03, color: col })],
    shadow: { r: 0.18 },
  };
});

def('antenna', { desc: 'Broadcast mast with pulsing signal rings. Wireless, events, publishing, notifications.', opts: '' }, (o, K) => {
  const A = K.hex(o.accent);
  const top = 1.72;
  const rings = (ctx) => [0, 1, 2].map((i) => `<ellipse rx="34" ry="17" fill="none" stroke="${A}" stroke-width="1.8" opacity="0" style="${ctx.animStyle({ type: 'ring', period: 2.4, phase: i / 3 })}"/>`).join('');
  return {
    w: 0.7, d: 0.7, h: 1.9, round: true, glowColor: A,
    parts: [
      cyl({ r: 0.3, h: 0.08, color: 'dark' }),
      { t: 'cone', o: [0, 0, 0.08], r0: 0.13, r1: 0.03, h: 1.56, color: o.color },
      { t: 'raw', at: [0, 0, top], box: { x0: -0.3, y0: -0.3, z0: top - 0.3, x1: 0.3, y1: 0.3, z1: top + 0.3 }, svg: rings },
      { t: 'sphere', c: [0, 0, top - 0.05], r: 0.09, color: o.accent },
    ],
    shadow: { r: 0.3 },
  };
});

def('bulb', { desc: 'Light bulb. An idea, an insight, a discovery, "aha".', opts: '' }, (o, K) => {
  const col = o.color === 'body' ? 'gold' : o.color;
  return {
    w: 0.9, d: 0.9, h: 1.3, round: true, glowColor: K.hex(col),
    parts: [cyl({ r: 0.2, h: 0.1, color: 'dark' }), cyl({ r: 0.16, z: 0.1, h: 0.2, color: 'body2', ao: false }), { t: 'sphere', c: [0, 0, 0.78], r: 0.38, color: col }],
    shadow: { r: 0.3 },
  };
});

def('cursor', { desc: 'Pointer arrow. A click, a selection, user input, an interaction.', opts: 'facing' }, (o) => {
  const L = o.facing !== 'right';
  const col = o.color === 'body' ? 'paper' : o.color;
  const k = 0.9;
  const pts = [[0, 1.0], [0, 0.12], [0.2, 0.33], [0.34, 0.0], [0.5, 0.07], [0.36, 0.4], [0.66, 0.42]].map(([a, b]) => [a * k - 0.3, b * k]);
  return { w: 0.6, d: 0.3, h: 1.2, floatZ: 0.3, parts: [panel({ facing: L ? 'left' : 'right', outline: pts, w: 0.6, h: 0.9, t: 0.08, z: 0.3, color: col })], shadow: { r: 0.18, soft: true } };
});

def('battery', { desc: 'Battery with charge level. Energy, capacity, quota, remaining budget.', opts: 'level' }, (o, K) => {
  const lvl = Math.max(0, Math.min(1, o.level ?? 0.7));
  const r = 0.42, H = 1.3;
  const fillColor = lvl < 0.25 ? 'danger' : o.color === 'body' ? 'ok' : o.color;
  return {
    w: r * 2, d: r * 2, h: H + 0.12, round: true,
    parts: [cyl({ r, h: H * lvl, color: fillColor }), ...(lvl < 1 ? [cyl({ r, z: H * lvl, h: H * (1 - lvl), color: 'muted', ao: false })] : []), cyl({ r: 0.17, z: H, h: 0.1, color: 'body2', ao: false })],
  };
});

def('truck', { desc: 'Delivery truck. Logistics, shipping, moving data in bulk, deployment.', opts: '' }, (o, K) => {
  const A = K.hex(o.accent);
  const m = K.mat(o.color);
  const wheel = (x) => ({ t: 'prism', plane: 'left', o: [x, 0.36, 0], pts: circleOutline(0.2, 0, 0.2, 20), depth: 0.12, color: 'dark', decals: [{ plane: 'left', o: [x - 0.2, 0.48, 0.4], items: [{ t: 'circle', cx: 0.2, cy: 0.2, r: 0.08, fill: rgba('#ffffff', 0.5) }] }] });
  return {
    w: 2.3, d: 1.0, h: 1.3,
    parts: [
      box({ w: 2.2, d: 0.8, h: 0.12, z: 0.2, color: 'dark', ao: false, rim: false }),
      box({ w: 1.45, d: 0.92, h: 0.95, x: -0.38, z: 0.3, r: 0.05, color: o.color === 'body' ? 'paper' : o.color, left: (fw, fh) => [{ t: 'rect', x: 0.12, y: fh * 0.55, w: fw - 0.24, h: 0.09, r: 0.04, fill: A }] }),
      box({ w: 0.66, d: 0.88, h: 0.72, x: 0.74, z: 0.3, r: 0.08, color: o.accent, left: (fw, fh) => [{ t: 'rect', x: 0.1, y: 0.1, w: fw - 0.2, h: fh * 0.42, r: 0.05, fill: K.hex('screen') }], right: (fw, fh) => [{ t: 'rect', x: 0.08, y: 0.1, w: fw - 0.16, h: fh * 0.42, r: 0.05, fill: K.hex('screen') }] }),
      wheel(-0.62), wheel(0.62),
    ],
    shadow: { w: 2.2, d: 0.9 },
  };
});

def('queue', { desc: 'Row of waiting blocks. A queue, a buffer, a backlog, messages in line.', opts: 'count axis' }, (o) => {
  const n = Math.max(2, Math.min(8, o.count ?? 4));
  const isX = o.axis !== 'y';
  const s = 0.5, gap = 0.16, Lg = n * s + (n - 1) * gap;
  const parts = [box({ w: isX ? Lg + 0.4 : 0.9, d: isX ? 0.9 : Lg + 0.4, h: 0.08, r: 0.1, color: 'muted' })];
  for (let i = 0; i < n; i++) {
    const c = -Lg / 2 + s / 2 + i * (s + gap);
    parts.push(box({ w: s, d: s, h: s * 0.8, z: 0.08, x: isX ? c : 0, y: isX ? 0 : c, r: 0.05, color: i === n - 1 ? o.accent : o.color }));
  }
  return { w: isX ? Lg + 0.4 : 0.9, d: isX ? 0.9 : Lg + 0.4, h: 0.08 + s * 0.8, parts };
});

/**
 * The same building blocks the kit is made of, for objects the kit does not have.
 * Everything is in grid cells, relative to the object's own origin (the centre of its footprint on the floor).
 */
export const SHAPES = {
  /** Upright block. top / left / right take flat artwork: an array of items or (faceWidth, faceHeight) => items. */
  box,
  /** Cylinder standing on the floor. top takes flat artwork. */
  cyl,
  /** Upright slab facing 'left' or 'right'. face takes flat artwork; outline replaces the rectangle with any shape [[a, b], ...] (a across, b up). */
  panel,
  /** Any outline pushed out of a plane. plane 'top' rises, 'left' comes toward the lower-left, 'right' toward the lower-right. */
  prism: ({ plane = 'top', at = [0, 0, 0], outline, depth = 1, color = 'body', ...rest }) => ({ t: 'prism', plane, o: at, pts: outline, depth, color, ...rest }),
  sphere: ({ x = 0, y = 0, z = 0.5, r = 0.5, color = 'body', ...rest }) => ({ t: 'sphere', c: [x, y, z], r, color, ...rest }),
  /** Cone, or a tapered cylinder when r2 is given (r at the bottom, r2 at the top). */
  cone: ({ x = 0, y = 0, z = 0, r = 0.5, r2 = 0, h = 1, color = 'body', ...rest }) => ({ t: 'cone', o: [x, y, z], r0: r, r1: r2, h, color, ...rest }),
  /** Convex solid from flat faces; list each face's corners counter-clockwise as seen from outside. */
  mesh: ({ faces, color = 'body', rimEdges, ...rest }) => ({ t: 'mesh', faces, color, rimEdges, ...rest }),
  /** Flat artwork lying on a plane at a point in space. */
  decal: ({ plane = 'top', at = [0, 0, 0], items, size = [1, 1], turn = 0, ...rest }) => ({ t: 'decal', plane, o: at, items, size, turn, ...rest }),
  /** Any SVG markup standing upright at a point in space (drawn in screen pixels around that point). */
  raw: ({ x = 0, y = 0, z = 0, svg, w = 1, d = 0.2, h = 1, ...rest }) => ({ t: 'raw', at: [x, y, z], svg, box: { x0: x - w / 2, y0: y - d / 2, z0: z, x1: x + w / 2, y1: y + d / 2, z1: z + h }, ...rest }),
  /** A soft ball of light at a point in space: a lit lamp, a spark, a hot spot. r is its reach in cells. */
  glow: ({ x = 0, y = 0, z = 0.5, r = 0.8, color = 'gold', strength = 1, ...rest }) => ({
    t: 'raw', at: [x, y, z], box: { x0: x - 0.04, y0: y - 0.04, z0: z - 0.04, x1: x + 0.04, y1: y + 0.04, z1: z + 0.04 }, ...rest,
    svg: (ctx) => {
      const hex = isHex(color) ? color : ctx.theme.roles[color] || ctx.theme.roles.gold;
      const k = Math.max(0, Math.min(1, strength));
      const id = ctx.def(`light|${hex}|${k}`, (gid) => `<radialGradient id="${gid}"><stop offset="0" stop-color="#ffffff" stop-opacity="${+(0.9 * k).toFixed(2)}"/><stop offset="0.16" stop-color="${hex}" stop-opacity="${+(0.85 * k).toFixed(2)}"/><stop offset="0.5" stop-color="${hex}" stop-opacity="${+(0.28 * k).toFixed(2)}"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient>`);
      return `<circle r="${+(r * UNIT).toFixed(1)}" fill="url(#${id})"/>`;
    },
  }),
  /** A straight arrow between two points in space: a force, a velocity, a field, a direction of flow. */
  arrow: ({ from = [0, 0, 0], to = [1, 0, 0], color = 'accent', width = 3, head = 1, dash, ...rest }) => ({
    t: 'raw', at: [from[0], from[1], from[2] || 0], ...rest,
    box: { x0: Math.min(from[0], to[0]) - 0.03, y0: Math.min(from[1], to[1]) - 0.03, z0: Math.min(from[2] || 0, to[2] || 0) - 0.03, x1: Math.max(from[0], to[0]) + 0.03, y1: Math.max(from[1], to[1]) + 0.03, z1: Math.max(from[2] || 0, to[2] || 0) + 0.03 },
    svg: (ctx) => {
      const hex = isHex(color) ? color : ctx.theme.roles[color] || ctx.theme.roles.accent;
      const a = proj(from[0], from[1], from[2] || 0), b = proj(to[0], to[1], to[2] || 0);
      const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
      const ux = dx / len, uy = dy / len, hl = Math.min(len * 0.6, (7 + width * 2.4) * head), hw = hl * 0.42;
      const bx = dx - ux * hl, by = dy - uy * hl, n = (v) => +v.toFixed(1);
      return `<path d="M0 0L${n(bx)} ${n(by)}" stroke="${hex}" stroke-width="${width}" stroke-linecap="round" fill="none"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`
        + `<path d="M${n(dx)} ${n(dy)}L${n(bx - uy * hw)} ${n(by + ux * hw)}L${n(bx + uy * hw)} ${n(by - ux * hw)}Z" fill="${hex}" stroke="${hex}" stroke-width="1" stroke-linejoin="round"/>`;
    },
  }),
  /** Rings that spread out and fade, lying on a plane: 'top' for ripples on the floor, 'left' or 'right' for a wall. */
  ripple: ({ x = 0, y = 0, z = 0.02, plane = 'top', r = 1, count = 3, period = 2.4, color = 'accent', width = 1.6, ...rest }) => ({
    t: 'decal', plane, o: [x, y, z], size: [0.1, 0.1], turn: 0, ...rest,
    items: Array.from({ length: count }, (_, i) => ({ t: 'circle', cx: 0, cy: 0, r: r / 1.25, stroke: color, sw: width / UNIT, anim: { type: 'ring', period, phase: i / count } })),
  }),
  /**
   * Many small particles on one path [[x, y, z], ...]: charge in a wire, water in a pipe, air carrying sound.
   * mode 'drift' (they travel), 'alternate' (they rock to and fro in step), 'zigzag' (they travel, jostling).
   */
  stream: ({ points, closed = false, ...rest }) => ({ t: 'stream', pts: points, closed, ...rest }),
  /** Several shapes that move as one: sh.group({ parts: [...], anim }). */
  group: ({ parts, anim, sort, opacity, name }) => ({ t: 'group', parts, anim, sort, opacity, name }),
  /** A thin line through points in space [[x, y, z], ...]: a cable, an antenna, a beam. */
  wire: ({ points, color, width = 1.5, dash, ...rest }) => ({ t: 'line', pts: points, stroke: color, sw: width, dash, ...rest }),
  outline: {
    rect: rectOutline,
    circle: circleOutline,
    ngon: (n, r, rotation = 0) => Array.from({ length: n }, (_, i) => [Math.cos(rotation + (i / n) * Math.PI * 2) * r, Math.sin(rotation + (i / n) * Math.PI * 2) * r]),
    blob: blobOutline,
    gear: gearOutline,
  },
  /** An icon as flat artwork, centred in a face of the given size. */
  icon: (name, fw, fh, color, k = 0.6) => icon(name, fw, fh, color, k),
};

export const KIT = B;
export const KIND_NAMES = Object.keys(B);

// Small things that travel along links.
export const PACKETS = {
  dot: (c, K) => {
    const hex = K.hex(c), line = K.theme.outline;
    const core = line ? hex : mix(hex, '#ffffff', K.theme.dark ? 0.55 : 0.2);
    const svg = line
      ? `<circle r="8" fill="${hex}" stroke="${K.theme.ink}" stroke-width="${line}"/>`
      : `<circle r="9.5" fill="${hex}"/><circle r="6.8" fill="${core}"/><circle cx="-2.2" cy="-2.5" r="2.2" fill="#ffffff" fill-opacity="0.85"/>`;
    return { parts: [{ t: 'raw', at: [0, 0, 0.26], box: { x0: -0.2, y0: -0.2, z0: 0.06, x1: 0.2, y1: 0.2, z1: 0.46 }, svg }], shadow: 0.18, glow: true, glowZ: 0.26 };
  },
  cube: (c) => ({ parts: [box({ w: 0.42, d: 0.42, h: 0.42, z: 0.08, r: 0.05, color: c, ao: false })], shadow: 0.28 }),
  doc: (c, K) => {
    const ink = rgba(K.theme.dark ? '#1a2040' : K.theme.ink, 0.38);
    return { parts: [panel({ w: 0.5, h: 0.64, t: 0.045, z: 0.12, r: 0.04, color: 'paper', face: (fw) => [{ t: 'rect', x: 0.08, y: 0.1, w: fw * 0.5, h: 0.07, r: 0.03, fill: K.hex(c) }, { t: 'rect', x: 0.08, y: 0.26, w: fw - 0.16, h: 0.045, r: 0.02, fill: ink }, { t: 'rect', x: 0.08, y: 0.38, w: fw * 0.6, h: 0.045, r: 0.02, fill: ink }, { t: 'rect', x: 0.08, y: 0.5, w: fw - 0.2, h: 0.045, r: 0.02, fill: ink }] })], shadow: 0.24 };
  },
  box: (c) => ({ parts: [box({ w: 0.5, d: 0.5, h: 0.38, z: 0.05, r: 0.03, color: c === 'accent' ? 'gold' : c, ao: false, top: (fw, fh) => [{ t: 'rect', x: 0, y: fh / 2 - 0.05, w: fw, h: 0.1, fill: 'rgba(0,0,0,0.22)' }] })], shadow: 0.32 }),
  coin: (c, K) => {
    const col = c === 'accent' ? 'gold' : c;
    return { parts: [cyl({ r: 0.25, h: 0.085, z: 0.12, color: col, ao: false, top: (fw) => [{ t: 'circle', cx: fw / 2, cy: fw / 2, r: fw * 0.3, stroke: rgba(K.mat(col).on, 0.4), sw: 0.03 }] })], shadow: 0.24 };
  },
  mail: (c, K) => ({ parts: [panel({ w: 0.6, h: 0.42, t: 0.045, z: 0.14, r: 0.04, color: 'paper', face: (fw, fh) => [{ t: 'poly', open: true, pts: [[0.05, 0.06], [fw / 2, fh * 0.56], [fw - 0.05, 0.06]], stroke: K.hex(c), sw: 0.05 }] })], shadow: 0.26 }),
  gem: (c) => {
    const r = 0.22, z0 = 0.1;
    const ring = Array.from({ length: 4 }, (_, i) => [Math.cos((i / 4) * Math.PI * 2 + 0.785) * r, Math.sin((i / 4) * Math.PI * 2 + 0.785) * r, z0 + 0.27]);
    const faces = [];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; faces.push([[0, 0, z0], ring[j], ring[i]]); faces.push([[0, 0, z0 + 0.54], ring[i], ring[j]]); }
    return { parts: [{ t: 'mesh', color: c === 'accent' ? 'accent2' : c, faces }], shadow: 0.18, glow: true, glowZ: 0.37 };
  },
};
export const PACKET_NAMES = Object.keys(PACKETS);

export { ICONS, mix, adjust };
