/**
 * The intro field's motion, on the field's own grid (one value per slat): soft drifting smoke, and a small liquid that a pointer stroke stirs. The
 * liquid keeps the stroke's momentum: its glow (dye) is carried along the stroke's direction and slowly spreads and fades. Pure functions on typed
 * arrays; nothing is drawn here.
 */

export type Fluid = { cols: number; rows: number; vx: Float32Array; vy: Float32Array; dye: Float32Array; nx: Float32Array; ny: Float32Array; nd: Float32Array; nw: Float32Array };

export function createFluid(cols: number, rows: number): Fluid {
  const size = Math.max(1, cols * rows);
  const make = () => new Float32Array(size);
  return { cols, rows, vx: make(), vy: make(), dye: make(), nx: make(), ny: make(), nd: make(), nw: make() };
}

const MAX_SPEED = 3;   // cells per frame: a flick of the mouse never throws the glow across the screen

/** A stroke from (x0, y0) to (x1, y1), in cells: the liquid along it takes on the stroke's motion, and glows in proportion to its speed. */
export function stir(fluid: Fluid, x0: number, y0: number, x1: number, y1: number, radius = 2.4) {
  const dx = x1 - x0, dy = y1 - y0, length = Math.hypot(dx, dy);
  if (!(length > 0.01)) return;
  const scale = Math.min(1, MAX_SPEED / length), ux = dx * scale * 0.7, uy = dy * scale * 0.7;
  const glow = Math.min(1, length / 2) * 0.6;
  const steps = Math.ceil(length), reach = Math.ceil(radius);
  for (let s = 1; s <= steps; s += 1) {
    const px = x0 + (dx * s) / steps, py = y0 + (dy * s) / steps;
    const c0 = Math.max(0, Math.floor(px - reach)), c1 = Math.min(fluid.cols - 1, Math.ceil(px + reach));
    const r0 = Math.max(0, Math.floor(py - reach)), r1 = Math.min(fluid.rows - 1, Math.ceil(py + reach));
    for (let r = r0; r <= r1; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const d = Math.hypot(c - px, r - py);
        if (d >= radius) continue;
        const fall = (1 - d / radius) ** 2, i = r * fluid.cols + c;
        fluid.vx[i] += (ux - fluid.vx[i]) * fall;   // blend toward the stroke's motion, so going over a spot again does not pile speed up
        fluid.vy[i] += (uy - fluid.vy[i]) * fall;
        fluid.dye[i] = Math.min(1.5, fluid.dye[i] + glow * fall);
      }
    }
  }
}

/**
 * Moves time on by `dt` frames (1 = 1/60 s): each cell's glow is carried forward along its motion and shared between the cells it lands on, so the
 * glow travels with the stroke without being lost on the way; the motion travels with it (averaged where parcels meet) and slowly dies away, and
 * the glow fades. Returns the strongest glow left, so the caller can tell a calm liquid.
 */
export function advance(fluid: Fluid, dt = 1, carry = 0.965, fade = 0.984) {
  const { cols, rows, vx, vy, dye, nx, ny, nd, nw } = fluid;
  const keep = carry ** dt, glow = fade ** dt;
  nx.fill(0); ny.fill(0); nd.fill(0); nw.fill(0);
  for (let i = 0; i < dye.length; i += 1) {
    const moving = Math.abs(vx[i]) + Math.abs(vy[i]) > 1e-4;
    if (!moving && dye[i] === 0) continue;
    const c = i % cols, r = (i - c) / cols;
    const x = Math.min(cols - 1, Math.max(0, c + vx[i] * dt)), y = Math.min(rows - 1, Math.max(0, r + vy[i] * dt));
    const c0 = Math.floor(x), r0 = Math.floor(y), fx = x - c0, fy = y - r0;
    for (const [cc, rr, weight] of [[c0, r0, (1 - fx) * (1 - fy)], [c0 + 1, r0, fx * (1 - fy)], [c0, r0 + 1, (1 - fx) * fy], [c0 + 1, r0 + 1, fx * fy]]) {
      if (weight <= 0 || cc >= cols || rr >= rows) continue;
      const j = rr * cols + cc;
      nd[j] += dye[i] * weight;
      if (moving) { nx[j] += vx[i] * weight; ny[j] += vy[i] * weight; nw[j] += weight; }
    }
  }
  let peak = 0;
  for (let j = 0; j < nd.length; j += 1) {
    const share = nw[j] > 1 ? nw[j] : 1;   // where parcels meet their motion is averaged, never added up
    nx[j] = (nx[j] / share) * keep; ny[j] = (ny[j] / share) * keep;
    if (Math.abs(nx[j]) + Math.abs(ny[j]) < 1e-4) { nx[j] = 0; ny[j] = 0; }
    const d = Math.min(1.5, nd[j] * glow);
    nd[j] = d < 0.003 ? 0 : d;
    if (nd[j] > peak) peak = nd[j];
  }
  fluid.vx = nx; fluid.vy = ny; fluid.dye = nd; fluid.nx = vx; fluid.ny = vy; fluid.nd = dye;
  return peak;
}

/** Smooth value noise on a seeded 64 x 64 lattice that wraps, 0-1. */
const LATTICE = (() => {
  let seed = 23;
  return Float32Array.from({ length: 64 * 64 }, () => ((seed = (seed * 16807) % 2147483647) / 2147483647));
})();
function noise(x: number, y: number) {
  const xf = Math.floor(x), yf = Math.floor(y), fx = x - xf, fy = y - yf;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const c0 = xf & 63, c1 = (xf + 1) & 63, r0 = (yf & 63) * 64, r1 = ((yf + 1) & 63) * 64;
  const top = LATTICE[r0 + c0] + (LATTICE[r0 + c1] - LATTICE[r0 + c0]) * sx;
  const bottom = LATTICE[r1 + c0] + (LATTICE[r1 + c1] - LATTICE[r1 + c0]) * sx;
  return top + (bottom - top) * sy;
}

/** Drifting smoke at a point (in smoke units, about 240 px each) and time `t` in seconds: soft clouds that curl as they drift, 0-1. */
export function smoke(x: number, y: number, t: number) {
  const warp = noise(x * 0.7 + t * 0.045, y * 0.7 - t * 0.03);
  return noise(x + warp * 1.8 + t * 0.06, y + warp * 1.2 - t * 0.035) * 0.68 + noise(x * 2.1 - t * 0.09, y * 2.1 + warp) * 0.32;
}
