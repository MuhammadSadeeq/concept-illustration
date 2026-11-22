// Connector routing on the floor grid. Routes follow the two floor axes so they read as
// part of the isometric world, and their corners are rounded in world space.

import { projP, r1 } from './geom.mjs';

const EPS = 0.02;

// A link that meets an object on one of its two far sides would end behind it. Stop it early
// enough that its tip lands on the object's visible outline instead.
const edgePoint = (o, axis, sign, gap) => {
  const half = axis === 'x' ? (o.w || 0) / 2 : (o.d || 0) / 2;
  const other = axis === 'x' ? (o.d || 0) / 2 : (o.w || 0) / 2;
  let g = half > 0 ? gap : 0;
  if (half > 0 && sign < 0) g = Math.min(o.h ?? 0, other) + 0.1;
  const off = sign * (half + g);
  return axis === 'x' ? [o.x + off, o.y] : [o.x, o.y + off];
};

/**
 * Corner points of a route between two footprints ({x, y, w, d}) on the floor.
 * mode: 'auto' | 'x' (leave along x, then turn) | 'y' | 'straight'
 */
export function routePoints(a, b, { mode = 'auto', gap = 0.14, via } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const sx = Math.sign(dx) || 1, sy = Math.sign(dy) || 1;
  if (via && via.length) {
    const first = via[0], last = via[via.length - 1];
    const startAxis = Math.abs(first[0] - a.x) >= Math.abs(first[1] - a.y) ? 'x' : 'y';
    const endAxis = Math.abs(last[0] - b.x) >= Math.abs(last[1] - b.y) ? 'x' : 'y';
    const s = edgePoint(a, startAxis, startAxis === 'x' ? Math.sign(first[0] - a.x) || 1 : Math.sign(first[1] - a.y) || 1, gap);
    const e = edgePoint(b, endAxis, endAxis === 'x' ? Math.sign(last[0] - b.x) || 1 : Math.sign(last[1] - b.y) || 1, gap);
    return [s, ...via.map((p) => [p[0], p[1]]), e];
  }
  if (mode === 'straight') {
    const l = Math.hypot(dx, dy) || 1;
    const ux = dx / l, uy = dy / l;
    // distance from an object's centre to the edge of its footprint along the link direction
    const reach = (o) => ((o.w || 0) > 0 ? Math.min((o.w / 2) / (Math.abs(ux) || 1e-9), (o.d / 2) / (Math.abs(uy) || 1e-9)) : 0);
    // how much of the link an object hides when the link meets it from behind
    const hidden = (o, toward) => Math.max(0, toward) * Math.min(o.h ?? 0, Math.min(o.w || 0, o.d || 0) / 2 + 0.2) * 0.9;
    const ra = reach(a) + ((a.w || 0) > 0 ? gap : 0) + hidden(a, -(ux + uy) / Math.SQRT2);
    const rb = reach(b) + ((b.w || 0) > 0 ? gap : 0) + hidden(b, (ux + uy) / Math.SQRT2);
    const cut = Math.min(1, (l * 0.92) / (ra + rb || 1));
    return [[a.x + ux * ra * cut, a.y + uy * ra * cut], [b.x - ux * rb * cut, b.y - uy * rb * cut]];
  }
  if (Math.abs(dy) < EPS) return [edgePoint(a, 'x', sx, gap), edgePoint(b, 'x', -sx, gap)];
  if (Math.abs(dx) < EPS) return [edgePoint(a, 'y', sy, gap), edgePoint(b, 'y', -sy, gap)];
  let m = mode;
  if (m === 'auto') {
    // Use a Z-shaped route along the dominant axis when there is room for the jog, otherwise an L.
    const roomX = Math.abs(dx) - (a.w || 0) / 2 - (b.w || 0) / 2;
    const roomY = Math.abs(dy) - (a.d || 0) / 2 - (b.d || 0) / 2;
    if (Math.abs(dx) >= Math.abs(dy) && roomX >= 1.1) m = 'zx';
    else if (Math.abs(dy) > Math.abs(dx) && roomY >= 1.1) m = 'zy';
    else m = roomX >= roomY ? 'x' : 'y';
  }
  if (m === 'zx') {
    const s = edgePoint(a, 'x', sx, gap), e = edgePoint(b, 'x', -sx, gap);
    const mx = (s[0] + e[0]) / 2;
    return [s, [mx, a.y], [mx, b.y], e];
  }
  if (m === 'zy') {
    const s = edgePoint(a, 'y', sy, gap), e = edgePoint(b, 'y', -sy, gap);
    const my = (s[1] + e[1]) / 2;
    return [s, [a.x, my], [b.x, my], e];
  }
  if (m === 'x') return [edgePoint(a, 'x', sx, gap), [b.x, a.y], edgePoint(b, 'y', -sy, gap)];
  if (m === 'y') return [edgePoint(a, 'y', sy, gap), [a.x, b.y], edgePoint(b, 'x', -sx, gap)];
  throw new Error(`Unknown route "${mode}". Use 'auto', 'x', 'y' or 'straight'.`);
}

/**
 * Turn corner points into a rounded polyline.
 * Returns { flat: [{ p: [x, y, z], seg }], lens, total, svg(projected path) } where seg is the
 * index of the straight run a point belongs to (used to keep moving objects correctly layered).
 */
export function buildPath(corners, z = 0, radius = 0.32) {
  const pts = corners.map((p) => [p[0], p[1]]);
  const flat = [];
  let d = '';
  const P = (p) => projP([p[0], p[1], z]);
  const push = (p, seg) => {
    const last = flat[flat.length - 1];
    if (last && Math.hypot(last.p[0] - p[0], last.p[1] - p[1]) < 1e-6) return;
    flat.push({ p: [p[0], p[1], z], seg });
  };
  push(pts[0], 0);
  let s0 = P(pts[0]);
  d += `M${r1(s0[0])} ${r1(s0[1])}`;
  for (let i = 1; i < pts.length; i++) {
    const cur = pts[i];
    if (i === pts.length - 1) {
      push(cur, i - 1);
      const s = P(cur);
      d += `L${r1(s[0])} ${r1(s[1])}`;
      break;
    }
    const prev = pts[i - 1], next = pts[i + 1];
    const l1 = Math.hypot(cur[0] - prev[0], cur[1] - prev[1]), l2 = Math.hypot(next[0] - cur[0], next[1] - cur[1]);
    const r = Math.min(radius, l1 / 2, l2 / 2);
    const u1 = [(cur[0] - prev[0]) / (l1 || 1), (cur[1] - prev[1]) / (l1 || 1)];
    const u2 = [(next[0] - cur[0]) / (l2 || 1), (next[1] - cur[1]) / (l2 || 1)];
    const q0 = [cur[0] - u1[0] * r, cur[1] - u1[1] * r], q1 = [cur[0] + u2[0] * r, cur[1] + u2[1] * r];
    push(q0, i - 1);
    const n = 6;
    for (let k = 1; k < n; k++) {
      const t = k / n;
      const x = (1 - t) * (1 - t) * q0[0] + 2 * (1 - t) * t * cur[0] + t * t * q1[0];
      const y = (1 - t) * (1 - t) * q0[1] + 2 * (1 - t) * t * cur[1] + t * t * q1[1];
      push([x, y], t < 0.5 ? i - 1 : i);
    }
    push(q1, i);
    const a = P(q0), c = P(cur), b = P(q1);
    d += `L${r1(a[0])} ${r1(a[1])}Q${r1(c[0])} ${r1(c[1])} ${r1(b[0])} ${r1(b[1])}`;
  }
  const lens = [0];
  for (let i = 1; i < flat.length; i++) lens.push(lens[i - 1] + Math.hypot(flat[i].p[0] - flat[i - 1].p[0], flat[i].p[1] - flat[i - 1].p[1], flat[i].p[2] - flat[i - 1].p[2]));
  return { flat, lens, total: lens[lens.length - 1], d, segs: Math.max(1, pts.length - 1) };
}

/** A hop through the air between two points (for wireless signals, calls, hand-offs). */
export function buildArc(a, b, height = 1.4) {
  const n = 18;
  const flat = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const lift = 4 * height * t * (1 - t);
    flat.push({ p: [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t + lift], seg: 0 });
  }
  const lens = [0];
  for (let i = 1; i < flat.length; i++) lens.push(lens[i - 1] + Math.hypot(flat[i].p[0] - flat[i - 1].p[0], flat[i].p[1] - flat[i - 1].p[1], flat[i].p[2] - flat[i - 1].p[2]));
  const s = flat.map((f) => projP(f.p));
  const d = 'M' + s.map((q) => `${r1(q[0])} ${r1(q[1])}`).join('L');
  return { flat, lens, total: lens[lens.length - 1], d, segs: 1 };
}

/** Point at a fraction (0..1) of the path length. */
export function pointAt(path, f) {
  const target = Math.max(0, Math.min(1, f)) * path.total;
  const { flat, lens } = path;
  let i = 1;
  while (i < lens.length - 1 && lens[i] < target) i++;
  const span = lens[i] - lens[i - 1] || 1;
  const t = (target - lens[i - 1]) / span;
  const a = flat[i - 1].p, b = flat[i].p;
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function reversePath(path) {
  const flat = [...path.flat].reverse().map((f) => ({ p: f.p, seg: path.segs - 1 - f.seg }));
  const lens = [0];
  for (let i = 1; i < flat.length; i++) lens.push(lens[i - 1] + Math.hypot(flat[i].p[0] - flat[i - 1].p[0], flat[i].p[1] - flat[i - 1].p[1], flat[i].p[2] - flat[i - 1].p[2]));
  return { ...path, flat, lens };
}
