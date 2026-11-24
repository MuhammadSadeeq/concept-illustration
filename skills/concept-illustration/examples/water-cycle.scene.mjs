// A hand-drawn scene: flat artwork in screen pixels, placed with unproj and moved with keys.
// No kit objects, floor or engine shadows; the engine supplies the clock, the captions and the export.
export default ({ scene, unproj }) => {
  const T = 12;
  const s = scene({ look: 'sky', floor: 'none', shadows: false, pad: 0, loop: T, title: 'The water cycle', desc: 'The sun warms the sea, vapour rises and cools into a cloud, rain falls on the mountains and a river carries it back to the sea.' });
  // art(svg, x, y, anim): markup in screen pixels, placed at screen point (x, y). Every piece hangs from the world origin
  // and is positioned inside its markup, so no piece's box reaches across the scene.
  const art = (sh, svg, x = 0, y = 0, anim) => sh.raw({ svg: `<g transform="translate(${x} ${y})">${svg}</g>`, w: 0.01, d: 0.01, h: 0.01, anim });
  // keys in seconds; move is a screen offset in pixels, turned into cells by unproj
  const keys = (list) => ({ type: 'keys', period: T, keys: list.map(([t, dx = 0, dy = 0, opacity = 1]) => ({ t, move: unproj(dx, dy), opacity })) });
  const path = (d, fill, extra = '') => `<path d="${d}" fill="${fill}"${extra}/>`;
  const ink = '#2f4858';

  // the frame: the engine cannot measure raw artwork, so mark the canvas corners, each in an s.draw of its own
  for (const [x, y] of [[-320, -190], [320, 170]]) { const [a, b, z] = unproj(x, y); s.draw((sh) => [sh.raw({ svg: '', x: a, y: b, z, w: 0.01, d: 0.01, h: 0.01 })]); }

  // back to front, in one group that keeps this order
  s.draw((sh) => [sh.group({ sort: false, parts: [
    art(sh, `<defs><linearGradient id="wc-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#bfe3f7"/><stop offset="1" stop-color="#eef8fb"/></linearGradient></defs><rect x="-320" y="-190" width="640" height="360" rx="18" fill="url(#wc-sky)"/>`),
    art(sh, `<circle r="62" fill="#ffe7a3" opacity=".4"/>${Array.from({ length: 12 }, (_, i) => `<path d="M0 -44v-10" stroke="#ffc94a" stroke-width="4" stroke-linecap="round" transform="rotate(${i * 30})"/>`).join('')}<circle r="34" fill="#ffd166" stroke="#f4a93b" stroke-width="3"/>`, -235, -120,
      keys([[0, 0, 0, 0.8], [0.4, 0, 0, 1], [2.5, 0, 0, 1], [3.2, 0, 0, 0.8], [T, 0, 0, 0.8]])),
    art(sh, path('M40 76L170 -62L206 -22L262 -88L344 34L344 76Z', '#8fa7b8', ` stroke="${ink}" stroke-opacity=".35" stroke-width="2" stroke-linejoin="round"`)
      + path('M170 -62L206 -22L196 70L120 76Z', '#7d95a7') + path('M170 -62L150 -38L174 -44L190 -32L206 -22L188 -42ZM262 -88L238 -54L262 -60L284 -50Z', '#ffffff')),
    art(sh, path('M-330 50Q-170 26 -20 56Q50 70 80 110L80 175L-330 175Z', '#3a86c8') + path('M-300 82q18 -8 36 0t36 0M-220 114q18 -8 36 0t36 0M-130 92q18 -8 36 0t36 0M-286 146q18 -8 36 0t36 0M-150 150q18 -8 36 0t36 0', 'none', ` stroke="#9ad0f5" stroke-width="3" stroke-linecap="round"`)),
    art(sh, path('M-70 175Q-58 78 52 62Q170 42 340 62L340 175Z', '#e9d8a6') + path('M-52 175Q-40 86 60 72Q172 52 340 70L340 175Z', '#7cc47f', ` stroke="${ink}" stroke-opacity=".25" stroke-width="2"`)
      + path('M-6 175Q30 116 124 108Q232 100 340 122L340 175Z', '#5fae6e')),
    art(sh, path('M214 46C190 70 130 64 110 86S60 120 20 118S-30 126 -48 142', 'none', ` stroke="#4f9bd9" stroke-width="10" stroke-linecap="round"`)),
    art(sh, [[150, 74], [196, 84], [262, 98], [92, 122], [300, 112]].map(([x, y], i) => path(`M${x - 2} ${y}h4v12h-4Z`, '#7a5a3a') + `<circle cx="${x}" cy="${y - 9}" r="${11 + (i % 2) * 3}" fill="#3f8f54" stroke="${ink}" stroke-opacity=".3" stroke-width="2"/>`).join('')),
  ] })]);

  // vapour: soft wisps leave the warm sea, rise, and drift toward the mountains
  s.draw((sh) => [0, 1, 2, 3].map((i) => art(sh, path('M0 0q-8 -10 0 -20t0 -20', 'none', ` stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity=".9"`), -250 + i * 55, 66,
    keys([[0, 0, 0, 0], [1.6 + i * 0.5, 0, 0, 0], [2.2 + i * 0.5, 0, -20, 1], [4.4 + i * 0.5, 60 + i * 30, -120, 0.8], [5.2 + i * 0.5, 120 + i * 40, -150, 0], [T, 120 + i * 40, -150, 0]]))), { layer: 'air' });

  // the cloud gathers, then turns grey and rains on the peaks
  const puff = (fill) => `<g fill="${fill}"><circle cx="-34" cy="6" r="22"/><circle cx="0" cy="-8" r="30"/><circle cx="34" cy="4" r="22"/><rect x="-56" y="4" width="112" height="24" rx="12"/></g>`;
  s.draw((sh) => [
    art(sh, puff('#ffffff'), 200, -132, keys([[0, 0, 0, 0.35], [4, 0, 0, 0.35], [5.4, 0, 0, 1], [6.2, 0, 0, 1], [6.6, 0, 0, 0], [11.2, 0, 0, 0], [T, 0, 0, 0.35]])),
    art(sh, puff('#8fa1b3') + path('M-40 26h80', 'none', ` stroke="${ink}" stroke-opacity=".15" stroke-width="4" stroke-linecap="round"`), 200, -132, keys([[0, 0, 0, 0], [6, 0, 0, 0], [6.6, 0, 0, 1], [10.6, 0, 0, 1], [11.2, 0, 0, 0], [T, 0, 0, 0]])),
    ...[-36, -14, 8, 30, 52, -26, 18, 42].map((x, i) => art(sh, path('M0 0q-6 10 0 15q6 -5 0 -15Z', '#4f9bd9'), 200 + x, -100,
      keys([[0, 0, 0, 0], [6.6 + (i % 4) * 0.25 + (i > 4 ? 0.5 : 0), 0, 0, 0], [6.7 + (i % 4) * 0.25 + (i > 4 ? 0.5 : 0), 0, 0, 1], [7.6 + (i % 4) * 0.25 + (i > 4 ? 0.5 : 0), -8, 90, 1], [7.7 + (i % 4) * 0.25 + (i > 4 ? 0.5 : 0), -8, 90, 0], [T, -8, 90, 0]]))),
  ], { layer: 'air' });

  // the river carries the water back to the sea, all the time. It lies on the ground, so its particles run on floor
  // points (z = 0) drawn at those screen points, which keeps the stream's box flat and inside the canvas.
  const ground = (x, y) => unproj(x, y, y / 20);
  s.draw((sh) => [sh.stream({ points: [[214, 46], [150, 68], [110, 86], [60, 112], [20, 118], [-40, 140]].map(([x, y]) => ground(x, y)), count: 12, r: 0.08, color: '#ffffff', speed: 2.2 })], { layer: 'air' });

  s.story([
    s.say('The sun warms the sea', { at: 0 }),
    s.say('Water rises as vapour and cools into a cloud', { at: 2 }),
    s.say('The cloud rains on the mountains', { at: 6.4 }),
    s.say('A river carries the water back to the sea', { at: 9 }),
  ]);
  return s;
};
