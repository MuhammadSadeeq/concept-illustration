// Primitive solids and flat artwork. Each renderer returns an SVG fragment in the
// local screen space of its object (the object's origin projects to 0,0).

import {
  UNIT, SPHERE_K, PLANES, VIEW, proj, projP, planePoint, planeMatrix, signedArea, polyPath,
  dot3, cross3, norm3, sub3, add3, mul3, aabb, r1, r2, esc, circleOutline, depthSort,
} from './geom.mjs';
import { toneFor } from './themes.mjs';
import { blend, rgba, adjust, mix } from './color.mjs';
import { ICONS } from './icons.mjs';

const f = r1;

// ---------------------------------------------------------------- prism

/**
 * An outline extruded along a plane normal. Covers boxes, slabs, cylinders, rounded
 * blocks, upright panels and any custom footprint.
 *   plane  'top' (extrudes up) | 'left' (toward +y) | 'right' (toward +x)
 *   o      local origin of the outline's back plane
 *   pts    outline in plane coordinates [[a, b], ...]
 *   depth  extrusion length
 */
export function prismBox(p) {
  const P = PLANES[p.plane || 'top'];
  let b = null;
  for (const [a, bb] of p.pts) {
    for (const k of [0, p.depth]) {
      const q = add3(planePoint(p.plane || 'top', p.o || [0, 0, 0], a, bb), mul3(P.N, k));
      b = b ? aabb(Math.min(b.x0, q[0]), Math.min(b.y0, q[1]), Math.min(b.z0, q[2]), Math.max(b.x1, q[0]), Math.max(b.y1, q[1]), Math.max(b.z1, q[2])) : aabb(q[0], q[1], q[2], q[0], q[1], q[2]);
    }
  }
  return b;
}

export function renderPrism(ctx, p) {
  const { theme } = ctx;
  const plane = p.plane || 'top';
  const P = PLANES[plane];
  const o = p.o || [0, 0, 0];
  const mat = ctx.mat(p.color || 'body');
  const capMat = p.capColor ? ctx.mat(p.capColor) : mat;
  const pts = signedArea(p.pts) >= 0 ? p.pts : [...p.pts].reverse();
  const n = pts.length;
  const ext = mul3(P.N, p.depth);
  const base = pts.map(([a, b]) => planePoint(plane, o, a, b));
  const capS = base.map((q) => projP(add3(q, ext)));
  const baseS = base.map(projP);

  // Edge normals and visibility.
  const en = [], vis = [];
  for (let i = 0; i < n; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % n];
    const dx = x2 - x1, dy = y2 - y1, l = Math.hypot(dx, dy) || 1;
    const m = [dy / l, -dx / l];
    const N = [P.A[0] * m[0] + P.B[0] * m[1], P.A[1] * m[0] + P.B[1] * m[1], P.A[2] * m[0] + P.B[2] * m[1]];
    en.push(N);
    vis.push(p.depth > 0.0001 && dot3(N, VIEW) > 1e-6);
  }

  // Gradient axis: perpendicular to the on-screen extrusion direction.
  const e0 = proj(ext[0], ext[1], ext[2]);
  const el = Math.hypot(e0[0], e0[1]) || 1;
  const gx = -e0[1] / el, gy = e0[0] / el;
  const gOf = (s) => s[0] * gx + s[1] * gy;

  // Collect chains of consecutive visible walls.
  const chains = [];
  if (vis.some(Boolean)) {
    let start = 0;
    if (vis.every(Boolean)) start = 0;
    else while (!(vis[start] && !vis[(start - 1 + n) % n])) start++;
    let cur = null;
    for (let k = 0; k < n; k++) {
      const i = (start + k) % n;
      if (vis[i]) {
        if (!cur) { cur = [i]; chains.push(cur); }
        cur.push((i + 1) % n);
      } else cur = null;
    }
  }

  const smoothCos = 0.84;
  const tone = (N) => toneFor(mat, norm3(N), blend);
  let out = '';
  const bands = [];
  for (const ch of chains) {
    // split where the gradient coordinate stops being monotonic
    const parts = [];
    let part = [ch[0]], dir = 0;
    for (let k = 1; k < ch.length; k++) {
      const d = gOf(capS[ch[k]]) - gOf(capS[ch[k - 1]]);
      const sgn = Math.abs(d) < 0.01 ? 0 : Math.sign(d);
      if (dir && sgn && sgn !== dir) { parts.push(part); part = [ch[k - 1]]; dir = sgn; }
      else if (!dir) dir = sgn;
      part.push(ch[k]);
    }
    parts.push(part);
    for (const vs of parts) if (vs.length >= 2) bands.push(vs);
  }
  const depthOf = (vs) => {
    let s = 0;
    for (const i of vs) s += base[i][0] + base[i][1] + base[i][2];
    return s / vs.length;
  };
  bands.sort((a, b) => depthOf(a) - depthOf(b));

  const ol = p.outline === false ? 0 : theme.outline;
  const strokeAttr = ol ? ` stroke="${mat.ink}" stroke-width="${ol}" stroke-linejoin="round"` : '';
  const creases = [];
  const rims = [];

  for (const vs of bands) {
    const g = vs.map((i) => gOf(capS[i]));
    const g0 = Math.min(...g), g1 = Math.max(...g), span = g1 - g0 || 1;
    const stops = [];
    for (let k = 0; k < vs.length; k++) {
      const i = vs[k];
      const prevEdge = (i - 1 + n) % n, nextEdge = i; // edges touching vertex i
      const nPrev = en[prevEdge], nNext = en[nextEdge];
      const smooth = dot3(nPrev, nNext) > smoothCos;
      const off = (g[k] - g0) / span;
      if (smooth) stops.push([off, tone(add3(nPrev, nNext))]);
      else {
        if (k > 0) stops.push([off, tone(nPrev)]);
        if (k < vs.length - 1) stops.push([off, tone(nNext)]);
        if (k > 0 && k < vs.length - 1) creases.push(i);
      }
    }
    stops.sort((a, b) => a[0] - b[0]);
    // drop redundant interior stops on smooth runs
    const slim = stops.filter((s, k) => k === 0 || k === stops.length - 1 || !(stops[k - 1][1] === s[1] && stops[k + 1][1] === s[1]));
    const poly = [...vs.map((i) => capS[i]), ...[...vs].reverse().map((i) => baseS[i])];
    const d = polyPath(poly);
    let fill;
    if (slim.every((s) => s[1] === slim[0][1])) fill = slim[0][1];
    else {
      const a = [gx * g0, gy * g0], b = [gx * g1, gy * g1];
      const key = `lg|${f(a[0])},${f(a[1])},${f(b[0])},${f(b[1])}|${slim.map((s) => r2(s[0]) + s[1]).join(',')}`;
      const id = ctx.def(key, (id) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(a[0])}" y1="${f(a[1])}" x2="${f(b[0])}" y2="${f(b[1])}">${slim.map((s) => `<stop offset="${r2(s[0])}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`);
      fill = `url(#${id})`;
    }
    out += `<path d="${d}" fill="${fill}"${strokeAttr}/>`;
    if (!ol && theme.shade.ao && plane === 'top' && p.depth >= 0.3 && p.ao !== false) {
      const id = ctx.def('ao', (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.3" stop-color="${theme.shadow.color}" stop-opacity="0"/><stop offset="1" stop-color="${theme.shadow.color}" stop-opacity="${theme.shade.ao}"/></linearGradient>`);
      out += `<path d="${d}" fill="url(#${id})"/>`;
    }
    rims.push(vs.map((i) => capS[i]));
  }

  for (const i of creases) {
    if (ol) out += `<path d="M${f(capS[i][0])} ${f(capS[i][1])}L${f(baseS[i][0])} ${f(baseS[i][1])}" stroke="${mat.ink}" stroke-width="${ol}" stroke-linecap="round" fill="none"/>`;
    else if (theme.rim && p.depth >= 0.25) out += `<path d="M${f(capS[i][0])} ${f(capS[i][1] + 1)}L${f(baseS[i][0])} ${f(baseS[i][1] - 1)}" stroke="${mat.rim}" stroke-opacity="${r2(theme.rim * 0.35)}" stroke-width="1" fill="none"/>`;
  }

  // Cap (the face that looks at the viewer).
  if (p.cap !== false) {
    const capTone = toneFor(capMat, P.N, blend);
    let capFill = capTone;
    if (p.flatCap !== true && !ol && !theme.flat) {
      const hi = plane === 'top' ? capMat.topLight : adjust(capTone, { dl: theme.dark ? 0.03 : 0.015 });
      const lo = plane === 'top' ? capMat.topShade : adjust(capTone, { dl: theme.dark ? -0.035 : -0.03 });
      const dir = plane === 'top' ? 'x1="0" y1="0" x2="1" y2="1"' : 'x1="0" y1="0" x2="0" y2="1"';
      const id = ctx.def(`cap|${plane}|${hi}|${lo}`, (id) => `<linearGradient id="${id}" ${dir}><stop offset="0" stop-color="${hi}"/><stop offset="1" stop-color="${lo}"/></linearGradient>`);
      capFill = `url(#${id})`;
    }
    const seal = ol ? strokeAttr.replace(mat.ink, capMat.ink) : ` stroke="${capTone}" stroke-width="0.6" stroke-linejoin="round"`;
    out += `<path d="${polyPath(capS)}" fill="${capFill}"${seal}/>`;
    if (!ol && theme.rim && p.rim !== false) {
      for (const rim of rims) out += `<path d="${polyPath(rim, false)}" fill="none" stroke="${capMat.rim}" stroke-opacity="${theme.rim}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  }
  if (p.decals) for (const dcl of p.decals) out += renderDecal(ctx, dcl);
  return out;
}

// ---------------------------------------------------------------- mesh (convex polyhedron)

export function meshBox(p) {
  let b = null;
  for (const face of p.faces) for (const q of face) b = b ? aabb(Math.min(b.x0, q[0]), Math.min(b.y0, q[1]), Math.min(b.z0, q[2]), Math.max(b.x1, q[0]), Math.max(b.y1, q[1]), Math.max(b.z1, q[2])) : aabb(...q, ...q);
  return b;
}

export function renderMesh(ctx, p) {
  const { theme } = ctx;
  const mat = ctx.mat(p.color || 'body');
  const ol = theme.outline;
  let out = '';
  const faces = [];
  for (const face of p.faces) {
    const N = norm3(cross3(sub3(face[1], face[0]), sub3(face[2], face[0])));
    if (dot3(N, VIEW) <= 1e-6) continue;
    const c = face.reduce((s, q) => s + q[0] + q[1] + q[2], 0) / face.length;
    faces.push({ face, N, c });
  }
  faces.sort((a, b) => a.c - b.c);
  for (const { face, N } of faces) {
    const tone = toneFor(mat, N, blend);
    const stroke = ol ? ` stroke="${mat.ink}" stroke-width="${ol}"` : ` stroke="${tone}" stroke-width="0.6"`;
    out += `<path d="${polyPath(face.map(projP))}" fill="${tone}"${stroke} stroke-linejoin="round"/>`;
  }
  if (!ol && theme.rim && p.rimEdges) {
    for (const edge of p.rimEdges) out += `<path d="${polyPath(edge.map(projP), false)}" fill="none" stroke="${mat.rim}" stroke-opacity="${theme.rim}" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return out;
}

// ---------------------------------------------------------------- sphere

export const sphereBox = (p) => aabb(p.c[0] - p.r, p.c[1] - p.r, p.c[2] - p.r, p.c[0] + p.r, p.c[1] + p.r, p.c[2] + p.r);

export function renderSphere(ctx, p) {
  const { theme } = ctx;
  const mat = ctx.mat(p.color || 'body');
  const [cx, cy] = projP(p.c);
  const R = p.r * UNIT * SPHERE_K;
  const ol = theme.outline;
  let fill;
  if (ol) {
    const id = ctx.def(`sphL|${mat.top}|${mat.right}`, (id) => `<radialGradient id="${id}" cx="0.36" cy="0.32" r="0.8"><stop offset="0.55" stop-color="${mat.top}"/><stop offset="1" stop-color="${mat.right}"/></radialGradient>`);
    fill = `url(#${id})`;
  } else {
    const hi = adjust(mat.top, { dl: theme.dark ? 0.1 : 0.02 });
    const id = ctx.def(`sph|${hi}|${mat.left}|${mat.right}|${mat.under}`, (id) => `<radialGradient id="${id}" cx="0.34" cy="0.28" r="0.82"><stop offset="0" stop-color="${hi}"/><stop offset="0.38" stop-color="${mat.top}"/><stop offset="0.72" stop-color="${mat.left}"/><stop offset="1" stop-color="${mat.under}"/></radialGradient>`);
    fill = `url(#${id})`;
  }
  let out = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(R)}" fill="${fill}"${ol ? ` stroke="${mat.ink}" stroke-width="${ol}"` : ''}/>`;
  if (!ol && theme.rim && p.shine !== false) {
    out += `<ellipse cx="${f(cx - R * 0.34)}" cy="${f(cy - R * 0.42)}" rx="${f(R * 0.2)}" ry="${f(R * 0.11)}" transform="rotate(-35 ${f(cx - R * 0.34)} ${f(cy - R * 0.42)})" fill="#ffffff" fill-opacity="${theme.dark ? 0.32 : 0.6}"/>`;
  }
  return out;
}

// ---------------------------------------------------------------- cone / frustum

export const coneBox = (p) => {
  const r = Math.max(p.r0, p.r1 || 0);
  const o = p.o || [0, 0, 0];
  return aabb(o[0] - r, o[1] - r, o[2], o[0] + r, o[1] + r, o[2] + p.h);
};

export function renderCone(ctx, p) {
  const { theme } = ctx;
  const mat = ctx.mat(p.color || 'body');
  const o = p.o || [0, 0, 0];
  const r0 = p.r0, r1c = p.r1 || 0, h = p.h;
  const ring = circleOutline(1, 0, 0, 48);
  const n = ring.length;
  const slope = (r0 - r1c) / h; // > 0 narrows toward the top
  const bot = ring.map(([c, s]) => [o[0] + c * r0, o[1] + s * r0, o[2]]);
  const top = ring.map(([c, s]) => [o[0] + c * r1c, o[1] + s * r1c, o[2] + h]);
  const normalAt = (c, s) => norm3([c, s, slope]);
  const vis = ring.map((_, i) => {
    const a = ((i + 0.5) / n) * Math.PI * 2;
    return dot3(normalAt(Math.cos(a), Math.sin(a)), VIEW) > 1e-6;
  });
  let out = '';
  const ol = theme.outline;
  if (vis.some(Boolean) && !vis.every(Boolean)) {
    let start = 0;
    while (!(vis[start] && !vis[(start - 1 + n) % n])) start++;
    const vs = [start];
    for (let k = 0; k < n && vis[(start + k) % n]; k++) vs.push((start + k + 1) % n);
    const bs = vs.map((i) => projP(bot[i])), ts = vs.map((i) => projP(top[i]));
    const xs = [...bs, ...ts].map((q) => q[0]);
    const g0 = Math.min(...xs), g1 = Math.max(...xs);
    const stops = vs.map((i, k) => [(bs[k][0] - g0) / (g1 - g0 || 1), toneFor(mat, normalAt(ring[i][0], ring[i][1]), blend)]).sort((a, b) => a[0] - b[0]);
    const slim = stops.filter((_, k) => k % 3 === 0 || k === stops.length - 1);
    const id = ctx.def(`cone|${f(g0)}|${f(g1)}|${slim.map((s) => r2(s[0]) + s[1]).join(',')}`, (id) => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(g0)}" y1="0" x2="${f(g1)}" y2="0">${slim.map((s) => `<stop offset="${r2(s[0])}" stop-color="${s[1]}"/>`).join('')}</linearGradient>`);
    const poly = r1c > 0.001 ? [...ts, ...[...bs].reverse()] : [projP([o[0], o[1], o[2] + h]), ...[...bs].reverse()];
    out += `<path d="${polyPath(poly)}" fill="url(#${id})"${ol ? ` stroke="${mat.ink}" stroke-width="${ol}" stroke-linejoin="round"` : ''}/>`;
  }
  if (r1c > 0.001) {
    const capS = top.map(projP);
    const tone = toneFor(mat, [0, 0, 1], blend);
    out += `<path d="${polyPath(capS)}" fill="${tone}"${ol ? ` stroke="${mat.ink}" stroke-width="${ol}"` : ` stroke="${tone}" stroke-width="0.6"`}/>`;
    if (!ol && theme.rim) out += `<path d="${polyPath(capS)}" fill="none" stroke="${mat.rim}" stroke-opacity="${r2(theme.rim * 0.7)}" stroke-width="1"/>`;
  }
  return out;
}

// ---------------------------------------------------------------- 3D polyline

export const lineBox = (p) => {
  let b = null;
  for (const q of p.pts) b = b ? aabb(Math.min(b.x0, q[0]), Math.min(b.y0, q[1]), Math.min(b.z0, q[2] || 0), Math.max(b.x1, q[0]), Math.max(b.y1, q[1]), Math.max(b.z1, q[2] || 0)) : aabb(q[0], q[1], q[2] || 0, q[0], q[1], q[2] || 0);
  return b;
};

export function renderLine(ctx, p) {
  const color = p.stroke || ctx.theme.ink;
  return `<path d="${polyPath(p.pts.map(projP), !!p.close)}" fill="${p.fill || 'none'}" stroke="${color}" stroke-width="${p.sw || 1.5}" stroke-linecap="round" stroke-linejoin="round"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''}${p.op != null ? ` opacity="${p.op}"` : ''}${attrs(p, ctx)}/>`;
}

// ---------------------------------------------------------------- flat artwork on a plane

const attrs = (it, ctx) => {
  const style = [it.style, it.anim && ctx ? ctx.animStyle(it.anim, it.flat !== false) : ''].filter(Boolean).join(';');
  return (it.cls ? ` class="${it.cls}"` : '') + (style ? ` style="${style}"` : '') + (it.id ? ` id="${it.id}"` : '');
};
// colours in artwork may be palette roles ('accent', 'gold', 'danger', ...) as well as hex values
const col = (v, ctx) => (ctx && v && ctx.theme.roles[v] ? ctx.theme.roles[v] : v);
const paint = (raw, ctx) => {
  const it = { ...raw, fill: col(raw.fill, ctx), stroke: col(raw.stroke, ctx) };
  let s;
  if (it.fade && it.fill && ctx) {
    // fade: [x1, y1, x2, y2] — the fill is at full strength at the first point and gone at the second
    const [x1, y1, x2, y2] = it.fade, op = it.fillOp ?? 1;
    const id = ctx.def(`fade|${it.fill}|${it.fade.join(',')}|${op}`, (gid) => `<linearGradient id="${gid}" gradientUnits="userSpaceOnUse" x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}"><stop offset="0" stop-color="${it.fill}" stop-opacity="${op}"/><stop offset="1" stop-color="${it.fill}" stop-opacity="0"/></linearGradient>`);
    s = ` fill="url(#${id})"`;
  } else {
    s = ` fill="${it.fill || 'none'}"`;
    if (it.fillOp != null && it.fillOp < 1) s += ` fill-opacity="${it.fillOp}"`;
  }
  if (it.stroke) s += ` stroke="${it.stroke}" stroke-width="${it.sw ?? 0.04}" stroke-linecap="round" stroke-linejoin="round"`;
  if (it.dash) s += ` stroke-dasharray="${it.dash}"`;
  if (it.op != null && it.op < 1) s += ` opacity="${it.op}"`;
  return s;
};

export function renderFlat(ctx, items) {
  let out = '';
  for (const it of items) {
    if (!it) continue;
    switch (it.t) {
      case 'rect':
        out += `<rect x="${r2(it.x)}" y="${r2(it.y)}" width="${r2(it.w)}" height="${r2(it.h)}"${it.r ? ` rx="${r2(Math.min(it.r, it.w / 2, it.h / 2))}"` : ''}${paint(it, ctx)}${attrs(it, ctx)}/>`;
        break;
      case 'circle':
        out += `<circle cx="${r2(it.cx)}" cy="${r2(it.cy)}" r="${r2(it.r)}"${paint(it, ctx)}${attrs(it, ctx)}/>`;
        break;
      case 'ellipse':
        out += `<ellipse cx="${r2(it.cx)}" cy="${r2(it.cy)}" rx="${r2(it.rx)}" ry="${r2(it.ry)}"${paint(it, ctx)}${attrs(it, ctx)}/>`;
        break;
      case 'line':
        out += `<path d="M${r2(it.x1)} ${r2(it.y1)}L${r2(it.x2)} ${r2(it.y2)}"${paint({ ...it, fill: 'none', stroke: it.stroke || '#000' }, ctx)}${attrs(it, ctx)}/>`;
        break;
      case 'path':
        out += `<path d="${it.d}"${paint(it, ctx)}${it.rule ? ` fill-rule="${it.rule}"` : ''}${attrs(it, ctx)}/>`;
        break;
      case 'poly':
        out += `<path d="M${it.pts.map((q) => `${r2(q[0])} ${r2(q[1])}`).join('L')}${it.open ? '' : 'Z'}"${paint(it, ctx)}${attrs(it, ctx)}/>`;
        break;
      case 'text': {
        const size = it.size || 0.3;
        if (ctx && ctx.sawText) ctx.sawText(size, it.text);
        out += `<text x="${r2(it.x)}" y="${r2(it.y)}" font-size="${r2(size)}" font-family="${esc(it.mono ? ctx.theme.mono : ctx.theme.font)}" font-weight="${it.weight || 700}" text-anchor="${it.anchor || 'middle'}" dominant-baseline="central" fill="${col(it.fill, ctx) || '#000'}"${it.ls ? ` letter-spacing="${it.ls}"` : ''}${it.op != null ? ` opacity="${it.op}"` : ''}${attrs(it, ctx)}>${esc(it.text)}</text>`;
        break;
      }
      case 'icon': {
        const ic = ICONS[it.name];
        if (!ic) throw new Error(`Unknown icon "${it.name}".`);
        const s = (it.size || 0.6) / 24;
        const color = it.color || '#000';
        out += `<g transform="translate(${r2(it.x - (it.size || 0.6) / 2)} ${r2(it.y - (it.size || 0.6) / 2)}) scale(${+s.toFixed(4)})" fill="none" stroke="${color}" stroke-width="${it.sw || 2.2}" stroke-linecap="round" stroke-linejoin="round"${it.op != null ? ` opacity="${it.op}"` : ''}${attrs(it, ctx)}>${ic.replace(/\{c\}/g, color)}</g>`;
        break;
      }
      case 'g': {
        const tf = (it.tx || it.ty ? `translate(${r2(it.tx || 0)} ${r2(it.ty || 0)})` : '') + (it.rot ? ` rotate(${r2(it.rot)})` : '') + (it.scale ? ` scale(${it.scale})` : '');
        const open = `<g${tf ? ` transform="${tf.trim()}"` : ''}${it.op != null ? ` opacity="${it.op}"` : ''}${it.clip ? ` clip-path="url(#${ctx.clipId(it.clip)})"` : ''}`;
        // An animated transform would replace the placement transform, so animate an inner group.
        if (it.anim) out += `${open}><g${attrs(it, ctx)}>${renderFlat(ctx, it.items)}</g></g>`;
        else out += `${open}${attrs(it, ctx)}>${renderFlat(ctx, it.items)}</g>`;
        break;
      }
      case 'bar': {
        // a bar that fills to a level: fixed (level) or changing over the period (levels: [[at, value, ease], ...])
        const w = it.w ?? 0.2, h = it.h ?? 1, side = it.from === 'left';
        const lv = it.levels ? it.levels.map(([at, v, ease]) => ({ [it.seconds ? 't' : 'at']: at, [side ? 'scaleX' : 'scaleY']: Math.max(0.001, v), [side ? 'scaleY' : 'scaleX']: 1, ease: ease || 'inOut' })) : null;
        const still = `scale(${side ? r2(it.level ?? 1) : 1} ${side ? 1 : r2(it.level ?? 1)})`;
        if (it.track !== false) out += `<rect x="${r2(it.x)}" y="${r2(it.y)}" width="${r2(w)}" height="${r2(h)}"${it.r ? ` rx="${r2(it.r)}"` : ''} fill="${col(it.track || it.fill || '#000', ctx)}" fill-opacity="${it.track ? 1 : 0.16}"/>`;
        const style = lv && ctx ? ctx.animStyle({ type: 'keys', period: it.period, phase: it.phase, delay: it.delay, keys: lv }, true) : '';
        out += `<g transform="translate(${r2(it.x)} ${r2(it.y + h)})"><rect x="0" y="${r2(-h)}" width="${r2(w)}" height="${r2(h)}"${it.r ? ` rx="${r2(it.r)}"` : ''} fill="${col(it.fill || '#000', ctx)}"${style ? ` style="${style}"` : ` transform="${still}"`}/></g>`;
        break;
      }
      case 'readout': {
        // text that changes over the period: values: [[at, 'text'], ...]; each shows until the next takes over
        const vals = [...(it.values || [])].sort((a, b) => a[0] - b[0]);
        const size = it.size || 0.3;
        if (ctx && ctx.sawText && vals.length) ctx.sawText(size, vals[0][1]);
        vals.forEach(([at, text], i) => {
          // the last value stays until the first comes round again
          const until = i < vals.length - 1 ? vals[i + 1][0] : vals[0][0] > 0 ? 'wrap-first' : null;
          const style = ctx && vals.length > 1 ? ctx.animStyle({ type: 'show', period: it.period, phase: it.phase, delay: it.delay, seconds: !!it.seconds, from: at, to: until, first: vals[0][0] }, true) : '';
          out += `<text x="${r2(it.x)}" y="${r2(it.y)}" font-size="${r2(size)}" font-family="${esc(it.mono === false ? ctx.theme.font : ctx.theme.mono)}" font-weight="${it.weight || 700}" text-anchor="${it.anchor || 'middle'}" dominant-baseline="central" fill="${col(it.fill || '#000', ctx)}"${style ? ` style="${style}"` : ''}>${esc(String(text))}</text>`;
        });
        break;
      }
      case 'raw':
        out += it.svg;
        break;
      default:
        throw new Error(`Unknown flat item type "${it.t}". Use rect, circle, ellipse, line, path, poly, text, icon, bar, readout or g.`);
    }
  }
  return out;
}

/** Flat artwork placed on a plane: { plane, o: [x, y, z], turn, items }. */
export function renderDecal(ctx, d) {
  if (!d || !d.items || !d.items.length) return '';
  return `<g transform="${planeMatrix(d.plane || 'top', d.o || [0, 0, 0], d.turn || 0)}"${d.op != null ? ` opacity="${d.op}"` : ''}${attrs(d, ctx)}>${renderFlat(ctx, d.items)}</g>`;
}

export function decalBox(d) {
  const o = d.o || [0, 0, 0];
  const s = d.size || [1, 1];
  const P = PLANES[d.plane || 'top'];
  const q = add3(add3(o, mul3(P.U, s[0])), mul3(P.V, s[1]));
  const e = 0.012;
  const b = aabb(o[0], o[1], o[2], q[0], q[1], q[2]);
  return { x0: b.x0, y0: b.y0, z0: b.z0, x1: b.x1 + P.N[0] * e, y1: b.y1 + P.N[1] * e, z1: b.z1 + P.N[2] * e };
}

// ---------------------------------------------------------------- dispatch

export function primBox(p) {
  switch (p.t) {
    case 'prism': return prismBox(p);
    case 'mesh': return meshBox(p);
    case 'sphere': return sphereBox(p);
    case 'cone': return coneBox(p);
    case 'line': return lineBox(p);
    case 'decal': return decalBox(p);
    case 'raw': return p.box;
    case 'stream': {
      const e = (p.r ?? 0.06) + (typeof p.swing === 'number' ? p.swing : 0) + (p.jitter || 0);
      const xs = p.pts.map((q) => q[0]), ys = p.pts.map((q) => q[1]), zs = p.pts.map((q) => q[2] || 0);
      return aabb(Math.min(...xs) - e, Math.min(...ys) - e, Math.min(...zs) - e, Math.max(...xs) + e, Math.max(...ys) + e, Math.max(...zs) + e);
    }
    case 'group': {
      let b = null;
      for (const c of p.parts) {
        const cb = primBox(c);
        b = b ? aabb(Math.min(b.x0, cb.x0), Math.min(b.y0, cb.y0), Math.min(b.z0, cb.z0), Math.max(b.x1, cb.x1), Math.max(b.y1, cb.y1), Math.max(b.z1, cb.z1)) : cb;
      }
      return b;
    }
    default: throw new Error(`Unknown primitive "${p.t}".`);
  }
}

const boxUnion = (a, b) => (!a ? b : !b ? a : aabb(Math.min(a.x0, b.x0), Math.min(a.y0, b.y0), Math.min(a.z0, b.z0), Math.max(a.x1, b.x1), Math.max(a.y1, b.y1), Math.max(a.z1, b.z1)));
// how far artwork reaches from the origin of its group, for artwork that turns
const reach = (items) => {
  let r = 0;
  for (const it of items || []) {
    if (!it) continue;
    const pts = it.t === 'line' ? [[it.x1, it.y1], [it.x2, it.y2]] : it.t === 'poly' ? it.pts : it.t === 'rect' || it.t === 'bar' ? [[it.x, it.y], [it.x + (it.w || 0), it.y + (it.h || 0)]]
      : it.t === 'circle' ? [[(it.cx || 0) + it.r, it.cy || 0], [(it.cx || 0) - it.r, it.cy || 0], [it.cx || 0, (it.cy || 0) + it.r], [it.cx || 0, (it.cy || 0) - it.r]] : it.t === 'text' || it.t === 'icon' ? [[it.x || 0, it.y || 0]] : [];
    for (const q of pts) r = Math.max(r, Math.hypot(q[0] || 0, q[1] || 0));
    if (it.t === 'g') r = Math.max(r, Math.hypot(it.tx || 0, it.ty || 0) + reach(it.items) * (it.scale || 1));
  }
  return r;
};

/** The box a shape occupies over its whole motion, not only at rest: used to frame the picture. */
/**
 * Every box a shape occupies as it moves: at rest and at each place its keys or move take it (a disc for artwork
 * that turns, a ring for an orbit). The frame takes in each one on screen; one box round them all would also take in
 * corners the shape never visits, which for a move that is both across and up adds empty space above the picture.
 */
export function sweepBoxes(p) {
  if (!p) return [];
  let boxes = p.t === 'group' ? p.parts.filter(Boolean).flatMap(sweepBoxes) : [primBox(p)];
  if (p.t === 'decal') {
    // artwork that spins or swings sweeps a disc in its plane
    const P = PLANES[p.plane || 'top'], o = p.o || [0, 0, 0];
    for (const it of p.items || []) {
      if (!it || it.t !== 'g' || !it.anim || !['spin', 'swing', 'keys'].includes(it.anim.type)) continue;
      const R = reach(it.items) * (it.scale || 1), c = add3(add3(o, mul3(P.U, it.tx || 0)), mul3(P.V, it.ty || 0));
      const ext = [0, 1, 2].map((i) => R * Math.max(Math.abs(P.U[i]), Math.abs(P.V[i])));
      boxes.push(aabb(c[0] - ext[0], c[1] - ext[1], c[2] - ext[2], c[0] + ext[0], c[1] + ext[1], c[2] + ext[2]));
    }
  }
  const a = p.anim;
  if (a && boxes.length) {
    const rest = boxes;
    const moves = a.type === 'move' ? [a.by || [0, 0, 0.5]] : a.type === 'keys' ? (a.keys || []).map((k) => k.move).filter(Boolean) : [];
    for (const m of moves) boxes = boxes.concat(rest.map((b) => aabb(b.x0 + (m[0] || 0), b.y0 + (m[1] || 0), b.z0 + (m[2] || 0), b.x1 + (m[0] || 0), b.y1 + (m[1] || 0), b.z1 + (m[2] || 0))));
    if (a.type === 'orbit') {
      const r = a.r ?? 0.5, ax = a.axis || { right: 'x', left: 'y', top: 'z' }[a.plane] || 'x';
      boxes = rest.map((b) => aabb(b.x0 - (ax === 'x' ? 0 : r), b.y0 - (ax === 'y' ? 0 : r), b.z0 - (ax === 'z' ? 0 : r), b.x1 + (ax === 'x' ? 0 : r), b.y1 + (ax === 'y' ? 0 : r), b.z1 + (ax === 'z' ? 0 : r)));
    }
  }
  return boxes;
}

export function renderPrim(ctx, p) {
  let inner;
  switch (p.t) {
    case 'prism': inner = renderPrism(ctx, p); break;
    case 'mesh': inner = renderMesh(ctx, p); break;
    case 'sphere': inner = renderSphere(ctx, p); break;
    case 'cone': inner = renderCone(ctx, p); break;
    case 'line': inner = renderLine(ctx, { ...p, anim: null }); break;
    case 'decal': inner = renderDecal(ctx, p); break;
    case 'stream': inner = ctx.stream ? ctx.stream(p) : ''; break;
    case 'raw': {
      const [x, y] = projP(p.at);
      inner = `<g transform="translate(${f(x)} ${f(y)})${p.scale ? ` scale(${p.scale})` : ''}">${typeof p.svg === 'function' ? p.svg(ctx) : p.svg}</g>`;
      break;
    }
    case 'group':
      // sort: false draws the parts exactly as listed, back to front, for parts that slide inside one another
      inner = (p.sort === false ? p.parts.filter(Boolean) : depthSort(p.parts.filter(Boolean).map((c) => ({ aabb: primBox(c), c }))).map((it) => it.c)).map((c) => renderPrim(ctx, c)).join('');
      break;
    default: throw new Error(`Unknown primitive "${p.t}".`);
  }
  // a shape (or a group of shapes) can move as one: anim is given in world cells
  if (p.opacity != null && p.opacity < 1) inner = `<g opacity="${r2(Math.max(0, p.opacity))}">${inner}</g>`;
  if (p.anim && p.anim.type === 'orbit' && ctx.orbit) {
    // the shape circles the place where it was drawn, keeping its own orientation
    const b = primBox(p);
    return ctx.orbit(p.anim, [(b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, (b.z0 + b.z1) / 2], inner);
  }
  const w = p.wrap || (p.anim ? { anim: p.anim } : null);
  if (w) return `<g${attrs({ ...w, flat: false }, ctx)}>${inner}</g>`;
  return inner;
}

export { rgba, mix };
