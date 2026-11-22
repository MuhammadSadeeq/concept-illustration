// How a generator makes alternating current: a coil of wire turns between two magnets, the
// current it produces reverses every half turn, and that current lights a lamp.
// Pattern: a working model. The machine is a custom object whose parts really turn (the coil's
// sides orbit the shaft, its ends spin in step), and everything that depends on the current
// (the dots in the wires, the lamp, the meter) runs on the same clock, in the right phase:
// the current is zero when the coil stands upright and strongest when it lies level.
export default ({ scene }) => {
  const s = scene({ look: 'ocean', floor: 'plate', title: 'How a generator makes alternating current', pad: 48 });

  const P = 3;      // seconds per turn of the coil = one full cycle of the current
  const Z = 1.3;    // height of the shaft
  const R = 0.78;   // radius of the coil
  const L = 1.15;   // half the length of the coil
  const POLE = 1.75; // distance from the shaft to each magnet's face

  // --- a bar magnet with its pole marked on the face toward the viewer
  s.define('magnet', (o, sh) => ({ parts: [
    sh.box({ w: 2.3, d: 1.0, h: 1.9, r: 0.1, color: o.pole === 'N' ? '#e5484d' : '#3d7ff0',
      left: (fw, fh) => [{ t: 'text', x: fw / 2, y: fh * 0.36, text: o.pole, size: 0.8, fill: '#ffffff', weight: 800 }] }),
  ] }));

  // --- the rotor: handle, shaft, coil, slip rings and brushes. x = 0 is the middle of the coil.
  s.define('rotor', (o, sh, K) => {
    const X = (x) => x + 0.52; // shift so the object's footprint is centred on its own origin
    const copper = K.hex('gold');
    const disc = (x, r, depth, color) => sh.prism({ plane: 'right', at: [X(x), 0, Z], outline: sh.outline.circle(r), depth, color });
    const rod = (x0, x1) => disc(x0, 0.065, x1 - x0, 'body2');
    // one long side of the coil: a wire parallel to the shaft that circles it
    const side = (from) => sh.prism({ plane: 'right', at: [X(-L), 0, Z], outline: sh.outline.circle(0.06), depth: 2 * L, color: 'gold',
      anim: { type: 'orbit', axis: 'x', r: R, from, period: P } });
    // one end of the coil: a bar across the shaft, spinning in the plane that faces along it
    const end = (x, gap) => sh.decal({ plane: 'right', at: [X(x), 0, Z], size: [0.1, 0.1], items: [{ t: 'g', rot: 90, anim: { type: 'spin', period: P }, items: gap
      ? [{ t: 'line', x1: -R, y1: 0, x2: -0.16, y2: 0, stroke: copper, sw: 0.12 }, { t: 'line', x1: 0.16, y1: 0, x2: R, y2: 0, stroke: copper, sw: 0.12 }]
      : [{ t: 'line', x1: -R, y1: 0, x2: R, y2: 0, stroke: copper, sw: 0.12 }] }] });
    // the magnetic field: faint lines running from the north pole to the south pole
    const field = [-0.7, 0, 0.7].flatMap((x) => [Z - 0.42, Z + 0.42].map((z) => sh.wire({ points: [[X(x), -POLE, z], [X(x), POLE, z]],
      color: '#ffffff', width: 1.4, dash: '2 7', opacity: 0.55, anim: { type: 'march', period: 1.5, len: 9 } })));
    return {
      d: 0.6, // the footprint is the bench the machine stands on, not the sweep of the coil
      parts: [
        // the handle: a wheel with a knob that goes round with it
        disc(-3.4, 0.7, 0.16, 'paper'),
        sh.decal({ plane: 'right', at: [X(-3.235), 0, Z], size: [0.1, 0.1], items: [{ t: 'g', rot: 90, anim: { type: 'spin', period: P }, items: [
          ...[0, 60, 120].map((a) => ({ t: 'g', rot: a, items: [{ t: 'line', x1: -0.6, y1: 0, x2: 0.6, y2: 0, stroke: K.mat('paper').on, sw: 0.04, op: 0.35 }] })),
          { t: 'circle', cx: 0, cy: 0, r: 0.15, fill: K.hex('body2') },
        ] }] }),
        sh.group({ sort: false, parts: [
          rod(-3.24, -L),
          sh.prism({ plane: 'right', at: [X(-3.23), 0, Z], outline: sh.outline.circle(0.09), depth: 0.36, color: 'accent', anim: { type: 'orbit', axis: 'x', r: 0.5, from: 90, period: P } }),
        ] }),
        sh.box({ x: X(-2.2), w: 0.3, d: 0.5, h: Z - 0.075, r: 0.06, color: 'paper' }),   // bearings that carry the shaft
        sh.box({ x: X(1.42), w: 0.24, d: 0.5, h: Z - 0.075, r: 0.06, color: 'paper' }),

        // the coil in the field. Its parts cross one another as it turns, so they are listed back to front.
        sh.group({ sort: false, parts: [...field, end(-L, false), side(90), side(270), end(L, true)] }),

        // out of the far end: the shaft, two slip rings, and the brushes that rub on them
        rod(L + 0.02, 1.72), disc(1.72, 0.24, 0.18, 'gold'), rod(1.9, 2.06), disc(2.06, 0.24, 0.18, 'gold'), rod(2.24, 2.36),
        sh.box({ x: X(1.98), w: 0.82, d: 0.6, h: 0.66, r: 0.08, color: 'paper' }),
        sh.box({ x: X(1.81), z: 0.66, w: 0.13, d: 0.18, h: Z - 0.24 - 0.66, color: 'dark' }),
        sh.box({ x: X(2.15), z: 0.66, w: 0.13, d: 0.18, h: Z - 0.24 - 0.66, color: 'dark' }),
      ],
    };
  });

  // --- a lamp whose light follows the strength of the current: brightest twice every turn
  s.define('lamp', (o, sh) => ({ round: true, parts: [sh.group({ sort: false, parts: [
    sh.cyl({ r: 0.42, h: 0.16, color: 'paper' }),
    sh.cyl({ z: 0.16, r: 0.2, h: 0.36, color: 'body2' }),
    sh.sphere({ z: 1.0, r: 0.5, color: 'gold' }),
    sh.glow({ z: 1.0, r: 1.9, color: 'gold', anim: { type: 'blink', period: P / 2, min: 0.2, phase: 0.5 } }),
  ] })] }));

  // --- a meter whose needle swings one way, then the other
  s.define('meter', (o, sh, K) => ({ parts: [
    sh.box({ w: 1.5, d: 0.7, h: 1.2, r: 0.1, color: o.color,
      left: (fw, fh) => {
        const cx = fw / 2, cy = fh - 0.3, ink = K.mat('paper').on, r = 0.64;
        const at = (deg, r) => [cx + r * Math.sin((deg * Math.PI) / 180), cy - r * Math.cos((deg * Math.PI) / 180)];
        return [
          { t: 'rect', x: 0.1, y: 0.1, w: fw - 0.2, h: fh - 0.2, r: 0.07, fill: K.hex('paper') },
          { t: 'path', d: `M${at(-50, r).join(' ')}A${r} ${r} 0 0 1 ${at(50, r).join(' ')}`, stroke: ink, sw: 0.035, op: 0.7 },
          ...[-50, -25, 0, 25, 50].map((a) => ({ t: 'line', x1: at(a, r)[0], y1: at(a, r)[1], x2: at(a, r - (a ? 0.08 : 0.14))[0], y2: at(a, r - (a ? 0.08 : 0.14))[1], stroke: ink, sw: 0.035, op: 0.7 })),
          { t: 'g', tx: cx, ty: cy, anim: { type: 'swing', from: -42, to: 42, period: P, hold: 0, ease: 'sine', phase: 0.25 },
            items: [{ t: 'line', x1: 0, y1: 0.07, x2: 0, y2: -(r - 0.06), stroke: K.hex('danger'), sw: 0.06 }] },
          { t: 'circle', cx, cy, r: 0.075, fill: ink },
        ];
      } }),
  ] }));

  // --- the scene
  s.add('magnet', { at: [0, -(POLE + 0.5)], pole: 'N', info: 'The north pole. The magnetic field runs from here across the gap to the south pole.' });
  const rotor = s.add('rotor', { at: [-0.52, 0], hero: true, color: 'body',
    info: 'A loop of wire on a shaft. As it turns, its sides cut through the magnetic field, and that pushes a current round the loop.' });
  s.add('magnet', { at: [0, POLE + 0.5], pole: 'S', info: 'The south pole. Between the two poles the field is steady; nothing here moves.' });
  const lamp = s.add('lamp', { at: [5.1, 0], label: 'Lamp', glow: 'gold', info: 'The current heats the filament. It is brightest twice in every turn, whichever way the current flows.' });
  const meter = s.add('meter', { at: [1.98, 4.7], color: 'body2', label: 'Meter', sub: 'swings both ways', info: 'The needle shows the direction of the current: one way for half a turn, the other way for the next half.' });
  s.callout([-0.5, 0, Z + R], 'Coil', { sub: 'turns in the field', rise: 74 });
  s.callout([0.95, -(POLE + 0.75), 1.9], 'Magnets', { sub: 'a steady field between them', length: 46 });
  s.callout([2.15, 0, Z + 0.26], 'Slip rings', { sub: 'carry the current out', length: 70 });
  s.callout([-3.3, 0, Z + 0.75], 'Handle', { side: 'left' });

  // the circuit: one loop of wire through the lamp and the meter. The dots rock to and fro: alternating current.
  const wire = { color: 'gold', arrow: false, width: 2.4, flow: { alternate: true, period: P, swing: 0.34 } };
  s.link(rotor, lamp, wire);
  s.link(lamp, meter, { ...wire, via: [[5.1, 4.7]] });
  s.link(meter, [1.98, 0.36], wire);

  s.story([
    s.say('Turning the handle spins a coil of wire between two magnets'),
    s.wait(3),
    s.say('Wire moving through a magnetic field gets a current'),
    s.wait(3),
    s.say('Each half turn the current reverses: alternating current'),
    s.wait(3),
    s.say('Slip rings pass it to the circuit, and the lamp lights'),
    s.wait(3),
  ]);
  return s;
};
