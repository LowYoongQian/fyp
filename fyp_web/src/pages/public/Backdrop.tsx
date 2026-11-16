import { useEffect, useRef } from 'react';
import { motion, useTransform, type MotionValue } from 'motion/react';
import { BarChart3, Bell, BookOpen, CalendarDays, Clock, MapPin, Monitor, ScanFace, ShieldCheck, Smartphone, UserCheck, Wifi, type LucideIcon } from 'lucide-react';
import { Slab } from './scenes';

/** The look of the story's stage: a deep blue night, a light cone from the top corner, a grid floor that slides towards the reader and floating glossy tiles. */

type TileSpec = { icon: LucideIcon; x: number; y: number; z: number; size: number; blur?: number; phase: number; fore?: boolean };
// Positions are in a 1440 x 900 design space, measured from the middle of the stage; z is the distance towards (+) or away from (-) the reader.
const TILES: TileSpec[] = [
  { icon: ScanFace, x: -560, y: -250, z: 120, size: 96, phase: 0.2 },
  { icon: CalendarDays, x: 520, y: -280, z: 60, size: 88, phase: 1.1 },
  { icon: Wifi, x: -330, y: -340, z: -240, size: 64, phase: 2.0 },
  { icon: Bell, x: 330, y: -360, z: -200, size: 60, phase: 2.9 },
  { icon: BarChart3, x: 620, y: 120, z: 150, size: 100, phase: 3.7 },
  { icon: ShieldCheck, x: -660, y: 10, z: 40, size: 90, phase: 4.4 },
  { icon: MapPin, x: -400, y: -120, z: -120, size: 70, phase: 5.2 },
  { icon: Smartphone, x: 440, y: 330, z: -60, size: 76, phase: 0.8 },
  { icon: Monitor, x: 200, y: -400, z: -420, size: 54, phase: 1.7, blur: 1.5 },
  { icon: BookOpen, x: 60, y: 390, z: -380, size: 56, phase: 2.6, blur: 1.5 },
  { icon: Clock, x: -60, y: -330, z: -300, size: 58, phase: 3.4, blur: 1.5 },
  { icon: UserCheck, x: -700, y: -140, z: -300, size: 60, phase: 4.1, blur: 1.5 },
  { icon: ScanFace, x: -780, y: 120, z: 520, size: 130, blur: 5, phase: 5.0, fore: true },
  { icon: BarChart3, x: 780, y: -210, z: 560, size: 150, blur: 6, phase: 0.5, fore: true },
];

/** Tiles gather loosely around the first message and burst outward at each chapter change (`spread` 1 = at rest). */
const CHAPTER_STARTS = [0.3, 0.615, 0.91];
const spreadAt = (progress: number) => 1 + CHAPTER_STARTS.reduce((sum, start) => sum + 0.45 * Math.exp(-(((progress - start) / 0.035) ** 2)), 0);

function Tile({ spec, p, dim, kx, ky, ks }: { spec: TileSpec; p: MotionValue<number>; dim: MotionValue<number>; kx: number; ky: number; ks: number }) {
  const size = spec.size * ks;
  const x = useTransform(p, value => spec.x * kx * spreadAt(value) + Math.sin(value * 9 + spec.phase) * 12);
  const y = useTransform(p, value => spec.y * ky * (0.9 + 0.1 * spreadAt(value)) + Math.cos(value * 7 + spec.phase) * 10);
  const rotateY = useTransform(p, value => -26 + Math.sin(value * 5 + spec.phase) * 26 + Math.sin(value * 2 + spec.phase * 2) * 18);
  const rotateX = useTransform(p, value => 12 + Math.cos(value * 6 + spec.phase) * 12);
  const opacity = useTransform(dim, value => (spec.fore ? value * 0.7 : value));
  const visibility = useTransform(opacity, value => (value < 0.005 ? 'hidden' : 'visible'));   // a tile that is faded out costs nothing
  const radius = size * 0.24;
  const Icon = spec.icon;
  return (
    <motion.div data-tile={spec.fore ? 'fore' : 'back'} data-blur={spec.blur ? spec.blur * ks : 0} className="ps-3d absolute left-1/2 top-1/2" style={{ x, y, z: spec.z, marginLeft: -size / 2, marginTop: -size / 2, opacity, visibility }}>
      <div style={{ perspective: 700, filter: spec.blur ? `blur(${spec.blur * ks}px)` : undefined }}>
        <motion.div className="ps-3d" style={{ rotateX, rotateY }}>
          <Slab w={size} h={size} radius={radius} depth={size * 0.22} edge="#1e40af">
            <div className="absolute inset-0 flex items-center justify-center overflow-hidden" style={{ borderRadius: radius, background: 'linear-gradient(145deg, #8cc0ff 0%, #3b82f6 46%, #1d4ed8 100%)', boxShadow: 'inset 0 2px 0 rgba(255,255,255,0.6), inset 0 -10px 18px rgba(30,64,175,0.55), inset 0 0 0 1px rgba(255,255,255,0.2)' }}>
              <span className="pointer-events-none absolute -left-1/4 -top-1/3 h-full w-full rounded-full" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.45), transparent 62%)' }} />
              <Icon style={{ width: size * 0.46, height: size * 0.46 }} className="relative text-white drop-shadow-[0_3px_6px_rgba(30,64,175,0.7)]" strokeWidth={1.8} />
            </div>
          </Slab>
        </motion.div>
      </div>
    </motion.div>
  );
}

/**
 * The stage behind the story (after React Bits Grid Scan): a tunnel of grid lines receding to a point in the middle of the stage, its rings
 * travelling toward the reader as the story is scrolled, and a glowing square frame that sweeps out of the depth every few seconds. One 2D
 * canvas; it draws only while it is on screen and the tab is shown. With `reduce` it is drawn once, still, without the sweep.
 */
export function Backdrop({ p, reduce }: { p: MotionValue<number>; reduce?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, frame = 0, running = false, visible = true;
    const start = performance.now();
    const RINGS = 14, WALL_LINES = 9, DEPTH = 7, SWEEP = 3.6;   // rings in the tunnel, lines across each wall, far ring at 1/(1+DEPTH), seconds per sweep
    const draw = (now: number) => {
      const t = reduce ? 0 : (now - start) / 1000;
      const cx = w / 2, cy = h * 0.47;
      // A ring at depth z (0 near the reader, 1 far): its half width and half height on screen.
      const ring = (z: number) => { const k = 1 / (1 + z * DEPTH); return [w * 0.62 * k, h * 0.62 * k] as const; };
      ctx.clearRect(0, 0, w, h);
      const sky = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * 0.75);
      sky.addColorStop(0, '#0a1a4a'); sky.addColorStop(0.55, '#06102e'); sky.addColorStop(1, '#030817');
      ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
      ctx.lineWidth = 1;
      // Lines along the four walls, from the near edge to the far ring.
      const [fx, fy] = ring(1), [nx, ny] = ring(-0.12);
      ctx.strokeStyle = 'rgba(147,197,253,0.16)';
      ctx.beginPath();
      for (let i = 0; i <= WALL_LINES; i += 1) {
        const a = -1 + (2 * i) / WALL_LINES;
        for (const [x0, y0, x1, y1] of [[a * nx, -ny, a * fx, -fy], [a * nx, ny, a * fx, fy], [-nx, a * ny, -fx, a * fy], [nx, a * ny, fx, a * fy]]) {
          ctx.moveTo(cx + x0, cy + y0); ctx.lineTo(cx + x1, cy + y1);
        }
      }
      ctx.stroke();
      // Rings, drifting toward the reader with the scroll (and a little with time); nearer rings are brighter.
      const drift = (p.get() * 22 + t * 0.06) % 1;
      for (let i = 0; i < RINGS; i += 1) {
        const z = 1 - (i + drift) / RINGS;
        if (z <= -0.1) continue;
        const [rx, ry] = ring(z);
        ctx.strokeStyle = `rgba(147,197,253,${(0.05 + 0.2 * (1 - z)).toFixed(3)})`;
        ctx.strokeRect(cx - rx, cy - ry, rx * 2, ry * 2);
      }
      // The sweep: a glowing frame flying out of the depth and fading as it passes the reader.
      if (!reduce) {
        const phase = (t % SWEEP) / SWEEP, z = 1 - phase * 1.15;
        if (z > -0.12) {
          const [rx, ry] = ring(z), fade = Math.min(1, phase * 5) * Math.min(1, (z + 0.12) * 4);
          ctx.save();
          ctx.shadowColor = 'rgba(96,165,250,0.95)'; ctx.shadowBlur = 18;
          ctx.strokeStyle = `rgba(191,219,254,${(0.85 * fade).toFixed(3)})`; ctx.lineWidth = 2;
          ctx.strokeRect(cx - rx, cy - ry, rx * 2, ry * 2);
          ctx.restore();
        }
      }
      // The reader's end of the tunnel fades into the stage, so the edges are soft.
      const vignette = ctx.createRadialGradient(cx, cy, Math.min(w, h) * 0.35, cx, cy, Math.max(w, h) * 0.78);
      vignette.addColorStop(0, 'rgba(3,8,23,0)'); vignette.addColorStop(1, 'rgba(3,8,23,0.7)');
      ctx.fillStyle = vignette; ctx.fillRect(0, 0, w, h);
    };
    const loop = (now: number) => { draw(now); frame = requestAnimationFrame(loop); };
    const sync = () => {
      const on = !reduce && visible && document.visibilityState === 'visible';
      if (on === running) return;
      running = on;
      if (on) frame = requestAnimationFrame(loop); else cancelAnimationFrame(frame);
    };
    const layout = () => {
      const box = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = box.width; h = box.height;
      if (w < 1 || h < 1) return;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(performance.now());
    };
    const resize = new ResizeObserver(layout); resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); seen.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    layout(); sync();
    return () => { running = false; cancelAnimationFrame(frame); resize.disconnect(); seen.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [p, reduce]);
  return <canvas ref={canvasRef} aria-hidden="true" data-grid-scan className="pointer-events-none absolute inset-0 h-full w-full" style={{ background: '#040a1c' }} />;
}

/** The floating tiles. `dim` (0-1) fades them while a device is the star of the scene. */
export function Tiles({ p, dim, vw, vh, fore }: { p: MotionValue<number>; dim: MotionValue<number>; vw: number; vh: number; fore: boolean }) {
  const kx = vw / 2 / 720, ky = vh / 2 / 460;
  const ks = Math.min(1, Math.max(0.42, Math.min(kx, ky) * 1.25));
  const narrow = vw < 640;
  return (
    <div aria-hidden="true" className="ps-stage pointer-events-none absolute inset-0">
      <div className="ps-3d absolute inset-0">
        {TILES.map((spec, index) => (!!spec.fore === fore && !(narrow && index % 2 === 1) ? <Tile key={index} spec={spec} p={p} dim={dim} kx={kx} ky={ky} ks={ks} /> : null))}
      </div>
    </div>
  );
}
