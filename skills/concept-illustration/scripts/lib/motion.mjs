// Motion: easing curves and a small timeline that compiles to plain CSS keyframes.
// Everything animates through CSS so a finished scene needs no JavaScript to play.

export const EASE = {
  linear: 'linear',
  smooth: 'cubic-bezier(.4,0,.2,1)',
  inOut: 'cubic-bezier(.65,0,.35,1)',
  out: 'cubic-bezier(.16,1,.3,1)',
  in: 'cubic-bezier(.7,0,.84,0)',
  back: 'cubic-bezier(.34,1.56,.64,1)',
  sine: 'cubic-bezier(.37,0,.63,1)',
};

// Numeric versions, used when a path has to be sampled.
const bez = (x1, y1, x2, y2) => (t) => {
  let lo = 0, hi = 1, u = t;
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) / 2;
    const x = 3 * (1 - u) * (1 - u) * u * x1 + 3 * (1 - u) * u * u * x2 + u * u * u;
    if (x < t) lo = u; else hi = u;
  }
  return 3 * (1 - u) * (1 - u) * u * y1 + 3 * (1 - u) * u * u * y2 + u * u * u;
};
export const EASE_FN = {
  linear: (t) => t,
  smooth: bez(0.4, 0, 0.2, 1),
  inOut: bez(0.65, 0, 0.35, 1),
  out: bez(0.16, 1, 0.3, 1),
  in: bez(0.7, 0, 0.84, 0),
  sine: bez(0.37, 0, 0.63, 1),
  back: bez(0.34, 1.56, 0.64, 1),
};

const pct = (t, T) => {
  const v = Math.max(0, Math.min(100, (t / T) * 100));
  return +v.toFixed(3) + '%';
};

const fmt = (prop, v) => {
  switch (prop) {
    case 'opacity': return `opacity:${+(+v).toFixed(3)}`;
    case 'translate': return `transform:translate(${+v[0].toFixed(2)}px,${+v[1].toFixed(2)}px)`;
    case 'scale': return Array.isArray(v) ? `transform:scale(${+v[0].toFixed(4)},${+v[1].toFixed(4)})` : `transform:scale(${+(+v).toFixed(4)})`;
    case 'rotate': return `transform:rotate(${+(+v).toFixed(2)}deg)`;
    case 'dash': return `stroke-dashoffset:${+(+v).toFixed(2)}`;
    default: return `${prop}:${v}`;
  }
};

const same = (a, b) => (Array.isArray(a) ? a.every((v, i) => Math.abs(v - b[i]) < 1e-6) : Math.abs(a - b) < 1e-6);

/**
 * One animated property of one element over the loop.
 * Segments say "from time t0 to t1 go from value a to value b"; between segments the value holds.
 */
export class Track {
  constructor(prop, initial) {
    this.prop = prop;
    this.initial = initial;
    this.segs = [];
  }
  /** Current value at time t (the value the last segment before t ended on). */
  valueAt(t) {
    let v = this.initial;
    for (const s of this.segs) if (s.t1 <= t + 1e-9) v = s.to;
    return v;
  }
  to(t0, t1, value, ease = 'inOut') {
    this.segs.push({ t0, t1, from: null, to: value, ease });
    this.segs.sort((a, b) => a.t0 - b.t0);
    return this;
  }
  fromTo(t0, t1, from, to, ease = 'inOut') {
    this.segs.push({ t0, t1, from, to, ease });
    this.segs.sort((a, b) => a.t0 - b.t0);
    return this;
  }
  get used() { return this.segs.length > 0; }
  get end() { return this.segs.reduce((m, s) => Math.max(m, s.t1), 0); }

  /** Make the loop seamless: return to the initial value just before the loop ends. */
  close(T, resetDur = 0.45) {
    if (!this.segs.length) return;
    const last = this.valueAt(T + 1);
    if (!same(last, this.initial)) this.to(Math.max(this.end, T - resetDur), T, this.initial, 'smooth');
  }

  css(T) {
    const keys = [{ t: 0, v: this.initial }];
    let cur = this.initial;
    for (const s of this.segs) {
      const from = s.from ?? cur;
      const t0 = Math.max(s.t0, keys[keys.length - 1].t);
      const t1 = Math.max(s.t1, t0);
      if (t0 > keys[keys.length - 1].t + 1e-6) keys.push({ t: t0, v: cur }); // hold until the segment starts
      const k = keys[keys.length - 1];
      if (!same(from, cur)) {
        if (k.t > 1e-6) { // jump cut: hold the old value right up to the start
          k.t = Math.max(k.t - 0.0004 * T, keys.length > 1 ? keys[keys.length - 2].t : 0);
          keys.push({ t: t0, v: from });
        } else k.v = from;
      }
      keys[keys.length - 1].ease = s.ease;
      keys.push({ t: t1, v: s.to });
      cur = s.to;
    }
    if (keys[keys.length - 1].t < T - 1e-6) keys.push({ t: T, v: cur });
    return keyframes(this.prop, keys.map((k) => [k.t, k.v, k.ease]), T);
  }
}

/** Raw keyframes from explicit [time, value, ease?] stops (used for sampled paths and visibility windows). */
export function keyframes(prop, stops, T) {
  let css = '';
  let prev = null;
  for (const [t, v, ease] of stops) {
    const p = pct(t, T);
    if (p === prev) css = css.slice(0, css.lastIndexOf(p + '{'));
    css += `${p}{${fmt(prop, v)}${ease && ease !== 'linear' ? `;animation-timing-function:${EASE[ease] || ease}` : ''}}`;
    prev = p;
  }
  return css;
}

/** Snap an ambient period so a whole number of cycles fits the loop: the scene then repeats exactly. */
export function snapPeriod(period, T) {
  const n = Math.max(1, Math.round(T / period));
  return T / n;
}

// ---------------------------------------------------------------- story scheduling

const DEFAULT_DUR = { pulse: 0.7, glow: 1.1, pop: 0.55, show: 0.45, hide: 0.4, lift: 0.7, drop: 0.6, tint: 0.5, untint: 0.5, shake: 0.5, say: 0, wait: 0.5, flash: 0.6, grow: 0.8, move: 1, mark: 0.5, unmark: 0.3 };

/**
 * Lay steps out on a timeline. A plain array is a sequence; an array nested inside it runs in
 * parallel; an array nested inside that is a sequence again.
 */
export function schedule(steps, t0, gap, durOf, parallel = false, read = { since: -Infinity, need: 0 }) {
  let t = t0, end = t0;
  const out = [];
  for (const st of steps) {
    if (!st) continue;
    let start = parallel ? t0 : t;
    if (Array.isArray(st)) {
      const sub = schedule(st, start, gap, durOf, !parallel, read);
      out.push(...sub.items);
      if (parallel) end = Math.max(end, sub.end); else { t = sub.end + gap; end = sub.end; }
      continue;
    }
    // at: an absolute time on the scene clock. The step starts then, whatever came before it.
    if (st.at != null && Number.isFinite(+st.at)) { start = +st.at; if (!parallel) t = start; }
    if (st.type === 'say') {
      // a caption stays long enough to be read before the next one replaces it
      if (st.at == null && start - read.since < read.need) { start = read.since + read.need; if (!parallel) t = start; }
      read.since = start;
      read.need = Math.max(1.3, String(st.text || '').length * 0.042);
    }
    const dur = st.dur ?? durOf(st) ?? DEFAULT_DUR[st.type] ?? 0.5;
    const delay = st.delay || 0;
    out.push({ ...st, t0: start + delay, t1: start + delay + dur });
    const fin = start + delay + dur;
    if (parallel) end = Math.max(end, fin);
    else { t = fin + (st.type === 'say' ? 0 : gap); end = fin; }
  }
  return { items: out, end: parallel ? end : Math.max(end, t0), read };
}
