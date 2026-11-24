// Where everything is on screen at a given moment: each object's and each moving part's outline,
// how much of it something in front hides, and how much of the frame the drawing fills.
// It feeds the composition checks and --layout, a text account of the picture for anyone who
// cannot look at the sheet.

import { proj, aabbShift, boxesOverlap, depthSort } from './geom.mjs';
import { primBox } from './prims.mjs';
import { pointAt } from './links.mjs';
import { EASE_FN } from './motion.mjs';
import { animAt, trackAt } from './probe.mjs';

// an animation that carries its shape somewhere, rather than turning, blinking or fading it in place
const moves = (a) => !!a && (a.type === 'move' || a.type === 'orbit' || (a.type === 'keys' && (a.keys || []).some((k) => k.move && k.move.some((v) => v))));

/** Convex outline of a box as it appears on screen (a hexagon for most boxes). */
function outline(b) {
  const pts = [];
  for (const x of [b.x0, b.x1]) for (const y of [b.y0, b.y1]) for (const z of [b.z0, b.z1]) pts.push(proj(x, y, z));
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, c) => (a[0] - o[0]) * (c[1] - o[1]) - (a[1] - o[1]) * (c[0] - o[0]);
  const half = (list) => { const h = []; for (const p of list) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } h.pop(); return h; };
  return [...half(pts), ...half([...pts].reverse())];
}

const inside = (poly, x, y) => {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const c = (b[0] - a[0]) * (y - a[1]) - (b[1] - a[1]) * (x - a[0]);
    if (Math.abs(c) < 1e-9) continue;
    if (sign === 0) sign = Math.sign(c); else if (Math.sign(c) !== sign) return false;
  }
  return poly.length > 2;
};

const boxOf = (polys) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of polys) for (const [x, y] of p) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1 };
};

/**
 * ctx: { sc, T, probe, movers, camera (Track or null), vb, strip (caption strip height), rank (Map: object or token piece -> drawing order), labels }
 * at(t) returns { items, frame } with items [{ id, kind, box, polys, opacity, hidden, by }], boxes in frame pixels.
 */
export function makeLayout({ sc, T, probe, movers, camera, vb, strip, rank, labels = [] }) {
  // the pieces each token is drawn in, with their places in the drawing order
  const segsOf = new Map();
  for (const [key, r] of rank) if (key && key.mv) segsOf.set(key.mv, [...(segsOf.get(key.mv) || []), { fa: key.fa, fb: key.fb, rank: r }]);
  // the drawing order of each object's own shapes, fixed from where they are drawn, as the compiler sorts them
  const partOrder = new Map();
  for (const ob of sc.objs) {
    const order = depthSort(ob.parts.map((p, i) => ({ aabb: primBox(p), i }))).map((it) => it.i);
    partOrder.set(ob, new Map(order.map((idx, k) => [idx, k])));
  }

  function at(t, { useCamera = true, occlusion = true } = {}) {
    const cam = camera && useCamera ? trackAt(camera, t) : null;
    const view = (pt) => (cam ? [cam[0] + cam[2] * pt[0], cam[1] + cam[2] * pt[1]] : pt);
    const items = [], solids = []; // solids: every shape outline, with what draws it and when
    for (const ob of sc.objs) {
      if (ob.free) continue;
      const base = probe.at(ob, null, t);
      // every shape's outline at time t; a shape that carries itself somewhere, or has a name, is also listed on its own
      const walkAll = (parts, off, op, top, name) => {
        const got = [];
        let allRaw = true;
        parts.forEach((p, i) => {
          if (!p) return;
          const m = animAt(p.anim, t, T), o2 = [off[0] + m.move[0], off[1] + m.move[1], off[2] + m.move[2]], op2 = op * m.opacity;
          const ti = top ?? i;
          const label = p.name || (moves(p.anim) ? `${p.t === 'prism' ? 'shape' : p.t}#${i + 1}` : null);
          let mine = [], art = p.t === 'raw';
          if (p.t === 'group') { mine = walkAll(p.parts, o2, op2, ti, label || name); art = mine.raw; }
          else {
            let b = aabbShift(primBox(p), o2);
            if (base.level < 1) b = { ...b, z1: Math.min(b.z1, ob.z + (ob.h || 0) * base.level) };
            if (b.z1 > b.z0) {
              const poly = outline(b).map(view);
              mine = [poly];
              if (op2 * base.opacity > 0.15) solids.push({ poly, ob, top: ti, box: b, part: label || name || null });
            }
          }
          if (label && mine.length && op2 * base.opacity > 0.15) items.push({ id: `${ob.id} › ${label}`, kind: 'part', ob, top: ti, polys: mine, opacity: op2 * base.opacity, raw: art });
          if (mine.length) allRaw = allRaw && art;
          got.push(...mine);
        });
        got.raw = allRaw && got.length > 0;
        return got;
      };
      const shapes = walkAll(ob.parts, [base.x, base.y, base.z], 1, null, null);
      if (shapes.length) items.push({ id: ob.id, kind: 'object', ob, polys: [...shapes], opacity: base.opacity, raw: shapes.raw });
    }
    // tokens on their way along a link
    for (const mv of movers) {
      const until = mv.stay ? mv.until : mv.t1;
      if (t < mv.t0 || t > until || !mv.local) continue;
      const u = Math.min(1, (t - mv.t0) / Math.max(1e-6, mv.t1 - mv.t0)), f = mv.ease === 'linear' ? u : (EASE_FN[mv.ease] || EASE_FN.inOut)(u);
      const b = aabbShift(mv.local, pointAt(mv.path, f));
      const poly = outline(b).map(view);
      // a token is drawn in one piece per straight run of its path, each with its own place in the drawing order; a hop goes over everything
      const seg = segsOf.get(mv)?.find((sg) => f >= sg.fa - 1e-9 && f <= sg.fb + 1e-9);
      const order = mv.path.arc || !seg ? Infinity : seg.rank;
      solids.push({ poly, token: true, order });
      items.push({ id: `the ${mv.as} token`, kind: 'token', as: mv.as, polys: [poly], opacity: 1, order });
    }
    // how much of each item is hidden by shapes drawn after it, in the order the compiler drew them
    const orderOf = (x) => (x.token || x.kind === 'token' ? x.order : rank.get(x.ob) ?? 0);
    const later = (it, s) => {
      if (it.kind === 'token' || s.token || s.ob !== it.ob) return orderOf(s) > orderOf(it);
      if (it.kind !== 'part') return false;
      const ord = partOrder.get(it.ob);
      return (ord.get(s.top) ?? 0) > (ord.get(it.top) ?? 0);
    };
    for (const it of items) {
      it.box = boxOf(it.polys);
      if (!occlusion) continue;
      const occ = solids.filter((s) => (it.kind === 'token' || s.ob !== it.ob || it.kind === 'part') && boxesOverlap(boxOf([s.poly]), it.box) && later(it, s));
      if (!occ.length) { it.hidden = 0; it.by = []; continue; }
      let n = 0, hid = 0;
      const byOb = new Map();
      const N = 14, { x0, y0, x1, y1 } = it.box;
      for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / N, y = y0 + ((j + 0.5) * (y1 - y0)) / N;
        if (!it.polys.some((pl) => inside(pl, x, y))) continue;
        n++;
        const hit = occ.find((s) => inside(s.poly, x, y));
        if (hit) { hid++; const who = hit.token ? 'a token' : hit.ob === it.ob ? `${hit.ob.id}${hit.part ? ` › ${hit.part}` : ''}` : hit.ob.id; byOb.set(who, (byOb.get(who) || 0) + 1); }
      }
      it.hidden = n ? hid / n : 0;
      it.by = [...byOb.entries()].sort((a, b) => b[1] - a[1]).map(([who]) => who);
    }
    const frame = { x0: vb.x0, y0: vb.y0, x1: vb.x1, y1: vb.y1 - strip };
    return { items, frame, solids };
  }

  /** Share of the frame (0 to 1) covered by the drawing at time t, sampled on a grid. */
  function fill(t) {
    const { solids, frame } = at(t);
    const NX = 72, NY = Math.max(24, Math.round((NX * (frame.y1 - frame.y0)) / (frame.x1 - frame.x0)));
    const boxes = solids.map((s) => ({ s, b: boxOf([s.poly]) }));
    let n = 0, hit = 0;
    const span = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
    for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
      const x = frame.x0 + ((i + 0.5) * (frame.x1 - frame.x0)) / NX, y = frame.y0 + ((j + 0.5) * (frame.y1 - frame.y0)) / NY;
      n++;
      if (boxes.some(({ s, b }) => x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 && inside(s.poly, x, y))) {
        hit++; span.x0 = Math.min(span.x0, x); span.x1 = Math.max(span.x1, x); span.y0 = Math.min(span.y0, y); span.y1 = Math.max(span.y1, y);
      }
    }
    return { share: hit / n, span, frame };
  }

  /**
   * Composition over the whole loop, sampled every 0.1 s: things that carry the story across the picture
   * but are too small to follow, and stretches in which nothing visibly moves.
   */
  function survey() {
    const fw = vb.x1 - vb.x0, n = Math.max(2, Math.ceil(T / 0.1));
    const trav = new Map();
    let prev = null, run = 0, start = 0;
    const stills = [];
    for (let i = 0; i <= n; i++) {
      const t = Math.min(T - 1e-3, i * 0.1);
      const seen = at(t, { occlusion: false }).items, flat = at(t, { occlusion: false, useCamera: false }).items;
      flat.forEach((it, k) => {
        const travelling = it.kind === 'token' ? it.as !== 'dot' : it.kind === 'object' ? !!it.ob.tracks.move : true;
        if (!travelling || it.raw || it.opacity < 0.3) return;
        const e = trav.get(it.id) || { c: [], s: [] }, sb = seen[k].box;
        e.c.push([(it.box.x0 + it.box.x1) / 2, (it.box.y0 + it.box.y1) / 2]);
        e.s.push(Math.max(sb.x1 - sb.x0, sb.y1 - sb.y0));
        trav.set(it.id, e);
      });
      const now = new Map(seen.filter((it) => it.opacity >= 0.15).map((it) => [it.id, it]));
      let moved = !prev || prev.size !== now.size;
      if (prev && !moved) for (const [id, it] of now) {
        const p = prev.get(id);
        if (!p) { moved = true; break; }
        const size = Math.max(it.box.x1 - it.box.x0, it.box.y1 - it.box.y0);
        if (Math.hypot((it.box.x0 + it.box.x1 - p.box.x0 - p.box.x1) / 2, (it.box.y0 + it.box.y1 - p.box.y0 - p.box.y1) / 2) > 0.8 || Math.abs(it.opacity - p.opacity) * size > 0.8 || Math.abs(size - Math.max(p.box.x1 - p.box.x0, p.box.y1 - p.box.y0)) > 0.8) { moved = true; break; }
      }
      prev = now;
      if (moved) { if (run > 0) stills.push([start, start + run]); run = 0; start = t; } else run = t - start;
    }
    if (run > 0) stills.push([start, start + run]);
    const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
    const small = [...trav.entries()].map(([id, e]) => {
      const xs = e.c.map((c) => c[0]), ys = e.c.map((c) => c[1]);
      return { id, size: median(e.s), travel: Math.hypot(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) };
    }).filter((e) => e.travel > Math.max(2 * e.size, 0.25 * fw) && e.size < 0.035 * fw).sort((a, b) => a.size - b.size);
    return { small, stills, fw };
  }

  // motion that the outlines above do not show: flows, particles, floating, artwork that turns, blinks or marches,
  // and anything drawn as raw SVG or with s.draw, whose real outline the engine does not know
  const continuous = sc.links.some((l) => l.o.flow) || sc.objs.some((ob) => {
    if (ob.float) return true;
    const busy = (parts) => (parts || []).some((p) => p && (p.t === 'stream' || (p.anim && (ob.free || p.t === 'raw' || !['keys', 'move', 'orbit'].includes(p.anim.type)))
      || [p, ...(p.decals || [])].some((d) => (d.items || []).some(function art(it) { return it && (it.anim || (it.items || []).some(art)); }))
      || (p.t === 'group' && busy(p.parts))));
    return busy(ob.parts);
  });

  return { at, fill, survey, continuous, labels, frame: { x0: vb.x0, y0: vb.y0, x1: vb.x1, y1: vb.y1 - strip } };
}

