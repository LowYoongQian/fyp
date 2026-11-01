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
  const radius = size * 0.24;
  const Icon = spec.icon;
  return (
    <motion.div data-tile={spec.fore ? 'fore' : 'back'} data-blur={spec.blur ? spec.blur * ks : 0} className="ps-3d absolute left-1/2 top-1/2" style={{ x, y, z: spec.z, marginLeft: -size / 2, marginTop: -size / 2, opacity }}>
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

/** Seeded points of light, in viewport units, so the sky is the same every time. */
const STARS = (() => {
  let seed = 7;
  const next = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  return Array.from({ length: 46 }, () => `${(next() * 100).toFixed(1)}vw ${(next() * 100).toFixed(1)}vh 0 ${next() < 0.2 ? 1 : 0}px rgba(191,219,254,${(0.35 + next() * 0.5).toFixed(2)})`).join(',');
})();

/** The stage behind the story: sky, light cone, stars and the sliding grid floor. */
export function Backdrop({ p, reduce }: { p: MotionValue<number>; reduce?: boolean }) {
  const gridY = useTransform(p, value => `${value * 2400}px`);
  const cone = useTransform(p, value => 0.55 + 0.25 * Math.sin(value * 12));
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden" style={{ background: 'linear-gradient(180deg, #040a1c 0%, #08143a 55%, #0c2260 100%)' }}>
      <div className="absolute left-0 top-0 h-px w-px" style={{ boxShadow: STARS }} />
      <motion.div className="absolute -right-[12%] -top-[25%] h-[130%] w-[75%]" style={{ opacity: reduce ? 0.6 : cone, background: 'conic-gradient(from 196deg at 80% 0%, transparent 0deg, rgba(96,165,250,0.5) 20deg, rgba(37,99,235,0.18) 44deg, transparent 62deg)', filter: 'blur(22px)', mixBlendMode: 'screen' }} />
      <div className="absolute inset-x-0 bottom-0 h-[58%]" style={{ perspective: 620, perspectiveOrigin: '50% 0%' }}>
        <motion.div className="absolute top-0 h-[260%] w-[320%]" style={{
          left: '-110%', transform: 'rotateX(74deg)', transformOrigin: '50% 0%', backgroundSize: '90px 90px', backgroundPositionY: reduce ? '0px' : gridY,
          backgroundImage: 'linear-gradient(rgba(147,197,253,0.34) 1.5px, transparent 1.5px), linear-gradient(90deg, rgba(147,197,253,0.34) 1.5px, transparent 1.5px)',
          maskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 60%, transparent 100%)', WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, #000 18%, #000 60%, transparent 100%)',
        }} />
      </div>
      <div className="absolute inset-x-0 bottom-0 h-1/3" style={{ background: 'linear-gradient(0deg, rgba(30,64,175,0.35), transparent)' }} />
    </div>
  );
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
