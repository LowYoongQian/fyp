// Data and random generators for the login night sky; the drawing lives in LoginSky.tsx.

// Stylised star figures in a 100 x 100 box. `m` is apparent brightness: 1 bright, 2 medium, 3 faint.
export type ConstellationPattern = { id: string; name: string; nodes: { x: number; y: number; m: 1 | 2 | 3 }[]; edges: [number, number][] };

export const CONSTELLATIONS: ConstellationPattern[] = [
  { id: 'ursa-major', name: 'Ursa Major',
    nodes: [{ x: 6, y: 30, m: 2 }, { x: 24, y: 40, m: 2 }, { x: 40, y: 38, m: 2 }, { x: 54, y: 52, m: 3 }, { x: 58, y: 76, m: 2 }, { x: 88, y: 78, m: 1 }, { x: 86, y: 50, m: 1 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]] },
  { id: 'cassiopeia', name: 'Cassiopeia',
    nodes: [{ x: 6, y: 30, m: 2 }, { x: 28, y: 66, m: 1 }, { x: 50, y: 40, m: 1 }, { x: 72, y: 70, m: 2 }, { x: 94, y: 34, m: 2 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { id: 'orion', name: 'Orion',
    nodes: [{ x: 22, y: 10, m: 1 }, { x: 72, y: 16, m: 2 }, { x: 40, y: 50, m: 2 }, { x: 50, y: 47, m: 2 }, { x: 60, y: 44, m: 2 }, { x: 30, y: 88, m: 2 }, { x: 78, y: 84, m: 1 }],
    edges: [[0, 1], [0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6]] },
  { id: 'cygnus', name: 'Cygnus',
    nodes: [{ x: 50, y: 6, m: 1 }, { x: 50, y: 40, m: 2 }, { x: 50, y: 92, m: 2 }, { x: 14, y: 46, m: 2 }, { x: 86, y: 34, m: 3 }],
    edges: [[0, 1], [1, 2], [3, 1], [1, 4]] },
  { id: 'taurus', name: 'Taurus',
    nodes: [{ x: 32, y: 60, m: 1 }, { x: 44, y: 54, m: 3 }, { x: 52, y: 64, m: 3 }, { x: 58, y: 56, m: 3 }, { x: 92, y: 12, m: 2 }, { x: 86, y: 40, m: 2 }, { x: 6, y: 84, m: 3 }],
    edges: [[6, 0], [0, 1], [1, 3], [3, 4], [0, 2], [2, 5]] },
  { id: 'leo', name: 'Leo',
    nodes: [{ x: 26, y: 74, m: 1 }, { x: 22, y: 52, m: 3 }, { x: 32, y: 40, m: 2 }, { x: 34, y: 22, m: 3 }, { x: 48, y: 14, m: 3 }, { x: 66, y: 46, m: 2 }, { x: 94, y: 58, m: 2 }, { x: 66, y: 66, m: 3 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [6, 7], [7, 0]] },
  { id: 'pegasus', name: 'Pegasus',
    nodes: [{ x: 26, y: 28, m: 2 }, { x: 70, y: 24, m: 2 }, { x: 74, y: 70, m: 2 }, { x: 22, y: 66, m: 2 }, { x: 94, y: 44, m: 3 }, { x: 6, y: 90, m: 3 }],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [3, 5]] },
];

export type AuroraCurtain = { left: number; width: number; height: number; bottom: number; color: string; sway: number; pulse: number; delay: number; tilt: number };
export type AuroraEpisode = { key: number; curtains: AuroraCurtain[]; length: number };

const AURORA_COLORS = ['94 234 212', '45 212 191', '110 231 183', '125 211 252'];   // teal, deep teal, green, ice blue

/** A fresh random aurora: a few overlapping ray curtains with their own colour, height, sway and pulse. */
export const randomAurora = (key: number): AuroraEpisode => {
  const count = 3 + Math.floor(Math.random() * 3);
  const curtains = Array.from({ length: count }, (_, index): AuroraCurtain => {
    const width = 18 + Math.random() * 20;
    return {
      left: Math.min(100 - width, Math.max(-6, (index / count) * 100 - 8 + Math.random() * 14)),
      width, height: 46 + Math.random() * 40, bottom: 4 + Math.random() * 14,
      color: AURORA_COLORS[Math.floor(Math.random() * AURORA_COLORS.length)],
      sway: 9 + Math.random() * 8, pulse: 5 + Math.random() * 5, delay: -Math.random() * 10, tilt: -6 + Math.random() * 12,
    };
  });
  return { key, curtains, length: 45 + Math.random() * 45 };
};
