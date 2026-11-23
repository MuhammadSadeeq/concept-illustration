// A press that stamps each document as it passes: approval, signing, a quality gate.
// Pattern: a vignette. One object fills the frame, nothing is labelled, and the mechanism
// itself tells the idea: parts slide, press, hold and release on one shared clock.
// The ram slides inside its sleeve, so the parts are listed back to front (sort: false).
export default ({ scene }) => {
  const s = scene({ look: 'studio', title: 'Every document is checked and stamped before it moves on', loop: 5, pad: 40 });
  const P = 5;      // seconds for one document to pass through
  const DROP = 0.7; // how far the head travels

  s.custom({
    at: [0, 0],
    parts: (sh, K) => {
      const ink = K.mat('paper').on;
      const seal = K.hex('accent');
      const press = { type: 'keys', period: P, keys: [
        // waits, drops with weight, holds, lifts away quickly
        { at: 0, move: [0, 0, 0] }, { at: 0.3, move: [0, 0, 0], ease: 'in' },
        { at: 0.42, move: [0, 0, -DROP] }, { at: 0.5, move: [0, 0, -DROP], ease: 'out' },
        { at: 0.64, move: [0, 0, 0] }, { at: 1, move: [0, 0, 0] },
      ] };
      return [sh.group({ sort: false, parts: [
        // the bed the documents travel along
        sh.box({ w: 4.2, d: 1.7, h: 0.22, r: 0.24, color: 'body',
          top: (fw, fh) => [{ t: 'line', x1: 0.5, y1: fh / 2 + 0.2, x2: fw - 0.5, y2: fh / 2 + 0.2, stroke: 'rgba(0,0,0,0.14)', sw: 0.8, dash: '0.04 0.3', anim: { type: 'march', period: 1, len: 0.34 }, style: 'stroke-linecap:butt' }] }),
        // the frame: a column at the back
        sh.box({ y: -0.58, z: 0.22, w: 0.62, d: 0.4, h: 1.6, r: 0.13, color: 'body' }),

        // the document: slides in, waits under the press, leaves with its seal
        sh.group({
          anim: { type: 'keys', period: P, keys: [
            { at: 0, move: [-1.7, 0, 0], opacity: 0 }, { at: 0.06, move: [-1.5, 0, 0], opacity: 1, ease: 'out' },
            { at: 0.24, move: [0, 0, 0] }, { at: 0.7, move: [0, 0, 0], ease: 'in' },
            { at: 0.92, move: [1.6, 0, 0], opacity: 1 }, { at: 1, move: [1.8, 0, 0], opacity: 0 },
          ] },
          parts: [sh.box({ y: 0.2, z: 0.22, w: 0.9, d: 1.0, h: 0.05, r: 0.06, color: 'paper', ao: false,
            top: (fw, fh) => [
              { t: 'rect', x: 0.13, y: 0.14, w: fw * 0.42, h: 0.07, r: 0.03, fill: ink, fillOp: 0.75 },
              ...[0, 1, 2].map((i) => ({ t: 'rect', x: 0.13, y: 0.3 + i * 0.13, w: fw - 0.26 - (i === 2 ? 0.25 : 0), h: 0.045, r: 0.02, fill: ink, fillOp: 0.28 })),
              // the seal appears the moment the press lands and stays with the document
              { t: 'g', tx: fw - 0.28, ty: fh - 0.26, anim: { type: 'keys', period: P, keys: [{ at: 0, opacity: 0, scale: 0.6 }, { at: 0.43, opacity: 0, scale: 0.6, ease: 'back' }, { at: 0.47, opacity: 1, scale: 1 }, { at: 0.98, opacity: 1, scale: 1 }, { at: 1, opacity: 0, scale: 1 }] },
                items: [{ t: 'circle', cx: 0, cy: 0, r: 0.16, fill: seal }, { t: 'circle', cx: 0, cy: 0, r: 0.095, stroke: '#ffffff', sw: 0.03 }] },
            ] })],
        }),

        // the head and the ram that drives it
        sh.group({ anim: press, parts: [
          sh.box({ y: 0.2, z: 1.0, w: 1.2, d: 1.0, h: 0.34, r: 0.16, color: 'accent' }),
          sh.cyl({ y: 0.2, z: 1.34, r: 0.1, h: 0.84, color: 'body2' }),
        ] }),
        // the sleeve the ram slides in, and the arm that carries it
        sh.cyl({ y: 0.2, z: 1.42, r: 0.2, h: 0.4, color: 'body' }),
        sh.box({ y: -0.04, z: 1.82, w: 0.62, d: 1.48, h: 0.26, r: 0.13, color: 'body' }),
      ] })];
    },
  });
  return s;
};
