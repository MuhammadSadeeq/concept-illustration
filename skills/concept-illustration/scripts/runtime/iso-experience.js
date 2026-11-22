/*
 * Interactive layer for a built scene: playback controls, chapter stepping, scroll-driven
 * playback and object hotspots. The scene stays a plain animated SVG; this script only steers
 * the CSS animations it already carries (through the Web Animations API) and adds chrome around
 * it. Without the script the SVG simply keeps looping.
 *
 *   <figure data-iso-experience data-mode="loop | step | scroll"> <svg ...> </figure>
 *   const player = IsoExperience.mount(figureOrSvg, { mode, controls, hotspots });
 */
(function () {
  'use strict';

  const HOLD_GAP = 0.05; // a chapter comes to rest this long before the next caption takes over
  const OUTRO = 0.6; // the loop's last moments fade the caption and reset the scene
  const SCROLL_VH_PER_SECOND = 28; // scroll distance that stands for one second of the loop
  const EDGE = 8; // keeps the hotspot card off the edges of the stage
  const ICONS = {
    play: 'M8 5v14l11-7z',
    pause: 'M7 5h3.5v14H7zM13.5 5H17v14h-3.5z',
    replay: 'M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z',
    prev: 'M15.4 7.4 14 6l-6 6 6 6 1.4-1.4L10.8 12z',
    next: 'M8.6 16.6 10 18l6-6-6-6-1.4 1.4L13.2 12z',
  };
  const TRACK = '{height:4px;border-radius:2px;background:linear-gradient(to right,var(--isox-ink) var(--isox-p),var(--isox-line) var(--isox-p))}';
  const THUMB = '{width:12px;height:12px;border:0;border-radius:50%;background:var(--isox-ink)}';
  const CSS = [
    '.isox{--isox-ink:#1c2033;--isox-soft:rgba(28,32,51,.62);--isox-line:rgba(28,32,51,.16);--isox-wash:rgba(28,32,51,.08);--isox-card:#1c2033;--isox-card-ink:#fff;--isox-ring:#2f55d4;display:block;margin:0;color:var(--isox-ink);font:500 13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;-webkit-tap-highlight-color:transparent}',
    '.isox--dark{--isox-ink:#f1f3fa;--isox-soft:rgba(241,243,250,.66);--isox-line:rgba(241,243,250,.18);--isox-wash:rgba(241,243,250,.1);--isox-card:#f4f5fb;--isox-card-ink:#171a2a;--isox-ring:#a9bcff}',
    '.isox:focus{outline:none}',
    '.isox-frame{position:relative;border-radius:14px;overflow:hidden;background:var(--isox-bg,transparent)}',
    // drawn inside the frame so the ring always sits on the scene's own backdrop
    '.isox:focus-visible .isox-frame::after{content:"";position:absolute;inset:0;border:2px solid var(--isox-ring);border-radius:inherit;pointer-events:none}',
    '.isox-stage{position:relative}',
    '.isox-svg{display:block;width:100%;height:auto}',
    '.isox-svg [data-obj]{transition:opacity .18s ease}',
    '.isox-svg.isox-dim [data-obj]:not(.isox-on){opacity:.45}',
    '.isox-hot{cursor:pointer;outline:none}',
    '.isox-hot:focus-visible{outline:2px solid var(--isox-ring);outline-offset:3px;border-radius:6px}',
    '.isox-bar{display:flex;flex-wrap:wrap;align-items:center;padding:2px 6px 6px}',
    '.isox-btn,.isox-dot{appearance:none;display:grid;place-items:center;height:40px;padding:0;border:0;border-radius:10px;background:none;color:var(--isox-soft);cursor:pointer}',
    '.isox-btn{flex:none;width:40px;transition:background .15s,color .15s}',
    '.isox-btn:hover{background:var(--isox-wash);color:var(--isox-ink)}',
    '.isox-btn svg{display:block;fill:currentColor}',
    '.isox-play{color:var(--isox-ink)}',
    '.isox-btn:focus-visible,.isox-dot:focus-visible,.isox-scrub:focus-visible{outline:2px solid var(--isox-ring);outline-offset:-3px}',
    '.isox-scrub{appearance:none;-webkit-appearance:none;flex:1 1 150px;min-width:0;height:40px;margin:0 10px;padding:0;border-radius:10px;background:none;cursor:pointer;--isox-p:0%}',
    '.isox-scrub::-webkit-slider-runnable-track' + TRACK,
    '.isox-scrub::-moz-range-track' + TRACK,
    '.isox-scrub::-webkit-slider-thumb{-webkit-appearance:none;margin-top:-4px}',
    '.isox-scrub::-webkit-slider-thumb' + THUMB,
    '.isox-scrub::-moz-range-thumb' + THUMB,
    // auto margins centre the stepper only once it has wrapped onto a row of its own
    '.isox-steps{display:flex;align-items:center;min-width:0;margin:0 auto}',
    '.isox-dot{flex:0 1 40px;width:40px;min-width:24px}',
    '.isox-dot i{width:8px;height:8px;border-radius:4px;background:var(--isox-ink);opacity:.3;transition:width .2s ease,opacity .2s ease}',
    '.isox-dot:hover i{opacity:.6}',
    '.isox-dot--on i,.isox-dot--on:hover i{width:20px;opacity:1}',
    '.isox-live{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}',
    '.isox-card{position:absolute;left:0;top:0;z-index:2;box-sizing:border-box;width:max-content;max-width:min(264px,calc(100% - 16px));padding:9px 12px 10px;border-radius:10px;background:var(--isox-card);color:var(--isox-card-ink);box-shadow:0 8px 28px rgba(0,0,0,.28),0 1px 3px rgba(0,0,0,.22);pointer-events:none;opacity:0;visibility:hidden;transform:translateY(4px);transition:opacity .14s ease,transform .14s ease,visibility 0s .14s}',
    '.isox-card--below{transform:translateY(-4px)}',
    '.isox-card--open{opacity:1;visibility:visible;transform:none;transition-delay:0s}',
    '.isox-card b{display:block;font-weight:650}',
    '.isox-card span{display:block;margin-top:2px;font-weight:450;opacity:.8}',
    '.isox-card b:empty,.isox-card span:empty{display:none}',
    '.isox-card i{position:absolute;left:var(--isox-caret,50%);bottom:-4px;width:10px;height:10px;margin-left:-5px;border-radius:2px;background:inherit;transform:rotate(45deg)}',
    '.isox-card--below i{top:-4px;bottom:auto}',
    '.isox--scroll{height:calc(100vh + var(--isox-span,200vh))}',
    '.isox--scroll .isox-pin{position:sticky;top:0;display:flex;align-items:center;justify-content:center;height:100vh;height:100svh}',
    '.isox--scroll .isox-frame{width:min(100%,calc((100vh - 96px)*var(--isox-ratio,1.4)))}',
    '@media (prefers-reduced-motion:reduce){.isox *,.isox-svg [data-obj]{transition:none!important}}',
  ].join('\n');

  const players = new WeakMap();
  let styleTag = null;
  let mounted = 0;

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const iconSvg = (d) => '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="' + d + '"/></svg>';

  function make(tag, cls, attrs) {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    for (const key in attrs || {}) node.setAttribute(key, attrs[key]);
    return node;
  }

  function button(cls, label, d) {
    const node = make('button', cls, { type: 'button', 'aria-label': label, title: label });
    if (d) node.innerHTML = iconSvg(d); else node.appendChild(make('i'));
    return node;
  }

  // Classes and inline styles come off again on destroy; do not leave empty attributes behind.
  function tidy(node) {
    for (const name of ['class', 'style']) if (!node.getAttribute(name)) node.removeAttribute(name);
  }

  // Brightness (0-255) of an element's own background, or null when it paints none.
  function toneOf(el) {
    const c = (getComputedStyle(el).backgroundColor.match(/[\d.]+/g) || []).map(Number);
    return c.length === 3 || c[3] > 0.5 ? 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] : null;
  }

  // Chrome is light or dark to suit what is actually behind it: the scene's backdrop or, for a
  // transparent scene, the first painted background up the tree, or else the page canvas (which
  // follows the reader's colour scheme only on pages that opted in to it).
  function hasDarkBackdrop(node) {
    for (let el = node; el; el = el.parentElement) if (toneOf(el) != null) return toneOf(el) < 128;
    const probe = node.appendChild(make('i'));
    probe.style.backgroundColor = 'Canvas';
    const dark = toneOf(probe) < 128;
    probe.remove();
    return dark;
  }

  function readChapters(svg, loop) {
    try {
      const list = JSON.parse(svg.dataset.chapters || '[]');
      return list.filter((c) => c && c.t >= 0 && c.t < loop).sort((a, b) => a.t - b.t);
    } catch {
      return [];
    }
  }

  // The scene switches its animations off under reduced motion, but a held frame needs them to
  // exist. Lift that rule while this layer is in charge; in return it never plays unasked.
  function liftMotionRule(svg) {
    const lifted = [];
    for (const style of svg.querySelectorAll('style')) {
      const rules = style.sheet ? style.sheet.cssRules : [];
      for (let i = rules.length - 1; i >= 0; i--) {
        if (!rules[i].media || !/reduced-motion/.test(rules[i].media.mediaText)) continue;
        lifted.push({ sheet: style.sheet, text: rules[i].cssText });
        style.sheet.deleteRule(i);
      }
    }
    return () => lifted.forEach((rule) => rule.sheet.insertRule(rule.text, rule.sheet.cssRules.length));
  }

  // Every animation in the scene started together, so one number positions them all: seconds
  // since the scene appeared (the entrance first, then the loop over and over).
  function createTimeline(svg) {
    let list = [];
    let last = 0;
    function all() {
      if (!list.length || list[0].anim.playState === 'idle') {
        list = svg.getAnimations({ subtree: true })
          .filter((anim) => typeof anim.animationName === 'string') // not our own transitions
          .map((anim) => ({ anim, end: anim.effect ? anim.effect.getComputedTiming().endTime : Infinity }));
      }
      return list;
    }
    return {
      now() {
        const ref = all().find((item) => item.end === Infinity);
        if (ref && ref.anim.currentTime != null) last = ref.anim.currentTime / 1000;
        return last;
      },
      set(seconds) {
        last = seconds;
        for (const item of all()) item.anim.currentTime = seconds * 1000;
      },
      run(on) {
        for (const item of all()) {
          // play() rewinds an animation that already finished, which would replay the entrance
          if (!on) item.anim.pause(); else if (item.anim.currentTime < item.end) item.anim.play();
        }
      },
    };
  }

  // An object the story has not revealed yet still catches the pointer; treat it as absent.
  function isShown(group) {
    let node = group.firstElementChild;
    while (node && node.tagName === 'g' && node.parentNode.childElementCount === 1) {
      if (+getComputedStyle(node).opacity < 0.1) return false;
      node = node.firstElementChild;
    }
    return true;
  }

  // One shared style tag, added with the first player and removed with the last.
  function countPlayer(delta) {
    mounted += delta;
    if (mounted && !styleTag) {
      styleTag = document.head.appendChild(make('style', '', { id: 'isox-style' }));
      styleTag.textContent = CSS;
    } else if (!mounted && styleTag) {
      styleTag.remove();
      styleTag = null;
    }
  }

  function mount(target, options) {
    const svg = target && (target.matches('svg') ? target : target.querySelector('svg[data-loop]'));
    if (!svg) return null;
    if (players.has(svg)) return players.get(svg);

    const opts = options || {};
    const mode = opts.mode === 'step' || opts.mode === 'scroll' ? opts.mode : 'loop';
    const loop = +svg.dataset.loop || 6;
    const intro = +svg.dataset.intro || 0;
    const chapters = readChapters(svg, loop);
    // Stepping needs something to step through, so a scene without chapters counts as one.
    const marks = chapters.length ? chapters : [{ t: 0, text: '' }];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timeline = createTimeline(svg);
    const undo = [];
    const ui = { dots: [], cur: -1 };
    let playing = false;
    let stopAt = null; // timeline position at which a chapter run comes to rest
    let time = 0; // position in the loop, seconds
    let cur = 0; // chapter index
    let inView = true;
    let raf = 0;
    let watcher = null;
    let closeCard = () => {};

    // host > pin > frame > (stage > svg + card), bar
    const slot = svg.parentNode;
    const after = svg.nextSibling;
    const host = target === svg ? slot.insertBefore(make('div'), svg) : target;
    const pin = make('div', 'isox-pin');
    const frame = pin.appendChild(make('div', 'isox-frame'));
    const stage = frame.appendChild(make('div', 'isox-stage'));
    const live = frame.appendChild(make('div', 'isox-live', { 'aria-live': 'polite' }));
    const view = svg.viewBox.baseVal;
    const ownsTabindex = !host.hasAttribute('tabindex');

    function listen(node, type, fn, o) {
      node.addEventListener(type, fn, o);
      undo.push(() => node.removeEventListener(type, fn, o));
    }

    function dress() {
      countPlayer(1);
      if (target === svg) host.appendChild(pin); else slot.insertBefore(pin, svg);
      stage.appendChild(svg);
      svg.classList.add('isox-svg');
      host.classList.add('isox', 'isox--' + mode);
      if (svg.dataset.bg) host.style.setProperty('--isox-bg', svg.dataset.bg);
      host.style.setProperty('--isox-ratio', view.width / view.height || 1.4);
      host.style.setProperty('--isox-span', Math.max(120, loop * SCROLL_VH_PER_SECOND) + 'vh');
      host.classList.toggle('isox--dark', hasDarkBackdrop(frame));
      if (ownsTabindex) host.setAttribute('tabindex', '0');
      // moving the svg re-parses its style sheet, so the rule can only be lifted afterwards
      if (reduced) undo.push(liftMotionRule(svg));
    }

    function undress() {
      slot.insertBefore(svg, after && after.parentNode === slot ? after : null);
      pin.remove();
      svg.classList.remove('isox-svg', 'isox-dim');
      tidy(svg);
      if (target === svg) return host.remove();
      host.classList.remove('isox', 'isox--' + mode, 'isox--dark');
      ['--isox-bg', '--isox-ratio', '--isox-span'].forEach((name) => host.style.removeProperty(name));
      if (ownsTabindex) host.removeAttribute('tabindex');
      tidy(host);
    }

    // ---- time

    const locate = (seconds) => (seconds <= intro ? 0 : (seconds - intro) % loop);
    const startOf = (i) => (i ? marks[i].t : 0);
    const running = () => playing && inView && !document.hidden;

    function chapterAt(t) {
      let found = 0;
      marks.forEach((mark, i) => { if (t >= mark.t) found = i; });
      return found;
    }

    function holdOf(i) {
      if (i + 1 < marks.length) return Math.max(startOf(i), marks[i + 1].t - HOLD_GAP);
      return Math.max(marks[i].t, loop - OUTRO);
    }

    function place(t) {
      time = clamp(t, 0, loop);
      timeline.set(intro + loop + time);
    }

    function sync() {
      timeline.run(running());
      if (running() && !raf) raf = requestAnimationFrame(tick);
      paint();
    }

    function tick() {
      raf = 0;
      if (!running()) return;
      const at = timeline.now();
      if (stopAt != null && at >= stopAt) return rest(holdOf(cur));
      time = locate(at);
      if (stopAt == null) cur = chapterAt(time);
      paint();
      raf = requestAnimationFrame(tick);
    }

    function rest(t) {
      stopAt = null;
      playing = false;
      place(t);
      sync();
    }

    // Play on and come to rest at loop time t, running through the loop end if t lies behind us.
    function runUntil(t) {
      if (reduced) return rest(t);
      const at = timeline.now();
      stopAt = at + (at < intro ? intro - at + t : (((t - locate(at)) % loop) + loop) % loop);
      playing = true;
      sync();
    }

    // ---- controller

    function play() {
      if (playing || mode === 'scroll') return;
      if (mode === 'step') return time >= holdOf(cur) - 0.01 ? next() : runUntil(holdOf(cur));
      playing = true;
      sync();
    }

    function pause() {
      if (!playing) return;
      time = locate(timeline.now());
      stopAt = null;
      playing = false;
      sync();
    }

    function seek(t) {
      if (mode === 'scroll') return scrollToTime(+t || 0);
      const resume = playing;
      pause();
      place(+t || 0);
      cur = chapterAt(time);
      if (resume) play(); else sync();
    }

    function goto(index) {
      if (!chapters.length && mode !== 'step') return;
      const i = clamp(Math.round(+index) || 0, 0, marks.length - 1);
      if (mode === 'scroll') return scrollToTime(holdOf(i));
      if (playing) time = locate(timeline.now());
      // From the hold just before this chapter, carry straight on; from anywhere else, cut to its start.
      const before = (i + marks.length - 1) % marks.length;
      const carryOn = marks.length > 1 && cur === before && time >= holdOf(before) - 0.01;
      if (!carryOn) place(startOf(i));
      cur = i;
      live.textContent = marks[i].text;
      runUntil(holdOf(i));
    }

    function restart() {
      if (mode === 'scroll') return scrollToTime(0);
      pause();
      cur = 0;
      time = 0;
      timeline.set(0); // the very top, so the entrance plays again
      if (mode === 'step') runUntil(holdOf(0)); else play();
    }

    const toggle = () => (playing ? pause() : play());
    const next = () => goto(mode === 'scroll' ? cur + 1 : (cur + 1) % marks.length);
    const prev = () => goto(cur - 1);

    // ---- scroll mode: the host is a tall track and the pinned stage scrubs with the page

    const scrollSpan = () => Math.max(1, host.offsetHeight - pin.offsetHeight);

    function followScroll() {
      raf = 0;
      const t = clamp(-host.getBoundingClientRect().top / scrollSpan(), 0, 1) * loop;
      cur = chapterAt(t);
      // With reduced motion the picture steps between settled frames instead of gliding.
      place(reduced && chapters.length ? holdOf(cur) : t);
      paint();
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(followScroll);
    }

    function scrollToTime(t) {
      const top = window.scrollY + host.getBoundingClientRect().top + clamp(t / loop, 0, 1) * scrollSpan();
      window.scrollTo({ top: Math.round(top), behavior: reduced ? 'auto' : 'smooth' });
    }

    // ---- controls

    function paint() {
      if (ui.scrub) {
        ui.scrub.value = time;
        ui.scrub.style.setProperty('--isox-p', ((time / loop) * 100).toFixed(2) + '%');
        ui.scrub.setAttribute('aria-valuetext', time.toFixed(1) + ' of ' + loop.toFixed(1) + ' seconds');
      }
      if (ui.play && ui.play.title !== (playing ? 'Pause' : 'Play')) {
        ui.play.title = playing ? 'Pause' : 'Play';
        ui.play.setAttribute('aria-label', ui.play.title);
        ui.play.innerHTML = iconSvg(playing ? ICONS.pause : ICONS.play);
      }
      if (ui.cur === cur) return;
      ui.cur = cur;
      ui.dots.forEach((dot, i) => {
        dot.classList.toggle('isox-dot--on', i === cur);
        if (i === cur) dot.setAttribute('aria-current', 'step'); else dot.removeAttribute('aria-current');
      });
    }

    // Dragging the scrubber leaves the scene paused on the chosen frame.
    function scrub() {
      const t = +ui.scrub.value; // read first: pausing repaints the slider
      pause();
      seek(t);
    }

    function addControls() {
      if (mode === 'scroll' && !chapters.length) return;
      const bar = frame.appendChild(make('div', 'isox-bar'));
      const full = mode !== 'scroll'; // in scroll mode the page scroll is the control
      if (full) {
        ui.play = bar.appendChild(button('isox-btn isox-play', 'Play', ICONS.play));
        listen(ui.play, 'click', toggle);
        listen(bar.appendChild(button('isox-btn', 'Replay', ICONS.replay)), 'click', restart);
        ui.scrub = bar.appendChild(make('input', 'isox-scrub', { type: 'range', min: 0, max: loop, step: 0.01, value: 0, 'aria-label': 'Loop position' }));
        listen(ui.scrub, 'input', scrub);
      }
      if (!chapters.length) return;
      const steps = bar.appendChild(make('div', 'isox-steps', { role: 'group', 'aria-label': 'Chapters' }));
      if (full) listen(steps.appendChild(button('isox-btn', 'Previous chapter', ICONS.prev)), 'click', prev);
      chapters.forEach((chapter, i) => {
        ui.dots.push(steps.appendChild(button('isox-dot', chapter.text)));
        listen(ui.dots[i], 'click', () => goto(i));
      });
      if (full) listen(steps.appendChild(button('isox-btn', 'Next chapter', ICONS.next)), 'click', next);
    }

    function onKey(e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const onSlider = e.target === ui.scrub;
      const onButton = e.target.closest('button, .isox-hot');
      const nudge = { ArrowRight: 0.5, ArrowUp: 0.5, ArrowLeft: -0.5, ArrowDown: -0.5 }[e.key];
      let act = null;
      if (e.key === 'Escape') act = closeCard;
      else if (e.key === 'k' || e.key === 'K' || (e.key === ' ' && !onButton)) act = toggle;
      // left to itself the slider would creep by a single step per key press
      else if (onSlider) act = nudge ? () => seek(time + nudge) : null;
      else if (e.key === 'ArrowRight') act = next;
      else if (e.key === 'ArrowLeft') act = prev;
      else if (e.key === 'Home') act = restart;
      // in scroll mode Space keeps its usual job of paging down
      if (!act || (act === toggle && mode === 'scroll')) return;
      e.preventDefault();
      act();
    }

    // ---- hotspots

    // Where an object sits on the stage: its data-box is in viewBox units, the card in pixels.
    function spotRect(group) {
      const box = group.dataset.box.trim().split(/[\s,]+/).map(Number);
      const s = stage.getBoundingClientRect();
      const r = svg.getBoundingClientRect();
      const k = Math.min(r.width / view.width, r.height / view.height);
      const ox = r.left - s.left + (r.width - view.width * k) / 2 - view.x * k;
      const oy = r.top - s.top + (r.height - view.height * k) / 2 - view.y * k;
      return { x: ox + ((box[0] + box[2]) / 2) * k, top: oy + box[1] * k, bottom: oy + box[3] * k };
    }

    function addHotspots() {
      const spots = Array.from(svg.querySelectorAll('[data-obj][data-box]')).filter((g) => g.dataset.label || g.dataset.info);
      if (!spots.length) return;
      const card = stage.appendChild(make('div', 'isox-card', { 'aria-hidden': 'true' }));
      const role = svg.getAttribute('role');
      const spotOf = (node) => (node && node.closest ? node.closest('.isox-hot') : null);
      let open = null;
      card.innerHTML = '<b></b><span></span><i></i>';
      svg.setAttribute('role', 'group'); // an image role would hide the buttons inside it
      for (const g of spots) {
        g.classList.add('isox-hot');
        g.setAttribute('tabindex', '0');
        g.setAttribute('role', 'button');
        g.setAttribute('aria-label', [g.dataset.label, g.dataset.info].filter(Boolean).join('. '));
      }

      function openCard(g) {
        if (open === g) return;
        closeCard();
        open = g;
        card.children[0].textContent = g.dataset.label || '';
        card.children[1].textContent = g.dataset.info || '';
        g.classList.add('isox-on');
        svg.classList.add('isox-dim');
        const at = spotRect(g);
        const w = card.offsetWidth;
        const h = card.offsetHeight;
        const below = at.top - h - 10 < EDGE; // no room above the object
        const left = clamp(at.x - w / 2, EDGE, Math.max(EDGE, stage.clientWidth - w - EDGE));
        const top = below ? Math.min(at.bottom + 10, stage.clientHeight - h - EDGE) : at.top - h - 10;
        card.style.left = left + 'px';
        card.style.top = top + 'px';
        card.style.setProperty('--isox-caret', clamp(at.x - left, 14, w - 14) + 'px');
        card.className = 'isox-card isox-card--open' + (below ? ' isox-card--below' : '');
      }

      closeCard = () => {
        if (!open) return;
        open.classList.remove('isox-on');
        svg.classList.remove('isox-dim');
        card.classList.remove('isox-card--open');
        open = null;
      };

      function onPick(e) {
        if (spotOf(e.target)) openCard(spotOf(e.target));
      }

      // The listeners sit on the stage: focus listeners on an svg would make it a tab stop itself.
      listen(stage, 'pointerover', (e) => {
        const g = spotOf(e.target);
        if (g && e.pointerType === 'mouse' && isShown(g)) openCard(g);
      });
      listen(stage, 'pointerout', (e) => {
        const g = spotOf(e.target);
        if (g && e.pointerType === 'mouse' && spotOf(e.relatedTarget) !== g) closeCard();
      });
      listen(stage, 'focusin', onPick);
      listen(stage, 'click', onPick);
      listen(stage, 'focusout', closeCard);
      listen(stage, 'keydown', (e) => {
        const g = spotOf(e.target);
        if (!g || (e.key !== 'Enter' && e.key !== ' ')) return;
        e.preventDefault();
        if (open === g) closeCard(); else openCard(g);
      });
      listen(document, 'pointerdown', (e) => { if (!stage.contains(e.target) || !spotOf(e.target)) closeCard(); });
      listen(window, 'resize', closeCard);
      undo.push(() => {
        closeCard();
        card.remove();
        if (role) svg.setAttribute('role', role); else svg.removeAttribute('role');
        for (const g of spots) {
          g.classList.remove('isox-hot');
          ['tabindex', 'role', 'aria-label'].forEach((name) => g.removeAttribute(name));
          tidy(g);
        }
      });
    }

    // ---- life cycle

    function start() {
      listen(host, 'keydown', onKey);
      listen(document, 'visibilitychange', sync);
      // Off screen or in a background tab nothing plays; sync() picks up again from the same spot.
      if ('IntersectionObserver' in window) {
        watcher = new IntersectionObserver((entries) => {
          inView = entries[entries.length - 1].isIntersecting;
          sync();
        });
        watcher.observe(frame);
      }
      if (mode === 'scroll') {
        listen(window, 'scroll', onScroll, { passive: true });
        listen(window, 'resize', onScroll);
        timeline.run(false);
        return followScroll();
      }
      if (reduced) return rest(chapters.length ? holdOf(0) : loop * 0.5);
      if (mode === 'step') return runUntil(holdOf(0));
      play();
    }

    function destroy() {
      if (!players.delete(svg)) return;
      cancelAnimationFrame(raf);
      if (watcher) watcher.disconnect();
      undo.splice(0).reverse().forEach((fn) => fn());
      undress(); // moving the svg back also restarts its own untouched loop
      countPlayer(-1);
    }

    const player = {
      mode, play, pause, toggle, seek, goto, next, prev, restart, destroy,
      get playing() { return playing; },
      get time() { return playing ? locate(timeline.now()) : time; },
      get chapter() { return cur; },
    };
    players.set(svg, player);
    dress();
    if (opts.controls !== false) addControls();
    if (opts.hotspots !== false) addHotspots();
    start();
    return player;
  }

  function mountAll() {
    document.querySelectorAll('[data-iso-experience]').forEach((node) => {
      const d = node.dataset;
      mount(node, { mode: d.mode, controls: d.controls !== 'false', hotspots: d.hotspots !== 'false' });
    });
  }

  window.IsoExperience = { mount, mountAll };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll);
  else mountAll();
})();
