import React from 'react';
import { mix, shadowAlpha, shadowOffset, type Look } from './loginLighting';
import { footAt, MID } from './loginRidge';

// The land under the sign-in sky: two ridges, a few trees and a foreground hill, all lit by the one light in `look` (the side facing the sun or
// moon is bright, the far side falls into cool shade, trees cast their shadow away from it). Decorative: the parent is aria-hidden and pointer-transparent.
const BACK = 'M0,192L60,181.3C120,171,240,149,360,160C480,171,600,213,720,208C840,203,960,149,1080,144C1200,139,1320,181,1380,202.7L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z';
const HILL = 'M0,190 C360,110 600,230 900,140 C1200,50 1380,190 1440,150';

// Four trees, each at its own place along the ridge (`at`, in % of the width) so its foot is on the ground at any width or height. Each drawing
// is cut to its own box and ends at the bottom of the trunk; `round` trees are circles of foliage, `pine` trees are stacked points.
type Foliage = 'dark' | 'left' | 'right' | 'mid';
type Tree = { at: number; box: string; trunk: [number, number, number]; circles?: [number, number, number, Foliage][]; points?: [string, Foliage][] };
const TREES: Tree[] = [
  { at: 8.5, box: '7 4 36 42', trunk: [23, 28, 18], circles: [[25, 20, 14, 'dark'], [17, 22, 10, 'left'], [33, 22, 10, 'right']] },
  { at: 12.5, box: '45 0 40 46', trunk: [63, 30, 16], points: [['65,6 50,22 56,22 45,34 85,34 74,22 80,22', 'dark'], ['65,0 54,14 59,14 50,24 80,24 71,14 76,14', 'mid']] },
  { at: 87.5, box: '12 0 36 46', trunk: [28, 28, 18], points: [['30,4 16,20 22,20 12,32 48,32 38,20 44,20', 'dark'], ['30,0 20,12 24,12 16,22 44,22 36,12 40,12', 'mid']] },
  { at: 91.5, box: '55 3 40 43', trunk: [73, 28, 18], circles: [[75, 18, 15, 'dark'], [66, 20, 11, 'left'], [84, 20, 11, 'right']] },
];

const ease = (t: number) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };

/** A gradient across a surface: brightest where the light is strongest, falling toward shade on the far side. */
const Lit: React.FC<{ id: string; color: string; look: Look }> = ({ id, color, look }) => {
  const { light, shade, ground, sky } = look;
  const pull = light.strength * light.intensity;
  const bright = mix(mix(color, sky.tint, 0.28 * pull + 0.08 * light.intensity), '#FFFFFF', 0.07 * light.intensity);
  const dark = mix(color, ground.shadow, 0.5 * shade * pull + 0.05);
  const tone = (distance: number) => mix(bright, dark, ease(distance * 1.1));
  return (
    <linearGradient id={id} x1="0" x2="1" y1="0" y2="0">
      <stop offset="0" stopColor={tone(light.at)} />
      <stop offset={light.at} stopColor={bright} />
      <stop offset="1" stopColor={tone(1 - light.at)} />
    </linearGradient>
  );
};

/** One layer of land. Wider and lower than its box so a small depth shift never shows an edge. */
const Layer: React.FC<{ depth: number; children: React.ReactNode }> = ({ depth, children }) => (
  <div data-depth={depth} className="absolute -inset-x-6 -bottom-8 top-0">{children}</div>
);

export const LoginLandscape: React.FC<{ look: Look }> = ({ look }) => {
  const { ground, light, shade } = look;
  const cast = shadowOffset(light), alpha = shadowAlpha(look);
  const treeShadow = { filter: `drop-shadow(${cast.x.toFixed(1)}px ${cast.y.toFixed(1)}px 2.5px rgba(2, 6, 23, ${alpha.toFixed(2)}))` };
  // The brighter foliage sits on the side the light comes from.
  const [dark, mid, bright] = ground.leaves;
  const leaf: Record<Foliage, string> = { dark, mid, left: light.x < 0 ? bright : mid, right: light.x < 0 ? mid : bright };
  const rim = 0.55 * light.intensity * (0.4 + 0.6 * light.strength);
  return (
    <div className="absolute inset-x-0 bottom-0 h-56 sm:h-72 md:h-96">
      <Layer depth={6}>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="h-full w-full">
          <defs><Lit id="login-ridge-back" color={ground.far} look={look} /></defs>
          <path d={BACK} fill="url(#login-ridge-back)" />
        </svg>
      </Layer>
      <Layer depth={10}>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="h-full w-full">
          <defs><Lit id="login-ridge-mid" color={ground.near} look={look} /></defs>
          <path d={MID} fill="url(#login-ridge-mid)" />
        </svg>
        {TREES.map(({ at, box, trunk: [x, y, height], circles, points }) => (
          // The foot sits a pixel into the ridge so no sliver of sky shows under the trunk.
          <div key={at} data-tree className="absolute" style={{ left: `${at}%`, bottom: `${footAt(at)}%`, transform: 'translate(-50%, 1px)' }}>
            <svg viewBox={box} className="block h-[clamp(3rem,5.2vw,6.5rem)] w-auto overflow-visible" style={treeShadow}>
              <rect x={x} y={y} width="4" height={height} rx="1" fill={ground.trunk} />
              {circles?.map(([cx, cy, r, tone]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={leaf[tone]} />)}
              {points?.map(([list, tone]) => <polygon key={list} points={list} fill={leaf[tone]} />)}
            </svg>
          </div>
        ))}
      </Layer>
      <Layer depth={14}>
        <svg viewBox="0 0 1440 320" preserveAspectRatio="none" className="absolute bottom-0 h-[62%] w-full animate-mountain-wave">
          <defs>
            <Lit id="login-hill" color={ground.hill} look={look} />
            <linearGradient id="login-hill-shade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#020617" stopOpacity="0" />
              <stop offset="100%" stopColor="#020617" stopOpacity={0.2 + 0.25 * shade} />
            </linearGradient>
            {/* A thin rim of light along the ridge, strongest where the light is. */}
            <linearGradient id="login-hill-rim" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0" stopColor={ground.rim} stopOpacity="0.04" />
              <stop offset={light.at} stopColor={ground.rim} stopOpacity={rim} />
              <stop offset="1" stopColor={ground.rim} stopOpacity="0.04" />
            </linearGradient>
          </defs>
          <path fill="url(#login-hill)" d={`${HILL} L1440,320 L0,320 Z`} />
          <path fill="url(#login-hill-shade)" d={`${HILL} L1440,320 L0,320 Z`} />
          <path fill="none" stroke="url(#login-hill-rim)" strokeWidth="3" vectorEffect="non-scaling-stroke" d={HILL} />
        </svg>
      </Layer>
    </div>
  );
};
