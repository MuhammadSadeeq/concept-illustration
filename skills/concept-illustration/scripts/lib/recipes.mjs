// Recipes: complete, animated scene layouts driven by a small config.
// Each returns an ordinary scene, so anything can still be added before it is built.

import { scene as makeScene } from './scene.mjs';

const SCENE_KEYS = ['theme', 'accent', 'accent2', 'bg', 'background', 'grid', 'title', 'desc', 'heading', 'subheading', 'loop', 'intro', 'pad', 'aspect', 'id', 'font', 'shadows'];
const META_KEYS = ['kind', 'say', 'emits', 'mark'];

const sceneOpts = (cfg) => Object.fromEntries(Object.entries(cfg).filter(([k]) => SCENE_KEYS.includes(k)));
const norm = (spec, fallback = 'tile') => (typeof spec === 'string' ? { kind: fallback, label: spec } : { kind: fallback, ...spec });
const place = (s, spec, extra) => {
  const sp = norm(spec);
  const opts = Object.fromEntries(Object.entries(sp).filter(([k]) => !META_KEYS.includes(k)));
  return s.add(sp.kind, { ...opts, ...extra });
};
const need = (cond, msg) => { if (!cond) throw new Error(msg); };

export function makeRecipes(scene = makeScene) {
  const R = {};

  /**
   * A → B → C. A token travels through the stages in order.
   * stages: [{ kind, label, sub, say, emits, hero, ...object options }]  (2–8)
   */
  R.pipeline = (cfg = {}) => {
    need(Array.isArray(cfg.stages) && cfg.stages.length >= 2, 'recipes.pipeline: pass stages: [ ... ] with at least 2 stages.');
    const s = scene(sceneOpts(cfg));
    const st = cfg.stages.map((x) => norm(x));
    const n = st.length;
    const wrap = cfg.wrap ?? (n > 5 ? Math.ceil(n / 2) : n);
    const gap = cfg.gap ?? 4.4, rowGap = cfg.rowGap ?? 4.6;
    const objs = st.map((sp, i) => {
      const row = Math.floor(i / wrap), col = i % wrap;
      return place(s, sp, { at: [(row % 2 === 0 ? col : wrap - 1 - col) * gap, row * rowGap] });
    });
    for (let i = 0; i < n - 1; i++) s.link(objs[i], objs[i + 1], cfg.link || {});
    const steps = [];
    if (st[0].say) steps.push(s.say(st[0].say));
    steps.push(s.pulse(objs[0]));
    for (let i = 0; i < n - 1; i++) {
      steps.push(s.send(objs[i], objs[i + 1], { as: st[i].emits || cfg.token || 'dot', count: cfg.count ?? 1 }));
      if (st[i + 1].say) steps.push(s.say(st[i + 1].say));
      steps.push(st[i + 1].mark ? [s.pulse(objs[i + 1]), s.mark(objs[i + 1], st[i + 1].mark)] : s.pulse(objs[i + 1]));
    }
    if (cfg.done !== false && !st[n - 1].mark) steps.push(s.mark(objs[n - 1], cfg.done || 'check'));
    steps.push(s.wait(cfg.hold ?? 0.6));
    s.story(steps);
    s.objects = objs;
    return s;
  };

  /**
   * One thing in the middle, many around it.
   * center: { kind, label, ... }   spokes: [{ kind, label, ... }]  (2–8)
   * mode: 'both' (in, then out) | 'out' | 'in' | 'each' (one round trip at a time)
   */
  R.hub = (cfg = {}) => {
    need(cfg.center && Array.isArray(cfg.spokes) && cfg.spokes.length >= 2, 'recipes.hub: pass center: { ... } and spokes: [ ... ] with at least 2 spokes.');
    const s = scene(sceneOpts(cfg));
    const sp = cfg.spokes.map((x) => norm(x));
    const n = sp.length;
    const r = cfg.radius ?? Math.max(4.4, 3 + n * 0.42);
    const cSpec = norm(cfg.center, 'orb');
    let base = null;
    if (cfg.platform !== false) base = s.add('platform', { at: [0, 0], size: cfg.platformSize ?? 2.8, tiers: 2 });
    const center = place(s, { hero: true, ...cSpec }, base ? { on: base } : { at: [0, 0] });
    if (cfg.float !== false) s.float(center, { amp: 5 });
    const hubEnd = base || center;
    const pts = s.ring(n, { at: [0, 0], r, start: cfg.start ?? (n % 2 ? -90 : -135) });
    const objs = sp.map((x, i) => place(s, x, { at: pts[i] }));
    const mode = cfg.mode || 'both';
    objs.forEach((ob) => s.link(hubEnd, ob, { route: 'straight', arrow: mode === 'in' ? false : mode === 'out' ? true : 'both', ...(cfg.link || {}) }));
    const token = cfg.token || 'dot';
    const steps = [];
    const inward = () => objs.map((ob, i) => s.send(ob, hubEnd, { as: sp[i].emits || token, delay: i * 0.14 }));
    const outward = () => objs.map((ob, i) => s.send(hubEnd, ob, { as: cSpec.emits || token, delay: i * 0.14 }));
    if (cfg.say) steps.push(s.say(cfg.say[0] ?? cfg.say));
    if (mode === 'each') {
      objs.forEach((ob, i) => {
        if (sp[i].say) steps.push(s.say(sp[i].say));
        steps.push(s.send(hubEnd, ob, { as: cSpec.emits || token }), s.pulse(ob), s.send(ob, hubEnd, { as: sp[i].emits || token }));
      });
      steps.push(s.pulse(center));
    } else {
      if (mode === 'in' || mode === 'both') steps.push(inward(), [s.pulse(center), s.glow(center)]);
      if (Array.isArray(cfg.say) && cfg.say[1]) steps.push(s.say(cfg.say[1]));
      if (mode === 'out' || mode === 'both') { if (mode === 'out') steps.push(s.pulse(center)); steps.push(outward()); }
    }
    steps.push(s.wait(cfg.hold ?? 0.8));
    s.story(steps);
    s.objects = objs; s.center = center;
    return s;
  };

  /**
   * Layers stacked in the air, listed from top to bottom.
   * layers: [{ label, sub, icon, color, say }]  (2–6)
   */
  R.layers = (cfg = {}) => {
    need(Array.isArray(cfg.layers) && cfg.layers.length >= 2, 'recipes.layers: pass layers: [ ... ] (top layer first) with at least 2 layers.');
    const s = scene(sceneOpts(cfg));
    const ly = cfg.layers.map((x) => norm(x, 'slab'));
    const n = ly.length;
    const size = cfg.size ?? 3, th = 0.2, gap = cfg.gap ?? 0.95;
    const objs = [];
    for (let i = n - 1; i >= 0; i--) { // build from the bottom up
      const level = n - 1 - i;
      const sp = ly[i];
      const color = sp.color || (i === (cfg.focus ?? 0) ? 'accent' : level % 2 ? 'body2' : 'body');
      objs[i] = place(s, { ...sp, color }, { at: [0, 0, level * (th + gap)], w: size, d: size, h: th, labelSide: 'right', shadow: level === 0, glow: i === (cfg.focus ?? 0), iconAt: i === 0 ? 'center' : 'front' });
    }
    const steps = [];
    const order = cfg.direction === 'up' ? [...objs.keys()].reverse() : [...objs.keys()];
    for (const i of order) {
      if (ly[i].say) steps.push(s.say(ly[i].say));
      steps.push(s.lift(objs[i], 0.26, { dur: 0.45 }), s.wait(cfg.dwell ?? 0.7), s.drop(objs[i], { dur: 0.45 }));
    }
    steps.push(s.wait(cfg.hold ?? 0.5));
    s.story(steps);
    s.objects = objs;
    return s;
  };

  /**
   * A loop that returns to its start.
   * stages: [{ kind, label, say, ... }]  (3–6)    center: optional object in the middle
   */
  R.cycle = (cfg = {}) => {
    need(Array.isArray(cfg.stages) && cfg.stages.length >= 3, 'recipes.cycle: pass stages: [ ... ] with at least 3 stages.');
    const s = scene(sceneOpts(cfg));
    const st = cfg.stages.map((x) => norm(x));
    const n = st.length;
    const g = cfg.gap ?? 5.2;
    const pts = n === 4 ? [[0, 0], [g, 0], [g, g], [0, g]] : s.ring(n, { at: [0, 0], r: cfg.radius ?? Math.max(3.8, n * 0.95), start: -135 });
    const objs = st.map((sp, i) => place(s, sp, { at: pts[i] }));
    if (cfg.center) {
      const c = n === 4 ? [g / 2, g / 2] : [0, 0];
      s.center = place(s, norm(cfg.center, 'gear'), { at: c });
    }
    for (let i = 0; i < n; i++) s.link(objs[i], objs[(i + 1) % n], { route: n === 4 ? 'auto' : 'straight', ...(cfg.link || {}) });
    const steps = [];
    for (let i = 0; i < n; i++) {
      if (st[i].say) steps.push(s.say(st[i].say));
      steps.push(s.pulse(objs[i]), s.send(objs[i], objs[(i + 1) % n], { as: st[i].emits || cfg.token || 'dot' }));
    }
    s.story(steps, { hold: cfg.hold ?? 0.3 });
    s.objects = objs;
    return s;
  };

  /**
   * One source feeding many targets (or many feeding one with reverse: true).
   * source: { ... }   router: { ... } (optional)   targets: [{ ... }]  (2–6)
   * mode: 'all' (everything at once) | 'each' (one after another)
   */
  R.fanout = (cfg = {}) => {
    need(cfg.source && Array.isArray(cfg.targets) && cfg.targets.length >= 2, 'recipes.fanout: pass source: { ... } and targets: [ ... ] with at least 2 targets.');
    const s = scene(sceneOpts(cfg));
    const tg = cfg.targets.map((x) => norm(x));
    const n = tg.length;
    const gapX = cfg.gap ?? 4.8, gapY = cfg.spread ?? 3.3;
    const mid = ((n - 1) * gapY) / 2;
    const src = place(s, norm(cfg.source), { at: [0, mid] });
    const router = cfg.router ? place(s, { hero: true, ...norm(cfg.router, 'cube') }, { at: [gapX, mid] }) : null;
    const tx = router ? gapX * 2 : gapX * 1.2;
    const objs = tg.map((sp, i) => place(s, sp, { at: [tx, i * gapY] }));
    const hub = router || src;
    const rev = !!cfg.reverse;
    if (router) rev ? s.link(router, src, cfg.link || {}) : s.link(src, router, cfg.link || {});
    objs.forEach((ob) => (rev ? s.link(ob, hub, cfg.link || {}) : s.link(hub, ob, cfg.link || {})));
    const token = cfg.token || 'dot';
    const steps = [];
    if (cfg.say) steps.push(s.say(Array.isArray(cfg.say) ? cfg.say[0] : cfg.say));
    if (!rev) {
      if (router) steps.push(s.send(src, router, { as: token }), s.pulse(router));
      else steps.push(s.pulse(src));
      if (Array.isArray(cfg.say) && cfg.say[1]) steps.push(s.say(cfg.say[1]));
      if (cfg.mode === 'each') objs.forEach((ob) => steps.push(s.send(hub, ob, { as: token }), s.pulse(ob)));
      else steps.push(objs.map((ob, i) => s.send(hub, ob, { as: token, delay: i * 0.12 })), objs.map((ob) => s.pulse(ob)));
    } else {
      if (cfg.mode === 'each') objs.forEach((ob) => steps.push(s.send(ob, hub, { as: token })));
      else steps.push(objs.map((ob, i) => s.send(ob, hub, { as: token, delay: i * 0.12 })));
      steps.push(s.pulse(hub));
      if (Array.isArray(cfg.say) && cfg.say[1]) steps.push(s.say(cfg.say[1]));
      if (router) steps.push(s.send(router, src, { as: cfg.result || 'cube' }), [s.pulse(src), s.mark(src, 'check')]);
    }
    steps.push(s.wait(cfg.hold ?? 0.8));
    s.story(steps);
    s.objects = objs; s.source = src; s.router = router;
    return s;
  };

  /**
   * A climb, one level at a time.
   * steps: [{ label, sub, say }]  (2–6, lowest first)   climber: kit kind (default 'user')   goal: kit kind (default 'flag')
   */
  R.steps = (cfg = {}) => {
    need(Array.isArray(cfg.steps) && cfg.steps.length >= 2, 'recipes.steps: pass steps: [ ... ] (lowest first) with at least 2 steps.');
    const s = scene(sceneOpts(cfg));
    const sp = cfg.steps.map((x) => norm(x));
    const n = Math.min(7, sp.length);
    const stairs = s.add('stairs', { at: [0, 0], steps: n, color: cfg.color || 'body' });
    const tops = stairs.res.tops;
    sp.slice(0, n).forEach((x, i) => s.callout([tops[i][0] - 0.7, tops[i][1], tops[i][2]], x.label, { sub: x.sub, side: 'left' }));
    const kind = cfg.climber || 'user';
    const start = [tops[0][0], tops[0][1] + 1.5, 0];
    const waiting = s.add(kind, { at: [start[0], start[1]], scale: 0.55, shadow: false });
    if (cfg.goal !== false) s.add(cfg.goal || 'flag', { at: [tops[n - 1][0], tops[n - 1][1] - 0.05, tops[n - 1][2]], scale: 0.7, shadow: false });
    const steps = [];
    const hop = (a, b, first) => s.send(a, b, { as: kind, scale: 0.55, arc: 0.55, stay: true, id: 'climber', ease: 'smooth', dur: 0.7, color: 'accent' });
    let prev = start;
    for (let i = 0; i < n; i++) {
      const p = [tops[i][0], tops[i][1] + (i === n - 1 && cfg.goal !== false ? 0.22 : 0), tops[i][2]];
      if (sp[i].say) steps.push(s.say(sp[i].say));
      steps.push(i === 0 ? [hop(prev, p), s.hide(waiting, { dur: 0.1 })] : hop(prev, p), s.wait(cfg.dwell ?? 0.45));
      prev = p;
    }
    steps.push(s.wait(cfg.hold ?? 0.9));
    s.story(steps);
    s.stairs = stairs;
    return s;
  };

  /**
   * A quantity that grows (or shrinks) step by step. Bars rise out of the floor one after another,
   * climbing up and to the right.
   * values: [number | { value, label, sub, say, color }]  (2–8)
   */
  R.growth = (cfg = {}) => {
    need(Array.isArray(cfg.values) && cfg.values.length >= 2, 'recipes.growth: pass values: [ ... ] with at least 2 numbers (or { value, label, say } items).');
    const s = scene(sceneOpts(cfg));
    const items = cfg.values.map((v) => (typeof v === 'number' ? { value: v } : { ...v })).slice(0, 8);
    need(items.every((it) => typeof it.value === 'number' && it.value >= 0), 'recipes.growth: every value must be a number of 0 or more.');
    const n = items.length;
    const base = cfg.baseline ?? 0;
    const max = Math.max(...items.map((it) => it.value)) - base || 1;
    const maxH = cfg.height ?? 3, gap = cfg.gap ?? 1.9, w = cfg.barWidth ?? 1;
    const fmt = cfg.format || ((v) => `${cfg.prefix ?? ''}${(Number.isInteger(v) ? v : +v.toFixed(1)).toLocaleString('en-US')}${cfg.suffix ?? ''}`);
    const peak = items.reduce((b, it, i) => (it.value > items[b].value ? i : b), 0);
    const focus = cfg.focus ?? (cfg.focus === null ? -1 : n - 1);
    const bars = items.map((it, i) => s.add('cube', {
      at: [0, -i * gap], w, d: w, h: Math.max(0.3, ((it.value - base) / max) * maxH), level: 0,
      color: it.color || (i === focus ? 'accent' : 'body2'), glow: i === focus,
      label: it.label ?? fmt(it.value), sub: it.label ? it.sub ?? fmt(it.value) : it.sub,
    }));
    const steps = [];
    bars.forEach((bar, i) => {
      if (items[i].say) steps.push(s.say(items[i].say));
      if (cfg.token && i > 0) steps.push(s.send(bars[i - 1], bar, { as: cfg.token, arc: 0.7 }));
      steps.push(s.grow(bar, 1, { dur: cfg.rise ?? 0.75 }));
    });
    if (cfg.done !== false) steps.push(s.mark(bars[cfg.done === 'peak' ? peak : n - 1], typeof cfg.done === 'string' && cfg.done !== 'peak' ? cfg.done : 'trend'));
    steps.push(s.wait(cfg.hold ?? 1.2));
    s.story(steps, { gap: 0.18 });
    s.objects = bars;
    return s;
  };

  return R;
}

export const RECIPES = makeRecipes();
export const RECIPE_NAMES = Object.keys(RECIPES);
