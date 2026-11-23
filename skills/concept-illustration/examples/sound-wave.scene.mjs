// How sound travels: a speaker cone pushes the air, each bit of air only rocks to and fro, and
// the squeeze passes along to the microphone.
// Pattern: particles on a path. One sh.stream draws a whole row of air; mode 'alternate' with a
// wavelength makes each particle lag the one before, so a band of squeezed air travels although
// no particle does. Captions are pinned to the scene clock with { at }, and one callout is only
// on screen while its caption is.
export default ({ scene }) => {
  const s = scene({ look: 'grape', finish: 'soft', floor: 'dots', title: 'How sound travels through air', loop: 12, pad: 44 });

  const P = 2;        // seconds for one push of the cone = one wave
  const WAVE = 2.2;   // cells between one squeeze and the next
  const X0 = -3.2, X1 = 3.4, Z = 1.15;

  // --- the speaker: a cabinet whose cone moves out and back
  s.define('speaker', (o, sh) => ({ parts: [
    sh.box({ w: 0.9, d: 1.7, h: 2.0, r: 0.12, color: o.color }),
    sh.prism({ plane: 'right', at: [0.45, 0, Z], outline: sh.outline.circle(0.62), depth: 0.06, color: 'dark' }),
    sh.prism({ plane: 'right', at: [0.5, 0, Z], outline: sh.outline.circle(0.5), depth: 0.1, color: 'accent',
      anim: { type: 'move', by: [0.2, 0, 0], period: P, hold: 0, ease: 'sine' } }),
  ] }));

  // --- the air: rows of particles that rock along the row, each a little later than the last
  s.define('air', (o, sh) => {
    const row = (y, z, extra = {}) => sh.stream({ points: [[X0, y, z], [X1, y, z]], mode: 'alternate', swing: 0.2, wavelength: WAVE, period: P, count: 22, r: 0.075, color: 'accent', opacity: 0.45, ...extra });
    return {
      w: X1 - X0, d: 1.4, h: 0.1, shadow: { soft: true },
      parts: [
        row(-0.55, Z), row(0, Z - 0.42), row(0, Z + 0.42), row(0.55, Z), row(0, Z),
        row(0, Z, { count: 1, r: 0.12, color: 'accent2', opacity: 1 }),   // one particle picked out, to watch
      ],
    };
  });

  // --- the microphone and a level meter
  s.define('mic', (o, sh) => ({ round: true, parts: [
    sh.cyl({ r: 0.32, h: 0.1, color: 'dark' }),
    sh.cyl({ z: 0.1, r: 0.045, h: Z - 0.32, color: 'body2' }),
    sh.prism({ plane: 'right', at: [-0.3, 0, Z], outline: sh.outline.circle(0.2), depth: 0.6, color: o.color }),
    sh.prism({ plane: 'right', at: [-0.36, 0, Z], outline: sh.outline.circle(0.21), depth: 0.06, color: 'dark' }),
  ] }));
  s.define('level', (o, sh) => ({ parts: [
    sh.box({ w: 1.5, d: 0.6, h: 1.25, r: 0.1, color: o.color,
      left: (fw, fh) => [
        { t: 'rect', x: 0.1, y: 0.1, w: fw - 0.2, h: fh - 0.2, r: 0.07, fill: 'screen' },
        // five bars that rise and fall with each wave, one after another
        ...[0, 1, 2, 3, 4].map((i) => ({ t: 'bar', x: 0.24 + i * 0.22, y: 0.22, w: 0.13, h: 0.46, r: 0.03, fill: i > 2 ? 'accent2' : 'accent',
          levels: [[0, 0.2], [0.5, 0.55 + i * 0.1], [1, 0.2]], period: P, delay: i * 0.08 })),
        { t: 'readout', x: fw / 2, y: fh - 0.3, size: 0.24, fill: '#ffffff', values: [[0, '60 dB'], [0.34, '64 dB'], [0.67, '62 dB']] },
      ] }),
  ] }));

  const speaker = s.add('speaker', { at: [-4.3, 0], label: 'Speaker', info: 'The cone moves out and back many times a second, squeezing and then stretching the air in front of it.' });
  s.add('air', { at: [0, 0], shadow: false, info: 'Air. Every particle stays near where it started; it passes each push on to its neighbour.' });
  const mic = s.add('mic', { at: [4.3, 0], hero: true, label: 'Microphone', info: 'The squeezes arrive one after another and push the microphone in the same rhythm as the cone.' });
  const level = s.add('level', { at: [4.3, -3.2], color: 'body2', label: 'Level', labelSide: 'right' });
  s.link(mic, level, { arrow: false, style: 'dashed', flow: true });

  // the wave moves this way; no particle does
  s.custom({ at: [0, 1.7], shadow: false, parts: (sh) => [sh.arrow({ from: [-2.4, 0, 0.02], to: [2.4, 0, 0.02], color: 'accent', width: 3 })] });
  s.text('THE WAVE TRAVELS', { at: [-1.5, 2.45], size: 0.3 });
  s.callout([0.1, 0, Z + 0.12], 'One particle', { sub: 'only rocks to and fro', rise: 76, length: 36, from: 4, until: 8 });

  s.story([
    s.say('The speaker cone pushes the air in front of it', { at: 0.3 }),
    s.pulse(speaker, { at: 1 }),
    s.say('Each bit of air only rocks to and fro', { at: 4 }),
    s.say('but the squeeze passes along: that is the sound', { at: 8 }),
    s.pulse(mic, { at: 9 }),
  ]);
  return s;
};
