// End-to-end encryption: readable at both ends, unreadable in between.
// Pattern: a U-shaped route, a change of token along the way, and an onlooker who gets nothing.
export default ({ scene }) => {
  const s = scene({ theme: 'aurora', title: 'End-to-end encryption', accent: '#5b8cff', accent2: '#39e0b5' });

  const alice = s.add('laptop', { at: [0, 0], label: 'Sender', ui: 'chat' });
  const lock = s.add('lock', { at: [4.6, 0], label: 'Encrypt', hero: true });
  const net = s.add('cloud', { at: [9.2, 0], label: 'Internet' });
  const spy = s.add('sign', { at: [9.2, -3.6], icon: 'eye', color: 'danger', label: 'Onlooker' });
  const key = s.add('sign', { at: [9.2, 4.6], icon: 'key', color: 'accent2', label: 'Decrypt' });
  const bob = s.add('laptop', { at: [4.6, 4.6], label: 'Receiver', ui: 'chat', facing: 'right' });

  s.link(alice, lock);
  s.link(lock, net);
  s.link(net, key);
  s.link(key, bob);
  s.link(net, spy, { style: 'dotted', dim: true, arrow: false });

  s.story([
    s.say('A message is written in plain text'),
    s.send(alice, lock, { as: 'doc' }),
    s.pulse(lock),
    s.say('It is locked before it leaves the device'),
    s.send(lock, net, { as: 'cube', color: 'accent' }),
    s.say('Anyone watching the network sees only noise'),
    [s.send(net, spy, { as: 'cube', color: 'muted' }), s.send(net, key, { as: 'cube', color: 'accent' })],
    [s.shake(spy), s.mark(spy, 'x')],
    s.pulse(key),
    s.say('Only the receiver can open it'),
    s.send(key, bob, { as: 'doc' }),
    s.mark(bob, 'check'),
    s.wait(1.2),
  ]);
  return s;
};
