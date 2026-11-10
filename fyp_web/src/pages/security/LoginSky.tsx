import React, { useEffect, useRef, useState } from 'react';
import { towardLight, type Light } from './loginLighting';
import type { AuroraEpisode, ConstellationPattern } from './loginSkyData';

// Decorative login-sky artwork. Every piece is aria-hidden and pointer-transparent; the parent positions and animates it.
type Palette = { stop1: string; stop2: string; stop3: string; ring1: string; ring2: string };

/** The light on the scene, as the direction it comes from (x, y; y is negative from above). Bodies, clouds and the land all share it. */
export type LightDirection = { lx: number; ly: number };

/** Night-side shading and a lit rim shared by every round body; the bright side faces the light and the dark side turns away from it. */
const SphereShading: React.FC<{ id: string; r: number; rim: string } & LightDirection> = ({ id, r, rim, lx, ly }) => (
  <>
    <circle r={r} fill={`url(#${id}-shade)`} />
    <circle r={r - 0.6} fill="none" stroke={rim} strokeWidth="1.2" opacity="0.45" strokeDasharray={`${r * 2.2} ${r * 10}`} strokeLinecap="round" transform={`rotate(${Math.round(Math.atan2(ly, lx) * 180 / Math.PI - 63)})`} />
    <defs>
      <radialGradient id={`${id}-shade`} cx={`${50 + lx * 20}%`} cy={`${50 + ly * 20}%`} r="80%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
        <stop offset="35%" stopColor="#fff" stopOpacity="0" />
        <stop offset="68%" stopColor="#020617" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0.82" />
      </radialGradient>
    </defs>
  </>
);

export const PlanetBody: React.FC<{ id: string; kind: 'saturn' | 'ice_giant' | 'crimson_planet' | 'crater_moonlet'; pal: Palette; tilt: number } & LightDirection> = ({ id, kind, pal, tilt, lx, ly }) => {
  const r = kind === 'crater_moonlet' ? 15 : kind === 'saturn' ? 20 : 19;
  const base = (
    <radialGradient id={`${id}-base`} cx={`${50 + lx * 12}%`} cy={`${50 + ly * 16}%`} r="70%">
      <stop offset="0%" stopColor={kind === 'crater_moonlet' ? '#e2e8f0' : pal.stop1} />
      <stop offset="55%" stopColor={kind === 'crater_moonlet' ? '#94a3b8' : pal.stop2} />
      <stop offset="100%" stopColor={kind === 'crater_moonlet' ? '#475569' : pal.stop3} />
    </radialGradient>
  );
  const bands = kind === 'saturn' || kind === 'ice_giant';
  const ring = kind === 'saturn'
    ? { rx: 46, ry: 11, width: 5.5, inner: 37 }
    : kind === 'ice_giant' ? { rx: 34, ry: 6, width: 1.4, inner: 0 } : null;
  const ringHalf = (front: boolean) => ring && (
    <g opacity={front ? 1 : 0.7}>
      <path d={`M ${-ring.rx} 0 A ${ring.rx} ${ring.ry} 0 0 ${front ? 0 : 1} ${ring.rx} 0`} fill="none" stroke={`url(#${id}-ring)`} strokeWidth={ring.width} />
      {ring.inner > 0 && (
        <path d={`M ${-ring.inner} 0 A ${ring.inner} ${ring.ry * 0.78} 0 0 ${front ? 0 : 1} ${ring.inner} 0`} fill="none" stroke={pal.ring2} strokeWidth="2.6" opacity="0.75" />
      )}
    </g>
  );
  return (
    <svg viewBox="-60 -40 120 80" className="h-full w-full overflow-visible" aria-hidden="true">
      <g transform={`rotate(${tilt})`}>
        {ringHalf(false)}
        <clipPath id={`${id}-clip`}><circle r={r} /></clipPath>
        <circle r={r} fill={`url(#${id}-base)`} />
        <g clipPath={`url(#${id}-clip)`}>
          {bands && [-11, -5, 2, 9, 14].map((y, i) => (
            <ellipse key={y} cx="0" cy={y} rx={r * 1.3} ry={i % 2 ? 1.6 : 2.6} fill={i % 2 ? pal.stop1 : pal.stop3} opacity={i % 2 ? 0.22 : 0.18} />
          ))}
          {kind === 'crimson_planet' && (
            <>
              <ellipse cx="-6" cy="-5" rx="9" ry="4" fill={pal.stop3} opacity="0.3" transform="rotate(-18)" />
              <ellipse cx="7" cy="6" rx="7" ry="3" fill={pal.stop3} opacity="0.25" transform="rotate(12)" />
              <ellipse cx="2" cy="-12" rx="5" ry="1.6" fill={pal.stop1} opacity="0.3" />
            </>
          )}
          {kind === 'crater_moonlet' && [[-5, -4, 3.2], [5, 3, 2.6], [-1, 8, 2], [7, -7, 1.6]].map(([cx, cy, cr]) => (
            <g key={`${cx}${cy}`}>
              <circle cx={cx} cy={cy} r={cr} fill="#334155" opacity="0.35" />
              <circle cx={cx - lx * cr * 0.25} cy={cy - ly * cr * 0.25} r={cr * 0.8} fill="none" stroke="#f1f5f9" strokeWidth="0.6" opacity="0.35" />
            </g>
          ))}
          {/* The ring's shadow falling across the body, away from the light. */}
          {ring && ring.inner > 0 && <ellipse cx={-lx * 2.5} cy={3 - ly * 2.5} rx={ring.rx} ry={ring.ry * 0.6} fill="none" stroke="#020617" strokeWidth="2.2" opacity="0.3" />}
        </g>
        <SphereShading id={id} r={r} rim={kind === 'crater_moonlet' ? '#f8fafc' : pal.ring1} lx={lx} ly={ly} />
        {ringHalf(true)}
      </g>
      <defs>
        {base}
        <linearGradient id={`${id}-ring`} x1="0" x2="1">
          <stop offset="0%" stopColor={pal.ring1} stopOpacity="0.15" />
          <stop offset="30%" stopColor={pal.ring1} stopOpacity="0.95" />
          <stop offset="70%" stopColor={pal.ring2} stopOpacity="0.85" />
          <stop offset="100%" stopColor={pal.ring2} stopOpacity="0.15" />
        </linearGradient>
      </defs>
    </svg>
  );
};

/** A dark shadow ringed by a thin photon ring, with a tilted accretion disk that passes in front and is lensed over the top. */
export const BlackHole: React.FC<{ id: string; tilt: number }> = ({ id, tilt }) => {
  const half = (front: boolean) => `M -50 0 A 50 9 0 0 ${front ? 0 : 1} 50 0`;
  return (
    <svg viewBox="-60 -60 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
      <circle r="56" fill={`url(#${id}-glow)`} />
      <g transform={`rotate(${tilt})`}>
        <path d={half(false)} fill="none" stroke={`url(#${id}-disk)`} strokeWidth="9" opacity="0.28" />
        <path d={half(false)} fill="none" stroke={`url(#${id}-disk)`} strokeWidth="3" opacity="0.8" />
        <path d={half(false)} fill="none" stroke="#fffbeb" strokeWidth="0.8" strokeDasharray="2 10" opacity="0.4" className="login-disk-flow" />
        {/* Light from the far side of the disk, bent around the shadow. */}
        <circle r="23" fill="none" stroke={`url(#${id}-lens)`} strokeWidth="3" opacity="0.9" />
        <circle r="24" fill="none" stroke={`url(#${id}-lens)`} strokeWidth="9" opacity="0.18" />
        <circle r="19" fill={`url(#${id}-void)`} />
        <circle r="19.6" fill="none" stroke="#fff3d6" strokeWidth="0.9" opacity="0.95" />
        <path d={half(true)} fill="none" stroke={`url(#${id}-disk)`} strokeWidth="10" opacity="0.3" />
        <path d={half(true)} fill="none" stroke={`url(#${id}-disk)`} strokeWidth="3.8" />
        <path d={half(true)} fill="none" stroke="#fffbeb" strokeWidth="1" strokeDasharray="3 9" opacity="0.65" className="login-disk-flow" />
      </g>
      <defs>
        <radialGradient id={`${id}-glow`}>
          <stop offset="25%" stopColor="#f59e0b" stopOpacity="0.22" />
          <stop offset="55%" stopColor="#a855f7" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#a855f7" stopOpacity="0" />
        </radialGradient>
        {/* Brighter on the approaching (left) side. */}
        <linearGradient id={`${id}-disk`} x1="0" x2="1">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.2" />
          <stop offset="18%" stopColor="#fffbeb" />
          <stop offset="45%" stopColor="#fbbf24" />
          <stop offset="78%" stopColor="#ea580c" stopOpacity="0.85" />
          <stop offset="100%" stopColor="#7c2d12" stopOpacity="0.15" />
        </linearGradient>
        <linearGradient id={`${id}-lens`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fde68a" />
          <stop offset="50%" stopColor="#f97316" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0.75" />
        </linearGradient>
        <radialGradient id={`${id}-void`}>
          <stop offset="80%" stopColor="#000" />
          <stop offset="100%" stopColor="#1c0d05" />
        </radialGradient>
      </defs>
    </svg>
  );
};

const CRATERS: [number, number, number][] = [[-12, -14, 5], [10, -4, 7], [-6, 10, 4], [14, 16, 3.5], [-20, 4, 3]];
const MARIA: [number, number, number][] = [[-10, -10, 13], [12, -2, 11], [-2, 14, 9], [16, 16, 6]];

/** A clean crescent cut from one disc; its glow comes from the container drop-shadow so it follows the lit edge. `litAngle` is the way the lit edge faces, in degrees clockwise from the right: toward the sun, which is just below the horizon. */
export const CrescentMoon: React.FC<{ litAngle?: number }> = ({ litAngle = 156 }) => (
  <svg viewBox="-60 -60 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
    <g transform={`rotate(${litAngle - 180})`}>
      <g mask="url(#login-crescent)">
        <circle r="38" fill="url(#login-crescent-surface)" />
        {CRATERS.map(([x, y, r]) => <circle key={`${x}${y}`} cx={x - 8} cy={y} r={r * 0.7} fill="#d6cba8" opacity="0.35" />)}
      </g>
    </g>
    <defs>
      <mask id="login-crescent" maskUnits="userSpaceOnUse" x="-60" y="-60" width="120" height="120">
        <rect x="-60" y="-60" width="120" height="120" fill="#fff" />
        <circle cx="15" cy="-6" r="35" fill="#000" />
      </mask>
      <radialGradient id="login-crescent-surface" cx="20%" cy="55%" r="75%">
        <stop offset="0%" stopColor="#fffdf5" />
        <stop offset="60%" stopColor="#fbf3d9" />
        <stop offset="100%" stopColor="#e8dcb5" />
      </radialGradient>
    </defs>
  </svg>
);

/** A full moon with limb darkening, soft maria and a few craters. */
export const FullMoon: React.FC = () => (
  <svg viewBox="-60 -60 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
    <circle r="60" fill="url(#login-fullmoon-halo)" />
    <clipPath id="login-fullmoon-clip"><circle r="36" /></clipPath>
    <circle r="36" fill="url(#login-fullmoon-surface)" />
    <g clipPath="url(#login-fullmoon-clip)">
      {MARIA.map(([x, y, r]) => <circle key={`${x}${y}`} cx={x} cy={y} r={r} fill="url(#login-mare)" />)}
      {CRATERS.map(([x, y, r]) => (
        <g key={`${x}${y}`}>
          <circle cx={x} cy={y} r={r * 0.45} fill="#94a3b8" opacity="0.3" />
          <circle cx={x + 0.4} cy={y + 0.4} r={r * 0.45} fill="none" stroke="#fff" strokeWidth="0.5" opacity="0.35" />
        </g>
      ))}
    </g>
    <defs>
      <radialGradient id="login-fullmoon-surface" cx="40%" cy="38%" r="65%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="70%" stopColor="#e2e8f0" />
        <stop offset="100%" stopColor="#a8b3c4" />
      </radialGradient>
      <radialGradient id="login-mare">
        <stop offset="0%" stopColor="#64748b" stopOpacity="0.32" />
        <stop offset="100%" stopColor="#64748b" stopOpacity="0" />
      </radialGradient>
      <radialGradient id="login-fullmoon-halo">
        <stop offset="50%" stopColor="#e0f2fe" stopOpacity="0.3" />
        <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
);

/** A soft cloud: the side facing the light is bright, the far side and the underside fall into a cooler shade. */
export const Cloud: React.FC<{ id: string; lit: string; base: string; shade: string } & LightDirection> = ({ id, lit, base, shade, lx, ly }) => {
  // Shade grows away from the light and always a little downward, since the sky lights the top of a cloud.
  const sx = -lx, sy = 0.6 - ly, length = Math.hypot(sx, sy) || 1, dx = (sx / length) * 0.5, dy = (sy / length) * 0.5;
  return (
    <svg viewBox="0 0 120 60" className="h-full w-full overflow-visible" aria-hidden="true">
      <path fill={`url(#${id})`} d="M16 50 C6 50 3 41 11 36 C8 27 18 20 28 25 C31 13 47 8 57 16 C64 7 82 9 85 22 C96 20 106 29 102 39 C110 41 109 50 100 50 Z" />
      {/* The brightest cap sits on the side toward the light, nudged a little toward it. */}
      <path fill={lit} opacity="0.6" transform={`translate(${(lx * 3).toFixed(2)} ${(Math.min(0, ly) * 2).toFixed(2)})${lx > 0 ? ' translate(120 0) scale(-1 1)' : ''}`} d="M30 30 C33 20 46 15 55 22 C62 14 76 16 79 25 C70 22 63 26 60 31 C52 25 40 25 30 30 Z" />
      <defs>
        <linearGradient id={id} x1={0.5 - dx} y1={0.5 - dy} x2={0.5 + dx} y2={0.5 + dy}>
          <stop offset="0%" stopColor={lit} />
          <stop offset="55%" stopColor={base} />
          <stop offset="100%" stopColor={shade} />
        </linearGradient>
      </defs>
    </svg>
  );
};

/**
 * A drifting cloud lit from where it is now. It measures its own place on the stage a few times a second (one layout read, and a re-render
 * only when the angle has really changed), so as it passes the sun its bright side turns to face it, and its soft shadow falls away from it.
 */
export const SunlitCloud: React.FC<{ id: string; lit: string; base: string; shade: string; light: Light; shadow: number }> = ({ id, lit, base, shade, light, shadow }) => {
  const box = useRef<HTMLDivElement>(null);
  const [toward, setToward] = useState<LightDirection>({ lx: light.x, ly: light.y });
  const { left, top } = light;
  useEffect(() => {
    const measure = () => {
      const node = box.current, stage = node?.closest('[data-login-stage]');
      if (!node || !stage || document.hidden) return;
      const self = node.getBoundingClientRect(), area = stage.getBoundingClientRect();
      if (!area.width || !area.height || !self.width) return;
      const x = ((self.left + self.width / 2 - area.left) / area.width) * 100, y = ((self.top + self.height / 2 - area.top) / area.height) * 100;
      const next = towardLight({ ...light, left, top }, x, y, area.width, area.height);
      setToward(current => Math.abs(current.lx - next.lx) + Math.abs(current.ly - next.ly) < 0.04 ? current : next);
    };
    measure();
    const timer = window.setInterval(measure, 400);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the light's position matters here, not the object's identity
  }, [left, top]);
  // The shadow is cast away from the light: below and to the far side, softer the dimmer the light.
  const reach = 7;
  return (
    <div ref={box} className="h-full w-full" style={{ filter: shadow > 0.01 ? `drop-shadow(${(-toward.lx * reach).toFixed(1)}px ${(Math.max(0.35, -toward.ly) * reach).toFixed(1)}px 7px rgba(15, 23, 42, ${shadow.toFixed(3)}))` : undefined }}>
      <Cloud id={id} lit={lit} base={base} shade={shade} lx={toward.lx} ly={toward.ly} />
    </div>
  );
};

// ---- Birds ------------------------------------------------------------------------------------------------------
// A small bird in side view, flying to the right (the flock is mirrored to fly left): a tapered body with a head and a short beak, a forked
// tail, and two wings with a bend at the wrist and a pointed tip. The near wing sweeps back, the far wing (slightly paler) reaches forward;
// both turn at the shoulder, so a downstroke really brings the tips down rather than squashing the drawing.
const BIRD_BODY = 'M-5,0.6 C-3,-0.9 2,-1.3 4.2,-0.5 C5.2,-0.3 6.2,-0.1 7,0.2 C6,0.5 5,0.6 4,0.8 C1.5,1.6 -2.5,1.6 -5,0.6 Z';
const BIRD_TAIL = 'M-4.6,0.4 L-8.6,-0.7 L-7.5,0.8 L-8.8,2.1 Z';
const NEAR_WING = 'M0,-0.4 C-1.4,-3.2 -4,-6 -7.6,-7.4 C-8.6,-7.8 -9.8,-7.6 -10.6,-7.1 C-8.4,-6 -6.4,-4.4 -5,-3 C-3.6,-1.8 -2,-0.6 -0.8,0.4 Z';
const FAR_WING = 'M0.6,-0.5 C1.6,-3 3.4,-5.4 5.8,-6.6 C6.6,-7 7.4,-6.9 8,-6.5 C6.4,-5.4 4.8,-3.6 3.6,-2 C2.8,-1 2,-0.3 1.4,0.2 Z';
// [x, y, size, wingbeat cycle in s, offset in s, shown from flock size]: a loose V, the leader largest and the rest smaller with distance.
const FLOCK: [number, number, number, number, number, number][] = [
  [30, 24, 1.35, 1.7, 0, 1], [71, 13, 1.1, 1.55, -0.4, 1], [50, 36, 1.05, 1.8, -0.9, 1],
  [104, 23, 0.85, 1.6, -1.2, 4], [24, 43, 0.72, 1.75, -0.6, 5], [128, 16, 0.62, 1.5, -1.0, 6],
];

/** A flock of `count` birds in one 140 x 50 drawing, coloured by `color` (they read as dark shapes against the bright sky). */
export const BirdFlock: React.FC<{ count: number; color: string; className?: string; style?: React.CSSProperties }> = ({ count, color, className, style }) => (
  <svg className={className} viewBox="0 0 140 50" style={{ ...style, color }} aria-hidden="true">
    {FLOCK.filter(([, , , , , from]) => count >= from).map(([x, y, size, beat, offset]) => {
      const timing = { animationDuration: `${beat}s`, animationDelay: `${offset}s` };
      return (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y}) scale(${size})`}>
          <g className="login-bird" style={timing}>
            <path className="login-bird-wing-far" style={timing} d={FAR_WING} fill="currentColor" opacity="0.72" />
            <path d={BIRD_TAIL} fill="currentColor" />
            <path d={BIRD_BODY} fill="currentColor" />
            <path className="login-bird-wing-near" style={timing} d={NEAR_WING} fill="currentColor" />
          </g>
        </g>
      );
    })}
  </svg>
);

/** A fixed field of faint distant stars, a few of which twinkle slowly. */
// Placed once per page load; the field never reshuffles while the page is open.
const FIELD_STARS = Array.from({ length: 110 }, (_, i) => ({
  x: Math.random() * 100, y: Math.random() * 72, r: Math.random() < 0.15 ? 1.1 : 0.6, o: 0.25 + Math.random() * 0.55, twinkle: i % 5 === 0, delay: Math.random() * 6,
}));

export const StarField: React.FC = () => (
  <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
    {FIELD_STARS.map((s, i) => (
      <circle key={i} cx={`${s.x}%`} cy={`${s.y}%`} r={s.r} fill="#f8fafc" opacity={s.o} className={s.twinkle ? 'login-star-twinkle' : undefined} style={s.twinkle ? { animationDelay: `${s.delay}s` } : undefined} />
    ))}
  </svg>
);

// ---- Constellations ---------------------------------------------------------------------------------------------
export type PlacedConstellation = { key: number; pattern: ConstellationPattern; top: number; left: number; size: number };

const STAR_RADIUS = { 1: 1.9, 2: 1.4, 3: 1.05 } as const;

/** One constellation's life is driven by CSS: stars fade in one by one, lines draw between them, the name appears, it rests, then fades. */
export const ConstellationFigure: React.FC<{ figure: PlacedConstellation; onDone: () => void }> = ({ figure, onDone }) => {
  const { pattern, size } = figure;
  const lineStart = 0.6 + pattern.nodes.length * 0.18;
  return (
    <div
      data-login-constellation={pattern.id}
      className="login-constellation absolute"
      style={{ top: `${figure.top}%`, left: `${figure.left}%`, width: size, height: size }}
      onAnimationEnd={event => { if (event.target === event.currentTarget) onDone(); }}
    >
      <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible" aria-hidden="true">
        {pattern.edges.map(([from, to], index) => {
          const a = pattern.nodes[from], b = pattern.nodes[to];
          return <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} pathLength={1} vectorEffect="non-scaling-stroke"
            className="login-constellation-line" style={{ ['--d' as string]: `${lineStart + index * 0.32}s` } as React.CSSProperties} />;
        })}
        {pattern.nodes.map((node, index) => (
          <g key={index} transform={`translate(${node.x} ${node.y})`}>
            <g className="login-constellation-star" style={{ ['--d' as string]: `${0.2 + index * 0.18}s`, ['--tw' as string]: `${2.6 + (index % 4) * 0.7}s` } as React.CSSProperties}>
              <circle r={STAR_RADIUS[node.m] * 3.2} fill={`url(#login-star-halo-${figure.key})`} />
              <circle r={STAR_RADIUS[node.m]} fill="#f8fafc" />
            </g>
          </g>
        ))}
        <defs>
          <radialGradient id={`login-star-halo-${figure.key}`}>
            <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#e0f2fe" stopOpacity="0" />
          </radialGradient>
        </defs>
      </svg>
      <span className="login-constellation-label" style={{ ['--d' as string]: `${lineStart + pattern.edges.length * 0.32 + 0.4}s` } as React.CSSProperties}>
        ✦ {pattern.name}
      </span>
    </div>
  );
};

// ---- Aurora -----------------------------------------------------------------------------------------------------

/** Rayed light curtains that fade in, sway and breathe for one episode, then fade out (onDone); still and steady with reduced motion. */
export const Aurora: React.FC<{ episode: AuroraEpisode; onDone: () => void }> = ({ episode, onDone }) => (
  <div
    data-login-aurora
    className="login-aurora"
    style={{ ['--episode' as string]: `${episode.length}s` } as React.CSSProperties}
    onAnimationEnd={event => { if (event.target === event.currentTarget) onDone(); }}
    aria-hidden="true"
  >
    {episode.curtains.map((curtain, index) => (
      <div key={index} className="login-aurora-curtain" style={{
        left: `${curtain.left}%`, width: `${curtain.width}%`, height: `${curtain.height}%`, bottom: `${curtain.bottom}%`,
        ['--c' as string]: curtain.color, ['--sway' as string]: `${curtain.sway}s`, ['--pulse' as string]: `${curtain.pulse}s`,
        ['--delay' as string]: `${curtain.delay}s`, ['--tilt' as string]: `${curtain.tilt}deg`,
      } as React.CSSProperties} />
    ))}
  </div>
);
