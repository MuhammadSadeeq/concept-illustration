// Isometric projection and small geometry helpers.
//
// World axes (units are grid cells):
//   x  runs toward the lower-right of the picture
//   y  runs toward the lower-left of the picture
//   z  is up
// The viewer sits at (+x, +y, +z), so larger x + y is nearer the viewer.

export const UNIT = 40; // screen units per world cell
const COS = Math.cos(Math.PI / 6);
const SIN = 0.5;
export const SPHERE_K = Math.SQRT2 * COS; // a world radius r draws as a circle of r * UNIT * SPHERE_K

export const r2 = (n) => {
  const v = Math.round(n * 100) / 100;
  return Object.is(v, -0) ? 0 : v;
};
export const r1 = (n) => {
  const v = Math.round(n * 10) / 10;
  return Object.is(v, -0) ? 0 : v;
};

/** Project a world point to screen units. */
export const proj = (x, y, z = 0) => [(x - y) * COS * UNIT, (x + y) * SIN * UNIT - z * UNIT];
export const projP = (p) => proj(p[0], p[1], p[2] || 0);

export const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], (a[2] || 0) + (b[2] || 0)];
export const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], (a[2] || 0) - (b[2] || 0)];
export const mul3 = (a, k) => [a[0] * k, a[1] * k, (a[2] || 0) * k];
export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm3 = (a) => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

export const VIEW = [1, 1, 1]; // direction toward the viewer

/**
 * The three visible plane orientations.
 * A/B span the plane as the viewer sees it (A to the right, B up or forward), N faces the viewer.
 * U/V are used for flat artwork drawn on the plane: U reads left to right, V runs down the surface.
 */
export const PLANES = {
  top: { A: [1, 0, 0], B: [0, 1, 0], N: [0, 0, 1], U: [1, 0, 0], V: [0, 1, 0] },
  left: { A: [1, 0, 0], B: [0, 0, 1], N: [0, 1, 0], U: [1, 0, 0], V: [0, 0, -1] },
  right: { A: [0, -1, 0], B: [0, 0, 1], N: [1, 0, 0], U: [0, -1, 0], V: [0, 0, -1] },
};

export function planePoint(plane, o, a, b) {
  const P = PLANES[plane];
  return [o[0] + P.A[0] * a + P.B[0] * b, o[1] + P.A[1] * a + P.B[1] * b, o[2] + P.A[2] * a + P.B[2] * b];
}

/** SVG matrix that lays flat 2D artwork (in world units) onto a plane at a world origin. */
export function planeMatrix(plane, o, turn = 0) {
  const P = PLANES[plane];
  let U = P.U, V = P.V;
  for (let i = 0; i < ((turn % 4) + 4) % 4; i++) [U, V] = [V, mul3(U, -1)];
  const [ax, ay] = proj(U[0], U[1], U[2]);
  const [bx, by] = proj(V[0], V[1], V[2]);
  const [ex, ey] = projP(o);
  return `matrix(${r2(ax)} ${r2(ay)} ${r2(bx)} ${r2(by)} ${r2(ex)} ${r2(ey)})`;
}

// ---------- 2D outlines (in plane coordinates) ----------

export const signedArea = (pts) => {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
};

/** Rectangle outline centred on the origin, with optional rounded corners. */
export function rectOutline(w, d, radius = 0, cx = 0, cy = 0) {
  const hw = w / 2, hd = d / 2;
  const r = Math.max(0, Math.min(radius, hw - 1e-4, hd - 1e-4));
  if (r < 0.01) return [[cx - hw, cy - hd], [cx + hw, cy - hd], [cx + hw, cy + hd], [cx - hw, cy + hd]];
  const seg = Math.max(3, Math.min(10, Math.ceil(r * UNIT * 0.45)));
  const pts = [];
  const corners = [
    [cx + hw - r, cy - hd + r, -90], [cx + hw - r, cy + hd - r, 0],
    [cx - hw + r, cy + hd - r, 90], [cx - hw + r, cy - hd + r, 180],
  ];
  for (const [ox, oy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = ((a0 + (90 * i) / seg) * Math.PI) / 180;
      pts.push([ox + r * Math.cos(a), oy + r * Math.sin(a)]);
    }
  }
  return pts;
}

export function circleOutline(radius, cx = 0, cy = 0, segments) {
  const n = segments || Math.max(16, Math.min(56, Math.ceil(radius * UNIT * 0.9 / 4) * 4));
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return pts;
}

export function ngonOutline(n, radius, rotation = 0, cx = 0, cy = 0) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rotation + (i / n) * Math.PI * 2;
    pts.push([cx + radius * Math.cos(a), cy + radius * Math.sin(a)]);
  }
  return pts;
}

// ---------- screen helpers ----------

export const polyPath = (pts, close = true) =>
  'M' + pts.map((p) => `${r1(p[0])} ${r1(p[1])}`).join('L') + (close ? 'Z' : '');

export function bbox2(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const [x, y] of pts) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return { x0, y0, x1, y1 };
}

export const unionBox = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1) });
export const growBox = (b, m) => ({ x0: b.x0 - m, y0: b.y0 - m, x1: b.x1 + m, y1: b.y1 + m });
export const boxesOverlap = (a, b, m = 0) => a.x0 < b.x1 - m && b.x0 < a.x1 - m && a.y0 < b.y1 - m && b.y0 < a.y1 - m;

// ---------- 3D axis-aligned boxes ----------

export const aabb = (x0, y0, z0, x1, y1, z1) => ({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), z1: Math.max(z0, z1) });
export const aabbUnion = (a, b) => (!a ? b : !b ? a : { x0: Math.min(a.x0, b.x0), y0: Math.min(a.y0, b.y0), z0: Math.min(a.z0, b.z0), x1: Math.max(a.x1, b.x1), y1: Math.max(a.y1, b.y1), z1: Math.max(a.z1, b.z1) });
export const aabbShift = (a, d) => ({ x0: a.x0 + d[0], y0: a.y0 + d[1], z0: a.z0 + (d[2] || 0), x1: a.x1 + d[0], y1: a.y1 + d[1], z1: a.z1 + (d[2] || 0) });
export const aabbCenter = (a) => [(a.x0 + a.x1) / 2, (a.y0 + a.y1) / 2, (a.z0 + a.z1) / 2];
export const aabbIntersects = (a, b, eps = 0.02) =>
  a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.y0 < b.y1 - eps && b.y0 < a.y1 - eps && a.z0 < b.z1 - eps && b.z0 < a.z1 - eps;

/** Screen-space bounding box of a 3D box. */
export function aabbScreen(a) {
  const pts = [];
  for (const x of [a.x0, a.x1]) for (const y of [a.y0, a.y1]) for (const z of [a.z0, a.z1]) pts.push(proj(x, y, z));
  return bbox2(pts);
}

/**
 * Painter's order for boxes seen from (+x, +y, +z).
 * Box A can cover box B only if A reaches past B's near limits on all three axes;
 * that gives an exact partial order for boxes that do not intersect.
 */
export function depthSort(items) {
  const n = items.length;
  const key = items.map((it) => {
    const c = aabbCenter(it.aabb);
    return c[0] + c[1] + c[2] * 0.6 + (it.bias || 0);
  });
  const scr = items.map((it) => aabbScreen(it.aabb));
  const after = Array.from({ length: n }, () => []); // after[i] = items that must be drawn after i
  const indeg = new Array(n).fill(0);
  const eps = 0.011;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (!boxesOverlap(scr[i], scr[j])) continue;
      const a = items[i].aabb, b = items[j].aabb;
      const aFront = a.x1 > b.x0 + eps && a.y1 > b.y0 + eps && a.z1 > b.z0 + eps;
      const bFront = b.x1 > a.x0 + eps && b.y1 > a.y0 + eps && b.z1 > a.z0 + eps;
      let first; // index drawn first (behind)
      if (aFront && !bFront) first = j;
      else if (bFront && !aFront) first = i;
      else if (aFront && bFront) first = key[i] <= key[j] ? i : j;
      else continue;
      const second = first === i ? j : i;
      after[first].push(second);
      indeg[second]++;
    }
  }
  const done = new Array(n).fill(false);
  const out = [];
  for (let step = 0; step < n; step++) {
    let pick = -1;
    for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || key[i] < key[pick])) pick = i;
    if (pick < 0) for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || key[i] < key[pick])) pick = i; // cycle: fall back to depth key
    done[pick] = true;
    out.push(items[pick]);
    for (const j of after[pick]) indeg[j]--;
  }
  return out;
}

// ---------- text metrics (approximate; no DOM needed) ----------

const NARROW = new Set("iIl.,:;'|!jtf()[]{}r1 ".split(''));
const WIDE = new Set('mwMW@%'.split(''));
export function textWidth(str, size, weight = 500) {
  let w = 0;
  for (const ch of String(str)) {
    if (NARROW.has(ch)) w += 0.34;
    else if (WIDE.has(ch)) w += 0.86;
    else if (ch >= 'A' && ch <= 'Z') w += 0.68;
    else if (ch.charCodeAt(0) > 0x2e80) w += 1.0;
    else w += 0.56;
  }
  return w * size * (weight >= 600 ? 1.04 : 1);
}

export const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
