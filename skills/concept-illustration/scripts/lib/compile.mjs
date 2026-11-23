// Turns a Scene into one self-contained SVG string (static artwork + CSS animation).

import {
  UNIT, SPHERE_K, proj, projP, r1, r2, depthSort, aabbScreen, aabbUnion, aabbShift, aabbIntersects,
  bbox2, unionBox, growBox, boxesOverlap, rectOutline, circleOutline, polyPath, textWidth, esc, planeMatrix, PLANES,
} from './geom.mjs';
import { material } from './themes.mjs';
import { KIT, PACKETS } from './kit.mjs';
import { renderPrim, primBox, renderPrism, sweepBox } from './prims.mjs';
import { buildPath, pointAt, reversePath } from './links.mjs';
import { Track, keyframes, snapPeriod, schedule, EASE, EASE_FN } from './motion.mjs';
import { rgba, mix } from './color.mjs';
import { ICONS } from './icons.mjs';
import { makeProbe, findCollisions, normKeys } from './probe.mjs';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function hull(points) {
  const p = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop(); lower.push(q); }
  for (const q of [...p].reverse()) { while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function hash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(36);
}

export function compile(sc) {
  const th = sc.theme, o = sc.opts, K = sc.K;
  // Ids must not collide when several scenes are inlined on one page, and must not change
  // between builds of the same scene: derive them from the scene's content.
  const uid = sc.id || 'iso' + hash(JSON.stringify([o, sc.objs.map((b) => [b.kind, b.x, b.y, b.z, b.opts.color, b.opts.accent, b.label, b.k]), sc.links.length, sc.zones.length, sc.steps ? JSON.stringify(sc.steps, (k, v) => (v && v._iso ? v.id : k === 'obj' ? undefined : v)).length : 0]));
  const notes = [...sc.notes];
  const note = (level, code, msg) => notes.push({ level, code, msg });
  const defs = new Map();
  const kfs = new Map();
  for (const ob of sc.objs) { ob.tracks = {}; ob.tints = []; ob.marks = []; ob.movedTo = null; }

  const def = (key, make) => {
    if (!defs.has(key)) { const id = `${uid}-d${defs.size.toString(36)}`; defs.set(key, { id, svg: make(id) }); }
    return defs.get(key).id;
  };
  const kf = (css) => {
    if (!kfs.has(css)) kfs.set(css, `${uid}-k${kfs.size.toString(36)}`);
    return kfs.get(css);
  };

  // ================================================================ 1. timeline

  const speed = sc.storyOpts.speed ?? 3.4;
  const movers = [], rings = [], captions = [], keyTimes = [], timeline = [], cameraSteps = [];
  const flows = [], nameOf = (end) => (end && end.obj ? end.obj.id : 'a point');
  let T = o.loop ?? 6;
  const sameEnd = (a, b) => (a.obj && b.obj ? a.obj === b.obj : !a.obj && !b.obj && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6);
  const pathFor = (st) => {
    if (st.route || st.via || st.arc) return sc._route(st.from, st.to, st);
    for (const lk of sc.links) {
      if (sameEnd(lk.a, st.from) && sameEnd(lk.b, st.to)) return lk.path;
      if (sameEnd(lk.a, st.to) && sameEnd(lk.b, st.from)) return reversePath(lk.path);
    }
    if (st.from.obj && st.to.obj) note('hint', 'send-no-link', `send(${st.from.obj.id} → ${st.to.obj.id}) has no link between the two objects, so the token crosses open floor. Add s.link(${st.from.obj.id}, ${st.to.obj.id}) so viewers see the route (steer it around other objects with route or via), or drop this step.`);
    return sc._route(st.from, st.to, {});
  };
  const track = (ob, name, prop, init) => ob.tracks[name] || (ob.tracks[name] = new Track(prop, init));
  const bump = (ob, t) => {
    const tr = track(ob, 'scale', 'scale', 1);
    const s = Math.max(t, tr.end);
    tr.fromTo(s, s + 0.14, 1, 1.07, 'out').to(s + 0.14, s + 0.44, 1, 'inOut');
  };

  if (sc.steps) {
    const durOf = (st) => {
      if (st.type === 'move') { const cur = st.obj; return clamp(Math.hypot(st.to[0] - cur.x, st.to[1] - cur.y) / (st.speed ?? speed), 0.5, 2.6); }
      if (st.type === 'zoom' && st.hold != null && st.to) return 2.2 + Math.max(0, +st.hold); // in, stay, out
      if (st.type !== 'send') return undefined;
      st._path = pathFor(st);
      const n = st.count ?? 1;
      return clamp(st._path.total / (st.speed ?? speed), 0.6, 2.6) + (n - 1) * (st.stagger ?? 0.22);
    };
    const { items, end, read } = schedule(sc.steps, 0.35, sc.storyOpts.gap ?? 0.12, durOf);
    // the last caption also gets its reading time before the loop restarts
    T = Math.max(end + (sc.storyOpts.hold ?? 0.9), read.since + read.need + 0.6, o.loop ?? 0);
    T = Math.ceil(T * 10) / 10;
    if (o.loop && T > o.loop + 0.05) note('hint', 'loop-longer', `loop: ${o.loop} was asked for, but the story needs ${r1(T)} s, so the loop is ${r1(T)} s. Anything timed against the loop (a period, a readout, a series of scenes meant to match) should use ${r1(T)}, or shorten the story.`);
    for (const st of items) {
      const who = (x) => (x && x.obj ? x.obj.id : x && x._iso ? x.id : Array.isArray(x) ? `[${x.join(', ')}]` : '');
      timeline.push({ t0: st.t0, t1: st.t1, text: st.type === 'say' ? `caption "${st.text}"` : st.type === 'send' ? `send ${who(st.from)} → ${who(st.to)}${st.as ? ` as ${st.as}` : ''}` : st.type === 'wait' ? 'wait' : st.type === 'zoom' ? (st.to ? `zoom in ${st.k}× on ${st.to._iso ? st.to.id : `[${st.to.join(', ')}]`}` : 'zoom back out') : `${st.type} ${who(st.obj)}${st.type === 'move' ? ` to [${st.to.join(', ')}]` : ''}` });
    }
    for (const st of items) {
      const ob = st.obj;
      switch (st.type) {
        case 'send': {
          if (!st._path) st._path = pathFor(st);
          const n = st.count ?? 1, stag = st.stagger ?? 0.22;
          const travel = st.t1 - st.t0 - (n - 1) * stag;
          for (let i = 0; i < n; i++) movers.push({ path: st._path, t0: st.t0 + i * stag, t1: st.t0 + i * stag + travel, as: st.as || 'dot', color: st.color || 'accent', ease: st.ease || 'inOut', label: i === 0 ? st.label : null, stay: !!st.stay, id: st.id || null, scale: st.scale });
          if (st.to.obj && st.react !== false) for (let i = 0; i < n; i++) bump(st.to.obj, st.t0 + i * stag + travel - 0.05);
          break;
        }
        case 'pulse':
          rings.push({ ob, t0: st.t0, dur: Math.max(0.5, st.t1 - st.t0), color: st.color || (ob.opts.color !== 'body' ? ob.opts.color : 'accent') });
          bump(ob, st.t0);
          break;
        case 'glow': {
          const tr = track(ob, 'glow', 'opacity', ob.hero || ob.opts.glow ? 1 : 0);
          ob.glowColor = st.color || ob.glowColor;
          tr.to(st.t0, st.t0 + 0.3, 1, 'out');
          if (!st.keep) tr.to(Math.max(st.t0 + 0.3, st.t1 - 0.45), st.t1, tr.initial, 'smooth');
          break;
        }
        case 'pop':
          track(ob, 'opacity', 'opacity', ob.hidden ? 0 : 1).fromTo(st.t0, st.t0 + 0.14, 0, 1, 'linear');
          track(ob, 'scale', 'scale', 1).fromTo(st.t0, st.t0 + 0.32, 0.5, 1.08, 'out').to(st.t0 + 0.32, st.t1, 1, 'inOut');
          break;
        case 'show': track(ob, 'opacity', 'opacity', ob.hidden ? 0 : 1).to(st.t0, st.t1, 1, 'smooth'); break;
        case 'hide': track(ob, 'opacity', 'opacity', ob.hidden ? 0 : 1).to(st.t0, st.t1, 0, 'smooth'); break;
        case 'zoom': {
          const focus = !st.to ? null : st.to._iso ? [st.to.x, st.to.y, st.to.z + st.to.h / 2] : [st.to[0], st.to[1], st.to[2] || 0];
          const both = st.hold != null && focus; // one step that goes in, stays and comes back
          cameraSteps.push({ t0: st.t0, t1: both ? st.t0 + 1.1 : st.t1, k: st.k, ease: st.ease || 'inOut', focus });
          if (both) cameraSteps.push({ t0: st.t1 - 1.1, t1: st.t1, k: 1, ease: st.ease || 'inOut', focus: null });
          keyTimes.push((both ? st.t0 + 1.1 : st.t1) + 0.15);
          break;
        }
        case 'lift': track(ob, 'lift', 'translate', [0, 0]).to(st.t0, st.t1, [0, -st.dz * UNIT], 'inOut'); break;
        case 'drop': track(ob, 'lift', 'translate', [0, 0]).to(st.t0, st.t1, [0, 0], 'inOut'); break;
        case 'tint': {
          let tint = ob.tints.find((t) => t.color === st.color);
          if (!tint) ob.tints.push((tint = { color: st.color, track: new Track('opacity', 0) }));
          tint.track.to(st.t0, st.t1, 1, 'smooth');
          break;
        }
        case 'shake': {
          const tr = track(ob, 'shake', 'translate', [0, 0]);
          const n = 6, d = (st.t1 - st.t0) / n;
          for (let i = 0; i < n; i++) tr.to(st.t0 + i * d, st.t0 + (i + 1) * d, i === n - 1 ? [0, 0] : [(i % 2 ? 5 : -5) * (1 - i / n), 0], 'sine');
          break;
        }
        case 'mark': {
          const mk = { icon: st.icon, color: st.color, op: new Track('opacity', 0), sc: new Track('scale', 1) };
          mk.op.fromTo(st.t0, st.t0 + 0.12, 0, 1, 'linear');
          mk.sc.fromTo(st.t0, st.t0 + 0.3, 0.4, 1.15, 'out').to(st.t0 + 0.3, st.t0 + 0.5, 1, 'inOut');
          if (st.keep === false) mk.op.to(st.t1, st.t1 + 0.3, 0, 'smooth');
          ob.marks.push(mk);
          break;
        }
        case 'move': {
          const [ax, ay] = proj(ob.x, ob.y, ob.z), [bx, by] = proj(st.to[0], st.to[1], ob.z + (st.to[2] || 0));
          track(ob, 'move', 'translate', [0, 0]).to(st.t0, st.t1, [bx - ax, by - ay], st.ease || 'inOut');
          (ob.movedTo || (ob.movedTo = [])).push([st.to[0] - ob.x, st.to[1] - ob.y, st.to[2] || 0]);
          break;
        }
        case 'grow': {
          const full = ob.h * UNIT;
          track(ob, 'grow', 'translate', [0, (1 - ob.level) * full]).to(st.t0, st.t1, [0, (1 - st.to) * full], 'inOut');
          break;
        }
        case 'say': captions.push({ text: st.text, t: st.t0 }); break;
        default: break;
      }
      // moments worth a frame on the contact sheet
      if (st.type === 'send') keyTimes.push(st.t0 + (st.t1 - st.t0) * 0.5);
      else if (['tint', 'mark', 'pop', 'show', 'grow', 'lift', 'glow'].includes(st.type)) keyTimes.push(st.t1 + 0.12);
      else if (st.type === 'pulse' || st.type === 'shake') keyTimes.push(st.t0 + 0.3);
    }
    for (const ob of sc.objs) {
      for (const tr of Object.values(ob.tracks)) tr.close(T);
      for (const t of ob.tints) t.track.close(T);
      for (const m of ob.marks) m.op.close(T);
    }
  }

  // ---- facts the scene states about its own motion (s.expect), checked with the browser's own arithmetic
  const probe = makeProbe(sc, T);
  for (const ex of sc.expects || []) {
    const span = Array.isArray(ex.t);
    const n = span ? Math.min(600, Math.max(2, Math.ceil((ex.t[1] - ex.t[0]) / 0.05) + 1)) : 1;
    for (let i = 0; i < n; i++) {
      const t = span ? ex.t[0] + ((ex.t[1] - ex.t[0]) * i) / (n - 1) : ex.t;
      const seen = [];
      const at = (ref, part) => {
        const v = probe.at(ref, part, t);
        seen.push(`${part || (ref && ref._iso ? ref.id : ref)} at ${probe.fmt(v)}${v.angle != null ? `, angle ${r1(v.angle)}°` : ''}${v.opacity < 0.99 ? `, opacity ${r2(v.opacity)}` : ''}`);
        return v;
      };
      let ok = false, why = '';
      try { ok = !!ex.test(at, t); } catch (e) { if (/^expect:/.test(e.message)) throw e; why = ` (the test threw: ${e.message})`; }
      if (!ok) { note('warn', 'expect', `Not true at ${r2(t)} s: ${ex.msg || 'an s.expect() test'}${why}. Found: ${seen.join('; ') || 'nothing was looked up'}.`); break; }
    }
  }

  for (const hit of findCollisions(sc, T)) {
    note('hint', 'passes-through', `${hit.a} passes through ${hit.b} at about ${r1(hit.t)} s (they overlap by ${r2(hit.depth)} cells). If they should not touch, change the timing or the path${hit.unnamed ? '; give the shapes name: "…" to see which they are in --motion' : ''}. If one is meant to slide inside the other, list both in one sh.group({ sort: false, parts: [...] }).`);
  }

  // ================================================================ 2. shared helpers

  const sorted = [...sc.objs].sort((a, b) => a.x + a.y - (b.x + b.y));
  const stagger = o.intro ? Math.min(0.07, 0.6 / Math.max(1, sorted.length)) : 0;
  const introEnd = o.intro ? r2(0.55 + sorted.length * stagger + 0.1) : 0;
  const introOf = new Map(sorted.map((ob, i) => [ob, i * stagger]));

  // One clock for everything. Scene time 0 is the moment the story starts, after the intro; every
  // repeating motion (moving parts, floats, flows) is timed against that same zero and is already
  // running while the scene arrives. `raw` is for the story itself, which waits for the intro.
  const loopStyle = (css, { period = T, delay = 0, ease = 'linear', raw = false, extra = '' } = {}) => {
    let d = delay;
    if (!raw) { d = (introEnd + delay) % period; if (d > 0) d -= period; }
    return `animation:${kf(css)} ${r2(period)}s ${ease} ${r2(d)}s infinite${extra} both`;
  };
  const storyStyle = (css) => loopStyle(css, { delay: introEnd, raw: true });
  // jostling: a few short, jerky side-steps shared between any number of particles
  const rnd = (n) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
  const jostle = (cells) => {
    const jpx = cells * UNIT;
    return {
      css: [0, 1, 2].map((v) => `0%{transform:translate(0px,0px)}${Array.from({ length: 6 }, (_, k) => `${r2(((k + 1) / 7) * 100)}%{transform:translate(${r2((rnd(v * 10 + k) - 0.5) * 2 * jpx)}px,${r2((rnd(v * 10 + k + 50) - 0.5) * 2 * jpx)}px)}`).join('')}100%{transform:translate(0px,0px)}`),
      P: [0.55, 0.7, 0.9].map((q) => snapPeriod(q, T)),
      wrap: function (dot, i) { return `<g style="${loopStyle(this.css[i % 3], { period: this.P[i % 3], delay: -rnd(i + 7) * this.P[i % 3] })}">${dot}</g>`; },
    };
  };
  // phase runs a part ahead (a fraction of its period already done at time 0); delay holds it back (seconds)
  const lagOf = (a, P) => -(a.phase || 0) * P + (a.delay || 0);
  // which way a turn goes, as it appears in the picture: 'cw' clockwise, 'ccw' anticlockwise
  const turnOf = (a) => (a.sense === 'ccw' || a.sense === 'anticlockwise' ? -1 : a.sense === 'cw' || a.sense === 'clockwise' ? 1 : a.dir === -1 ? -1 : 1);
  const trackStyle = (tr) => storyStyle(tr.css(T));
  // While the camera moves in, a label stays its own size and keeps to its anchor: it is scaled
  // back about that point by exactly as much as the camera scales the scene.
  const steady = (svg, ax, ay) => {
    if (!cameraSteps.length || !svg) return svg;
    const tr = new Track('camera', [0, 0, 1]);
    for (const c of cameraSteps) { const q = c.focus ? 1 / c.k : 1; tr.to(c.t0, c.t1, [ax * (1 - q), ay * (1 - q), q], c.ease); }
    tr.close(T);
    return `<g style="${trackStyle(tr)}">${svg}</g>`;
  };
  // Object labels step aside while the camera is in close (the caption says what is being looked at);
  // callouts, which name parts, stay.
  const aside = (svg) => {
    if (!cameraSteps.length || !svg) return svg;
    const tr = new Track('opacity', 1);
    for (const c of cameraSteps) tr.to(c.t0, c.t0 + Math.min(0.3, c.t1 - c.t0), c.focus && c.k > 1.15 ? 0 : 1, 'smooth');
    tr.close(T);
    return `<g style="${trackStyle(tr)}">${svg}</g>`;
  };
  const join = (...list) => list.filter(Boolean).join(',').replace(/,animation:/g, ',');

  const smallText = [];
  const ctx = {
    theme: th,
    // text drawn on faces: remember any that will be too small to read
    sawText(size, text) { if (size * UNIT < 8.5) smallText.push({ px: size * UNIT, text: String(text) }); },
    mat: (c) => material(th, c || 'body'),
    def,
    clipId: (k) => `${uid}-${k}`,
    // flat: the animated thing is artwork on a plane (units are cells in that plane);
    // otherwise it is a shape in space (moves are [dx, dy, dz] in cells and are projected).
    animStyle(a, flat = true) {
      const shift = (m) => (flat ? [(m[0] || 0), (m[1] || 0)] : proj(m[0] || 0, m[1] || 0, m[2] || 0));
      const tf = (k) => {
        const parts = [];
        if (k.move) { const [x, y] = shift(k.move); parts.push(`translate(${r2(x)}px,${r2(y)}px)`); }
        if (k.rotate != null) parts.push(`rotate(${r2(k.rotate)}deg)`);
        if (k.scaleX != null || k.scaleY != null) parts.push(`scale(${r2(k.scaleX ?? k.scale ?? 1)},${r2(k.scaleY ?? k.scale ?? 1)})`);
        else if (k.scale != null) parts.push(`scale(${r2(k.scale)})`);
        return `${parts.length ? `transform:${parts.join(' ')}` : 'transform:none'}${k.opacity != null ? `;opacity:${r2(k.opacity)}` : ''}`;
      };
      switch (a.type) {
        case 'move': case 'swing': {
          // there and back again, resting at each end
          const P = snapPeriod(a.period || 3, T), h = clamp(a.hold ?? 0.15, 0, 0.45) * 50;
          const A = a.type === 'move' ? { move: [0, 0, 0] } : { rotate: a.from ?? -20 };
          const B = a.type === 'move' ? { move: a.by || [0, 0, 0.5] } : { rotate: a.to ?? 20 };
          const e = `;animation-timing-function:${EASE[a.ease] || EASE.inOut}`;
          return loopStyle(`0%{${tf(A)}}${r2(h)}%{${tf(A)}${e}}50%{${tf(B)}}${r2(50 + h)}%{${tf(B)}${e}}100%{${tf(A)}}`, { period: P, delay: lagOf(a, P) });
        }
        case 'keys': {
          // a keyframed sequence: keys: [{ at: 0..1, move, rotate, scale, opacity, ease }]
          const P = snapPeriod(a.period || 4, T);
          const ks = normKeys(a, P);
          if (!ks.length) return '';
          const main = loopStyle(ks.map((k) => `${r2(clamp(k.at, 0, 1) * 100)}%{${tf(k)};animation-timing-function:${EASE[k.ease] || EASE.inOut}}`).join(''), { period: P, delay: lagOf(a, P) });
          if (!a.fade) return main;
          // fade: the part slips out just before its sequence restarts and back in after, hiding the jump
          const f = r2(clamp(a.fade === true ? 0.05 : a.fade, 0.01, 0.3) * 100);
          return join(main, loopStyle(`0%{opacity:0}${f}%{opacity:1}${r2(100 - f)}%{opacity:1}100%{opacity:0}`, { period: P, delay: lagOf(a, P) }));
        }
        case 'blink': {
          const P = snapPeriod(a.period || 2.4, T);
          return loopStyle(`0%,100%{opacity:1}50%{opacity:${a.min ?? 0.25}}`, { period: P, delay: lagOf(a, P), ease: 'ease-in-out' });
        }
        case 'spin': { const P = snapPeriod(a.period || 8, T); return loopStyle(`to{transform:rotate(${turnOf(a) * 360}deg)}`, { period: P, delay: lagOf(a, P) }); }
        case 'march': {
          // alternate: the dashes rock back and forth like alternating current, still at each turn
          if (a.alternate) {
            const P = snapPeriod(a.period || 2, T);
            let d = (introEnd + lagOf(a, P)) % P; if (d > 0) d -= P;
            return `animation:${kf(`from{stroke-dashoffset:${r2(a.len / 2)}}to{stroke-dashoffset:${r2(-a.len / 2)}}`)} ${r2(P / 2)}s ${EASE.sine} ${r2(d)}s infinite alternate both`;
          }
          return loopStyle(`to{stroke-dashoffset:${-a.len}}`, { period: snapPeriod(a.period || 1.2, T) });
        }
        case 'show': {
          // visible only between two fractions of the period, switching at once (an interval past 1 wraps round)
          const P = snapPeriod(a.period || T, T), div = a.seconds ? P : 1;
          const f0 = clamp((a.from ?? 0) / div, 0, 1), f1 = a.to === 'wrap-first' ? 1 + (a.first || 0) / div : a.to == null ? 1 : a.to / div;
          const css = f1 > 1
            ? `0%{opacity:1}${r2((f1 - 1) * 100)}%{opacity:0}${r2(f0 * 100)}%{opacity:1}100%{opacity:1}`
            : `0%{opacity:${f0 <= 0 ? 1 : 0}}${f0 > 0 ? `${r2(f0 * 100)}%{opacity:1}` : ''}${f1 < 1 ? `${r2(f1 * 100)}%{opacity:0}` : ''}100%{opacity:${f1 >= 1 ? 1 : 0}}`;
          return loopStyle(css, { period: P, delay: lagOf(a, P), ease: 'step-end' });
        }
        case 'ring': {
          const P = snapPeriod(a.period || 2.4, T);
          return loopStyle(`0%{transform:scale(.3);opacity:0}15%{opacity:.9}100%{transform:scale(1.25);opacity:0}`, { period: P, delay: lagOf(a, P), ease: 'ease-out' });
        }
        default: return '';
      }
    },
    /** Many particles on one path, sharing a handful of keyframes however many there are. */
    stream(p) {
      const pts = (p.pts || []).map((q) => [q[0], q[1], q[2] || 0]);
      const line = p.closed ? [...pts, pts[0]] : pts;
      const segs = []; let total = 0;
      for (let i = 0; i < line.length - 1; i++) {
        const a = line[i], b = line[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
        if (len > 1e-6) { segs.push({ a, b, len, s0: total }); total += len; }
      }
      if (!segs.length) return '';
      const at3 = (dist) => {
        const d = p.closed ? ((dist % total) + total) % total : clamp(dist, 0, total);
        const sg = segs.find((g) => d <= g.s0 + g.len + 1e-9) || segs[segs.length - 1], f = (d - sg.s0) / sg.len;
        return { pos: [0, 1, 2].map((i) => sg.a[i] + (sg.b[i] - sg.a[i]) * f), sg };
      };
      const mode = p.mode || 'drift';
      const P = snapPeriod(p.period ?? (p.speed ? total / p.speed : 4), T);
      const count = Math.max(1, Math.round(p.count ?? total / 0.6));
      const hex = th.roles[p.color || 'accent'] || p.color || th.roles.accent;
      const rpx = r1((p.r ?? 0.06) * UNIT);
      const halo = (p.glow ?? (th.dark && th.glow > 0)) ? `<circle r="${r1(rpx * 2.8)}" fill="url(#${glowGrad(hex, 0.7)})"/>` : '';
      const dot = `${halo}<circle r="${rpx}" fill="${hex}"${th.outline ? ` stroke="${th.ink}" stroke-width="1"` : ''}/>`;
      const lag = lagOf(p, P);
      let out = '';
      if (mode === 'alternate') {
        // every particle rocks about its own place; with a wavelength each lags the one before, so a wave travels
        const amp = typeof p.swing === 'number' ? p.swing : 0.25;
        for (let i = 0; i < count; i++) {
          const dist = ((i + 0.5) / count) * total, { pos, sg } = at3(dist);
          const u = Array.isArray(p.swing) ? p.swing : [0, 1, 2].map((k) => ((sg.b[k] - sg.a[k]) / sg.len) * amp);
          const [dx, dy] = proj(u[0] || 0, u[1] || 0, u[2] || 0), [px, py] = projP(pos);
          let d = (introEnd + lag + (p.wavelength ? (dist / p.wavelength) * P : 0)) % P; if (d > 0) d -= P;
          const css = `from{transform:translate(${r2(-dx)}px,${r2(-dy)}px)}to{transform:translate(${r2(dx)}px,${r2(dy)}px)}`;
          out += `<g transform="translate(${r1(px)} ${r1(py)})"><g style="animation:${kf(css)} ${r2(P / 2)}s ${EASE.sine} ${r2(d)}s infinite alternate both">${dot}</g></g>`;
        }
        return out;
      }
      const back = turnOf(p) === -1;
      const verts = [{ v: line[0], d: 0 }, ...segs.map((g) => ({ v: g.b, d: g.s0 + g.len }))];
      const stops = (back ? [...verts].reverse().map((q) => ({ v: q.v, d: total - q.d })) : verts).map((q) => [(q.d / total) * P, projP(q.v)]);
      const css = keyframes('translate', stops, P);
      const fade = p.closed ? '' : keyframes('opacity', [[0, 0], [P * 0.06, 1], [P * 0.94, 1], [P, 0]], P);
      const jit = mode === 'zigzag' ? jostle(p.jitter ?? 0.1) : null;
      for (let i = 0; i < count; i++) {
        const delay = lag - (i / count) * P;
        const [px, py] = projP(at3((back ? 1 - i / count : i / count) * total).pos); // where it rests when motion is off
        const inner = jit ? jit.wrap(dot, i) : dot;
        out += `<g transform="translate(${r1(px)} ${r1(py)})" style="${join(loopStyle(css, { period: P, delay }), fade && loopStyle(fade, { period: P, delay }))}">${inner}</g>`;
      }
      return out;
    },
    /**
     * Carry a shape round a circle about an axis without turning the shape itself:
     * translate by M·R(θ)·(r, 0), built from two opposite spins so the path is an exact ellipse.
     */
    orbit(a, centre, inner) {
      const plane = a.plane || { x: 'right', y: 'left', z: 'top' }[a.axis || 'x'] || 'right';
      const Pl = PLANES[plane];
      const [ax, ay] = proj(Pl.U[0], Pl.U[1], Pl.U[2]);
      const [bx, by] = proj(Pl.V[0], Pl.V[1], Pl.V[2]);
      const det = ax * by - bx * ay;
      const f6 = (v) => +v.toFixed(6);
      const inv = [by / det, -ay / det, -bx / det, ax / det].map(f6).join(' ');
      const [cx, cy] = projP(centre);
      const P = snapPeriod(a.period || 4, T), dir = turnOf(a), a0 = r2(a.from || 0);
      const turn = (sign) => loopStyle(`to{transform:rotate(${sign * dir * 360}deg)}`, { period: P, delay: lagOf(a, P) });
      return `<g transform="translate(${r2(cx)} ${r2(cy)}) matrix(${f6(ax)} ${f6(ay)} ${f6(bx)} ${f6(by)} 0 0) rotate(${a0})"><g style="${turn(1)}"><g transform="translate(${r2(a.r ?? 0.5)} 0)"><g style="${turn(-1)}"><g transform="rotate(${-a0}) matrix(${inv} 0 0) translate(${r2(-cx)} ${r2(-cy)})">${inner}</g></g></g></g></g>`;
    },
  };

  const blurFilter = (std) => def(`blur${std}`, (id) => `<filter id="${id}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${std}"/></filter>`);
  const glowGrad = (hex, a = 1) => def(`glow${hex}${a}`, (id) => `<radialGradient id="${id}"><stop offset="0" stop-color="${hex}" stop-opacity="${r2(a)}"/><stop offset="0.55" stop-color="${hex}" stop-opacity="${r2(a * 0.3)}"/><stop offset="1" stop-color="${hex}" stop-opacity="0"/></radialGradient>`);

  const renderParts = (parts) => depthSort(parts.map((p) => ({ aabb: primBox(p), p }))).map((it) => renderPrim(ctx, it.p)).join('');
  const wrap = (inner, style, attrs = '') => (style || attrs ? `<g${attrs}${style ? ` style="${style}"` : ''}>${inner}</g>` : inner);

  let bounds = null;
  const grow = (b) => { bounds = unionBox(bounds, b); };

  // ================================================================ 3. floor layer

  let floor = '', floorFx = '', world = [], air = '', overlay = '';

  const rich = o.detail !== 'clean';
  // extent of everything standing on the floor
  let ext = null;
  for (const ob of sc.objs) if (!ob.parent) ext = unionBox(ext, { x0: ob.x - ob.w / 2, y0: ob.y - ob.d / 2, x1: ob.x + ob.w / 2, y1: ob.y + ob.d / 2 });
  for (const lk of sc.links) if (!lk.path.arc) for (const f of lk.path.flat) ext = unionBox(ext, { x0: f.p[0], y0: f.p[1], x1: f.p[0], y1: f.p[1] });
  for (const zn of sc.zones) ext = unionBox(ext, { x0: zn.x0, y0: zn.y0, x1: zn.x1, y1: zn.y1 });

  // --- a base plate turns the scene into a diorama standing on one raised slab
  if (th.floor.plate && ext && o.floor !== false) {
    const m = 1.15, T = 0.34;
    const w = ext.x1 - ext.x0 + m * 2, d = ext.y1 - ext.y0 + m * 2, cx = (ext.x0 + ext.x1) / 2, cy = (ext.y0 + ext.y1) / 2;
    const pts = rectOutline(w, d, Math.min(1, w / 5, d / 5), cx, cy);
    if (o.shadows) floor += `<path d="${polyPath(pts.map(([x, y]) => proj(x + 0.55, y - 0.15, -T)))}" fill="${th.shadow.color}" fill-opacity="${r2(th.shadow.alpha * 0.75)}" filter="url(#${blurFilter(16)})"/>`;
    floor += renderPrism(ctx, { plane: 'top', o: [0, 0, -T], pts, depth: T, color: 'floor', ao: false });
    // faint tile lines on the slab, kept clear of its rounded edge
    let d2 = '';
    for (let x = Math.ceil(ext.x0 - m + 0.8); x <= ext.x1 + m - 0.8; x++) { const a = proj(x, ext.y0 - m + 0.5), b = proj(x, ext.y1 + m - 0.5); d2 += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; }
    for (let y = Math.ceil(ext.y0 - m + 0.8); y <= ext.y1 + m - 0.8; y++) { const a = proj(ext.x0 - m + 0.5, y), b = proj(ext.x1 + m - 0.5, y); d2 += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; }
    floor += `<path d="${d2}" fill="none" stroke="${th.floor.color}" stroke-opacity="${r2(th.floor.alpha * 0.55)}" stroke-width="1"/>`;
    grow(growBox(bbox2(pts.map(([x, y]) => proj(x, y, -T))), 14));
    grow(bbox2(pts.map(([x, y]) => proj(x, y, 0))));
  }
  // --- concentric rings spreading from the middle of the scene
  if (th.floor.rings && ext && o.floor !== false) {
    const [rx0, ry0] = proj((ext.x0 + ext.x1) / 2, (ext.y0 + ext.y1) / 2, 0);
    const reachR = Math.hypot(ext.x1 - ext.x0, ext.y1 - ext.y0) / 2 + 2.5;
    for (let r = 1.5, i = 0; r <= reachR; r += 1.5, i++) {
      const fade = 1 - r / (reachR + 1.5);
      floor += `<ellipse cx="${r1(rx0)}" cy="${r1(ry0)}" rx="${r1(r * UNIT * SPHERE_K)}" ry="${r1(r * UNIT * 0.7071)}" fill="none" stroke="${th.floor.color}" stroke-opacity="${r2(th.floor.alpha * 1.5 * fade)}" stroke-width="${i % 2 ? 1 : 1.4}"${i % 2 ? ' stroke-dasharray="3 7"' : ''}/>`;
    }
  }

  // --- zones
  for (const zn of sc.zones) {
    const w = zn.x1 - zn.x0, d = zn.y1 - zn.y0, cx = (zn.x0 + zn.x1) / 2, cy = (zn.y0 + zn.y1) / 2;
    const pts = rectOutline(w, d, Math.min(0.5, w / 4, d / 4), cx, cy);
    const scr = pts.map(([x, y]) => proj(x, y, 0));
    const col = zn.color ? K.hex(zn.color) : null;
    let svg;
    if (zn.style === 'plate') {
      const zc = { ...ctx, theme: { ...th, rim: th.rim * 0.6 } };
      svg = `<g opacity="${th.dark ? 0.55 : 0.95}">${renderPrism(zc, { plane: 'top', o: [0, 0, -0.16], pts, depth: 0.16, color: zn.color || 'muted', ao: false })}</g>`;
      grow(bbox2(pts.map(([x, y]) => proj(x, y, -0.16))));
    } else {
      const dash = zn.style === 'dashed' ? ' stroke-dasharray="7 6"' : '';
      svg = `<path d="${polyPath(scr)}" fill="${rgba(col || th.zone.fill, zn.style === 'outline' || zn.style === 'dashed' ? th.zone.fillAlpha * 0.5 : th.zone.fillAlpha * 1.6)}" stroke="${rgba(col || th.zone.stroke, th.zone.strokeAlpha)}" stroke-width="1.4"${dash} stroke-linejoin="round"/>`;
    }
    floor += svg;
    grow(bbox2(scr));
  }

  // --- floor text
  for (const t of sc.texts) {
    floor += `<g transform="${planeMatrix('top', [t.at[0], t.at[1], 0], t.turn)}"><text x="0" y="0" font-size="${r2(t.size)}" font-family="${esc(th.font)}" font-weight="${t.weight}" text-anchor="${t.anchor}" fill="${t.color ? K.hex(t.color) : th.text.muted}"${t.op != null ? ` opacity="${t.op}"` : ''}>${esc(t.text)}</text></g>`;
    const wdt = textWidth(t.text, t.size, t.weight);
    grow(bbox2([proj(t.at[0], t.at[1] - t.size, 0), proj(t.at[0] + wdt, t.at[1], 0), proj(t.at[0], t.at[1], 0), proj(t.at[0] + wdt, t.at[1] - t.size, 0)]));
  }

  // --- shadows and glow pools
  const floatStyleOf = new Map();
  sc.objs.forEach((ob, i) => {
    if (!ob.float) return;
    const P = snapPeriod(ob.float.period ?? 4, T);
    const amp = ob.float.amp ?? 7;
    const delay = -((i * 0.37) % 1) * P;
    floatStyleOf.set(ob, {
      obj: loopStyle(`0%,100%{transform:translateY(0)}50%{transform:translateY(${-amp}px)}`, { period: P, delay, ease: 'ease-in-out' }),
      shadow: loopStyle(`0%,100%{transform:scale(1);opacity:1}50%{transform:scale(.9);opacity:.72}`, { period: P, delay, ease: 'ease-in-out' }),
    });
  });

  const opacityStyle = (ob) => (ob.tracks.opacity ? trackStyle(ob.tracks.opacity) : '');
  const hiddenAttr = (ob) => (ob.hidden ? ' opacity="0"' : '');

  const shadowOf = (ob) => {
    if (ob.free) return '';
    if (ob.opts.ghost) {
      // a ghost stands for something absent or still to come: no shadow, a dashed footprint instead
      const gw = ob.res.w * ob.k + 0.3, gd = ob.res.d * ob.k + 0.3;
      const ol = ob.res.round ? circleOutline(1, 0, 0, 28).map(([a, b]) => [(a * gw) / 2, (b * gd) / 2]) : rectOutline(gw, gd, Math.min(0.24, gw / 3, gd / 3));
      const [gx, gy] = proj(ob.x, ob.y, ob.parent ? ob.z : 0);
      let mark = `<path d="${polyPath(ol.map(([a, b]) => proj(a, b, 0)))}" fill="none" stroke="${th.text.color}" stroke-opacity="0.5" stroke-width="1.2" stroke-dasharray="4 4" stroke-linecap="round"/>`;
      mark = wrap(mark, opacityStyle(ob), hiddenAttr(ob));
      if (ob.tracks.move) mark = wrap(mark, trackStyle(ob.tracks.move));
      return `<g transform="translate(${r1(gx)} ${r1(gy)})">${mark}</g>`;
    }
    if (!o.shadows || th.shadow.kind === 'none' || ob.opts.shadow === false) return '';
    const sh = ob.res.shadow || {};
    const k = ob.k;
    const floating = ob.z > 0.05 && !ob.parent;
    const soft = !!sh.soft || floating;
    const baseZ = ob.parent ? ob.z : 0;
    const round = sh.r != null || sh.round || (ob.res.round && sh.w == null);
    const sw = (sh.w ?? ob.res.w) * k, sd = (sh.d ?? ob.res.d) * k;
    const outlines = sh.rects
      ? sh.rects.map((q) => rectOutline((q.x1 - q.x0) * k, (q.y1 - q.y0) * k, Math.min(0.18, ((q.x1 - q.x0) * k) / 3, ((q.y1 - q.y0) * k) / 3), ((q.x0 + q.x1) / 2) * k, ((q.y0 + q.y1) / 2) * k))
      : [round ? (sh.r != null ? circleOutline(sh.r * k, 0, 0, 28) : circleOutline(1, 0, 0, 28).map(([a, b]) => [(a * sw) / 2, (b * sd) / 2])) : rectOutline(sw, sd, Math.min(0.18, sw / 3, sd / 3))];
    // every outline is grown about its own centre, so separate pieces stay separate
    const shape = (g, dx = 0, dy = 0) => outlines.map((ol) => {
      const cx = ol.reduce((t, q) => t + q[0], 0) / ol.length, cy = ol.reduce((t, q) => t + q[1], 0) / ol.length;
      return polyPath(ol.map(([a, b]) => proj(cx + (a - cx) * g + dx, cy + (b - cy) * g + dy, 0)));
    }).join('');
    let body;
    if (th.shadow.kind === 'cast' && !soft && !ob.parent) {
      const hh = Math.min(ob.h, 2.6);
      const dx = 0.5 * hh, dy = -0.26 * hh;
      const thrown = outlines.map((ol) => polyPath(hull([...ol, ...ol.map(([a, b]) => [a + dx, b + dy])]).map(([a, b]) => proj(a, b, 0)))).join('');
      body = `<path d="${thrown}" fill="${th.shadow.color}" fill-opacity="${th.shadow.alpha}"/>`;
      body += `<path d="${shape(1.04)}" fill="${th.shadow.color}" fill-opacity="${r2(th.shadow.alpha * 0.7)}" filter="url(#${blurFilter(2)})"/>`;
    } else if (ob.parent || soft) {
      const g = ob.parent ? 1.03 : 0.92;
      const blur = ob.parent ? 2 : th.shadow.kind === 'cast' ? 6 : th.shadow.blur * 1.35;
      const alpha = ob.parent ? th.shadow.alpha : (th.shadow.kind === 'cast' ? 0.3 : th.shadow.alpha) * 0.6;
      body = `<path d="${shape(g)}" fill="${th.shadow.color}" fill-opacity="${r2(alpha)}" filter="url(#${blurFilter(blur)})"/>`;
    } else {
      // Two layers read as real light: a tight dark contact shadow where the object meets the
      // floor, and a wider, softer one thrown away from the light that grows with height.
      const hh = Math.min(sh.rects ? Math.min(ob.h, 0.9) : ob.h, 2.8), reach = th.shadow.reach ?? 1;
      const off = [(0.12 + hh * 0.2) * reach, -(0.04 + hh * 0.07) * reach];
      body = `<path d="${shape(1.12, off[0], off[1])}" fill="${th.shadow.color}" fill-opacity="${r2(th.shadow.alpha * 0.55)}" filter="url(#${blurFilter(r1(th.shadow.blur * (1 + hh * 0.18)))})"/>`
        + `<path d="${shape(1.04, 0.03, 0)}" fill="${th.shadow.color}" fill-opacity="${r2(Math.min(0.75, th.shadow.alpha * 0.95))}" filter="url(#${blurFilter(2.2)})"/>`;
    }
    const [sx, sy] = proj(ob.x, ob.y, baseZ);
    const fl = floatStyleOf.get(ob);
    let inner = wrap(body, fl ? fl.shadow : '');
    inner = wrap(inner, opacityStyle(ob), hiddenAttr(ob));
    if (ob.tracks.move) inner = wrap(inner, trackStyle(ob.tracks.move));
    grow(growBox(bbox2([[sx - sw * UNIT, sy - sd * UNIT * 0.5], [sx + (sw + Math.min(ob.h, 2.8) * 0.3) * UNIT, sy + sd * UNIT * 0.5]]), 6));
    return `<g transform="translate(${r1(sx)} ${r1(sy)})">${inner}</g>`;
  };

  let shadowLayer = '', glowLayer = '';
  const stackedShadow = new Map();
  for (const ob of sc.objs) {
    const s = shadowOf(ob);
    if (ob.parent) stackedShadow.set(ob, s); else shadowLayer += s;
    const hasGlow = ob.hero || ob.opts.glow || ob.tracks.glow;
    if (hasGlow && (th.glow > 0 || ob.tracks.glow)) {
      const color = K.hex(ob.glowColor || (ob.opts.glow && ob.opts.glow !== true ? ob.opts.glow : null) || ob.res.glowColorRole || (ob.opts.color !== 'body' ? ob.opts.color : ob.opts.accent));
      const R = Math.max(ob.w, ob.d) * 1.25 + 0.6;
      const [gx, gy] = proj(ob.x, ob.y, 0);
      const strength = Math.max(th.glow, 0.3);
      const el = `<ellipse cx="${r1(gx)}" cy="${r1(gy)}" rx="${r1(R * UNIT * SPHERE_K)}" ry="${r1(R * UNIT * 0.7071)}" fill="url(#${glowGrad(color, strength)})"/>`;
      const tr = ob.tracks.glow;
      glowLayer += wrap(wrap(el, tr ? trackStyle(tr) : '', tr && tr.initial === 0 ? ' opacity="0"' : ''), opacityStyle(ob), hiddenAttr(ob));
    }
  }

  // --- a few motes of light drifting up around the hero (only where the look has glow)
  let motes = '';
  if (rich && th.glow >= 0.45) {
    for (const ob of sc.objs.filter((b) => b.hero && !b.hidden).slice(0, 1)) {
      const color = mix(K.hex(ob.opts.color !== 'body' ? ob.opts.color : ob.opts.accent), '#ffffff', 0.45);
      const P = snapPeriod(4.2, T);
      for (let i = 0; i < 7; i++) {
        const a = i * 2.399, rr = (0.45 + ((i * 37) % 10) / 10 * 0.75) * Math.max(ob.w, ob.d);
        const [px, py] = proj(ob.x + Math.cos(a) * rr, ob.y + Math.sin(a) * rr, ob.z + 0.2 + ((i * 53) % 10) / 10 * ob.h * 0.6);
        const rise = 26 + ((i * 29) % 10) * 2.2;
        motes += `<circle cx="${r1(px)}" cy="${r1(py)}" r="${i % 3 === 0 ? 1.9 : 1.3}" fill="${color}" opacity="0" style="${loopStyle(`0%{transform:translateY(0);opacity:0}18%{opacity:.85}100%{transform:translateY(${-rise}px);opacity:0}`, { period: P, delay: -(i / 7) * P, ease: 'ease-out' })}"/>`;
      }
    }
  }

  // --- links
  let linkLayer = '';
  sc.links.forEach((lk, li) => {
    const lo = lk.o;
    const color = lo.color ? K.hex(lo.color) : th.link.color;
    const alpha = (lo.dim ? 0.45 : 1) * th.link.alpha;
    const width = lo.width ?? th.link.width;
    const path = lk.path;
    const flat = path.flat;
    let d = path.d;
    let arrow = '';
    const want = lo.arrow === true || lo.arrow === 'both' || lo.arrow === 'end';
    if (want && !path.arc && path.corners) {
      const cs = path.corners.map((c) => [...c]);
      const heads = lo.arrow === 'both' ? [[cs.length - 1, cs.length - 2], [0, 1]] : [[cs.length - 1, cs.length - 2]];
      for (const [ti, pi] of heads) {
        const tip = [...cs[ti]], prev = cs[pi];
        const l = Math.hypot(tip[0] - prev[0], tip[1] - prev[1]) || 1;
        const u = [(tip[0] - prev[0]) / l, (tip[1] - prev[1]) / l];
        const L = 0.3, Wd = 0.15;
        const b = [tip[0] - u[0] * L, tip[1] - u[1] * L];
        const tri = [tip, [b[0] - u[1] * Wd, b[1] + u[0] * Wd], [b[0] + u[1] * Wd, b[1] - u[0] * Wd]].map(([x, y]) => proj(x, y, path.z));
        arrow += `<path d="${polyPath(tri)}" fill="${color}" stroke="${color}" stroke-width="1" stroke-linejoin="round"/>`;
        cs[ti] = [tip[0] - u[0] * Math.min(L * 0.8, l * 0.5), tip[1] - u[1] * Math.min(L * 0.8, l * 0.5)];
      }
      d = buildPath(cs, path.z + 0.004).d;
    } else if (want && path.arc) {
      const a = projP(flat[flat.length - 2].p), b = projP(flat[flat.length - 1].p);
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      arrow = `<path d="M0 0L-9 -4.5L-9 4.5Z" transform="translate(${r1(b[0])} ${r1(b[1])}) rotate(${r1(ang)})" fill="${color}"/>`;
    }
    const dashed = lo.style === 'dashed' || path.arc && lo.style !== 'line', dotted = lo.style === 'dotted';
    const dashArr = dashed ? '7 7' : dotted ? '0.1 8' : '';
    const flow = lo.flow;
    let style = '';
    if (flow && (dashed || dotted)) style = loopStyle(`to{stroke-dashoffset:${dashed ? -14 : -8.1}}`, { period: snapPeriod(dashed ? 0.9 : 0.7, T) });
    let svg = '';
    if (lo.style === 'road') {
      const asphalt = th.dark ? mix(th.roles.dark, '#000000', 0.25) : mix(th.roles.dark, th.bg.from, 0.25);
      svg += `<path d="${d}" fill="none" stroke="${asphalt}" stroke-opacity="${th.dark ? 0.9 : 0.82}" stroke-width="${width * 9}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.75" stroke-width="1.6" stroke-dasharray="7 8" stroke-linecap="round"${style ? ` style="${style}"` : ''}/>`;
      arrow = '';
    } else if (lo.style === 'pipe') {
      svg += `<path d="${d}" fill="none" stroke="${mix(color, th.shadow.color, 0.55)}" stroke-width="${width * 5.2}" stroke-linecap="round" stroke-linejoin="round" opacity="${alpha}"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${width * 3.4}" stroke-linecap="round" stroke-linejoin="round" opacity="${alpha}"/><path d="${d}" fill="none" stroke="#ffffff" stroke-opacity="0.22" stroke-width="${width * 0.9}" stroke-linecap="round" stroke-linejoin="round" transform="translate(0 ${-width * 0.9})"/>`;
    } else {
      if (th.glow > 0 && !lo.dim) svg += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${r2(th.glow * 0.22)}" stroke-width="${width * 4.5}" stroke-linecap="round" stroke-linejoin="round"/>`;
      // solid links draw themselves from source to target as the scene arrives
      const draw = !dashArr && o.intro ? ` pathLength="1" stroke-dasharray="1" style="animation:${kf('from{stroke-dashoffset:1}to{stroke-dashoffset:0}')} .7s ${EASE.inOut} ${r2(0.25 + li * 0.08)}s both"` : '';
      svg += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${r2(alpha)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dashArr ? ` stroke-dasharray="${dashArr}"` : ''}${style ? ` style="${style}"` : ''}${draw}/>`;
    }
    svg += arrow ? `<g opacity="${r2(alpha)}">${arrow}</g>` : '';
    // travelling dots for a continuous flow
    let dots = '';
    if (flow === 'alternate' || (flow && flow.alternate)) {
      // alternating flow: every dot rocks back and forth about its own place, all in step
      const fo = typeof flow === 'object' ? flow : {};
      flows.push(`${nameOf(lk.a)} → ${nameOf(lk.b)}   dots rock to and fro in place, once every ${r1(fo.period ?? 2)} s`);
      const P = snapPeriod(fo.period ?? 2, T);
      const count = fo.count ?? Math.max(2, Math.round(path.total / 0.8));
      const amp = (fo.swing ?? 0.3) / path.total, ph = (fo.phase || 0) * 2 * Math.PI;
      const dotColor = fo.color ? K.hex(fo.color) : th.glow > 0 ? mix(color, '#ffffff', 0.35) : K.hex('accent');
      for (let i = 0; i < count; i++) {
        const f0 = (i + 0.5) / count, N = 16;
        const at = (t) => projP(pointAt(path, clamp(f0 - amp * Math.cos(2 * Math.PI * t + ph), 0, 1)));
        const css = keyframes('translate', Array.from({ length: N + 1 }, (_, j) => [(j / N) * P, at(j / N)]), P);
        const pos = at(0);
        const glowDot = th.glow > 0 ? `<circle r="7" fill="url(#${glowGrad(dotColor, 0.7)})"/>` : '';
        dots += `<g transform="translate(${r1(pos[0])} ${r1(pos[1])})" style="${loopStyle(css, { period: P })}">${glowDot}<circle r="2.6" fill="${dotColor}"${th.outline ? ` stroke="${th.ink}" stroke-width="1"` : ''}/></g>`;
      }
    } else if (flow) {
      // reverse: the dots travel from b to a; jitter: they jostle sideways as they go (cells)
      const fo = typeof flow === 'object' ? flow : {};
      flows.push(`${nameOf(lk.a)} → ${nameOf(lk.b)}   dots travel ${fo.reverse ? `backwards, from ${nameOf(lk.b)} to ${nameOf(lk.a)}` : `from ${nameOf(lk.a)} to ${nameOf(lk.b)}`}${fo.jitter ? ', jostling' : ''}, ${r1(path.total / (fo.speed ?? 2.4))} s end to end`);
      const count = fo.count ?? Math.max(1, Math.round(path.total / (fo.jitter ? 0.7 : 2.6)));
      const P = snapPeriod(path.total / (fo.speed ?? 2.4), T);
      const frac = (f) => (fo.reverse ? 1 - f : f);
      const stops = (fo.reverse ? [...flat].map((f, i) => ({ f, d: path.lens[i] })).reverse().map((q) => [(1 - q.d / path.total) * P, projP(q.f.p)]) : flat.map((f, i) => [(path.lens[i] / path.total) * P, projP(f.p)]));
      const css = keyframes('translate', stops, P);
      const fade = keyframes('opacity', [[0, 0], [P * 0.08, 1], [P * 0.9, 1], [P, 0]], P);
      const dotColor = fo.color ? K.hex(fo.color) : th.glow > 0 ? mix(color, '#ffffff', 0.35) : K.hex('accent');
      const jit = fo.jitter ? jostle(fo.jitter === true ? 0.08 : fo.jitter) : null;
      const rad = fo.r != null ? fo.r * UNIT : lo.style === 'pipe' ? 4 : fo.jitter ? 2.6 : 3.2;
      for (let i = 0; i < count; i++) {
        const delay = -((i + 0.5) / count) * P;
        const pos = projP(pointAt(path, frac((i + 0.5) / count)));
        const glowDot = th.glow > 0 ? `<circle r="${r1(rad * 2.8)}" fill="url(#${glowGrad(dotColor, 0.8)})"/>` : '';
        const dot = `${glowDot}<circle r="${r1(rad)}" fill="${dotColor}"${th.outline ? ` stroke="${th.ink}" stroke-width="1.2"` : ''}/>`;
        dots += `<g transform="translate(${r1(pos[0])} ${r1(pos[1])})" style="${join(loopStyle(css, { period: P, delay }), loopStyle(fade, { period: P, delay }))}">${jit ? jit.wrap(dot, i) : dot}</g>`;
      }
    }
    if (rich && !path.arc && lk.a.obj && lo.style !== 'road' && lo.style !== 'pipe' && lo.arrow !== 'both') {
      const [qx, qy] = projP(flat[0].p);
      svg += `<ellipse cx="${r1(qx)}" cy="${r1(qy)}" rx="4.6" ry="2.7" fill="${th.text.halo}" stroke="${color}" stroke-opacity="${r2(alpha)}" stroke-width="${Math.max(1.4, width * 0.8)}"/>`;
    }
    if (path.arc) air += svg + dots; else { linkLayer += svg; floorFx += dots; }
    grow(growBox(bbox2(flat.map((f) => projP(f.p))), 10));
    if (lo.label) {
      const mid = projP(pointAt(path, 0.5));
      overlay += `<text x="${r1(mid[0])}" y="${r1(mid[1] - 13)}" font-size="11.5" font-family="${esc(th.font)}" font-weight="600" text-anchor="middle" fill="${th.text.muted}"${o.background ? ` stroke="${th.text.halo}" stroke-width="4" stroke-linejoin="round" paint-order="stroke"` : ''}>${esc(lo.label)}</text>`;
      const tw = textWidth(lo.label, 11.5, 600);
      grow({ x0: mid[0] - tw / 2, x1: mid[0] + tw / 2, y0: mid[1] - 24, y1: mid[1] });
    }
    // lint: a short kink where two objects are almost, but not quite, in line
    if (!path.arc && path.corners && path.corners.length === 4 && !lo.via) {
      const [, c1, c2] = path.corners;
      const jog = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]);
      if (jog > 0.02 && jog < 1.2 && lk.a.obj && lk.b.obj) note('hint', 'kink', `The link ${lk.a.obj.id} → ${lk.b.obj.id} has a small kink because the two objects are ${r1(jog)} cells out of line. Give them the same x or the same y, or use { route: 'straight' }.`);
    }
    // lint: a route that runs under an object
    if (!path.arc) {
      for (const ob of sc.objs) {
        if (ob === lk.a.obj || ob === lk.b.obj || ob.parent || ob.free || ob.z > 0.3) continue;
        let hit = false;
        for (let i = 1; i < flat.length && !hit; i++) {
          const a = flat[i - 1].p, b = flat[i].p;
          const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2));
          for (let k = 0; k <= n && !hit; k++) {
            const x = a[0] + ((b[0] - a[0]) * k) / n, y = a[1] + ((b[1] - a[1]) * k) / n;
            hit = Math.abs(x - ob.x) < ob.w / 2 - 0.08 && Math.abs(y - ob.y) < ob.d / 2 - 0.08;
          }
        }
        if (hit) { note('warn', 'link-through', `The link ${lk.a.obj ? lk.a.obj.id : 'point'} → ${lk.b.obj ? lk.b.obj.id : 'point'} runs underneath "${ob.id}". Move "${ob.id}", or route the link around it with { route: 'x' }, { route: 'y' } or { via: [[x, y]] }.`); break; }
      }
    }
  });

  // ================================================================ 4. world layer

  const introStyle = (ob) => (o.intro ? `animation:${kf('from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}')} .6s ${EASE.out} ${r2(introOf.get(ob))}s both` : '');

  for (const ob of sc.objs) {
    let inner = renderParts(ob.parts);
    for (const tint of ob.tints) {
      const res = (sc.kinds[ob.kind] || KIT[ob.kind]).build({ ...ob.opts, color: tint.color, accent: ob.opts.accent === tint.color ? 'paper' : ob.opts.accent }, K);
      inner += `<g opacity="0" style="${trackStyle(tint.track)}">${renderParts(ob.k === 1 ? res.parts : sc.scaleParts(res.parts, ob.k))}</g>`;
    }
    if (ob.level < 1 || ob.tracks.grow) {
      // The object slides up through a clip that hides everything below its footprint,
      // so it appears to rise out of the floor.
      const fw = ob.res.w * ob.k, fd = ob.res.d * ob.k;
      const front = ob.res.round
        ? Array.from({ length: 13 }, (_, i) => { const a = ((135 - i * 15) * Math.PI) / 180; return proj((Math.cos(a) * fw) / 2, (Math.sin(a) * fd) / 2, 0); })
        : [proj(-fw / 2, fd / 2, 0), proj(fw / 2, fd / 2, 0), proj(fw / 2, -fd / 2, 0)];
      const topY = -(ob.h * UNIT + 400);
      const poly = [[front[0][0] - 8, topY], [front[0][0] - 8, front[0][1]], ...front, [front[front.length - 1][0] + 8, front[front.length - 1][1]], [front[front.length - 1][0] + 8, topY]];
      const clip = def(`grow|${polyPath(poly)}`, (id) => `<clipPath id="${id}"><path d="${polyPath(poly)}"/></clipPath>`);
      const off = (1 - ob.level) * ob.h * UNIT;
      inner = `<g clip-path="url(#${clip})"><g${off ? ` transform="translate(0 ${r1(off)})"` : ''}${ob.tracks.grow ? ` style="${trackStyle(ob.tracks.grow)}"` : ''}>${inner}</g></g>`;
    }
    const fade = ob.opts.ghost ? 0.28 : ob.opts.opacity;
    if (fade != null && fade < 1) inner = `<g opacity="${r2(clamp(fade, 0, 1))}">${inner}</g>`;
    inner = wrap(inner, opacityStyle(ob), hiddenAttr(ob));
    if (ob.tracks.scale) inner = wrap(inner, trackStyle(ob.tracks.scale));
    const fl = floatStyleOf.get(ob);
    if (fl) inner = wrap(inner, fl.obj);
    if (ob.tracks.shake) inner = wrap(inner, trackStyle(ob.tracks.shake));
    if (ob.tracks.lift) inner = wrap(inner, trackStyle(ob.tracks.lift));
    if (ob.tracks.move) inner = wrap(inner, trackStyle(ob.tracks.move));
    inner = wrap(inner, introStyle(ob));
    const [sx, sy] = proj(ob.x, ob.y, ob.z);
    const sbx = aabbScreen(ob.box);
    const meta = ` data-obj="${esc(ob.id)}"${ob.label ? ` data-label="${esc(ob.label)}"` : ''}${ob.opts.info ? ` data-info="${esc(ob.opts.info)}"` : ''} data-box="${r1(sbx.x0)} ${r1(sbx.y0)} ${r1(sbx.x1)} ${r1(sbx.y1)}"`;
    const svg = `${stackedShadow.get(ob) || ''}<g transform="translate(${r1(sx)} ${r1(sy)})"${meta}>${inner}</g>`;
    let box = ob.box;
    if (ob.float) box = { ...box, z1: box.z1 + 0.2 };
    // shapes that are not objects are drawn under the objects, over them, or in among them, as asked
    if (ob.free && ob.layer === 'floor') floorFx += svg; else if (ob.free && ob.layer === 'air') air += svg; else world.push({ aabb: box, svg, ob });
    const sb = aabbScreen(box);
    const liftPx = ob.tracks.lift ? Math.max(0, ...ob.tracks.lift.segs.map((s) => -s.to[1])) : 0;
    grow({ x0: sb.x0, x1: sb.x1, y0: sb.y0 - liftPx - (ob.float ? 8 : 0), y1: sb.y1 });
    if (ob.tracks.move) for (const sg of ob.tracks.move.segs) grow({ x0: sb.x0 + sg.to[0], x1: sb.x1 + sg.to[0], y0: sb.y0 + sg.to[1], y1: sb.y1 + sg.to[1] });
    // the frame must hold the object over its whole motion, not only at rest
    if (ob.animated) for (const part of ob.parts) { const sw = sweepBox(part); if (sw) grow(growBox(aabbScreen(aabbShift(sw, [ob.x, ob.y, ob.z])), 4)); }
  }

  // --- story tokens: one copy per straight run of the route, so each sorts correctly among the objects
  // a token that stays at its destination remains until the next hop of the same id, or the loop end
  movers.forEach((mv, mi) => {
    if (!mv.stay) return;
    const next = movers.find((m2, j) => j > mi && mv.id && m2.id === mv.id);
    mv.until = next ? next.t0 : T - 0.45;
  });
  const kitToken = (mv) => {
    const res = (sc.kinds[mv.as] || KIT[mv.as]).build({ color: mv.color === 'accent' ? 'body' : mv.color, accent: 'accent' }, K);
    const k = mv.scale ?? 0.5;
    return { parts: sc.scaleParts(res.parts, k), shadow: Math.max(res.w, res.d) * k * 0.45 };
  };
  movers.forEach((mv, mi) => {
    const isKind = !PACKETS[mv.as] && (sc.kinds[mv.as] || KIT[mv.as]);
    let pk = PACKETS[mv.as] ? PACKETS[mv.as](mv.color, K) : isKind ? kitToken(mv) : PACKETS.dot(mv.color, K);
    if (PACKETS[mv.as] && mv.scale && mv.scale !== 1) pk = { ...pk, parts: sc.scaleParts(pk.parts, mv.scale), shadow: pk.shadow * mv.scale, glowZ: pk.glowZ != null ? pk.glowZ * mv.scale : undefined };
    const partsSvg = renderParts(pk.parts);
    let local = null;
    for (const p of pk.parts) local = aabbUnion(local, primBox(p));
    const { path } = mv;
    const dur = mv.t1 - mv.t0;
    const E = EASE_FN[mv.ease] || EASE_FN.inOut;
    const inv = (f) => { let lo = 0, hi = 1; for (let i = 0; i < 22; i++) { const m = (lo + hi) / 2; if (E(m) < f) lo = m; else hi = m; } return (lo + hi) / 2; };
    const N = clamp(Math.ceil(dur * 20), 10, 44);
    const stops = [[0, projP(path.flat[0].p)]];
    const floorStops = [[0, proj(path.flat[0].p[0], path.flat[0].p[1], path.arc ? 0 : path.flat[0].p[2])]];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const p = pointAt(path, mv.ease === 'linear' ? u : E(u));
      stops.push([mv.t0 + u * dur, projP(p)]);
      floorStops.push([mv.t0 + u * dur, proj(p[0], p[1], path.arc ? 0 : p[2])]);
    }
    stops.push([T, stops[stops.length - 1][1]]);
    floorStops.push([T, floorStops[floorStops.length - 1][1]]);
    const moveCss = keyframes('translate', stops, T);
    const eps = 0.0006 * T;
    const windowCss = (ta, tb, first, last) => {
      const s = [[0, 0]];
      const a = clamp(ta, 0, T), b = clamp(tb, 0, T);
      if (a > eps) s.push([a - (first ? 0 : eps), 0]);
      s.push([first ? Math.min(a + 0.12, b) : a, 1]);
      s.push([last ? Math.max(b - 0.14, a) : b, 1]);
      if (b < T - eps) s.push([last ? b : b + eps, 0]);
      s.push([T, 0]);
      return keyframes('opacity', s, T);
    };
    const staticF = 0.3 + 0.2 * (mi % 3);
    const staticPos = projP(pointAt(path, staticF));
    const glowSvg = pk.glow && th.glow > 0 ? `<circle cy="${-(pk.glowZ ?? 0.16) * UNIT}" r="${r1(24 * (PACKETS[mv.as] && mv.scale ? mv.scale : 1))}" fill="url(#${glowGrad(K.hex(mv.color), 0.9)})"/>` : '';
    // a token swells as it is emitted and shrinks as it is absorbed, so hand-offs feel physical
    const endScale = mv.until != null ? 1 : 0.5;
    const swell = keyframes('scale', [[0, 0.35], [mv.t0, 0.35, 'out'], [mv.t0 + Math.min(0.24, dur * 0.3), 1], [mv.t1 - Math.min(0.16, dur * 0.25), 1, 'in'], [mv.t1, endScale], [T, endScale]], T);
    const body = glowSvg + `<g style="${storyStyle(swell)}">${partsSvg}</g>`;

    // fraction range of each straight run
    const segs = [];
    for (let s = 0; s < path.segs; s++) {
      const idx = path.flat.map((f, i) => (f.seg === s ? i : -1)).filter((i) => i >= 0);
      if (!idx.length) continue;
      const first = idx[0], last = idx[idx.length - 1];
      const fa = first === 0 ? 0 : (path.lens[first] + path.lens[first - 1]) / 2 / path.total;
      const fb = last === path.flat.length - 1 ? 1 : (path.lens[last] + path.lens[last + 1]) / 2 / path.total;
      let box = null;
      for (const i of idx) box = aabbUnion(box, aabbShift(local, path.flat[i].p));
      segs.push({ fa, fb, box });
    }
    const endOf = (si, tb) => (si === segs.length - 1 && mv.until != null ? Math.max(tb, mv.until) : tb);
    segs.forEach((sg, si) => {
      const ua = mv.ease === 'linear' ? sg.fa : inv(sg.fa), ub = mv.ease === 'linear' ? sg.fb : inv(sg.fb);
      const vis = windowCss(mv.t0 + ua * dur, endOf(si, mv.t0 + ub * dur), si === 0, si === segs.length - 1);
      const on = staticF >= sg.fa && staticF < sg.fb;
      const svg = `<g transform="translate(${r1(staticPos[0])} ${r1(staticPos[1])})" opacity="${on ? 1 : 0}" style="${join(storyStyle(moveCss), storyStyle(vis))}">${body}</g>`;
      if (path.arc) air += svg; else world.push({ aabb: sg.box, svg, bias: 0.05 });
    });
    if (rich && !isKind && path.d && !mv.stay) {
      let Lp = 0;
      for (let i = 1; i < path.flat.length; i++) { const a = projP(path.flat[i - 1].p), b = projP(path.flat[i].p); Lp += Math.hypot(b[0] - a[0], b[1] - a[1]); }
      const tail = Math.min(62, Lp * 0.4);
      const dash = [[0, path.rev ? -Lp : tail]];
      for (let i = 0; i <= N; i++) { const u = i / N, f = mv.ease === 'linear' ? u : E(u); dash.push([mv.t0 + u * dur, path.rev ? -(Lp - f * Lp) : tail - f * Lp]); }
      dash.push([T, dash[dash.length - 1][1]]);
      const vis = keyframes('opacity', [[0, 0], [Math.max(0, mv.t0), 0], [mv.t0 + Math.min(0.18, dur * 0.3), 0.6], [mv.t1 - Math.min(0.2, dur * 0.3), 0.6], [mv.t1, 0], [T, 0]], T);
      const trail = `<path d="${path.d}" fill="none" stroke="${K.hex(mv.color)}" stroke-width="${th.outline ? 2.2 : 3}" stroke-linecap="round" stroke-dasharray="${r1(tail)} ${r1(Lp * 3)}" opacity="0" style="${join(storyStyle(keyframes('dash', dash, T)), storyStyle(vis))}"/>`;
      if (path.arc) air += trail; else floorFx += trail;
    }
    if (pk.shadow && o.shadows && th.shadow.kind !== 'none') {
      const sp = proj(...pointAt(path, staticF).slice(0, 2), path.arc ? 0 : path.z || 0);
      const vis = windowCss(mv.t0, mv.until != null ? Math.max(mv.t1, mv.until) : mv.t1, true, true);
      floorFx += `<g transform="translate(${r1(sp[0])} ${r1(sp[1])})" style="${join(storyStyle(keyframes('translate', floorStops, T)), storyStyle(vis))}"><ellipse rx="${r1(pk.shadow * UNIT * 1.1)}" ry="${r1(pk.shadow * UNIT * 0.62)}" fill="${th.shadow.color}" fill-opacity="${r2(Math.min(0.5, th.shadow.alpha * 0.8))}"/></g>`;
    }
    if (mv.label) {
      // the word rides with the token but only shows once it has left the sender
      const vis = windowCss(mv.t0 + dur * 0.2, mv.t1 - dur * 0.1, true, true);
      overlay += `<g transform="translate(${r1(staticPos[0])} ${r1(staticPos[1])})" style="${join(storyStyle(moveCss), storyStyle(vis))}"><text y="-34" font-size="11.5" font-family="${esc(th.font)}" font-weight="700" text-anchor="middle" fill="${th.text.color}"${o.background ? ` stroke="${th.text.halo}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke"` : ''}>${esc(mv.label)}</text></g>`;
    }
  });

  // --- ripples on the floor
  let ringLayer = '';
  for (const rg of rings) {
    const ob = rg.ob;
    const R = Math.max(ob.w, ob.d) * 0.62 + 0.25;
    const [cx, cy] = proj(ob.x, ob.y, ob.parent ? ob.z : 0);
    const color = K.hex(rg.color);
    const scale = keyframes('scale', [[0, 0.55], [rg.t0, 0.55, 'out'], [rg.t0 + rg.dur, 1.45], [T, 1.45]], T);
    const op = keyframes('opacity', [[0, 0], [Math.max(0, rg.t0 - 0.001), 0], [rg.t0 + 0.06, 0.75, 'smooth'], [rg.t0 + rg.dur, 0], [T, 0]], T);
    ringLayer += `<g transform="translate(${r1(cx)} ${r1(cy)})"><ellipse rx="${r1(R * UNIT * SPHERE_K)}" ry="${r1(R * UNIT * 0.7071)}" fill="${color}" fill-opacity="0.1" stroke="${color}" stroke-width="1.6" opacity="0" style="${join(storyStyle(scale), storyStyle(op))}"/></g>`;
  }

  // ================================================================ 5. labels and other overlay

  const halo = o.background ? ` stroke="${th.text.halo}" stroke-opacity="${th.dark ? 0.7 : 0.9}" stroke-width="${th.dark ? 3.2 : 4}" stroke-linejoin="round" paint-order="stroke"` : '';
  const labelBoxes = [];
  const calloutBoxes = [];
  const calloutSvg = (ax, ay, c) => {
    const left = c.side === 'left';
    const dir = left ? -1 : 1;
    // rise lifts the text away from the point (negative lowers it); length is how far the leader runs sideways
    const rise = c.rise || 0, len = Math.max(14, c.length ?? 30);
    const ty = ay - rise;
    const tx = ax + len * dir;
    const w = Math.max(textWidth(c.text, 13, 650), c.sub ? textWidth(c.sub, 11, 500) : 0);
    const lead = rise ? `M${r1(ax)} ${r1(ay - Math.sign(rise) * 5)}L${r1(ax + Math.min(len - 8, Math.abs(rise) * 0.5) * dir)} ${r1(ty)}H${r1(tx - 6 * dir)}` : `M${r1(ax + 5 * dir)} ${r1(ay)}H${r1(tx - 6 * dir)}`;
    const dot = rise ? [ax, ay - Math.sign(rise) * 5] : [ax + 5 * dir, ay];
    let svg = `<path d="${lead}" stroke="${th.text.muted}" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/><circle cx="${r1(dot[0])}" cy="${r1(dot[1])}" r="2.4" fill="${th.text.muted}"/>`;
    svg += `<text x="${r1(tx)}" y="${r1(ty + (c.sub ? -2 : 4.5))}" font-size="13" font-family="${esc(th.font)}" font-weight="650" text-anchor="${left ? 'end' : 'start'}" fill="${th.text.color}"${halo}>${esc(c.text)}</text>`;
    if (c.sub) svg += `<text x="${r1(tx)}" y="${r1(ty + 12)}" font-size="11" font-family="${esc(th.font)}" font-weight="500" text-anchor="${left ? 'end' : 'start'}" fill="${th.text.muted}"${halo}>${esc(c.sub)}</text>`;
    const box = left ? { x0: tx - w - 4, x1: tx + 2, y0: ty - 14, y1: ty + 18 } : { x0: tx - 2, x1: tx + w + 4, y0: ty - 14, y1: ty + 18 };
    grow(box);
    grow({ x0: ax - 4, x1: ax + 4, y0: ay - 4, y1: ay + 4 });
    labelBoxes.push(box);
    calloutBoxes.push({ text: c.text, box, ax, ay, timed: c.from != null || c.until != null });
    return svg;
  };
  for (const c of sc.callouts) {
    const [ax, ay] = projP(c.at);
    let one = calloutSvg(ax, ay, c);
    if (c.from != null || c.until != null) {
      // a callout that is only on screen for part of the loop
      const from = c.from ?? 0, until = Math.min(c.until ?? T - 0.3, T - 0.25);
      const tr = new Track('opacity', c.from != null && c.from > 0.05 ? 0 : 1);
      if (c.from != null && c.from > 0.05) tr.to(from, from + 0.25, 1, 'smooth');
      tr.to(Math.max(until, from + 0.3), Math.max(until, from + 0.3) + 0.2, 0, 'smooth');
      one = `<g style="${trackStyle(tr)}">${one}</g>`;
    }
    overlay += steady(one, ax, ay);
  }
  // labels keep clear of every object, including ones that only appear later in the story
  const solid = sc.objs.filter((ob) => !ob.free).map((ob) => ({ ob, box: growBox(aabbScreen(ob.box), -5) }));
  const LS = 14, SS = 11.5;
  // points along every floor link, so labels can keep clear of them
  const linkDots = [];
  for (const lk of sc.links) {
    if (lk.path.arc) continue;
    const fl = lk.path.flat;
    for (let i = 1; i < fl.length; i++) {
      const a = projP(fl[i - 1].p), b = projP(fl[i].p), n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 8));
      for (let k = 0; k <= n; k++) linkDots.push([a[0] + ((b[0] - a[0]) * k) / n, a[1] + ((b[1] - a[1]) * k) / n]);
    }
  }
  for (const ob of sc.objs) {
    const lines = [];
    if (ob.label) lines.push({ text: String(ob.label), size: LS, weight: 650, fill: th.text.color });
    if (ob.sub) lines.push({ text: String(ob.sub), size: SS, weight: 500, fill: th.text.muted });
    const callouts = ob.res.callouts || [];
    for (const c of callouts) {
      const [ax, ay] = proj(ob.x + c.at[0] * ob.k, ob.y + c.at[1] * ob.k, ob.z + c.at[2] * ob.k);
      overlay += steady(wrap(calloutSvg(ax, ay, c), opacityStyle(ob), hiddenAttr(ob)), ax, ay);
    }
    if (!lines.length) continue;
    if (String(ob.label || '').length > 24) note('hint', 'label-long', `Label "${ob.label}" is long (${String(ob.label).length} characters). Keep labels to 1–3 words and move detail into sub: or a caption.`);
    const w = Math.max(...lines.map((l) => textWidth(l.text, l.size, l.weight)));
    const h = lines.reduce((s, l) => s + l.size * 1.28, 0);
    const sb = { ...aabbScreen(ob.box) };
    for (let p = ob.parent; p; p = p.parent) sb.y1 = Math.max(sb.y1, aabbScreen(p.box).y1); // a stacked object's label goes under its base
    const cx = proj(ob.x, ob.y, 0)[0];
    const place = (side) => {
      if (side === 'above') return { x: cx, y: sb.y0 - 9 - h, anchor: 'middle', box: { x0: cx - w / 2, x1: cx + w / 2, y0: sb.y0 - 9 - h, y1: sb.y0 - 9 } };
      if (side === 'right') return { x: sb.x1 + 10, y: (sb.y0 + sb.y1) / 2 - h / 2, anchor: 'start', box: { x0: sb.x1 + 10, x1: sb.x1 + 10 + w, y0: (sb.y0 + sb.y1) / 2 - h / 2, y1: (sb.y0 + sb.y1) / 2 + h / 2 } };
      if (side === 'left') return { x: sb.x0 - 10, y: (sb.y0 + sb.y1) / 2 - h / 2, anchor: 'end', box: { x0: sb.x0 - 10 - w, x1: sb.x0 - 10, y0: (sb.y0 + sb.y1) / 2 - h / 2, y1: (sb.y0 + sb.y1) / 2 + h / 2 } };
      return { x: cx, y: sb.y1 + 9, anchor: 'middle', box: { x0: cx - w / 2, x1: cx + w / 2, y0: sb.y1 + 9, y1: sb.y1 + 9 + h } };
    };
    const onLink = (b) => linkDots.some((q) => q[0] > b.x0 + 2 && q[0] < b.x1 - 2 && q[1] > b.y0 + 2 && q[1] < b.y1 - 2);
    const clash = (b) => labelBoxes.some((l) => boxesOverlap(l, b, 1)) || solid.some((sld) => sld.ob !== ob && sld.ob !== ob.parent && sld.ob.parent !== ob && boxesOverlap(sld.box, b, 2)) || onLink(b);
    const order = ob.labelSide ? [ob.labelSide] : ['below', 'above', 'right', 'left'];
    let pos = place(order[0]);
    for (const side of order) { const p = place(side); if (!clash(p.box)) { pos = p; break; } }
    if (clash(pos.box)) note(onLink(pos.box) && !labelBoxes.some((l) => boxesOverlap(l, pos.box, 1)) ? 'hint' : 'warn', 'label-overlap', `The label "${ob.label || ob.sub}" overlaps another label, an object or a link. Give "${ob.id}" more room, shorten the text, or set labelSide: 'above' | 'below' | 'left' | 'right'.`);
    labelBoxes.push(pos.box);
    let y = pos.y, svg = '';
    for (const l of lines) {
      y += l.size * 1.0;
      svg += `<text x="${r1(pos.x)}" y="${r1(y)}" font-size="${l.size}" font-family="${esc(th.font)}" font-weight="${l.weight}" text-anchor="${pos.anchor}" fill="${l.fill}"${halo}>${esc(l.text)}</text>`;
      y += l.size * 0.28;
    }
    if (ob.opts.badge != null) {
      const bx = pos.anchor === 'middle' ? pos.box.x0 - 15 : pos.anchor === 'start' ? pos.box.x0 + 9 : pos.box.x0 - 15;
      const by = pos.box.y0 + LS * 0.62;
      const A = K.hex('accent');
      svg += `<circle cx="${r1(bx)}" cy="${r1(by)}" r="9.5" fill="${A}"/><text x="${r1(bx)}" y="${r1(by + 4)}" font-size="11.5" font-family="${esc(th.font)}" font-weight="800" text-anchor="middle" fill="${material(th, 'accent').on}">${esc(ob.opts.badge)}</text>`;
      pos.box.x0 -= 26;
    }
    overlay += wrap(aside(wrap(svg, opacityStyle(ob), hiddenAttr(ob))), ob.tracks.move ? trackStyle(ob.tracks.move) : '');
    grow(pos.box);
    if (ob.tracks.move) for (const sg of ob.tracks.move.segs) grow({ x0: pos.box.x0 + sg.to[0], x1: pos.box.x1 + sg.to[0], y0: pos.box.y0 + sg.to[1], y1: pos.box.y1 + sg.to[1] });
  }

  // --- zone labels lie on the floor along one edge of the zone. Try each edge and keep the one
  //     that collides with the fewest links, objects and labels.
  for (const zn of sc.zones) {
    if (!zn.label) continue;
    const len = textWidth(zn.label, 0.345, 700) + 0.1, sz = 0.32;
    const cands = [
      { o: [zn.x0 - 0.2, zn.y1 - 0.55, 0], turn: 3, rect: [[zn.x0 - 0.2, zn.y1 - 0.55], [zn.x0 - 0.2 - sz, zn.y1 - 0.55 - len]] }, // far-left edge
      { o: [zn.x0 + 0.55, zn.y0 - 0.2, 0], turn: 0, rect: [[zn.x0 + 0.55, zn.y0 - 0.2], [zn.x0 + 0.55 + len, zn.y0 - 0.2 - sz]] }, // far-right edge
      { o: [zn.x0 + 0.55, zn.y1 + 0.5, 0], turn: 0, rect: [[zn.x0 + 0.55, zn.y1 + 0.5], [zn.x0 + 0.55 + len, zn.y1 + 0.5 - sz]] }, // near-left edge
      { o: [zn.x1 + 0.5, zn.y1 - 0.55, 0], turn: 3, rect: [[zn.x1 + 0.5, zn.y1 - 0.55], [zn.x1 + 0.5 - sz, zn.y1 - 0.55 - len]] }, // near-right edge
    ];
    let best = null;
    for (const c of cands) {
      const [[xa, ya], [xb, yb]] = c.rect;
      const box = bbox2([proj(xa, ya, 0), proj(xb, yb, 0), proj(xa, yb, 0), proj(xb, ya, 0)]);
      let score = 0;
      for (const l of labelBoxes) if (boxesOverlap(l, box, 1)) score += 3;
      for (const sld of solid) if (boxesOverlap(sld.box, box, 2)) score += 3;
      for (const lk of sc.links) if (lk.path.flat.some((f) => { const q = projP(f.p); return q[0] > box.x0 - 3 && q[0] < box.x1 + 3 && q[1] > box.y0 - 3 && q[1] < box.y1 + 3; })) score += 2;
      if (!best || score < best.score) best = { ...c, box, score };
      if (score === 0) break;
    }
    floor += `<g transform="${planeMatrix('top', best.o, best.turn)}"><text x="0" y="0" font-size="${sz}" font-family="${esc(th.font)}" font-weight="700" letter-spacing="0.04" fill="${th.text.muted}">${esc(zn.label)}</text></g>`;
    labelBoxes.push(best.box);
    grow(best.box);
  }

  // --- state badges from the story
  for (const ob of sc.objs) {
    ob.marks.forEach((mk, i) => {
      const sb = aabbScreen(ob.box);
      const cx = proj(ob.x, ob.y, 0)[0] + i * 28, cy = sb.y0 - 12;
      const role = mk.color || (mk.icon === 'check' ? 'ok' : mk.icon === 'x' ? 'danger' : mk.icon === 'warning' ? 'warn' : 'accent');
      const m = material(th, role);
      const ic = ICONS[mk.icon].replace(/\{c\}/g, m.on);
      overlay += `<g transform="translate(${r1(cx)} ${r1(cy)})"><g opacity="0" style="${trackStyle(mk.op)}"><g style="${trackStyle(mk.sc)}"><circle r="13" fill="${m.base}" stroke="${th.outline ? th.ink : th.text.halo}" stroke-width="${th.outline || 2}"/><g transform="translate(-8 -8) scale(0.667)" fill="none" stroke="${m.on}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${ic}</g></g></g></g>`;
      if (rich) {
        const t0 = mk.op.segs[0].t0;
        const rays = Array.from({ length: 8 }, (_, k) => `<path d="M0 -19V-26" transform="rotate(${k * 45})"/>`).join('');
        const sc2 = keyframes('scale', [[0, 0.5], [t0, 0.5, 'out'], [t0 + 0.5, 1.35], [T, 1.35]], T);
        const op2 = keyframes('opacity', [[0, 0], [Math.max(0, t0 - 0.001), 0], [t0 + 0.08, 1, 'smooth'], [t0 + 0.5, 0], [T, 0]], T);
        overlay += `<g transform="translate(${r1(cx)} ${r1(cy)})"><g fill="none" stroke="${m.base}" stroke-width="2" stroke-linecap="round" opacity="0" style="${join(storyStyle(sc2), storyStyle(op2))}">${rays}</g></g>`;
      }
      grow({ x0: cx - 16, x1: cx + 16, y0: cy - 28, y1: cy + 16 });
    });
  }

  // ================================================================ 6. frame, captions, background

  if (!bounds) bounds = { x0: -100, y0: -100, x1: 100, y1: 100 };
  // pad: one number, [sides, top-and-bottom], or [top, right, bottom, left]
  const pads = Array.isArray(o.pad) ? (o.pad.length === 2 ? [o.pad[1], o.pad[0], o.pad[1], o.pad[0]] : [0, 1, 2, 3].map((i) => o.pad[i] ?? o.pad[0] ?? 56)) : [o.pad, o.pad, o.pad, o.pad];
  const pad = Math.min(pads[1], pads[3]);
  let vb = { x0: bounds.x0 - pads[3], y0: bounds.y0 - pads[0], x1: bounds.x1 + pads[1], y1: bounds.y1 + pads[2] };
  const cx = (vb.x0 + vb.x1) / 2;

  if (o.heading) {
    vb.y0 -= o.subheading ? 62 : 44;
    const need = Math.max(textWidth(o.heading, 24, 750), o.subheading ? textWidth(o.subheading, 14, 500) : 0) + 88;
    if (vb.x1 - vb.x0 < need) { const add = (need - (vb.x1 - vb.x0)) / 2; vb.x0 -= add; vb.x1 += add; }
  }

  let captionSvg = '';
  if (captions.length) {
    captions.sort((a, b) => a.t - b.t);
    const capY = vb.y1 + 6;
    vb.y1 += 40;
    const widest = Math.max(...captions.map((c) => textWidth(c.text, 15.5, 600)));
    if (widest + pad > vb.x1 - vb.x0) { const add = (widest + pad - (vb.x1 - vb.x0)) / 2; vb.x0 -= add; vb.x1 += add; }
    captions.forEach((c, i) => {
      const shown = (i < captions.length - 1 ? captions[i + 1].t : T - 0.55) - c.t;
      if (shown < 1) note('warn', 'caption-rushed', `Caption "${c.text.slice(0, 40)}${c.text.length > 40 ? '…' : ''}" is on screen for only ${r1(Math.max(0, shown))}s, so it cannot be read${shown < 0.3 ? ' and will overprint the next one' : ''}. Put the steps it describes, or s.wait(1.5), between it and the next s.say().`);
      if (c.text.length > 64) note('hint', 'caption-long', `Caption "${c.text.slice(0, 40)}…" is long. Captions read best under about 60 characters.`);
      const last = i === captions.length - 1;
      const out = last ? T - 0.55 : captions[i + 1].t; // fade out as the next caption arrives
      const tr = new Track('opacity', 0).to(c.t + (i ? 0.12 : 0), c.t + (i ? 0.3 : 0.22), 1, 'smooth').to(Math.max(c.t + 0.32, out), Math.max(c.t + 0.32, out) + 0.16, 0, 'smooth');
      captionSvg += `<text x="${r1((vb.x0 + vb.x1) / 2)}" y="${r1(capY)}" font-size="15.5" font-family="${esc(th.font)}" font-weight="600" text-anchor="middle" fill="${th.text.color}" opacity="${i === 0 ? 1 : 0}" style="${trackStyle(tr)}">${esc(c.text)}</text>`;
    });
  }

  // size: [w, h] fixes the image's width and height, so rebuilding never changes the space it takes on a page
  if (o.size && !(Array.isArray(o.size) && o.size[0] > 0 && o.size[1] > 0)) throw new Error(`size must be [width, height] in pixels, e.g. size: [640, 480]; got ${JSON.stringify(o.size)}.`);
  if (o.aspect || o.size) {
    const ar = o.size ? o.size[0] / o.size[1] : typeof o.aspect === 'number' ? o.aspect : (() => { const [a, b] = String(o.aspect).split(/[:/x]/).map(Number); return a / b; })();
    if (!(ar > 0)) throw new Error(`aspect must look like '16:9' or a number, got "${o.aspect}".`);
    const w = vb.x1 - vb.x0, h = vb.y1 - vb.y0;
    if (w / h < ar) { const add = (h * ar - w) / 2; vb.x0 -= add; vb.x1 += add; } else { const add = (w / ar - h) / 2; vb.y0 -= add; vb.y1 += add; }
  }
  vb = { x0: Math.floor(vb.x0), y0: Math.floor(vb.y0), x1: Math.ceil(vb.x1), y1: Math.ceil(vb.y1) };
  let headingSvg = '';
  if (o.heading) {
    headingSvg += `<text x="${vb.x0 + 40}" y="${vb.y0 + 58}" font-size="24" font-family="${esc(th.font)}" font-weight="750" letter-spacing="-0.3" fill="${th.text.color}">${esc(o.heading)}</text>`;
    if (o.subheading) headingSvg += `<text x="${vb.x0 + 40}" y="${vb.y0 + 82}" font-size="14" font-family="${esc(th.font)}" font-weight="500" fill="${th.text.muted}">${esc(o.subheading)}</text>`;
  }
  if (smallText.length) {
    const worst = smallText.reduce((a, b) => (b.px < a.px ? b : a));
    note('hint', 'text-small', `Text drawn on a face is too small to read: "${worst.text.slice(0, 20)}" is ${r1(worst.px)} px high${smallText.length > 1 ? ` (and ${smallText.length - 1} more)` : ''}. Use size 0.24 or more (0.3 reads well), or say it with a label, a callout or a caption instead.`);
  }
  {
    const wide = vb.x1 - vb.x0, onPhone = (14 * 360) / wide;
    if (onPhone < 6) note('hint', 'phone-text', `This picture is ${Math.round(wide)} px wide, so on a phone (360 px) its labels shrink to about ${r1(onPhone)} px. If it will be read on phones, fold the layout into two lanes or an L so it is narrower, or build a second, simpler version for small screens.`);
  }
  const W = vb.x1 - vb.x0, H = vb.y1 - vb.y0;
  const outW = o.size ? Math.round(o.size[0]) : W, outH = o.size ? Math.round(o.size[1]) : H;
  const mx = (bounds.x0 + bounds.x1) / 2, my = (bounds.y0 + bounds.y1) / 2;

  let bg = '', floorBg = '';
  if (o.background) {
    let fill = th.bg.from;
    if (th.bg.type === 'radial') fill = `url(#${def('bg', (id) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${r1(mx)}" cy="${r1(my)}" r="${r1(Math.max(W, H) * 0.72)}"><stop offset="0" stop-color="${th.bg.from}"/><stop offset="1" stop-color="${th.bg.to}"/></radialGradient>`)})`;
    else if (th.bg.type === 'linear') fill = `url(#${def('bg', (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.bg.from}"/><stop offset="1" stop-color="${th.bg.to}"/></linearGradient>`)})`;
    bg += `<rect x="${vb.x0}" y="${vb.y0}" width="${W}" height="${H}" fill="${fill}"/>`;
    if (th.floor.spotAlpha > 0) floorBg += `<ellipse cx="${r1(mx)}" cy="${r1(my + (bounds.y1 - bounds.y0) * 0.12)}" rx="${r1((bounds.x1 - bounds.x0) * 0.62)}" ry="${r1((bounds.x1 - bounds.x0) * 0.62 * 0.52)}" fill="url(#${glowGrad(th.floor.spot, th.floor.spotAlpha)})"/>`;
  }
  const gridKind = o.grid === false ? 'none' : o.grid === true ? (th.floor.grid === 'none' ? 'dots' : th.floor.grid) : typeof o.grid === 'string' ? o.grid : o.background ? th.floor.grid : 'none';
  if (gridKind !== 'none') {
    const C = Math.cos(Math.PI / 6) * UNIT, S = 0.5 * UNIT;
    const corners = [[vb.x0, vb.y0], [vb.x1, vb.y0], [vb.x0, vb.y1], [vb.x1, vb.y1]].map(([sx, sy]) => [(sx / C + sy / S) / 2, (sy / S - sx / C) / 2]);
    const xs = corners.map((c) => c[0]), ys = corners.map((c) => c[1]);
    const xa = Math.floor(Math.min(...xs)), xb = Math.ceil(Math.max(...xs)), ya = Math.floor(Math.min(...ys)), yb = Math.ceil(Math.max(...ys));
    let d = '';
    if (gridKind === 'lines') {
      for (let x = xa; x <= xb; x++) { const a = proj(x, ya), b = proj(x, yb); d += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; }
      for (let y = ya; y <= yb; y++) { const a = proj(xa, y), b = proj(xb, y); d += `M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`; }
    } else {
      for (let x = xa; x <= xb; x++) for (let y = ya; y <= yb; y++) {
        const p = proj(x, y);
        if (p[0] < vb.x0 - 4 || p[0] > vb.x1 + 4 || p[1] < vb.y0 - 4 || p[1] > vb.y1 + 4) continue;
        d += `M${r1(p[0])} ${r1(p[1])}h0`;
      }
    }
    const fadeR = Math.max(bounds.x1 - bounds.x0, (bounds.y1 - bounds.y0) * 1.7) * 0.62 + 120;
    const mask = def('gridmask', (id) => `<radialGradient id="${id}g" gradientUnits="userSpaceOnUse" cx="${r1(mx)}" cy="${r1(my)}" r="${r1(fadeR)}" gradientTransform="translate(0 ${r1(my * 0.42)}) scale(1 0.58)"><stop offset="0.25" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><mask id="${id}" maskUnits="userSpaceOnUse" x="${vb.x0}" y="${vb.y0}" width="${W}" height="${H}"><rect x="${vb.x0}" y="${vb.y0}" width="${W}" height="${H}" fill="url(#${id}g)"/></mask>`);
    floorBg += `<path d="${d}" fill="none" stroke="${th.floor.color}" stroke-opacity="${th.floor.alpha}" stroke-width="${gridKind === 'lines' ? 1 : 2.2}" stroke-linecap="round" mask="url(#${mask})"/>`;
  }

  // ================================================================ 7. lint

  const vis = sc.objs.filter((ob) => !ob.hidden && !ob.free);
  // an object sunk into the floor only takes up the part of its height that shows
  const standing = (ob) => (ob.level < 1 ? { ...ob.box, z1: ob.box.z0 + (ob.box.z1 - ob.box.z0) * Math.max(0.02, ob.level) } : ob.box);
  for (let i = 0; i < sc.objs.length; i++) for (let j = i + 1; j < sc.objs.length; j++) {
    const a = sc.objs[i], b = sc.objs[j];
    if (a.parent === b || b.parent === a || (a.hidden !== b.hidden) || a.free || b.free) continue;
    if (aabbIntersects(standing(a), standing(b), 0.04)) note('warn', 'overlap', `"${a.id}" and "${b.id}" occupy the same space, so they will cut into each other. Move one of them (they need about ${r1((a.w + b.w) / 2 + 0.4)} cells between centres along x, or ${r1((a.d + b.d) / 2 + 0.4)} along y), or stack with on:.`);
  }
  if (vis.length > 16) note('warn', 'crowded', `${vis.length} objects is a lot for one picture. The clearest scenes use 3–9 objects; cut supporting detail or split the idea into two scenes.`);
  else if (vis.length > 11) note('hint', 'crowded', `${vis.length} objects: check that each one is needed to explain the idea.`);
  // a callout's words should sit on clear background, not on an object or on another callout
  calloutBoxes.forEach((c, i) => {
    const tight = growBox(c.box, -3);
    // the object a callout points into is the one it is about; only other objects count
    const onObj = vis.find((ob) => { const sb = aabbScreen(ob.box); return !(c.ax >= sb.x0 - 6 && c.ax <= sb.x1 + 6 && c.ay >= sb.y0 - 6 && c.ay <= sb.y1 + 6) && boxesOverlap(tight, growBox(sb, -6)); });
    const onOther = calloutBoxes.find((d, j) => j < i && !(c.timed && d.timed) && boxesOverlap(tight, growBox(d.box, -3)));
    if (onObj || onOther) note('hint', 'callout-overlap', `The callout "${c.text}" sits on ${onObj ? `"${onObj.id}"` : `the callout "${onOther.text}"`}. Move its words onto clear background with side: 'left' | 'right', rise (pixels up, negative for down) and length.`);
  });
  const heroes = sc.objs.filter((ob) => ob.hero);
  if (vis.length >= 4 && heroes.length === 0 && !sc.objs.some((ob) => ob.opts.glow || ['accent', 'accent2'].includes(ob.opts.color))) note('hint', 'no-hero', 'No focal point. Mark the single most important object with hero: true so the eye has somewhere to land.');
  if (heroes.length > 2) note('hint', 'many-heroes', `${heroes.length} objects are marked hero. One focal point reads best; keep hero: true for the single most important object.`);
  const hasMotion = sc.steps || sc.objs.some((ob) => ob.float || ob.animated) || sc.links.some((l) => l.o.flow);
  for (const ob of sc.objs) if (ob.level < 1 && !ob.tracks.grow) note('hint', 'never-grown', `"${ob.id}" starts at level ${ob.level} but the story never raises it. Add s.grow(${ob.id}) to the story.`);
  if (!hasMotion && sc.objs.length) note('hint', 'static', 'Nothing moves yet. Add a story (s.story([...])) to show the idea happening, or flow: true on a link.');
  if (sc.objs.filter((ob) => ob.float).length > 3) note('hint', 'too-much-float', 'More than three floating objects makes the scene feel restless. Float only the hero or things that really hover.');
  if (T > 16) note('hint', 'long-loop', `The loop is ${r1(T)}s long. Loops of 5–12s hold attention best; trim steps or split the story.`);
  if (W / H > 2.7) note('hint', 'aspect', `The picture is very wide (${Math.round(W)}×${Math.round(H)}). Spread objects along y as well as x, or it will look thin where it is embedded.`);
  if (W / H < 0.72) note('hint', 'aspect', `The picture is very tall (${Math.round(W)}×${Math.round(H)}). Spread objects along x as well as y.`);
  for (const ob of sc.objs) if (ob.hidden && !ob.tracks.opacity) note('warn', 'never-shown', `"${ob.id}" is hidden: true but the story never reveals it. Add s.pop(${ob.id}) or s.show(${ob.id}) to the story.`);
  const labelled = sc.objs.filter((ob) => ob.label).length;
  if (vis.length >= 3 && labelled === 0 && !captions.length && !sc.callouts.length) note('hint', 'no-labels', 'No labels or captions: viewers may not know what the objects stand for. Label the key objects.');

  // ================================================================ 8. assemble

  const hazeSvg = o.background && o.haze !== false && th.haze > 0 && H > 320 ? `<rect x="${vb.x0}" y="${vb.y0}" width="${W}" height="${Math.round(H * 0.5)}" fill="url(#${def('haze', (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.bg.to}" stop-opacity="${typeof o.haze === 'number' ? o.haze : th.haze}"/><stop offset="1" stop-color="${th.bg.to}" stop-opacity="0"/></linearGradient>`)})" pointer-events="none"/>` : '';
  const worldOrder = depthSort(world);
  const sortedWorld = worldOrder.map((w) => w.svg).join('');
  // An object that slides keeps the drawing order of the place it started. If it ends up in front of
  // something it is drawn behind (or the other way round), it will look wrong when it gets there.
  {
    const rank = new Map(worldOrder.map((w, i) => [w.ob, i]));
    const eps = 0.011, seenPairs = new Set();
    for (const a of sc.objs) {
      if (!a.movedTo || a.free || !rank.has(a)) continue;
      for (const d of a.movedTo) {
        const A = aabbShift(a.box, d);
        for (const b of sc.objs) {
          if (b === a || b.free || b.hidden || b.parent === a || a.parent === b || !rank.has(b) || seenPairs.has(b)) continue;
          const B = b.box;
          if (!boxesOverlap(aabbScreen(A), aabbScreen(B))) continue;
          const aFront = A.x1 > B.x0 + eps && A.y1 > B.y0 + eps && A.z1 > B.z0 + eps, bFront = B.x1 > A.x0 + eps && B.y1 > A.y0 + eps && B.z1 > A.z0 + eps;
          if (aFront === bFront) continue;
          const drawnInFront = rank.get(a) > rank.get(b);
          if (drawnInFront !== aFront) {
            seenPairs.add(b);
            note('warn', 'move-depth', `"${a.id}" moves ${aFront ? 'in front of' : 'behind'} "${b.id}" but will be drawn ${aFront ? 'behind' : 'in front of'} it, because an object that slides keeps the drawing order of the place where it starts. Start "${a.id}" where it ends and move it the other way; or lay the scene out so it starts ${aFront ? 'nearer the viewer (larger x + y)' : 'further from the viewer (smaller x + y)'} than "${b.id}"; or make the trip a token instead: s.send(from, to, { as: '${a.kind}' }).`);
          }
        }
      }
    }
  }
  const fadeIn = (delay, dur = 0.5) => (o.intro ? `animation:${kf('from{opacity:0}to{opacity:1}')} ${dur}s ease-out ${r2(delay)}s both` : '');
  // the camera: one transform over everything in the scene, leaving backdrop, heading and captions where they are
  let cameraOpen = '';
  if (cameraSteps.length) {
    const cxm = vb.x0 + W / 2, cym = vb.y0 + (H - (captions.length ? 46 : 0)) / 2;
    const cam = new Track('camera', [0, 0, 1]);
    for (const c of cameraSteps) {
      const f = c.focus ? projP(c.focus) : null;
      cam.to(c.t0, c.t1, f ? [cxm - c.k * f[0], cym - c.k * f[1], c.k] : [0, 0, 1], c.ease);
    }
    cam.close(T);
    // the zoomed scene stays out of the strip the captions are written in
    const strip = captions.length ? 46 : 0;
    const clip = strip ? def('camclip', (id) => `<clipPath id="${id}"><rect x="${vb.x0}" y="${vb.y0}" width="${W}" height="${H - strip}"/></clipPath>`) : null;
    cameraOpen = `<g${clip ? ` clip-path="url(#${clip})"` : ''}><g style="${trackStyle(cam)}">`;
  }
  const css = [
    ...[...kfs.entries()].map(([body, name]) => `@keyframes ${name}{${body}}`),
    `#${uid}.is-paused *{animation-play-state:paused!important}`,
    `@media (prefers-reduced-motion:reduce){#${uid} *{animation:none!important}}`,
  ].join('');
  const title = o.title || o.heading || 'Isometric illustration';
  const desc = o.desc || (sc.objs.filter((ob) => ob.label).length ? `Shows: ${sc.objs.filter((ob) => ob.label).map((ob) => ob.label).join(', ')}.` : '');
  const pieces = [
    `<svg xmlns="http://www.w3.org/2000/svg" id="${uid}" viewBox="${vb.x0} ${vb.y0} ${W} ${H}" width="${outW}" height="${outH}" role="img" aria-labelledby="${uid}-t${desc ? ` ${uid}-s` : ''}" data-loop="${r2(T)}" data-intro="${introEnd}"${o.background ? ` data-bg="${th.bg.to}"` : ''}${th.dark ? ' data-dark="1"' : ''}${captions.length ? ` data-chapters="${esc(JSON.stringify(captions.map((c) => ({ t: +c.t.toFixed(2), text: c.text }))))}"` : ''}${keyTimes.length ? ` data-keys="${[...new Set([...keyTimes, T - 0.95].map((t) => Math.max(0, Math.min(T - 0.05, t)).toFixed(2)))].join(' ')}"` : ''} font-family="${esc(th.font)}">`,
    `<title id="${uid}-t">${esc(title)}</title>`, desc ? `<desc id="${uid}-s">${esc(desc)}</desc>` : '',
    `<style>${css}</style>`,
    `<defs>${[...defs.values()].map((d) => d.svg).join('')}</defs>`,
    bg ? `<g>${bg}</g>` : '',
    cameraOpen,
    floorBg ? `<g>${floorBg}</g>` : '',
    wrap(floor + glowLayer + shadowLayer + linkLayer + ringLayer + floorFx, fadeIn(0, 0.6)),
    `<g>${sortedWorld}</g>`,
    motes,
    air ? wrap(air, fadeIn(introEnd * 0.6)) : '',
    wrap(overlay, fadeIn(Math.max(0, introEnd - 0.35), 0.45)),
    cameraOpen ? '</g></g>' : '',
    hazeSvg,
    headingSvg ? wrap(headingSvg, fadeIn(Math.max(0, introEnd - 0.35), 0.45)) : '',
    captionSvg ? wrap(captionSvg, fadeIn(Math.max(0, introEnd - 0.2))) : '',
    '</svg>',
  ];
  const svg = pieces.join('');
  if (svg.length > 150 * 1024) {
    // say what the size is made of, so the cure is obvious
    const kfBytes = css.length, kfCount = (css.match(/@keyframes/g) || []).length;
    const heavy = world.map((w) => ({ id: w.ob ? w.ob.id : '?', kb: w.svg.length / 1024 })).sort((a, b) => b.kb - a.kb).slice(0, 2).filter((w) => w.kb > 12);
    note('hint', 'large', `The SVG is ${Math.round(svg.length / 1024)} KB; most scenes are 30 to 80. ${Math.round(kfBytes / 1024)} KB of it is ${kfCount} sets of keyframes${heavy.length ? `, and the heaviest objects are ${heavy.map((w) => `${w.id} (${Math.round(w.kb)} KB)`).join(' and ')}` : ''}. Many separately keyed dots are the usual cause: sh.stream, or flow on a link, moves any number of particles with a handful of shared keyframes.`);
  }

  return { svg, width: outW, height: outH, loop: T, intro: introEnd, notes, objects: sc.objs.length, bytes: svg.length, motion: () => ({ timeline, parts: probe.report(), flows }) };
}
