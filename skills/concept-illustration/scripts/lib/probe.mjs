// Where is each moving part at a given moment? The same arithmetic the browser will do, done at
// build time, so a scene can state facts about its own motion (s.expect) and the build can print
// what moves, when and which way (--motion) without anyone having to judge it from a picture.

import { PLANES, UNIT, proj } from './geom.mjs';
import { snapPeriod, EASE_FN } from './motion.mjs';
import { primBox } from './prims.mjs';

const frac = (v) => v - Math.floor(v);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const easeFn = (name) => EASE_FN[name] || EASE_FN.inOut;
const lerp = (a, b, f) => a + (b - a) * f;
const DEFAULT_PERIOD = { move: 3, swing: 3, keys: 4, blink: 2.4, spin: 8, orbit: 4, ring: 2.4, march: 1.2 };
export const turnOf = (a) => (a.sense === 'ccw' || a.sense === 'anticlockwise' ? -1 : a.sense === 'cw' || a.sense === 'clockwise' ? 1 : a.dir === -1 ? -1 : 1);
const planeOf = (a) => a.plane || { x: 'right', y: 'left', z: 'top' }[a.axis || 'x'] || 'right';

export const periodOf = (a, T) => snapPeriod(a.period || DEFAULT_PERIOD[a.type] || T, T);

/** What an animation has done to its shape at scene time t: { move: [x, y, z], opacity, angle }. */
export function animAt(a, t, T) {
  const out = { move: [0, 0, 0], opacity: 1, angle: null };
  if (!a || !a.type) return out;
  const P = periodOf(a, T);
  const p = frac((t - (a.delay || 0)) / P + (a.phase || 0));
  const thereAndBack = () => {
    const h = clamp(a.hold ?? 0.15, 0, 0.45) * 0.5, e = easeFn(a.ease);
    return p < h ? 0 : p < 0.5 ? e((p - h) / (0.5 - h)) : p < 0.5 + h ? 1 : 1 - e((p - 0.5 - h) / (0.5 - h));
  };
  switch (a.type) {
    case 'move': { const f = thereAndBack(), by = a.by || [0, 0, 0.5]; out.move = [0, 1, 2].map((i) => (by[i] || 0) * f); break; }
    case 'swing': out.angle = lerp(a.from ?? -20, a.to ?? 20, thereAndBack()); break;
    case 'spin': out.angle = turnOf(a) * 360 * p; break;
    case 'keys': {
      const ks = [...(a.keys || [])].sort((x, y) => x.at - y.at);
      if (!ks.length) break;
      if (ks[0].at > 0) ks.unshift({ ...ks[0], at: 0 });
      if (ks[ks.length - 1].at < 1) ks.push({ ...ks[0], at: 1 });
      let op = 1;
      const filled = ks.map((k) => { if (k.opacity != null) op = k.opacity; return { ...k, move: k.move || [0, 0, 0], op, rotate: k.rotate ?? null }; });
      let i = filled.findIndex((k, j) => j < filled.length - 1 && p >= k.at && p <= filled[j + 1].at);
      if (i < 0) i = filled.length - 2;
      const k0 = filled[i], k1 = filled[i + 1], span = k1.at - k0.at;
      const f = span > 1e-9 ? easeFn(k0.ease)((p - k0.at) / span) : 1;
      out.move = [0, 1, 2].map((j) => lerp(k0.move[j] || 0, k1.move[j] || 0, f));
      out.opacity = lerp(k0.op, k1.op, clamp(f, 0, 1));
      if (k0.rotate != null || k1.rotate != null) out.angle = lerp(k0.rotate || 0, k1.rotate || 0, f);
      break;
    }
    case 'orbit': {
      const Pl = PLANES[planeOf(a)], r = a.r ?? 0.5, th = (((a.from || 0) + turnOf(a) * 360 * p) * Math.PI) / 180;
      out.move = [0, 1, 2].map((i) => Pl.U[i] * r * Math.cos(th) + Pl.V[i] * r * Math.sin(th));
      break;
    }
    case 'show': { const f0 = a.from ?? 0, f1 = a.to ?? 1; out.opacity = (f1 > 1 ? p >= f0 || p < f1 - 1 : p >= f0 && p < f1) ? 1 : 0; break; }
    case 'blink': out.opacity = lerp(1, a.min ?? 0.25, 0.5 - 0.5 * Math.cos(2 * Math.PI * p)); break;
    default: break;
  }
  return out;
}

/** Value of a story track at scene time t, eased as the browser eases it. */
function trackAt(track, t) {
  if (!track) return null;
  let cur = track.initial;
  for (const s of track.segs) {
    if (t >= s.t1) { cur = s.to; continue; }
    if (t > s.t0) {
      const from = s.from ?? cur, f = easeFn(s.ease)((t - s.t0) / Math.max(1e-9, s.t1 - s.t0));
      return Array.isArray(cur) ? cur.map((_, i) => lerp(from[i], s.to[i], f)) : lerp(from, s.to, f);
    }
    break;
  }
  return cur;
}

// the way a movement looks on the page
const AX = proj(1, 0, 0), ZK = -proj(0, 0, 1)[1];
const WORDS = ['to the right', 'toward the lower right', 'down the picture', 'toward the lower left', 'to the left', 'toward the upper left', 'up the picture', 'toward the upper right'];
export function inPicture(d) {
  const [sx, sy] = proj(d[0] || 0, d[1] || 0, d[2] || 0);
  if (Math.hypot(sx, sy) < 0.5) return 'no visible move';
  return WORDS[((Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) % 8) + 8) % 8];
}

export function makeProbe(sc, T) {
  // every named shape, and every shape that moves, with the groups it sits inside
  const entries = [];
  const walk = (ob, parts, chain) => {
    parts.forEach((p, i) => {
      if (!p) return;
      const here = [...chain, p];
      const label = p.name || `${p.t === 'prism' ? 'shape' : p.t}#${chain.length ? `${chain.map((c) => c._i).join('.')}.` : ''}${i + 1}`;
      Object.defineProperty(p, '_i', { value: i + 1, enumerable: false, configurable: true });
      if (p.name || p.anim || p.t === 'stream') entries.push({ ob, part: p, chain: here, label, named: !!p.name });
      if (p.t === 'group') walk(ob, p.parts, here);
      // artwork that moves: on a decal of its own, or on the faces of a box, cylinder or panel
      const art = (items, tag) => (items || []).forEach((it, j) => {
        if (!it) return;
        if (it.anim || it.name) entries.push({ ob, part: p, item: it, chain: here, label: it.name || `artwork#${tag}.${j + 1}`, named: !!it.name });
        if (it.t === 'g') art(it.items, `${tag}.${j + 1}`);
      });
      if (p.t === 'decal') art(p.items, `${i + 1}`);
      (p.decals || []).forEach((d, k) => art(d.items, `${i + 1}.${d.plane || k}`));
    });
  };
  for (const ob of sc.objs) walk(ob, ob.parts, []);

  const objAt = (ob, t) => {
    const mv = trackAt(ob.tracks.move, t) || [0, 0], lf = trackAt(ob.tracks.lift, t) || [0, 0];
    // a slide across the floor is stored in screen pixels; turn it back into cells
    const a = mv[0] / AX[0], b = mv[1] / AX[1];
    const op = ob.tracks.opacity ? trackAt(ob.tracks.opacity, t) : ob.hidden ? 0 : 1;
    return { x: ob.x + (a + b) / 2, y: ob.y + (b - a) / 2, z: ob.z - lf[1] / ZK, opacity: op };
  };

  const find = (ref, partName) => {
    const obj = ref && ref._iso ? ref : sc.objs.find((o) => o.id === ref);
    if (obj && !partName) return { ob: obj };
    const name = partName || ref;
    const hits = entries.filter((e) => (e.part.name === name || (e.item && e.item.name === name)) && (!obj || e.ob === obj));
    if (hits.length === 1) return hits[0];
    const known = [...new Set([...sc.objs.map((o) => o.id), ...entries.filter((e) => e.named).map((e) => e.label)])];
    if (!hits.length) throw new Error(`expect: nothing is called "${name}". Objects: ${sc.objs.map((o) => o.id).join(', ')}. Named parts: ${entries.filter((e) => e.named).map((e) => e.label).join(', ') || 'none (give a shape name: "…" to refer to it)'}.`);
    throw new Error(`expect: ${hits.length} parts are called "${name}". Say which object: at(object, "${name}"). Known names: ${known.join(', ')}.`);
  };

  /** Position (cells), opacity and turn angle of an object or a named part at scene time t. */
  const at = (ref, partName, t) => {
    const hit = find(ref, partName);
    const base = objAt(hit.ob, t);
    if (!hit.part) return base;
    const b = primBox(hit.part);
    const pos = [base.x + (b.x0 + b.x1) / 2, base.y + (b.y0 + b.y1) / 2, base.z + (b.z0 + b.z1) / 2];
    let opacity = base.opacity, angle = null;
    for (const node of hit.chain) {
      const m = animAt(node.anim, t, T);
      for (let i = 0; i < 3; i++) pos[i] += m.move[i];
      opacity *= m.opacity;
      if (m.angle != null) angle = m.angle;
    }
    if (hit.item) { const m = animAt(hit.item.anim, t, T); angle = (hit.item.rot || 0) + (m.angle || 0); opacity *= m.opacity; }
    return { x: pos[0], y: pos[1], z: pos[2], opacity, angle };
  };

  const n2 = (v) => +(+v).toFixed(2);
  const fmt = (v) => `(${n2(v.x)}, ${n2(v.y)}, ${n2(v.z)})`;

  /** Plain-language account of everything that moves by itself, for --motion. */
  const report = () => {
    const lines = [];
    for (const e of entries) {
      const a = e.item ? e.item.anim : e.part.anim;
      const who = `${e.ob.id} › ${e.label}`;
      if (e.part.t === 'stream' && !e.item) {
        const p = e.part, P = snapPeriod(p.period ?? 4, T), a0 = p.pts[0], a1 = p.pts[p.pts.length - 1];
        const way = p.closed ? `round a closed path, ${turnOf(p) === -1 ? 'against' : 'in'} the order its points are listed` : `${inPicture([a1[0] - a0[0], a1[1] - a0[1], (a1[2] || 0) - (a0[2] || 0)].map((v) => v * turnOf(p)))}`;
        lines.push(`  ${who}   particles, mode ${p.mode || 'drift'}: ${(p.mode || 'drift') === 'alternate' ? `rocking in place every ${n2(P)} s${p.wavelength ? `, the wave travelling ${way}` : ''}` : `travelling ${way}, ${n2(P)} s end to end`}`);
        if (!a) continue;
      }
      if (!a) continue;
      const P = periodOf(a, T);
      if (e.item && a.type === 'keys') {
        lines.push(`  ${who}   artwork with a keyed sequence, every ${n2(P)} s: ${(a.keys || []).map((k) => `${n2(k.at * P)} s${k.rotate != null ? ` turn ${k.rotate}°` : ''}${k.opacity != null ? ` opacity ${k.opacity}` : ''}${k.scale != null ? ` scale ${k.scale}` : ''}${k.move ? ` move [${k.move.join(', ')}]` : ''}`).join(' → ')}`);
        continue;
      }
      if (e.item || a.type === 'spin' || a.type === 'swing') {
        lines.push(`  ${who}   ${a.type === 'spin' ? `turns ${turnOf(a) === 1 ? 'clockwise' : 'anticlockwise'} as it appears in the picture, once every ${n2(P)} s` : a.type === 'swing' ? `swings between ${a.from ?? -20}° and ${a.to ?? 20}° every ${n2(P)} s (positive is clockwise in the picture)` : `${a.type}, every ${n2(P)} s`}`);
        continue;
      }
      if (a.type === 'orbit') {
        lines.push(`  ${who}   circles the ${a.axis || 'x'} axis ${turnOf(a) === 1 ? 'clockwise' : 'anticlockwise'} as it appears in the picture, radius ${a.r ?? 0.5}, once every ${n2(P)} s`);
        for (const q of [0, 0.25, 0.5, 0.75]) lines.push(`        ${(q * P).toFixed(2)} s  at ${fmt(atEntry(e, q * P))}`);
        continue;
      }
      if (a.type === 'move' || a.type === 'keys') {
        lines.push(`  ${who}   ${a.type === 'move' ? 'there and back' : 'keyed sequence'}, every ${n2(P)} s${a.phase ? `, running ${n2(a.phase * P)} s ahead` : ''}${a.delay ? `, held back ${n2(a.delay)} s` : ''}`);
        const marks = a.type === 'move' ? [0, 0.5] : [...new Set((a.keys || []).map((k) => clamp(k.at, 0, 1)))].sort((x, y) => x - y);
        let prev = null;
        for (const q of marks) {
          // the last key of a sequence falls on the instant it restarts: look just before, and call it the period's end
          const raw = (q - (a.phase || 0)) * P + (a.delay || 0), end = q >= 1 && !a.phase && !a.delay;
          const t = end ? P : ((raw % P) + P) % P, v = atEntry(e, end ? P - 1e-4 : t);
          const d = prev ? [v.x - prev.x, v.y - prev.y, v.z - prev.z] : null;
          lines.push(`        ${t.toFixed(2)} s  at ${fmt(v)}${v.opacity < 0.99 ? `  opacity ${n2(v.opacity)}` : ''}${d && Math.hypot(...d) > 0.01 ? `  moved ${n2(Math.hypot(...d))} ${inPicture(d)}` : d ? '  held' : ''}`);
          prev = v;
        }
        continue;
      }
      lines.push(`  ${who}   ${a.type}, every ${n2(P)} s`);
    }
    return lines;
  };
  const atEntry = (e, t) => {
    const base = objAt(e.ob, t), b = primBox(e.part);
    const pos = [base.x + (b.x0 + b.x1) / 2, base.y + (b.y0 + b.y1) / 2, base.z + (b.z0 + b.z1) / 2];
    let opacity = base.opacity;
    for (const node of e.chain) { const m = animAt(node.anim, t, T); for (let i = 0; i < 3; i++) pos[i] += m.move[i]; opacity *= m.opacity; }
    return { x: pos[0], y: pos[1], z: pos[2], opacity };
  };

  return { at, report, fmt, names: () => entries.filter((e) => e.named).map((e) => e.label) };
}
