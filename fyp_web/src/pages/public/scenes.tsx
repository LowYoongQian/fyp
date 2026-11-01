import { motion, useTransform, type MotionValue } from 'motion/react';
import { MousePointer2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Box3D } from './Box3D';
import { Mark } from './Mark';
import { useRange } from './range';
import { MONITOR, PHONE, type DemoScreen } from './sceneConfig';

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const FADE = 0.012;

/** A tap (or click) on the captured screen at story progress `at`; `x` and `y` are fractions of the screen. */
export type Tap = { at: number; x: number; y: number };
/** What a device shows: its screens in order, the story progress range of the power-on splash, and the taps that lead from one screen to the next. */
export type DeviceScript = { screens: DemoScreen[]; boot?: [number, number]; taps?: Tap[]; scan?: [number, number] };

/**
 * A capture that arrives at `from` and leaves at `to`, so each screen gets a readable pause. The picture fills the screen exactly (same shape as the
 * capture, so nothing is cropped or stretched). On a phone it slides in like an app page; the first one opens with a small zoom.
 */
function ScreenImage({ p, screen, first, last, slide, width, warm }: { p: MotionValue<number>; screen: DemoScreen; first: boolean; last: boolean; slide: boolean; width: number; warm: boolean }) {
  const shown = useRange(p, [screen.from - FADE, screen.from, screen.to, screen.to + FADE], [0, 1, 1, last ? 1 : 0]);
  const opacity = useTransform(shown, value => (warm ? Math.max(value, 0.002) : value));   // while the page warms up every screen is drawn once, almost invisibly
  const x = useRange(p, [screen.from - FADE, screen.from, screen.to, screen.to + FADE], slide && !first ? [width * 0.22, 0, 0, -width * 0.08] : [0, 0, 0, 0]);
  const scale = useRange(p, [screen.from - FADE, screen.from], first ? [1.1, 1] : [1, 1]);
  return <motion.img src={screen.src} alt={screen.alt} draggable={false} decoding="async" className="absolute inset-0 h-full w-full select-none" style={{ opacity, x, scale }} />;
}

/** The splash an app shows while it opens: the logo on the app's blue. */
function Splash({ p, range, logo }: { p: MotionValue<number>; range: [number, number]; logo: number }) {
  const [a, b] = range;
  const opacity = useRange(p, [a - 0.004, a + 0.006, b - 0.004, b], [0, 1, 1, 0]);
  const scale = useRange(p, [a - 0.004, a + 0.01, b], [0.8, 1, 1.12]);
  return (
    <motion.div className="absolute inset-0 flex flex-col items-center justify-center gap-[6%]" style={{ opacity, background: 'radial-gradient(circle at 50% 42%, #2563eb 0%, #1e3a8a 55%, #0b1437 100%)' }}>
      <motion.div style={{ scale }} className="flex flex-col items-center gap-[10%]">
        <Mark height={logo} className="drop-shadow-[0_0_18px_rgba(147,197,253,0.65)]" />
        <span className="font-display font-extrabold tracking-[0.3em] text-blue-50" style={{ fontSize: logo * 0.26 }}>USAS</span>
      </motion.div>
    </motion.div>
  );
}

/**
 * While the check-in screen waits for a face: an oval guide with a line scanning down it (an animation only: there is no camera and no person).
 * No clipping and no large shadow, which would make the browser build a mask layer the first time it appears.
 */
function FaceScan({ p, range, warm }: { p: MotionValue<number>; range: [number, number]; warm: boolean }) {
  const [a, b] = range;
  const shown = useRange(p, [a, a + 0.008, b - 0.012, b], [0, 1, 1, 0]);
  const opacity = useTransform(shown, value => (warm ? Math.max(value, 0.002) : value));
  const along = useRange(p, [a + 0.004, (a + b) / 2, b - 0.012], [-1, 1, -1]);   // -1 top of the oval, 1 bottom
  const y = useTransform(along, value => 90 + value * 86);                        // the oval is 40% of the 450 px screen high: 180 px
  const width = useTransform(along, value => Math.sqrt(Math.max(0, 1 - value * value)));   // the line is as long as the oval is wide at that height
  return (
    <motion.div className="pointer-events-none absolute left-[17%] top-[27%] h-[40%] w-[66%] rounded-[50%] border-2 border-dashed border-white/90" style={{ opacity }}>
      <motion.span className="absolute inset-x-0 top-0 -mt-px h-[3px] rounded bg-blue-400 shadow-[0_0_8px_1px_rgba(59,130,246,0.9)]" style={{ y, scaleX: width }} />
    </motion.div>
  );
}

function TapMark({ p, tap, size, cursor }: { p: MotionValue<number>; tap: Tap; size: number; cursor: boolean }) {
  const opacity = useRange(p, [tap.at - 0.016, tap.at - 0.008, tap.at + 0.006, tap.at + 0.014], [0, 1, 1, 0]);
  const ring = useRange(p, [tap.at - 0.002, tap.at + 0.014], [0.4, 1.5]);
  const ringOpacity = useRange(p, [tap.at - 0.002, tap.at + 0.002, tap.at + 0.014], [0, 0.9, 0]);
  const glide = useRange(p, [tap.at - 0.02, tap.at - 0.004], [1, 0]);
  const cx = useTransform(glide, value => `${value * -7}%`);
  const cy = useTransform(glide, value => `${value * 9}%`);
  return (
    <motion.div className="pointer-events-none absolute" style={{ left: `${tap.x * 100}%`, top: `${tap.y * 100}%`, opacity }}>
      <motion.span className="absolute rounded-full border-2 border-blue-600 bg-blue-500/25" style={{ width: size, height: size, left: -size / 2, top: -size / 2, scale: ring, opacity: ringOpacity }} />
      {cursor && <motion.span className="absolute" style={{ left: cx, top: cy }}><MousePointer2 className="-ml-1 -mt-1 h-6 w-6 fill-white text-slate-900 drop-shadow" /></motion.span>}
    </motion.div>
  );
}

/** The device's display: black while off, then a power-on glow, the splash of the app, and the screens in turn. */
function Display({ p, on, script, w, h, radius, slide, tapSize, cursor, logo, warm }: { p: MotionValue<number>; on: MotionValue<number>; script: DeviceScript; w: number; h: number; radius: number; slide: boolean; tapSize: number; cursor: boolean; logo: number; warm: boolean }) {
  const dark = useTransform(on, value => 1 - clamp01(value * 1.4));
  const glow = useRange(on, [0, 0.5, 1], [0, 0.6, 0]);
  const sweep = useRange(on, [0, 1], [-w, w]);
  const sweepOpacity = useRange(on, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);
  return (
    <div className="absolute overflow-hidden bg-black" style={{ left: 0, top: 0, width: w, height: h, borderRadius: radius }}>
      {script.screens.map((screen, index) => <ScreenImage key={screen.src} p={p} screen={screen} first={index === 0} last={index === script.screens.length - 1} slide={slide} width={w} warm={warm} />)}
      {script.boot && <Splash p={p} range={script.boot} logo={logo} />}
      {script.scan && <FaceScan p={p} range={script.scan} warm={warm} />}
      {script.taps?.map(tap => <TapMark key={tap.at} p={p} tap={tap} size={tapSize} cursor={cursor} />)}
      <motion.div className="absolute inset-0 bg-black" style={{ opacity: dark }} />
      <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: glow, background: 'radial-gradient(circle at 50% 45%, rgba(147,197,253,0.9), rgba(37,99,235,0.2) 55%, transparent 75%)' }} />
      <motion.div className="pointer-events-none absolute inset-y-0 w-1/2" style={{ x: sweep, background: 'linear-gradient(100deg, transparent, rgba(255,255,255,0.28), transparent)', opacity: sweepOpacity }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(125deg, rgba(255,255,255,0.13) 0%, rgba(255,255,255,0) 36%)' }} />
    </div>
  );
}

/** A thick slab drawn as stacked silhouettes, so its rounded edge looks solid from any angle. `extras` are placed in 3D (side buttons and the like). */
export function Slab({ w, h, radius, depth, edge, children, extras }: { w: number; h: number; radius: number; depth: number; edge: string; children?: ReactNode; extras?: ReactNode }) {
  const layers = Math.max(2, Math.round(depth / 1.5));
  return (
    <div className="ps-3d relative" style={{ width: w, height: h }}>
      {/* the back is solid; every layer between it and the face is only a rim, so the side wall looks solid from any angle without one large texture per layer */}
      {Array.from({ length: layers - 1 }, (_, index) => (
        <div key={index} className="absolute inset-0" style={{ borderRadius: radius, ...(index === 0 ? { background: edge } : { border: `4px solid ${edge}` }), transform: `translateZ(${-depth + (index * depth) / (layers - 1)}px)` }} />
      ))}
      {/* the face sits exactly in the front plane (z = 0), so at rest it is drawn pixel for pixel */}
      <div className="ps-3d absolute inset-0">
        <div className="absolute inset-0" style={{ borderRadius: radius }}>{children}</div>
        {extras}
      </div>
    </div>
  );
}

export function Phone({ p, on, script, warm = false }: { p: MotionValue<number>; on: MotionValue<number>; script: DeviceScript; warm?: boolean }) {
  const { x, y, w, h } = PHONE.screen;
  const lit = useTransform(on, value => clamp01(value));
  return (
    <Slab w={PHONE.w} h={PHONE.h} radius={38} depth={11} edge="#3b4a63" extras={
      <>
        <div className="absolute rounded-sm bg-slate-500" style={{ right: -3, top: 126, width: 3, height: 58, transform: 'translateZ(-6px)' }} />
        <div className="absolute rounded-sm bg-slate-500" style={{ right: -3, top: 196, width: 3, height: 34, transform: 'translateZ(-6px)' }} />
      </>
    }>
      <div className="absolute inset-0 rounded-[38px] bg-gradient-to-br from-slate-700 via-slate-900 to-slate-950 shadow-[inset_0_0_0_1.5px_rgba(148,163,184,0.5),inset_0_0_14px_rgba(0,0,0,0.6)]">
        <div className="absolute rounded-full bg-black/80" style={{ left: PHONE.w / 2 - 22, top: 9, width: 44, height: 5 }} />
        <motion.div className="absolute rounded-full bg-blue-400/80 shadow-[0_0_6px_rgba(96,165,250,0.9)]" style={{ left: PHONE.w / 2 + 30, top: 8, width: 7, height: 7, opacity: lit }} />
        <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
          <Display p={p} on={on} script={script} w={w} h={h} radius={6} slide tapSize={44} cursor={false} logo={58} warm={warm} />
        </div>
      </div>
    </Slab>
  );
}

export function Monitor({ p, on, script, warm = false }: { p: MotionValue<number>; on: MotionValue<number>; script: DeviceScript; warm?: boolean }) {
  const { x, y, w, h } = MONITOR.screen;
  const lit = useTransform(on, value => clamp01(value));
  return (
    <div className="ps-3d relative" style={{ width: MONITOR.w, height: MONITOR.h + MONITOR.stand }}>
      <Slab w={MONITOR.w} h={MONITOR.h} radius={18} depth={14} edge="#475569">
        <div className="absolute inset-0 rounded-[18px] bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 shadow-[inset_0_0_0_1.5px_rgba(148,163,184,0.4),inset_0_0_18px_rgba(0,0,0,0.5)]">
          <div className="absolute" style={{ left: x, top: y, width: w, height: h }}>
            <Display p={p} on={on} script={script} w={w} h={h} radius={4} slide={false} tapSize={56} cursor logo={96} warm={warm} />
          </div>
          <motion.span className="absolute rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,1)]" style={{ left: MONITOR.w / 2 - 3, top: MONITOR.h - 20, width: 6, height: 6, opacity: lit }} />
        </div>
      </Slab>
      <div className="ps-3d absolute" style={{ left: MONITOR.w / 2 - 24, top: MONITOR.h - 6, transform: 'translateZ(-40px)' }}><Box3D w={48} h={110} d={30} color="#64748b" /></div>
      <div className="ps-3d absolute" style={{ left: MONITOR.w / 2 - 130, top: MONITOR.h + 98, transform: 'translateZ(-40px)' }}><Box3D w={260} h={12} d={150} color="#64748b" /></div>
    </div>
  );
}
