// From order to doorstep: a physical process with a vehicle that really drives.
// Pattern: any kit object can travel as a token (as: 'truck'); a link styled as a road gives it a route.
export default ({ scene }) => {
  const s = scene({ look: 'sand', floor: 'plate', title: 'From order to doorstep' });

  const phone = s.add('phone', { at: [0, 0], label: 'Order', ui: 'list' });
  const plant = s.add('factory', { at: [4.6, 0], label: 'Warehouse', hero: true, color: 'body2' });
  const home = s.add('house', { at: [13, 0], label: 'Home' });
  const parcel = s.add('package', { at: [13, 1.9], scale: 0.6, hidden: true });
  s.add('tree', { at: [8.6, -2.2], size: 0.9 });
  s.add('tree', { at: [10, -2.6], size: 1.2 });
  s.add('tree', { at: [9.2, 2.4], size: 0.8 });

  s.link(phone, plant, { style: 'dashed' });
  const road = s.link(plant, home, { style: 'road' });

  s.story([
    s.say('An order is placed'),
    s.send(phone, plant, { as: 'mail' }),
    s.pulse(plant),
    s.say('The parcel is packed and sent out'),
    s.send(plant, home, { as: 'truck', scale: 0.62, speed: 2.4, ease: 'smooth' }),
    s.say('It arrives at the door'),
    [s.pop(parcel), s.mark(home, 'check')],
    s.wait(1.2),
  ]);
  return s;
};
