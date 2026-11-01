import React from 'react';
import type { AuroraEpisode, ConstellationPattern } from './loginSkyData';

// Decorative login-sky artwork. Every piece is aria-hidden and pointer-transparent; the parent positions and animates it.
type Palette = { stop1: string; stop2: string; stop3: string; ring1: string; ring2: string };

/** Night-side shading, a lit rim and a soft atmosphere shared by every round body. */
const SphereShading: React.FC<{ id: string; r: number; rim: string }> = ({ id, r, rim }) => (
  <>
    <circle r={r} fill={`url(#${id}-shade)`} />
    <circle r={r - 0.6} fill="none" stroke={rim} strokeWidth="1.2" opacity="0.45" strokeDasharray={`${r * 2.2} ${r * 10}`} strokeDashoffset={-r * 2.9} strokeLinecap="round" />
    <defs>
      <radialGradient id={`${id}-shade`} cx="32%" cy="30%" r="80%">
        <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
        <stop offset="35%" stopColor="#fff" stopOpacity="0" />
        <stop offset="68%" stopColor="#020617" stopOpacity="0.25" />
        <stop offset="100%" stopColor="#020617" stopOpacity="0.82" />
      </radialGradient>
    </defs>
  </>
);

export const PlanetBody: React.FC<{ id: string; kind: 'saturn' | 'ice_giant' | 'crimson_planet' | 'crater_moonlet'; pal: Palette; tilt: number }> = ({ id, kind, pal, tilt }) => {
  const r = kind === 'crater_moonlet' ? 15 : kind === 'saturn' ? 20 : 19;
  const base = (
    <radialGradient id={`${id}-base`} cx="38%" cy="34%" r="70%">
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
              <circle cx={cx + cr * 0.25} cy={cy + cr * 0.25} r={cr * 0.8} fill="none" stroke="#f1f5f9" strokeWidth="0.6" opacity="0.35" />
            </g>
          ))}
          {/* The ring's shadow falling across the body. */}
          {ring && ring.inner > 0 && <ellipse cx="0" cy="3" rx={ring.rx} ry={ring.ry * 0.6} fill="none" stroke="#020617" strokeWidth="2.2" opacity="0.3" />}
        </g>
        <SphereShading id={id} r={r} rim={kind === 'crater_moonlet' ? '#f8fafc' : pal.ring1} />
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

/** A clean crescent cut from one disc; its glow comes from the container drop-shadow so it follows the lit edge. */
export const CrescentMoon: React.FC = () => (
  <svg viewBox="-60 -60 120 120" className="h-full w-full overflow-visible" aria-hidden="true">
    <g transform="rotate(-24)">
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

/** A soft cloud with a lit top and a cooler underside. */
export const Cloud: React.FC<{ id: string; evening: boolean }> = ({ id, evening }) => {
  return (
    <svg viewBox="0 0 120 60" className="h-full w-full overflow-visible" aria-hidden="true">
      <path fill={`url(#${id})`} d="M16 50 C6 50 3 41 11 36 C8 27 18 20 28 25 C31 13 47 8 57 16 C64 7 82 9 85 22 C96 20 106 29 102 39 C110 41 109 50 100 50 Z" />
      <path fill="#fff" opacity={evening ? 0.35 : 0.5} d="M30 30 C33 20 46 15 55 22 C62 14 76 16 79 25 C70 22 63 26 60 31 C52 25 40 25 30 30 Z" />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={evening ? '#fff7ed' : '#ffffff'} />
          <stop offset="60%" stopColor={evening ? '#fed7aa' : '#f8fafc'} />
          <stop offset="100%" stopColor={evening ? '#f9a8d4' : '#dbe4ef'} />
        </linearGradient>
      </defs>
    </svg>
  );
};

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
