// A lighthouse sweeping its beam over the water: monitoring, alerting, keeping watch.
// Pattern: a vignette on a dark look. The beam is flat artwork on a level plane that turns in
// that plane, so it sweeps the way a real beam does, and it fades out with distance.
export default ({ scene }) => {
  const s = scene({ look: 'abyss', floor: 'rings', title: 'A lighthouse keeping watch over the water', loop: 8, pad: 36 });

  s.custom({
    at: [0, 0], round: true,
    parts: (sh, K) => {
      const light = K.hex('gold');
      const wedge = (reach, spread, fillOp) => ({ t: 'poly', pts: [[0, 0], [reach, -spread], [reach, spread]], fill: light, fillOp, fade: [0.2, 0, reach, 0] });
      return [
        sh.cone({ r: 1.25, r2: 1.05, h: 0.22, color: 'muted' }),                       // the rock
        sh.cone({ z: 0.22, r: 0.8, r2: 0.7, h: 0.14, color: 'body2' }),
        sh.cone({ z: 0.36, r: 0.56, r2: 0.36, h: 2.1, color: 'paper' }),               // the tower
        sh.cone({ z: 1.0, r: 0.517, r2: 0.457, h: 0.36, color: 'accent' }),            // painted bands
        sh.cone({ z: 1.75, r: 0.427, r2: 0.387, h: 0.3, color: 'accent' }),
        sh.cyl({ z: 2.46, r: 0.5, h: 0.09, color: 'dark' }),                           // the gallery
        // the beam: two soft wedges turning on the plane of the lamp
        sh.decal({ plane: 'top', at: [0, 0, 2.78], size: [0.1, 0.1], items: [{ t: 'g', anim: { type: 'spin', period: 8 }, items: [wedge(3.3, 0.8, 0.34), wedge(3.3, 0.36, 0.5)] }] }),
        sh.cyl({ z: 2.55, r: 0.3, h: 0.44, color: 'gold' }),                           // the lamp room
        sh.cone({ z: 2.99, r: 0.38, r2: 0, h: 0.34, color: 'accent' }),                // the roof
      ];
    },
  });
  // a small boat that the light passes over
  s.custom({ at: [3.2, 1.9], round: true, float: { amp: 3, period: 3 }, parts: (sh) => [
    sh.prism({ plane: 'left', at: [0, -0.22, 0.02], depth: 0.44, color: 'body2', outline: [[-0.55, 0.22], [0.6, 0.22], [0.4, 0], [-0.4, 0]] }),
    sh.wire({ points: [[0, 0, 0.22], [0, 0, 0.95]], width: 1.6 }),
    sh.panel({ facing: 'left', x: 0.02, z: 0.3, w: 0.5, h: 0.62, t: 0.03, color: 'paper', outline: [[0, 0], [0.46, 0], [0, 0.62]] }),
  ] });
  return s;
};
