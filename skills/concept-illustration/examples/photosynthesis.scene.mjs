// Photosynthesis: light, water and air in; sugar and oxygen out.
// Pattern: inputs converge on a hero, outputs leave it. A custom accent colour retunes the theme.
export default ({ scene }) => {
  const s = scene({ look: 'mint', floor: 'none', title: 'Photosynthesis', accent2: '#3d8bff' });

  const leaf = s.add('tree', { at: [0, 0], size: 1.9, label: 'Leaf', hero: true, color: 'accent' });
  const sun = s.add('sun', { at: [-4.6, -1.2], z: 2.2, label: 'Sunlight', float: { amp: 5 } });
  const water = s.add('cloud', { at: [-1.2, -4.8], label: 'Water', size: 0.85 });
  const air = s.add('sign', { at: [-4.8, 3], text: 'CO₂', color: 'body2', label: 'Air' });
  const sugar = s.add('gem', { at: [4.8, 0], label: 'Sugar', sub: 'stored energy', color: 'gold', hidden: true });
  const oxygen = s.add('sign', { at: [1.2, 4.8], text: 'O₂', color: 'accent2', label: 'Oxygen', hidden: true });

  s.link(sun, leaf, { arc: 0.4, style: 'line', color: 'gold' });
  s.link(water, leaf, { style: 'dashed', route: 'straight' });
  s.link(air, leaf, { style: 'dashed', route: 'straight' });
  s.link(leaf, sugar, { route: 'straight' });
  s.link(leaf, oxygen, { route: 'straight' });

  s.story([
    s.say('A leaf takes in light, water and carbon dioxide'),
    [s.send(sun, leaf, { color: 'gold' }), s.send(water, leaf, { color: 'accent2', delay: 0.15 }), s.send(air, leaf, { color: 'muted', delay: 0.3 })],
    [s.pulse(leaf), s.glow(leaf)],
    s.say('It turns them into sugar it can store'),
    s.send(leaf, sugar, { as: 'gem', color: 'gold' }),
    s.pop(sugar),
    s.say('And releases the oxygen we breathe'),
    s.send(leaf, oxygen, { color: 'accent2' }),
    s.pop(oxygen),
    s.wait(1.4),
  ]);
  return s;
};
