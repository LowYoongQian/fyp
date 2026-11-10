import React, { useEffect, useRef, useState } from 'react';
import { castShadow, mix, shadowAlpha, towardLight, type Look } from './loginLighting';
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

/** The top of a tree's crown, in its own drawing units (the shadow is as long as the tree is tall). */
const crownTop = ({ circles, points }: Tree) => Math.min(
  ...(circles ?? []).map(([, cy, r]) => cy - r),
  ...(points ?? []).flatMap(([list]) => list.split(' ').map(pair => Number(pair.split(',')[1]))),
);

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
  const alpha = shadowAlpha(look) * (0.45 + 0.55 * light.intensity);
  const [dark, mid, bright] = ground.leaves;
  const rim = 0.55 * light.intensity * (0.4 + 0.6 * light.strength);
  // The stage's size and the land's height, so each tree's angle to the light is the true one on any screen (read again on resize).
  const land = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 1280, height: 800, land: 384 });
  useEffect(() => {
    const read = () => {
      const node = land.current, stage = node?.closest('[data-login-stage]');
      if (node && stage) setSize({ width: stage.clientWidth, height: stage.clientHeight, land: node.clientHeight });
    };
    read();
    window.addEventListener('resize', read);
    return () => window.removeEventListener('resize', read);
  }, []);
  return (
    <div ref={land} className="absolute inset-x-0 bottom-0 h-56 sm:h-72 md:h-96">
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
        {TREES.map(tree => {
          const { at, box, trunk: [x, y, height], circles, points } = tree;
          // This tree's own direction to the light: a tree left of the sun is lit from its right, one right of it from its left.
          const footY = 100 - ((footAt(at) / 100) * size.land / size.height) * 100;
          const { lx, ly } = towardLight(light, at, footY, size.width, size.height);
          const lightFromRight = lx > 0;
          const leaf: Record<Foliage, string> = { dark, mid, left: lightFromRight ? mid : bright, right: lightFromRight ? bright : mid };
          const fx = x + 2, fy = y + height, tall = fy - crownTop(tree);
          const { length, slant } = castShadow(lx, ly);
          const lay = `matrix(1 0 ${(-slant).toFixed(3)} ${(-length).toFixed(3)} ${(slant * fy).toFixed(2)} ${((1 + length) * fy).toFixed(2)})`;
          const id = `login-tree-${String(at).replace('.', '-')}`;
          const silhouette = <>
            <rect x={x} y={y} width="4" height={height} />
            {circles?.map(([cx, cy, r]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} />)}
            {points?.map(([list]) => <polygon key={list} points={list} />)}
          </>;
          return (
            // The foot sits a pixel into the ridge so no sliver of sky shows under the trunk.
            <div key={at} data-tree className="absolute" style={{ left: `${at}%`, bottom: `${footAt(at)}%`, transform: 'translate(-50%, 1px)' }}>
              <svg viewBox={box} className="block h-[clamp(3rem,5.2vw,6.5rem)] w-auto overflow-visible">
                <defs>
                  {/* Darkest at the foot, fading toward the far end; slightly soft-edged. */}
                  <linearGradient id={`${id}-shadow`} gradientUnits="userSpaceOnUse" x1={fx} y1={fy} x2={fx + slant * tall} y2={fy + length * tall}>
                    <stop offset="0" stopColor={ground.shadow} stopOpacity={alpha.toFixed(3)} />
                    <stop offset="1" stopColor={ground.shadow} stopOpacity={(alpha * 0.3).toFixed(3)} />
                  </linearGradient>
                  <filter id={`${id}-soft`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.7" /></filter>
                </defs>
                {alpha > 0.01 && <g data-tree-shadow transform={lay} fill={`url(#${id}-shadow)`} filter={`url(#${id}-soft)`}>{silhouette}</g>}
                <rect x={x} y={y} width="4" height={height} rx="1" fill={ground.trunk} />
                {/* The trunk's side away from the light is in shade. */}
                <rect x={lightFromRight ? x : x + 2} y={y} width="2" height={height} rx="1" fill={ground.shadow} opacity={(0.35 * light.intensity * light.strength).toFixed(3)} />
                {circles?.map(([cx, cy, r, tone]) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={leaf[tone]} />)}
                {points?.map(([list, tone]) => <polygon key={list} points={list} fill={leaf[tone]} />)}
              </svg>
            </div>
          );
        })}
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
