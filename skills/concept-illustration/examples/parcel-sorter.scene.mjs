// Parcels arrive on one belt and a turntable sends them down two lanes in turn: routing, load
// balancing, an A/B split.
// Pattern: a vignette with several moving parts on one shared clock. Each parcel is a group with
// its own keyframed path; the second runs the same sequence half a period apart (phase: 0.5). The
// turntable's arrow turns just before the parcel that needs it arrives, so cause comes first.
export default ({ scene }) => {
  const s = scene({ look: 'sand', finish: 'soft', floor: 'none', title: 'One stream of parcels shared between two lanes', loop: 6, pad: 44 });
  const P = 6;

  s.custom({
    at: [0, 0],
    parts: (sh, K) => {
      const belt = K.hex('screen'), mark = 'rgba(255,255,255,0.26)';
      // a dark belt surface whose chevrons travel the way the belt runs
      const surface = (along) => (fw, fh) => [
        { t: 'rect', x: 0.1, y: 0.1, w: fw - 0.2, h: fh - 0.2, r: 0.08, fill: belt },
        along === 'x'
          ? { t: 'line', x1: 0.25, y1: fh / 2, x2: fw - 0.25, y2: fh / 2, stroke: mark, sw: fh - 0.5, dash: '0.07 0.43', anim: { type: 'march', period: 1, len: 0.5 }, style: 'stroke-linecap:butt' }
          : { t: 'line', x1: fw / 2, y1: 0.25, x2: fw / 2, y2: fh - 0.25, stroke: mark, sw: fw - 0.5, dash: '0.07 0.43', anim: { type: 'march', period: 1, len: 0.5 }, style: 'stroke-linecap:butt' },
      ];
      // a parcel rides in along x, then either carries straight on or leaves down the side lane
      const parcel = (turn, phase, color) => sh.group({
        anim: { type: 'keys', period: P, phase, keys: turn
          ? [{ at: 0, move: [0, 0, 0], opacity: 0 }, { at: 0.05, move: [0.3, 0, 0], opacity: 1, ease: 'out' }, { at: 0.38, move: [2.9, 0, 0], ease: 'in' }, { at: 0.8, move: [2.9, 2.9, 0], opacity: 1, ease: 'linear' }, { at: 0.86, move: [2.9, 3.2, 0], opacity: 0 }, { at: 1, move: [0, 0, 0], opacity: 0 }]
          : [{ at: 0, move: [0, 0, 0], opacity: 0 }, { at: 0.05, move: [0.3, 0, 0], opacity: 1, ease: 'linear' }, { at: 0.8, move: [5.6, 0, 0], opacity: 1 }, { at: 0.86, move: [5.9, 0, 0], opacity: 0 }, { at: 1, move: [0, 0, 0], opacity: 0 }] },
        parts: [sh.box({ x: -2.9, z: 0.38, w: 0.62, d: 0.62, h: 0.5, r: 0.06, color,
          top: (fw, fh) => [{ t: 'rect', x: 0, y: fh / 2 - 0.05, w: fw, h: 0.1, fill: 'rgba(0,0,0,0.18)' }],
          left: (fw, fh) => [{ t: 'rect', x: fw - 0.3, y: 0.1, w: 0.2, h: 0.14, r: 0.02, fill: '#ffffff', fillOp: 0.85 }] })],
      });
      return [
        // the belts and the turntable are one piece, so the parcels always ride on top of it
        sh.group({ parts: [
          sh.box({ x: 0, w: 6.4, d: 1.05, h: 0.34, r: 0.12, color: 'body', top: surface('x') }),
          sh.box({ x: 0, y: 2.0, w: 1.05, d: 3.0, h: 0.34, r: 0.12, color: 'body', top: surface('y') }),
          sh.cyl({ z: 0.34, r: 0.47, h: 0.03, color: 'paper', top: (fw, fh) => [
            { t: 'circle', cx: fw / 2, cy: fh / 2, r: 0.36, fill: 'none', stroke: K.hex('muted'), sw: 0.025, dash: '0.05 0.06' },
            // the arrow: along the main belt for one parcel, a quarter turn for the next
            { t: 'g', tx: fw / 2, ty: fh / 2, anim: { type: 'keys', period: P, keys: [{ at: 0, rotate: 90 }, { at: 0.12, rotate: 90, ease: 'back' }, { at: 0.22, rotate: 0 }, { at: 0.6, rotate: 0, ease: 'back' }, { at: 0.7, rotate: 90 }, { at: 1, rotate: 90 }] },
              items: [{ t: 'path', d: 'M-0.24 -0.07H0.06V-0.19L0.3 0L0.06 0.19V0.07H-0.24Z', fill: K.hex('accent') }] },
          ] }),
        ] }),
        // a sensor that watches the junction: one small light, blinking
        sh.cyl({ x: -0.78, y: -0.76, r: 0.07, h: 0.66, color: 'body2' }),
        sh.sphere({ x: -0.78, y: -0.76, z: 0.74, r: 0.085, color: 'ok', anim: { type: 'blink', period: 1.5, min: 0.3 } }),
        parcel(false, 0, 'gold'),
        parcel(true, 0.5, 'accent2'),
      ];
    },
  });
  return s;
};
