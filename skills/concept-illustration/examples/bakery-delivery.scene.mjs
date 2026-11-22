// A bakery that delivers the same day. The kit has no oven and no bread, so the scene builds them.
// Pattern: s.define for objects the subject needs; s.move to carry a real object, not a token.
export default ({ scene }) => {
  const s = scene({ look: 'lemon', title: 'Fresh bread, delivered the same day' });

  s.define('oven', (o, sh, K) => {
    const glow = K.hex('accent');
    return {
      parts: [
        sh.box({ w: 1.5, d: 1.3, h: 1.25, r: 0.1, color: o.color || 'body2',
          left: (fw, fh) => [
            { t: 'rect', x: 0.16, y: 0.34, w: fw - 0.32, h: fh - 0.5, r: 0.08, fill: K.hex('screen') },
            { t: 'rect', x: 0.26, y: 0.46, w: fw - 0.52, h: fh - 0.74, r: 0.05, fill: glow, fillOp: 0.85, anim: { type: 'blink', period: 2.2, min: 0.55 } },
            { t: 'line', x1: 0.3, y1: 0.36, x2: fw - 0.3, y2: 0.36, stroke: K.mat('body2').onSide, sw: 0.05 },
            ...[0, 1, 2].map((i) => ({ t: 'circle', cx: 0.3 + i * 0.22, cy: 0.17, r: 0.055, fill: K.hex('dark') })),
          ],
          top: (fw, fh) => [{ t: 'rect', x: 0.2, y: 0.2, w: fw - 0.4, h: fh - 0.4, r: 0.06, stroke: 'rgba(0,0,0,0.12)', sw: 0.03 }] }),
        sh.cyl({ x: -0.4, y: -0.3, z: 1.25, r: 0.14, h: 0.5, color: 'dark' }),
      ],
    };
  });
  s.define('loaf', (o, sh) => ({
    parts: [sh.prism({ plane: 'left', at: [0, -0.3, 0], depth: 0.6, color: '#d9a05b',
      outline: [[-0.45, 0], [0.45, 0], [0.5, 0.2], [0.42, 0.38], [0.2, 0.46], [-0.2, 0.46], [-0.42, 0.38], [-0.5, 0.2]] })],
  }));

  const phone = s.add('phone', { at: [0, 0], label: 'Order', ui: 'list' });
  const oven = s.add('oven', { at: [4.6, 0], label: 'Bakery', hero: true, color: 'accent' });
  const home = s.add('house', { at: [11.5, 0], label: 'Your door' });
  const bread = s.add('loaf', { at: [4.6, 2.2], hidden: true });
  s.link(phone, oven, { style: 'dashed' });
  s.link(oven, home, { style: 'road' });

  s.story([
    s.say('You order before noon'),
    s.send(phone, oven, { as: 'mail' }),
    s.pulse(oven),
    s.say('We bake it fresh'),
    s.pop(bread),
    s.say('and a courier brings it the same day'),
    s.move(bread, [10, 1.6]),
    s.mark(home, 'check'),
    s.wait(1.2),
  ]);
  return s;
};
