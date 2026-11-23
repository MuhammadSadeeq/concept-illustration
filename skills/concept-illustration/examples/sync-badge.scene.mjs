// A small transparent component for a feature card: two devices kept in sync.
// Pattern: background: false, no captions, few objects, a continuous flow instead of a story.
export default ({ scene }) => {
  const s = scene({ look: 'paper', detail: 'clean', title: 'Devices staying in sync', background: false, intro: false, pad: 28, loop: 4 });

  const phone = s.add('phone', { at: [0, 0], ui: 'list' });
  const cloud = s.add('cloud', { at: [3.4, 0], size: 0.8, hero: true, float: { amp: 4 } });
  const laptop = s.add('laptop', { at: [6.8, 0], ui: 'list' });

  s.link(phone, cloud, { style: 'dashed', flow: true, arrow: 'both' });
  s.link(cloud, laptop, { style: 'dashed', flow: true, arrow: 'both' });
  return s;
};
