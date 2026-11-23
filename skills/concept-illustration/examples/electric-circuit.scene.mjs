// A simple circuit: electrons drift slowly round the loop from the negative terminal to the
// positive one, while conventional current is drawn the other way.
// Pattern: things flowing round a loop of components. The wires are links, drawn in the direction
// of conventional current; the electrons are a flow on those links, reversed and jostling. The
// arrows are not objects: s.draw puts shapes in the scene that take up no room, so nothing
// treats them as an obstacle. size keeps the image in its slot on the page.
export default ({ scene }) => {
  const s = scene({ look: 'sky', floor: 'dots', accent: '#2563eb', title: 'Electron flow and conventional current in a circuit', size: [640, 480], pad: 26, loop: 12 });

  // --- components
  s.define('cell', (o, sh) => ({ parts: [
    sh.prism({ plane: 'left', at: [0, -0.7, 0.46], outline: sh.outline.circle(0.42), depth: 1.06, color: 'body2' }),          // lying along y
    // the positive end faces the viewer, so its sign can be written on it
    sh.prism({ plane: 'left', at: [0, 0.36, 0.46], outline: sh.outline.circle(0.425), depth: 0.34, color: 'danger',
      decals: [{ plane: 'left', o: [-0.42, 0.705, 0.88], items: [{ t: 'text', x: 0.42, y: 0.42, text: '+', size: 0.5, fill: '#ffffff', weight: 800 }] }] }),
    // the negative end faces away: a small plate beside it carries the sign
    sh.panel({ facing: 'left', x: 0.74, y: -0.5, w: 0.42, h: 0.42, t: 0.05, r: 0.1, color: 'dark', face: (fw, fh) => [{ t: 'rect', x: fw / 2 - 0.11, y: fh / 2 - 0.035, w: 0.22, h: 0.07, r: 0.02, fill: '#ffffff' }] }),
  ] }));
  s.define('switch', (o, sh) => ({ parts: [
    sh.box({ w: 1.5, d: 0.7, h: 0.14, r: 0.1, color: o.color }),
    sh.cyl({ x: -0.48, z: 0.14, r: 0.1, h: 0.3, color: 'body2' }), sh.cyl({ x: 0.48, z: 0.14, r: 0.1, h: 0.3, color: 'body2' }),
    sh.box({ z: 0.44, w: 1.16, d: 0.14, h: 0.08, r: 0.04, color: 'accent' }),                                               // closed: the bar joins the contacts
  ] }));
  s.define('lamp', (o, sh) => ({ round: true, parts: [sh.group({ sort: false, parts: [
    sh.cyl({ r: 0.4, h: 0.14, color: 'body2' }), sh.cyl({ z: 0.14, r: 0.18, h: 0.3, color: 'dark' }),
    sh.sphere({ z: 0.9, r: 0.44, color: 'gold' }),
    sh.glow({ z: 0.9, r: 1.5, color: 'gold', anim: { type: 'blink', period: 3, min: 0.75 } }),
  ] })] }));
  s.define('ammeter', (o, sh) => ({ parts: [
    sh.box({ w: 1.4, d: 0.62, h: 1.1, r: 0.1, color: o.color,
      left: (fw, fh) => [
        { t: 'rect', x: 0.1, y: 0.1, w: fw - 0.2, h: fh - 0.2, r: 0.07, fill: 'paper' },
        { t: 'path', d: `M${fw / 2 - 0.42} 0.62A0.5 0.5 0 0 1 ${fw / 2 + 0.42} 0.62`, stroke: 'dark', sw: 0.035, op: 0.6 },
        { t: 'line', x1: fw / 2, y1: 0.66, x2: fw / 2 + 0.2, y2: 0.3, stroke: 'danger', sw: 0.05 },
        { t: 'text', x: fw / 2, y: fh - 0.28, text: '0.5 A', size: 0.26, fill: 'dark', weight: 800 },
      ] }),
  ] }));

  // --- the loop
  const cell = s.add('cell', { at: [0, 2], label: 'Battery', labelSide: 'left', info: 'Its chemistry keeps one end short of electrons (+) and the other crowded with them (−).' });
  const sw = s.add('switch', { at: [2.6, 0], label: 'Switch', sub: 'closed', labelSide: 'above', info: 'Closed, it completes the loop. Open, nothing flows anywhere.' });
  const lamp = s.add('lamp', { at: [5.2, 2], hero: true, glow: 'gold', label: 'Lamp', labelSide: 'left', info: 'Electrons pushing through the thin filament heat it until it glows.' });
  const meter = s.add('ammeter', { at: [2.6, 4], color: 'body2', label: 'Ammeter', info: 'Counts the charge passing each second: half an amp here.' });

  // Wires, each drawn the way conventional current goes: out of +, round the loop, back into −.
  // The electrons are the flow on them, reversed: they really travel from − round to +.
  const wire = { arrow: false, width: 2.6, flow: { reverse: true, jitter: 0.07, speed: 0.55, color: 'accent', r: 0.075 } };
  s.link(cell, meter, { ...wire, via: [[0, 4]] });
  s.link(meter, lamp, { ...wire, via: [[5.2, 4]] });
  s.link(lamp, sw, { ...wire, via: [[5.2, 0]] });
  s.link(sw, cell, { ...wire, via: [[0, 0]] });

  // conventional current: arrows beside the loop. Drawn, not added, so they are no obstacle to anything.
  s.draw((sh) => [
    sh.arrow({ from: [0.4, 5.2, 0.02], to: [2.0, 5.2, 0.02], color: 'gold', width: 3.2 }),
    sh.arrow({ from: [4.8, -1.2, 0.02], to: [3.2, -1.2, 0.02], color: 'gold', width: 3.2 }),
  ]);
  s.callout([4.0, -1.2, 0.02], 'Conventional current', { sub: 'drawn from + round to −', rise: 30, length: 30 });
  s.callout([4.4, 4, 0.08], 'Electrons', { sub: 'drift from − round to +', rise: -34, length: 30 });

  s.story([
    s.say('The battery pushes charge round the closed loop', { at: 0.4 }),
    s.pulse(cell, { at: 0.8 }),
    s.say('Electrons drift slowly, jostling, from − round to +', { at: 4 }),
    s.say('Conventional current is drawn the other way', { at: 8 }),
  ]);
  return s;
};
