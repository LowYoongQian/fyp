// The mid ridge of the sign-in landscape as data, so the trees standing on it can be put exactly on its surface at any screen size.
// A line and three curves in a 1440 x 320 drawing, which is stretched to the screen. The height at any x has to be known, not guessed.
type Piece = { to: [number, number]; curve?: [number, number, number, number] };
const MID_START: [number, number] = [0, 256];
const MID_PIECES: Piece[] = [
  { to: [80, 229.3] },
  { curve: [160, 203, 320, 149], to: [480, 165.3] },
  { curve: [640, 181, 800, 267], to: [960, 266.7] },
  { curve: [1120, 267, 1280, 181], to: [1360, 138.7] },
  { to: [1440, 96] },
];
export const MID = `M${MID_START.join(',')}${MID_PIECES.map(({ to, curve }) => (curve ? `C${curve.join(',')},` : 'L') + to.join(',')).join('')}L1440,320L0,320Z`;

/** Where the top of the mid ridge is at horizontal position x (0 to 1440), in the ridge's own 320-unit height (0 is the top). */
export const ridgeY = (x: number): number => {
  let from = MID_START;
  for (const { to, curve } of MID_PIECES) {
    if (x <= to[0]) {
      if (!curve) return from[1] + (to[1] - from[1]) * ((x - from[0]) / (to[0] - from[0]));
      let low = 0, high = 1;   // the curve only moves to the right, so find the point on it with this x by halving
      for (let i = 0; i < 30; i++) {
        const t = (low + high) / 2, u = 1 - t;
        const px = u * u * u * from[0] + 3 * u * u * t * curve[0] + 3 * u * t * t * curve[2] + t * t * t * to[0];
        if (px < x) low = t; else high = t;
      }
      const t = (low + high) / 2, u = 1 - t;
      return u * u * u * from[1] + 3 * u * u * t * curve[1] + 3 * u * t * t * curve[3] + t * t * t * to[1];
    }
    from = to;
  }
  return from[1];
};

/** The foot of a tree, as a share of the ridge layer's height up from its bottom: right on the ridge, whatever the screen's size or proportions. */
export const footAt = (percentAcross: number) => (320 - ridgeY(percentAcross * 14.4)) / 3.2;
