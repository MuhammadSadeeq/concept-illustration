// How a CDN answers a request: the first request misses the cache, the second is served at the edge.
// Pattern: three actors in a row, one focal object, a story with a change of state halfway through.
// The info texts become hover cards when it is built with --experience.
export default ({ scene }) => {
  const s = scene({ look: 'aurora', title: 'How a CDN answers a request' });

  const visitor = s.add('laptop', { at: [0, 0], label: 'Visitor', ui: 'image', info: 'Someone opening the site. They only notice how fast the page appears.' });
  const base = s.add('platform', { at: [5, 0], size: 2.3 });
  const edge = s.add('server', { on: base, label: 'Edge cache', sub: 'close to the visitor', hero: true, info: 'Keeps a copy of every page near the visitor, so repeat requests never travel to the origin.' });
  const origin = s.add('database', { at: [10.4, 0], label: 'Origin', sub: 'far away', info: 'The one place the real content lives. Every trip here costs time.' });
  s.zone({ around: [origin], label: 'DATA CENTRE', style: 'outline', pad: 1 });

  s.link(visitor, base, { arrow: 'both' });
  s.link(base, origin, { style: 'dashed', arrow: 'both' });

  s.story([
    s.say('The first visitor asks for a page'),
    s.send(visitor, base, { label: 'request' }),
    s.say('The edge has no copy yet, so it fetches one'),
    s.send(base, origin),
    s.pulse(origin),
    s.send(origin, base, { as: 'doc' }),
    [s.tint(edge, 'ok'), s.mark(edge, 'download')],
    s.send(base, visitor, { as: 'doc' }),
    s.wait(0.5),
    s.say('Every later request is answered from the edge'),
    s.send(visitor, base, { label: 'request' }),
    s.pulse(edge),
    s.send(base, visitor, { as: 'doc' }),
    s.mark(visitor, 'bolt'),
    s.wait(1),
  ]);
  return s;
};
