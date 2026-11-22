// Turns a Scene into one self-contained SVG string (static artwork + CSS animation).

import {
  UNIT, SPHERE_K, proj, projP, r1, r2, depthSort, aabbScreen, aabbUnion, aabbShift, aabbIntersects,
  bbox2, unionBox, growBox, boxesOverlap, rectOutline, circleOutline, polyPath, textWidth, esc, planeMatrix,
} from './geom.mjs';
import { material } from './themes.mjs';
import { KIT, PACKETS } from './kit.mjs';
import { renderPrim, primBox, renderPrism } from './prims.mjs';
import { buildPath, pointAt, reversePath } from './links.mjs';
import { Track, keyframes, snapPeriod, schedule, EASE, EASE_FN } from './motion.mjs';
import { rgba, mix } from './color.mjs';
import { ICONS } from './icons.mjs';

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
  for (const ob of sc.objs) { ob.tracks = {}; ob.tints = []; ob.marks = []; }

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
  const movers = [], rings = [], captions = [], keyTimes = [];
  let T = o.loop ?? 6;
  const sameEnd = (a, b) => (a.obj && b.obj ? a.obj === b.obj : !a.obj && !b.obj && Math.abs(a.x - b.x) < 1e-6 && Math.abs(a.y - b.y) < 1e-6);
  const pathFor = (st) => {
    if (st.route || st.via || st.arc) return sc._route(st.from, st.to, st);
    for (const lk of sc.links) {
      if (sameEnd(lk.a, st.from) && sameEnd(lk.b, st.to)) return lk.path;
      if (sameEnd(lk.a, st.to) && sameEnd(lk.b, st.from)) return reversePath(lk.path);
    }
    if (st.from.obj && st.to.obj) note('hint', 'send-no-link', `send(${st.from.obj.id} → ${st.to.obj.id}) has no link between the two objects, so the token crosses open floor. Add s.link(${st.from.obj.id}, ${st.to.obj.id}) so viewers see the route.`);
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
      if (st.type !== 'send') return undefined;
      st._path = pathFor(st);
      const n = st.count ?? 1;
      return clamp(st._path.total / (st.speed ?? speed), 0.6, 2.6) + (n - 1) * (st.stagger ?? 0.22);
    };
    const { items, end } = schedule(sc.steps, 0.35, sc.storyOpts.gap ?? 0.12, durOf);
    T = Math.max(end + (sc.storyOpts.hold ?? 0.9), o.loop ?? 0);
    T = Math.ceil(T * 10) / 10;
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

  // ================================================================ 2. shared helpers

  const sorted = [...sc.objs].sort((a, b) => a.x + a.y - (b.x + b.y));
  const stagger = o.intro ? Math.min(0.07, 0.6 / Math.max(1, sorted.length)) : 0;
  const introEnd = o.intro ? r2(0.55 + sorted.length * stagger + 0.1) : 0;
  const introOf = new Map(sorted.map((ob, i) => [ob, i * stagger]));

  const loopStyle = (css, { period = T, delay = 0, ease = 'linear' } = {}) => `animation:${kf(css)} ${r2(period)}s ${ease} ${r2(delay)}s infinite both`;
  const storyStyle = (css) => loopStyle(css, { delay: introEnd });
  const trackStyle = (tr) => storyStyle(tr.css(T));
  const join = (...list) => list.filter(Boolean).join(',').replace(/,animation:/g, ',');

  const ctx = {
    theme: th,
    mat: (c) => material(th, c || 'body'),
    def,
    clipId: (k) => `${uid}-${k}`,
    animStyle(a) {
      switch (a.type) {
        case 'blink': {
          const P = snapPeriod(a.period || 2.4, T);
          return loopStyle(`0%,100%{opacity:1}50%{opacity:${a.min ?? 0.25}}`, { period: P, delay: -(a.phase || 0) * P, ease: 'ease-in-out' });
        }
        case 'spin': return loopStyle(`to{transform:rotate(${a.dir === -1 ? -360 : 360}deg)}`, { period: snapPeriod(a.period || 8, T) });
        case 'march': return loopStyle(`to{stroke-dashoffset:${-a.len}}`, { period: snapPeriod(a.period || 1.2, T) });
        case 'ring': {
          const P = snapPeriod(a.period || 2.4, T);
          return loopStyle(`0%{transform:scale(.3);opacity:0}15%{opacity:.9}100%{transform:scale(1.25);opacity:0}`, { period: P, delay: -(a.phase || 0) * P, ease: 'ease-out' });
        }
        default: return '';
      }
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
    if (!o.shadows || th.shadow.kind === 'none' || ob.opts.shadow === false) return '';
    const sh = ob.res.shadow || {};
    const k = ob.k;
    const floating = ob.z > 0.05 && !ob.parent;
    const soft = !!sh.soft || floating;
    const baseZ = ob.parent ? ob.z : 0;
    const round = sh.r != null || sh.round || (ob.res.round && sh.w == null);
    const sw = (sh.w ?? ob.res.w) * k, sd = (sh.d ?? ob.res.d) * k;
    let outline = round ? (sh.r != null ? circleOutline(sh.r * k, 0, 0, 28) : circleOutline(1, 0, 0, 28).map(([a, b]) => [(a * sw) / 2, (b * sd) / 2])) : rectOutline(sw, sd, Math.min(0.18, sw / 3, sd / 3));
    let body;
    if (th.shadow.kind === 'cast' && !soft && !ob.parent) {
      const hh = Math.min(ob.h, 2.6);
      const dx = 0.5 * hh, dy = -0.26 * hh;
      const pts = hull([...outline, ...outline.map(([a, b]) => [a + dx, b + dy])]);
      body = `<path d="${polyPath(pts.map(([a, b]) => proj(a, b, 0)))}" fill="${th.shadow.color}" fill-opacity="${th.shadow.alpha}"/>`;
    } else {
      const g = ob.parent ? 1.03 : soft ? 0.92 : 1.1;
      const off = ob.parent || soft ? [0, 0] : [0.1 + Math.min(ob.h, 2) * 0.05, -0.05];
      const blur = ob.parent ? 2 : th.shadow.kind === 'cast' ? 6 : th.shadow.blur * (soft ? 1.35 : 1);
      const alpha = (th.shadow.kind === 'cast' ? 0.3 : th.shadow.alpha) * (soft ? 0.6 : 1);
      const pts = outline.map(([a, b]) => proj(a * g + off[0], b * g + off[1], 0));
      body = `<path d="${polyPath(pts)}" fill="${th.shadow.color}" fill-opacity="${r2(alpha)}" filter="url(#${blurFilter(blur)})"/>`;
    }
    const [sx, sy] = proj(ob.x, ob.y, baseZ);
    const fl = floatStyleOf.get(ob);
    let inner = wrap(body, fl ? fl.shadow : '');
    inner = wrap(inner, opacityStyle(ob), hiddenAttr(ob));
    grow(growBox(bbox2([[sx - sw * UNIT, sy - sd * UNIT * 0.5], [sx + sw * UNIT, sy + sd * UNIT * 0.5]]), 6));
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
      svg += `<path d="${d}" fill="none" stroke="${color}" stroke-opacity="${r2(alpha)}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${dashArr ? ` stroke-dasharray="${dashArr}"` : ''}${style ? ` style="${style}"` : ''}/>`;
    }
    svg += arrow ? `<g opacity="${r2(alpha)}">${arrow}</g>` : '';
    // travelling dots for a continuous flow
    let dots = '';
    if (flow) {
      const fo = typeof flow === 'object' ? flow : {};
      const count = fo.count ?? Math.max(1, Math.round(path.total / 2.6));
      const P = snapPeriod(path.total / (fo.speed ?? 2.4), T);
      const stops = flat.map((f, i) => [(path.lens[i] / path.total) * P, projP(f.p)]);
      const css = keyframes('translate', stops, P);
      const fade = keyframes('opacity', [[0, 0], [P * 0.08, 1], [P * 0.9, 1], [P, 0]], P);
      const dotColor = fo.color ? K.hex(fo.color) : th.glow > 0 ? mix(color, '#ffffff', 0.35) : K.hex('accent');
      for (let i = 0; i < count; i++) {
        const delay = -((i + 0.5) / count) * P;
        const pos = projP(pointAt(path, (i + 0.5) / count));
        const glowDot = th.glow > 0 ? `<circle r="9" fill="url(#${glowGrad(dotColor, 0.8)})"/>` : '';
        dots += `<g transform="translate(${r1(pos[0])} ${r1(pos[1])})" style="${join(loopStyle(css, { period: P, delay }), loopStyle(fade, { period: P, delay }))}">${glowDot}<circle r="${lo.style === 'pipe' ? 4 : 3.2}" fill="${dotColor}"${th.outline ? ` stroke="${th.ink}" stroke-width="1.2"` : ''}/></g>`;
      }
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
        if (ob === lk.a.obj || ob === lk.b.obj || ob.parent || ob.z > 0.3) continue;
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
      const res = KIT[ob.kind].build({ ...ob.opts, color: tint.color, accent: ob.opts.accent === tint.color ? 'paper' : ob.opts.accent }, K);
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
    inner = wrap(inner, opacityStyle(ob), hiddenAttr(ob));
    if (ob.tracks.scale) inner = wrap(inner, trackStyle(ob.tracks.scale));
    const fl = floatStyleOf.get(ob);
    if (fl) inner = wrap(inner, fl.obj);
    if (ob.tracks.shake) inner = wrap(inner, trackStyle(ob.tracks.shake));
    if (ob.tracks.lift) inner = wrap(inner, trackStyle(ob.tracks.lift));
    inner = wrap(inner, introStyle(ob));
    const [sx, sy] = proj(ob.x, ob.y, ob.z);
    const svg = `${stackedShadow.get(ob) || ''}<g transform="translate(${r1(sx)} ${r1(sy)})">${inner}</g>`;
    let box = ob.box;
    if (ob.float) box = { ...box, z1: box.z1 + 0.2 };
    world.push({ aabb: box, svg, ob });
    const sb = aabbScreen(box);
    const liftPx = ob.tracks.lift ? Math.max(0, ...ob.tracks.lift.segs.map((s) => -s.to[1])) : 0;
    grow({ x0: sb.x0, x1: sb.x1, y0: sb.y0 - liftPx - (ob.float ? 8 : 0), y1: sb.y1 });
  }

  // --- story tokens: one copy per straight run of the route, so each sorts correctly among the objects
  // a token that stays at its destination remains until the next hop of the same id, or the loop end
  movers.forEach((mv, mi) => {
    if (!mv.stay) return;
    const next = movers.find((m2, j) => j > mi && mv.id && m2.id === mv.id);
    mv.until = next ? next.t0 : T - 0.45;
  });
  const kitToken = (mv) => {
    const res = KIT[mv.as].build({ color: mv.color === 'accent' ? 'body' : mv.color, accent: 'accent' }, K);
    const k = mv.scale ?? 0.5;
    return { parts: sc.scaleParts(res.parts, k), shadow: Math.max(res.w, res.d) * k * 0.45 };
  };
  movers.forEach((mv, mi) => {
    let pk = PACKETS[mv.as] ? PACKETS[mv.as](mv.color, K) : KIT[mv.as] ? kitToken(mv) : PACKETS.dot(mv.color, K);
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
    const body = glowSvg + partsSvg;

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
  const calloutSvg = (ax, ay, c) => {
    const left = c.side === 'left';
    const dir = left ? -1 : 1;
    const tx = ax + 30 * dir;
    const w = Math.max(textWidth(c.text, 13, 650), c.sub ? textWidth(c.sub, 11, 500) : 0);
    let svg = `<path d="M${r1(ax + 5 * dir)} ${r1(ay)}H${r1(tx - 6 * dir)}" stroke="${th.text.muted}" stroke-width="1.2" stroke-linecap="round" fill="none"/><circle cx="${r1(ax + 5 * dir)}" cy="${r1(ay)}" r="2.4" fill="${th.text.muted}"/>`;
    svg += `<text x="${r1(tx)}" y="${r1(ay + (c.sub ? -2 : 4.5))}" font-size="13" font-family="${esc(th.font)}" font-weight="650" text-anchor="${left ? 'end' : 'start'}" fill="${th.text.color}"${halo}>${esc(c.text)}</text>`;
    if (c.sub) svg += `<text x="${r1(tx)}" y="${r1(ay + 12)}" font-size="11" font-family="${esc(th.font)}" font-weight="500" text-anchor="${left ? 'end' : 'start'}" fill="${th.text.muted}"${halo}>${esc(c.sub)}</text>`;
    const box = left ? { x0: tx - w - 4, x1: ax, y0: ay - 14, y1: ay + 18 } : { x0: ax, x1: tx + w + 4, y0: ay - 14, y1: ay + 18 };
    grow(box);
    labelBoxes.push(box);
    return svg;
  };
  for (const c of sc.callouts) { const [ax, ay] = projP(c.at); overlay += calloutSvg(ax, ay, c); }
  const solid = sc.objs.filter((ob) => !ob.hidden).map((ob) => ({ ob, box: growBox(aabbScreen(ob.box), -5) }));
  const LS = 14, SS = 11.5;
  for (const ob of sc.objs) {
    const lines = [];
    if (ob.label) lines.push({ text: String(ob.label), size: LS, weight: 650, fill: th.text.color });
    if (ob.sub) lines.push({ text: String(ob.sub), size: SS, weight: 500, fill: th.text.muted });
    const callouts = ob.res.callouts || [];
    for (const c of callouts) {
      const [ax, ay] = proj(ob.x + c.at[0] * ob.k, ob.y + c.at[1] * ob.k, ob.z + c.at[2] * ob.k);
      overlay += wrap(calloutSvg(ax, ay, c), opacityStyle(ob), hiddenAttr(ob));
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
    const clash = (b) => labelBoxes.some((l) => boxesOverlap(l, b, 1)) || solid.some((sld) => sld.ob !== ob && sld.ob !== ob.parent && sld.ob.parent !== ob && boxesOverlap(sld.box, b, 2));
    const order = ob.labelSide ? [ob.labelSide] : ['below', 'above', 'right', 'left'];
    let pos = place(order[0]);
    for (const side of order) { const p = place(side); if (!clash(p.box)) { pos = p; break; } }
    if (clash(pos.box)) note('warn', 'label-overlap', `The label "${ob.label || ob.sub}" overlaps another label or object. Give "${ob.id}" more room, shorten the text, or set labelSide: 'above' | 'below' | 'left' | 'right'.`);
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
    overlay += wrap(svg, opacityStyle(ob), hiddenAttr(ob));
    grow(pos.box);
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
      grow({ x0: cx - 16, x1: cx + 16, y0: cy - 16, y1: cy + 16 });
    });
  }

  // ================================================================ 6. frame, captions, background

  if (!bounds) bounds = { x0: -100, y0: -100, x1: 100, y1: 100 };
  const pad = o.pad;
  let vb = growBox(bounds, pad);
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
      if (c.text.length > 64) note('hint', 'caption-long', `Caption "${c.text.slice(0, 40)}…" is long. Captions read best under about 60 characters.`);
      const last = i === captions.length - 1;
      const out = last ? T - 0.55 : captions[i + 1].t; // fade out as the next caption arrives
      const tr = new Track('opacity', 0).to(c.t + (i ? 0.12 : 0), c.t + (i ? 0.3 : 0.22), 1, 'smooth').to(Math.max(c.t + 0.32, out), Math.max(c.t + 0.32, out) + 0.16, 0, 'smooth');
      captionSvg += `<text x="${r1((vb.x0 + vb.x1) / 2)}" y="${r1(capY)}" font-size="15.5" font-family="${esc(th.font)}" font-weight="600" text-anchor="middle" fill="${th.text.color}" opacity="${i === 0 ? 1 : 0}" style="${trackStyle(tr)}">${esc(c.text)}</text>`;
    });
  }

  if (o.aspect) {
    const ar = typeof o.aspect === 'number' ? o.aspect : (() => { const [a, b] = String(o.aspect).split(/[:/x]/).map(Number); return a / b; })();
    if (!(ar > 0)) throw new Error(`aspect must look like '16:9' or a number, got "${o.aspect}".`);
    const w = vb.x1 - vb.x0, h = vb.y1 - vb.y0;
    if (w / h < ar) { const add = (h * ar - w) / 2; vb.x0 -= add; vb.x1 += add; } else { const add = (w / ar - h) / 2; vb.y0 -= add; vb.y1 += add; }
  }
  vb = { x0: Math.floor(vb.x0), y0: Math.floor(vb.y0), x1: Math.ceil(vb.x1), y1: Math.ceil(vb.y1) };
  if (o.heading) {
    overlay += `<text x="${vb.x0 + 40}" y="${vb.y0 + 58}" font-size="24" font-family="${esc(th.font)}" font-weight="750" letter-spacing="-0.3" fill="${th.text.color}">${esc(o.heading)}</text>`;
    if (o.subheading) overlay += `<text x="${vb.x0 + 40}" y="${vb.y0 + 82}" font-size="14" font-family="${esc(th.font)}" font-weight="500" fill="${th.text.muted}">${esc(o.subheading)}</text>`;
  }
  const W = vb.x1 - vb.x0, H = vb.y1 - vb.y0;
  const mx = (bounds.x0 + bounds.x1) / 2, my = (bounds.y0 + bounds.y1) / 2;

  let bg = '';
  if (o.background) {
    let fill = th.bg.from;
    if (th.bg.type === 'radial') fill = `url(#${def('bg', (id) => `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${r1(mx)}" cy="${r1(my)}" r="${r1(Math.max(W, H) * 0.72)}"><stop offset="0" stop-color="${th.bg.from}"/><stop offset="1" stop-color="${th.bg.to}"/></radialGradient>`)})`;
    else if (th.bg.type === 'linear') fill = `url(#${def('bg', (id) => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.bg.from}"/><stop offset="1" stop-color="${th.bg.to}"/></linearGradient>`)})`;
    bg += `<rect x="${vb.x0}" y="${vb.y0}" width="${W}" height="${H}" fill="${fill}"/>`;
    if (th.floor.spotAlpha > 0) bg += `<ellipse cx="${r1(mx)}" cy="${r1(my + (bounds.y1 - bounds.y0) * 0.12)}" rx="${r1((bounds.x1 - bounds.x0) * 0.62)}" ry="${r1((bounds.x1 - bounds.x0) * 0.62 * 0.52)}" fill="url(#${glowGrad(th.floor.spot, th.floor.spotAlpha)})"/>`;
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
    bg += `<path d="${d}" fill="none" stroke="${th.floor.color}" stroke-opacity="${th.floor.alpha}" stroke-width="${gridKind === 'lines' ? 1 : 2.2}" stroke-linecap="round" mask="url(#${mask})"/>`;
  }

  // ================================================================ 7. lint

  const vis = sc.objs.filter((ob) => !ob.hidden);
  for (let i = 0; i < sc.objs.length; i++) for (let j = i + 1; j < sc.objs.length; j++) {
    const a = sc.objs[i], b = sc.objs[j];
    if (a.parent === b || b.parent === a || (a.hidden !== b.hidden)) continue;
    if (aabbIntersects(a.box, b.box, 0.04)) note('warn', 'overlap', `"${a.id}" and "${b.id}" occupy the same space, so they will cut into each other. Move one of them (they need about ${r1((a.w + b.w) / 2 + 0.4)} cells between centres along x, or ${r1((a.d + b.d) / 2 + 0.4)} along y), or stack with on:.`);
  }
  if (vis.length > 16) note('warn', 'crowded', `${vis.length} objects is a lot for one picture. The clearest scenes use 3–9 objects; cut supporting detail or split the idea into two scenes.`);
  else if (vis.length > 11) note('hint', 'crowded', `${vis.length} objects: check that each one is needed to explain the idea.`);
  const heroes = sc.objs.filter((ob) => ob.hero);
  if (vis.length >= 4 && heroes.length === 0 && !sc.objs.some((ob) => ob.opts.glow || ['accent', 'accent2'].includes(ob.opts.color))) note('hint', 'no-hero', 'No focal point. Mark the single most important object with hero: true so the eye has somewhere to land.');
  if (heroes.length > 2) note('hint', 'many-heroes', `${heroes.length} objects are marked hero. One focal point reads best; keep hero: true for the single most important object.`);
  const hasMotion = sc.steps || sc.objs.some((ob) => ob.float) || sc.links.some((l) => l.o.flow);
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

  const sortedWorld = depthSort(world).map((w) => w.svg).join('');
  const fadeIn = (delay, dur = 0.5) => (o.intro ? `animation:${kf('from{opacity:0}to{opacity:1}')} ${dur}s ease-out ${r2(delay)}s both` : '');
  const css = [
    ...[...kfs.entries()].map(([body, name]) => `@keyframes ${name}{${body}}`),
    `#${uid}.is-paused *{animation-play-state:paused!important}`,
    `@media (prefers-reduced-motion:reduce){#${uid} *{animation:none!important}}`,
  ].join('');
  const title = o.title || o.heading || 'Isometric illustration';
  const desc = o.desc || (sc.objs.filter((ob) => ob.label).length ? `Shows: ${sc.objs.filter((ob) => ob.label).map((ob) => ob.label).join(', ')}.` : '');
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" id="${uid}" viewBox="${vb.x0} ${vb.y0} ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="${uid}-t${desc ? ` ${uid}-s` : ''}" data-loop="${r2(T)}" data-intro="${introEnd}"${o.background ? ` data-bg="${th.bg.to}"` : ''}${keyTimes.length ? ` data-keys="${[...new Set([...keyTimes, T - 0.95].map((t) => Math.max(0, Math.min(T - 0.05, t)).toFixed(2)))].join(' ')}"` : ''} font-family="${esc(th.font)}">`,
    `<title id="${uid}-t">${esc(title)}</title>`, desc ? `<desc id="${uid}-s">${esc(desc)}</desc>` : '',
    `<style>${css}</style>`,
    `<defs>${[...defs.values()].map((d) => d.svg).join('')}</defs>`,
    bg ? `<g>${bg}</g>` : '',
    wrap(floor + glowLayer + shadowLayer + linkLayer + ringLayer + floorFx, fadeIn(0, 0.6)),
    `<g>${sortedWorld}</g>`,
    air ? wrap(air, fadeIn(introEnd * 0.6)) : '',
    wrap(overlay, fadeIn(Math.max(0, introEnd - 0.35), 0.45)),
    captionSvg ? wrap(captionSvg, fadeIn(Math.max(0, introEnd - 0.2))) : '',
    '</svg>',
  ].join('');

  return { svg, width: W, height: H, loop: T, intro: introEnd, notes, objects: sc.objs.length, bytes: svg.length };
}
