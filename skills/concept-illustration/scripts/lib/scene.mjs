// The scene model and authoring API. A scene is a list of objects on a floor grid,
// links between them, optional zones and text, and a story that plays in a loop.

import { aabbUnion, aabbShift, UNIT } from './geom.mjs';
import { resolveTheme, material, pickLook, THEME_NAMES, ROLE_NAMES } from './themes.mjs';
import { KIT, KIND_NAMES, PACKET_NAMES, SHAPES } from './kit.mjs';
import { ICON_NAMES } from './icons.mjs';
import { primBox } from './prims.mjs';
import { routePoints, buildPath, buildArc } from './links.mjs';
import { isHex } from './color.mjs';
import { compile } from './compile.mjs';

// ---------------------------------------------------------------- friendly errors

function distance(a, b) {
  const m = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return m[a.length][b.length];
}

export function suggest(word, list) {
  const w = String(word).toLowerCase();
  const scored = list.map((c) => [c, c.includes(w) || w.includes(c) ? 1 : distance(w, c)]).sort((a, b) => a[1] - b[1]);
  return scored[0] && scored[0][1] <= Math.max(2, Math.floor(w.length / 2)) ? scored[0][0] : null;
}

function unknown(what, value, list) {
  const s = suggest(value, list);
  return new Error(`Unknown ${what} "${value}".${s ? ` Did you mean "${s}"?` : ''} Available: ${list.join(', ')}.`);
}

const COMMON_OPTS = ['at', 'on', 'z', 'scale', 'color', 'accent', 'label', 'sub', 'labelSide', 'hero', 'hidden', 'float', 'glow', 'id', 'shadow', 'badge', 'level', 'info'];
const STEP_OPTS = ['dur', 'delay', 'color', 'keep', 'as', 'count', 'stagger', 'speed', 'label', 'route', 'via', 'arc', 'ease', 'react', 'stay', 'id', 'scale'];
const SCENE_OPTS = ['look', 'theme', 'palette', 'finish', 'floor', 'accent', 'accent2', 'bg', 'background', 'grid', 'title', 'desc', 'heading', 'subheading', 'loop', 'intro', 'pad', 'aspect', 'id', 'font', 'shadows', 'haze', 'vignette', 'detail'];
const LINK_OPTS = ['style', 'color', 'arrow', 'flow', 'route', 'via', 'label', 'arc', 'width', 'z', 'gap', 'dim'];

function scaleParts(parts, k) {
  const S = (p) => {
    const q = { ...p };
    if (q.o) q.o = q.o.map((v) => v * k);
    if (q.c) q.c = q.c.map((v) => v * k);
    if (q.at) q.at = q.at.map((v) => v * k);
    if (q.box) q.box = Object.fromEntries(Object.entries(q.box).map(([key, v]) => [key, v * k]));
    if (q.t === 'prism') { q.pts = q.pts.map(([a, b]) => [a * k, b * k]); q.depth *= k; }
    if (q.t === 'mesh') { q.faces = q.faces.map((f) => f.map((v) => v.map((c) => c * k))); if (q.rimEdges) q.rimEdges = q.rimEdges.map((f) => f.map((v) => v.map((c) => c * k))); }
    if (q.t === 'sphere') q.r *= k;
    if (q.t === 'cone') { q.r0 *= k; q.r1 = (q.r1 || 0) * k; q.h *= k; }
    if (q.t === 'line') q.pts = q.pts.map((v) => v.map((c) => c * k));
    if (q.t === 'raw') q.scale = (q.scale || 1) * k;
    if (q.t === 'decal') { q.items = [{ t: 'g', scale: k, items: q.items }]; if (q.size) q.size = q.size.map((v) => v * k); }
    if (q.decals) q.decals = q.decals.map((d) => ({ ...d, o: d.o.map((v) => v * k), items: [{ t: 'g', scale: k, items: d.items }] }));
    if (q.parts) q.parts = q.parts.map(S);
    return q;
  };
  return parts.map(S);
}

export class Scene {
  constructor(opts = {}) {
    for (const k of Object.keys(opts)) if (!SCENE_OPTS.includes(k)) this._early = [...(this._early || []), { level: 'warn', code: 'option', msg: `scene(): unknown option "${k}" was ignored.${suggest(k, SCENE_OPTS) ? ` Did you mean "${suggest(k, SCENE_OPTS)}"?` : ''}` }];
    this.opts = { background: true, intro: true, pad: 56, shadows: true, ...opts };
    this.notes = this._early || [];
    let look = this.opts.look || this.opts.theme || null;
    if (!look && !this.opts.palette) {
      // No look chosen: pick one from the subject so different scenes do not all look alike.
      const seed = String(this.opts.title || this.opts.heading || '');
      look = seed ? pickLook(seed) : 'aurora';
      this.notes.push({ level: 'hint', code: 'no-look', msg: `No look was chosen, so "${look}" was picked from the title. Choose one on purpose: look: '<palette>' with optional finish and floor (run build.mjs --list), or palette: { bg, accent } for brand colours.` });
    }
    this.look = look;
    this.theme = resolveTheme({ ...this.opts, look });
    this.id = this.opts.id || null; // filled in at build time from the scene's content
    this.objs = [];
    this.links = [];
    this.zones = [];
    this.texts = [];
    this.callouts = [];
    this.kinds = {};
    this.steps = null;
    this.storyOpts = {};
    this.n = 0;
    const theme = this.theme;
    this.K = {
      theme,
      mat: (c) => material(theme, c || 'body'),
      hex: (c) => theme.roles[c] || (isHex(c) ? c : theme.roles.accent),
    };
  }

  note(level, code, msg) { this.notes.push({ level, code, msg }); }
  scaleParts(parts, k) { return scaleParts(parts, k); }

  /** Accept a few natural spellings so a near-miss still works, and say what the canonical one is. */
  _tidy(o, where) {
    if (o == null || typeof o !== 'object' || Array.isArray(o)) throw new Error(`${where}: options must be an object like { at: [x, y], label: 'Name' }.`);
    const out = { ...o };
    const alias = { position: 'at', pos: 'at', name: 'label', title: 'label', subtitle: 'sub', sublabel: 'sub', caption: 'sub', highlight: 'hero', focus: 'hero', primary: 'hero', side: 'labelSide', size: null };
    for (const [from, to] of Object.entries(alias)) {
      if (to && from in out && !(to in out)) { out[to] = out[from]; delete out[from]; this.note('hint', 'alias', `${where}: "${from}" was read as "${to}". Use "${to}".`); }
    }
    if (out.at && !Array.isArray(out.at) && typeof out.at === 'object') {
      if (out.at._iso) out.at = [out.at.x, out.at.y];
      else if ('x' in out.at && 'y' in out.at) out.at = 'z' in out.at ? [out.at.x, out.at.y, out.at.z] : [out.at.x, out.at.y];
    }
    if (out.label && typeof out.label === 'object') { if (out.label.sub && !out.sub) out.sub = out.label.sub; out.label = out.label.text ?? out.label.label ?? ''; }
    return out;
  }

  // ------------------------------------------------------------ objects

  /** Place an object from the kit. Returns a handle used by link(), story steps and on:. */
  add(kind, o = {}) {
    const spec = this.kinds[kind] || KIT[kind];
    if (!spec) throw unknown('object kind', kind, [...Object.keys(this.kinds), ...KIND_NAMES]);
    o = this._tidy(o, `add('${kind}')`);
    const allowed = [...COMMON_OPTS, ...spec.opts.split(' ').filter(Boolean)];
    if (!spec.custom) for (const k of Object.keys(o)) if (!allowed.includes(k)) this.note('warn', 'option', `add('${kind}'): unknown option "${k}" was ignored. Options for ${kind}: ${allowed.join(', ')}.`);
    if (o.icon && !ICON_NAMES.includes(o.icon)) throw unknown('icon', o.icon, ICON_NAMES);
    for (const c of ['color', 'accent']) if (o[c] && !ROLE_NAMES.includes(o[c]) && !isHex(o[c])) throw unknown('colour', o[c], ROLE_NAMES);
    const opts = { color: 'body', accent: 'accent', ...o };
    if (o.hero) {
      if (!o.color) opts.color = 'accent';
      if (!o.accent && opts.color === 'accent') opts.accent = 'accent2';
    }
    const res = spec.build(opts, this.K);
    if (!res || !Array.isArray(res.parts) || !res.parts.length) throw new Error(`add('${kind}'): the builder must return { parts: [ ... ] } with at least one shape.`);
    if (res.w == null || res.d == null || res.h == null) {
      // measure a custom object from its shapes
      let bb = null;
      for (const p of res.parts) bb = aabbUnion(bb, primBox(p));
      res.w = res.w ?? Math.max(0.2, 2 * Math.max(Math.abs(bb.x0), Math.abs(bb.x1)));
      res.d = res.d ?? Math.max(0.2, 2 * Math.max(Math.abs(bb.y0), Math.abs(bb.y1)));
      res.h = res.h ?? Math.max(0.05, bb.z1);
    }
    const k = o.scale ?? 1;
    const parts = k === 1 ? res.parts : scaleParts(res.parts, k);
    let x = 0, y = 0, z = 0;
    const parent = o.on || null;
    if (parent) {
      if (!parent._iso) throw new Error(`add('${kind}'): "on" must be an object returned by add().`);
      x = parent.x; y = parent.y; z = parent.z + (parent.surfaceZ ?? parent.h);
    }
    if (o.at) {
      if (!Array.isArray(o.at) || o.at.length < 2 || o.at.some((v) => typeof v !== 'number' || Number.isNaN(v))) throw new Error(`add('${kind}'): "at" must be [x, y] or [x, y, z] in grid cells, got ${JSON.stringify(o.at)}.`);
      x = o.at[0]; y = o.at[1];
      if (o.at.length > 2) z = (parent ? z : 0) + o.at[2];
    }
    if (o.z) z += o.z;
    let local = res.box ? Object.fromEntries(Object.entries(res.box).map(([key, v]) => [key, v * k])) : null;
    if (!local) for (const p of parts) local = aabbUnion(local, primBox(p));
    const obj = {
      _iso: true, id: o.id || `${kind}${++this.n}`, kind, opts, res, parts, parent,
      x, y, z, w: res.w * k, d: res.d * k, h: res.h * k, k,
      surfaceZ: res.surfaceZ != null ? res.surfaceZ * k : undefined,
      local, hidden: !!o.hidden, hero: !!o.hero, level: Math.max(0, Math.min(1, o.level ?? 1)),
      float: o.float ? (typeof o.float === 'object' ? o.float : {}) : null,
      label: o.label ?? null, sub: o.sub ?? null, labelSide: o.labelSide || null,
      tracks: {}, tints: [], marks: [],
    };
    Object.defineProperty(obj, 'box', { get() { return aabbShift(this.local, [this.x, this.y, this.z]); } });
    obj.top = [x, y, z + obj.h];
    this.objs.push(obj);
    return obj;
  }

  /**
   * Teach the scene a new kind of object, built from shapes.
   *   s.define('oven', (o, sh, K) => ({ parts: [sh.box({ w: 1.4, d: 1.2, h: 1.1, color: o.color }), ...] }));
   *   s.add('oven', { at: [4, 0], label: 'Oven' });
   * sh is the shapes toolbox; K gives colours: K.hex('accent'), K.mat('body').on.
   */
  define(name, builder) {
    if (typeof name !== 'string' || typeof builder !== 'function') throw new Error("define(name, builder): pass a name and a function (o, sh, K) => ({ parts: [...] }).");
    this.kinds[name] = { custom: true, opts: '', desc: 'custom', build: (o, K) => builder(o, SHAPES, K) };
    return this;
  }

  /** A one-off object built from shapes: s.custom({ at, label, parts: (sh, K) => [ ... ] }). */
  custom(o = {}) {
    const { parts, w, d, h, round, ...rest } = o;
    if (!parts) throw new Error('custom({ parts }): pass parts: (sh, K) => [ ...shapes ] or an array of shapes.');
    const name = `custom${Object.keys(this.kinds).length + 1}`;
    this.kinds[name] = { custom: true, opts: '', desc: 'custom', build: (oo, K) => ({ parts: typeof parts === 'function' ? parts(SHAPES, K, oo) : parts, w, d, h, round }) };
    return this.add(name, rest);
  }

  /** Stand any SVG markup upright at a point: a logo, a hand-drawn figure, anything. w and h are its size in cells. */
  svg(markup, o = {}) {
    const { w = 1, h = 1, ...rest } = o;
    return this.custom({ ...rest, w, d: 0.3, h, parts: (sh) => [sh.raw({ svg: `<g transform="translate(${-w * 20} ${-h * 40}) scale(${(w * 40) / 100})">${markup}</g>`, w, h })] });
  }

  // ------------------------------------------------------------ layout helpers

  /** n positions in a line. axis 'x' runs toward the lower-right, 'y' toward the lower-left. */
  row(n, { at = [0, 0], gap = 3, axis = 'x' } = {}) {
    return Array.from({ length: n }, (_, i) => (axis === 'y' ? [at[0], at[1] + i * gap] : [at[0] + i * gap, at[1]]));
  }

  /** cols x rows positions, row by row. */
  grid(cols, rows, { at = [0, 0], gap = 2.4 } = {}) {
    const [gx, gy] = Array.isArray(gap) ? gap : [gap, gap];
    const out = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([at[0] + c * gx, at[1] + r * gy]);
    return out;
  }

  /** n positions around a centre. */
  ring(n, { at = [0, 0], r = 4, start = -90 } = {}) {
    return Array.from({ length: n }, (_, i) => {
      const a = ((start + (360 / n) * i) * Math.PI) / 180;
      return [+(at[0] + Math.cos(a) * r).toFixed(2), +(at[1] + Math.sin(a) * r).toFixed(2)];
    });
  }

  // ------------------------------------------------------------ links, zones, text

  _foot(e, what) {
    if (e && e._iso) return { x: e.x, y: e.y, w: e.w, d: e.d, h: e.z > 0.05 && !e.parent ? 0 : e.h, z: e.z, obj: e };
    if (Array.isArray(e) && e.length >= 2) return { x: e[0], y: e[1], w: 0, d: 0, z: e[2] || 0 };
    throw new Error(`${what}: expected an object returned by add() or a point [x, y], got ${JSON.stringify(e)}.`);
  }

  /** Draw a connector from a to b. Returns a handle (story steps reuse its route). */
  link(a, b, o = {}) {
    for (const k of Object.keys(o)) if (!LINK_OPTS.includes(k)) this.note('warn', 'option', `link(): unknown option "${k}" was ignored. Options: ${LINK_OPTS.join(', ')}.`);
    const STYLES = ['line', 'dashed', 'dotted', 'pipe', 'road'];
    if (o.style && !STYLES.includes(o.style)) throw unknown('link style', o.style, STYLES);
    const A = this._foot(a, 'link(a, b)'), Bf = this._foot(b, 'link(a, b)');
    const lk = { _link: true, a: A, b: Bf, o: { style: 'line', arrow: true, ...o } };
    lk.path = this._route(A, Bf, lk.o);
    this.links.push(lk);
    return lk;
  }

  _route(A, Bf, o) {
    if (o.arc) {
      const top = (f) => [f.x, f.y, f.obj ? f.obj.z + f.obj.h + 0.1 : f.z];
      const dist = Math.hypot(Bf.x - A.x, Bf.y - A.y);
      return { ...buildArc(top(A), top(Bf), typeof o.arc === 'number' ? o.arc : Math.max(1, dist * 0.28)), arc: true };
    }
    const z = o.z ?? (A.z === Bf.z ? A.z : 0);
    const corners = routePoints(A, Bf, { mode: o.route || 'auto', gap: o.gap ?? 0.16, via: o.via });
    return { ...buildPath(corners, z + 0.004), corners, z };
  }

  /** Tint a floor region to group objects. Pass around: [objects] or from/to corners. */
  zone(o = {}) {
    let x0, y0, x1, y1;
    if (o.around) {
      const pad = o.pad ?? 0.7;
      x0 = Math.min(...o.around.map((e) => e.x - e.w / 2)) - pad; x1 = Math.max(...o.around.map((e) => e.x + e.w / 2)) + pad;
      y0 = Math.min(...o.around.map((e) => e.y - e.d / 2)) - pad; y1 = Math.max(...o.around.map((e) => e.y + e.d / 2)) + pad;
    } else if (o.from && o.to) {
      x0 = Math.min(o.from[0], o.to[0]); x1 = Math.max(o.from[0], o.to[0]); y0 = Math.min(o.from[1], o.to[1]); y1 = Math.max(o.from[1], o.to[1]);
    } else throw new Error('zone(): pass around: [objects] or from: [x, y] and to: [x, y].');
    const zn = { x0, y0, x1, y1, label: o.label || null, style: o.style || 'plate', color: o.color || null };
    this.zones.push(zn);
    return zn;
  }

  /** Text lying on the floor (reads along the x axis). */
  text(str, o = {}) {
    this.texts.push({ text: String(str), at: o.at || [0, 0], size: o.size ?? 0.42, color: o.color || null, weight: o.weight ?? 700, turn: o.turn || 0, anchor: o.anchor || 'start', op: o.opacity });
  }

  /** A short label with a leader line, attached to any point in space [x, y, z]. */
  callout(at, text, o = {}) {
    if (!Array.isArray(at) || at.length < 2) throw new Error('callout(at, text): "at" must be a point [x, y] or [x, y, z].');
    this.callouts.push({ at: [at[0], at[1], at[2] || 0], text: String(text), sub: o.sub || null, side: o.side || 'right' });
  }

  // ------------------------------------------------------------ ambient motion

  /** Gentle hover. Use on one or two objects, not on everything. */
  float(obj, o = {}) { obj.float = { ...o }; return obj; }

  // ------------------------------------------------------------ story

  /**
   * One loop of cause and effect. Steps run in order; a nested array runs its steps together.
   *   s.story([ s.send(a, b), s.pulse(b), [s.send(b, c), s.send(b, d)], s.wait(1) ])
   */
  story(steps, o = {}, ...rest) {
    if (steps && !Array.isArray(steps) && steps.type) { steps = [steps, o, ...rest].filter((x) => x && (x.type || Array.isArray(x))); o = {}; }
    if (!Array.isArray(steps)) throw new Error('story(): pass an array of steps, e.g. s.story([s.send(a, b), s.pulse(b)]).');
    const check = (list) => list.forEach((st, i) => {
      if (Array.isArray(st)) return check(st);
      if (st == null || st === false) return;
      if (typeof st !== 'object' || !st.type) throw new Error(`story(): step ${i + 1} is not a step. Build steps with s.send(), s.pulse(), s.say(), s.wait() and the other step helpers; got ${JSON.stringify(st)}.`);
    });
    check(steps);
    this.steps = steps;
    this.storyOpts = o;
    return this;
  }

  _obj(e, fn) {
    if (!e || !e._iso) throw new Error(`${fn}: the first argument must be an object returned by add().`);
    return e;
  }

  /** Move a small token from one object to another (it follows a link between them when one exists). */
  send(a, b, o = {}) {
    if (typeof o === 'string') o = { as: o };
    if (o.as && !PACKET_NAMES.includes(o.as) && !KIT[o.as] && !this.kinds[o.as]) throw unknown('token', o.as, [...PACKET_NAMES, ...Object.keys(this.kinds), ...KIND_NAMES]);
    return { type: 'send', from: this._foot(a, 'send(a, b)'), to: this._foot(b, 'send(a, b)'), ...o };
  }
  /** A ripple and a small bounce: "this just did something". */
  pulse(obj, o = {}) { return { type: 'pulse', obj: this._obj(obj, 'pulse(obj)'), ...o }; }
  /** Light the floor under an object for a moment (keep: true leaves it on until the loop ends). */
  glow(obj, o = {}) { return { type: 'glow', obj: this._obj(obj, 'glow(obj)'), ...o }; }
  /** Reveal a hidden object with a springy scale-up. */
  pop(obj, o = {}) { return { type: 'pop', obj: this._obj(obj, 'pop(obj)'), ...o }; }
  show(obj, o = {}) { return { type: 'show', obj: this._obj(obj, 'show(obj)'), ...o }; }
  hide(obj, o = {}) { return { type: 'hide', obj: this._obj(obj, 'hide(obj)'), ...o }; }
  /** Raise an object by dz cells and leave it there (drop() brings it back). */
  lift(obj, dz = 0.6, o = {}) { return { type: 'lift', obj: this._obj(obj, 'lift(obj)'), dz, ...o }; }
  drop(obj, o = {}) { return { type: 'drop', obj: this._obj(obj, 'drop(obj)'), ...o }; }
  /** Make an object rise out of the floor to a fraction of its height (create it with level: 0). A lower value sinks it. */
  grow(obj, to = 1, o = {}) { return { type: 'grow', obj: this._obj(obj, 'grow(obj)'), to: Math.max(0, Math.min(1, typeof to === 'number' ? to : 1)), ...(typeof to === 'object' ? to : o) }; }
  /** Slide an object across the floor to [x, y] and leave it there until the loop restarts. */
  move(obj, to, o = {}) {
    if (!Array.isArray(to) || to.length < 2) throw new Error('move(obj, [x, y]): pass the destination as [x, y].');
    return { type: 'move', obj: this._obj(obj, 'move(obj, [x, y])'), to, ...o };
  }
  /** Recolour an object (for a change of state). It returns to normal when the loop restarts. */
  tint(obj, color = 'ok', o = {}) {
    if (!ROLE_NAMES.includes(color) && !isHex(color)) throw unknown('colour', color, ROLE_NAMES);
    return { type: 'tint', obj: this._obj(obj, 'tint(obj, color)'), color, ...o };
  }
  /** A quick side-to-side shake: rejected, failed, blocked. */
  shake(obj, o = {}) { return { type: 'shake', obj: this._obj(obj, 'shake(obj)'), ...o }; }
  /** Pop a small icon badge above an object: 'check', 'x', 'warning', 'lock', any icon. */
  mark(obj, icon = 'check', o = {}) {
    if (!ICON_NAMES.includes(icon)) throw unknown('icon', icon, ICON_NAMES);
    return { type: 'mark', obj: this._obj(obj, 'mark(obj, icon)'), icon, ...o };
  }
  /** Change the caption under the scene. Keep captions short. */
  say(text) { return { type: 'say', text: String(text) }; }
  wait(sec = 0.5) { return { type: 'wait', dur: sec }; }

  // ------------------------------------------------------------ output

  toSVG() { return compile(this).svg; }
  build() { return compile(this); }
}

const METHODS = ['add', 'link', 'zone', 'text', 'callout', 'row', 'grid', 'ring', 'define', 'custom', 'svg', 'float', 'story', 'send', 'move', 'pulse', 'glow', 'pop', 'show', 'hide', 'lift', 'drop', 'grow', 'tint', 'shake', 'mark', 'say', 'wait', 'build', 'toSVG'];
const METHOD_ALIAS = { connect: 'link', arrow: 'link', edge: 'link', line: 'link', object: 'add', place: 'add', put: 'add', node: 'add', group: 'zone', region: 'zone', area: 'zone', annotate: 'callout', caption: 'say', narrate: 'say', emit: 'send', flow: 'send', highlight: 'glow', reveal: 'pop', appear: 'pop', rise: 'grow', raise: 'grow', pause: 'wait', delay: 'wait', sleep: 'wait', timeline: 'story', sequence: 'story', hover: 'float', render: 'build', compile: 'build' };

/** Create a scene. Calling a method that does not exist explains what to use instead. */
export const scene = (opts) => new Proxy(new Scene(opts), {
  get(target, prop, recv) {
    if (prop in target || typeof prop !== 'string' || prop === 'then') return Reflect.get(target, prop, recv);
    if (METHOD_ALIAS[prop]) {
      target.note('hint', 'alias', `s.${prop}() was read as s.${METHOD_ALIAS[prop]}(). Use s.${METHOD_ALIAS[prop]}().`);
      return target[METHOD_ALIAS[prop]].bind(recv);
    }
    return () => { const sg = suggest(prop, METHODS); throw new Error(`s.${prop}() does not exist.${sg ? ` Did you mean s.${sg}()?` : ''} Motion comes from s.story([...steps]) and s.float(obj); labels come from the label: option of s.add(). Scene methods: ${METHODS.join(', ')}.`); };
  },
});
export { THEME_NAMES, KIND_NAMES, PACKET_NAMES, ICON_NAMES, UNIT, SHAPES };
