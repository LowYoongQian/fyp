// The sign-in sky's one clock. Everything on the page (sky, sun and moon, stars, clouds, hills, trees, shadows, even the card's shadow) is a
// pure function of the campus hour, so colours and light never disagree and nothing changes in a single step. The drawing lives in Login.tsx.

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

// ---- Colour ------------------------------------------------------------------------------------------------------

const channels = (hex: string): number[] => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = (values: number[]) => `#${values.map(value => Math.round(clamp(value, 0, 255)).toString(16).padStart(2, '0')).join('')}`;
export const mix = (a: string, b: string, t: number) => { const p = channels(a), q = channels(b); return toHex(p.map((value, i) => lerp(value, q[i], t))); };
/** A colour as seen under light of a given colour and strength: every channel is scaled by the light's own channel. */
export const lit = (color: string, light: string, strength: number) => { const c = channels(color), l = channels(light); return toHex(c.map((value, i) => value * strength * (l[i] / 255))); };
const luma = (hex: string) => { const [r, g, b] = channels(hex); return (0.299 * r + 0.587 * g + 0.114 * b) / 255; };
export const withAlpha = (hex: string, alpha: number) => `rgba(${channels(hex).join(', ')}, ${alpha.toFixed(3)})`;

// ---- Curves over the hour ----------------------------------------------------------------------------------------

type Curve = readonly (readonly [number, number])[];
const along = (curve: Curve, hour: number) => {
  if (hour <= curve[0][0]) return curve[0][1];
  for (let i = 1; i < curve.length; i++) {
    if (hour <= curve[i][0]) { const [h0, v0] = curve[i - 1], [h1, v1] = curve[i]; return lerp(v0, v1, (hour - h0) / (h1 - h0)); }
  }
  return curve[curve.length - 1][1];
};

const SUN_UP = 5.25, SUN_DOWN = 19.5;
const SUN: Curve = [[4.9, 0], [5.5, 1], [19, 1], [19.7, 0]];                                     // opacity: the disc is mostly behind the hills at both ends
const MOON: Curve = [[0, 1], [4.4, 1], [5.3, 0], [19.5, 0], [20.3, 1], [24, 1]];
const STARS: Curve = [[0, 1], [4.2, 1], [4.8, 0.85], [5.25, 0.5], [5.75, 0.12], [6.3, 0], [19.1, 0], [19.3, 0.3], [19.8, 0.62], [20.4, 0.9], [21.2, 1], [24, 1]];
const TWILIGHT: Curve = [[4.2, 0], [4.9, 0.55], [5.4, 0.7], [6, 0.35], [6.8, 0], [17.6, 0], [18.4, 0.35], [19.1, 0.65], [19.7, 0.55], [20.3, 0.2], [20.9, 0]];
const CLOUDS: Curve = [[4.4, 0], [5.4, 0.9], [6.4, 1], [11.75, 1], [12, 0], [12.5, 0], [12.75, 1], [19.3, 1], [19.9, 0.5], [20.6, 0]];   // clear at noon, as before
const BIRDS: Curve = [[5.2, 0], [5.9, 1], [18.6, 1], [19.4, 0]];

/** Sky keyframes: three sky colours (top, middle, horizon), the horizon glow, and how brightly and in what colour the ground is lit. */
type Key = { h: number; top: string; mid: string; bot: string; glow: [string, number]; bright: number; tint: string; shade: number };
const KEYS: Key[] = [
  { h: 0,     top: '#030712', mid: '#0B0F29', bot: '#111827', glow: ['#38BDF8', 0.10], bright: 0.26, tint: '#9BB2FF', shade: 0.35 },
  { h: 4.2,   top: '#050719', mid: '#0E1133', bot: '#161B3D', glow: ['#60A5FA', 0.14], bright: 0.26, tint: '#9BB2FF', shade: 0.35 },
  { h: 4.8,   top: '#0B1440', mid: '#1B2766', bot: '#3A4A8F', glow: ['#818CF8', 0.26], bright: 0.34, tint: '#A9B8F2', shade: 0.40 },   // first blue
  { h: 5.25,  top: '#1F2A6B', mid: '#5B5AA6', bot: '#C79BC6', glow: ['#F4ACC4', 0.40], bright: 0.52, tint: '#E8B7D4', shade: 0.60 },   // lavender
  { h: 5.75,  top: '#3F62AE', mid: '#A9A6D8', bot: '#FFC9A3', glow: ['#FFBE8C', 0.55], bright: 0.78, tint: '#FFC59A', shade: 0.85 },   // soft peach
  { h: 6.6,   top: '#2F86D0', mid: '#7DBEEA', bot: '#FCDDBF', glow: ['#FFE2AA', 0.55], bright: 0.93, tint: '#FFE2BE', shade: 0.66 },
  { h: 9.5,   top: '#0284C7', mid: '#38BDF8', bot: '#BAE6FD', glow: ['#FEF08A', 0.45], bright: 1,    tint: '#FFF6E0', shade: 0.35 },
  { h: 12,    top: '#0369A1', mid: '#0284C7', bot: '#7DD3FC', glow: ['#FFFFFF', 0.55], bright: 1,    tint: '#FFFFFF', shade: 0.22 },
  { h: 16.5,  top: '#0284C7', mid: '#38BDF8', bot: '#FDD6A8', glow: ['#FFC88C', 0.45], bright: 0.96, tint: '#FFF0D6', shade: 0.45 },
  { h: 17.8,  top: '#2F7FCB', mid: '#8DB4E6', bot: '#FFCFA6', glow: ['#FFBE8C', 0.55], bright: 0.82, tint: '#FFD2A8', shade: 0.70 },   // peach begins low on the horizon
  { h: 18.7,  top: '#4A5FB0', mid: '#A08FCF', bot: '#FFB694', glow: ['#FFAA82', 0.60], bright: 0.62, tint: '#FFBE98', shade: 0.85 },   // peach and lavender, sun low
  { h: 19.35, top: '#3B3F96', mid: '#7C69B6', bot: '#E6A5BA', glow: ['#ECA0BE', 0.45], bright: 0.42, tint: '#F2B0C4', shade: 0.70 },   // lavender
  { h: 19.85, top: '#1C2768', mid: '#343F8F', bot: '#6C69AD', glow: ['#818CF8', 0.30], bright: 0.30, tint: '#B5B8F0', shade: 0.50 },   // blue, before night
  { h: 20.5,  top: '#0D1443', mid: '#1A2260', bot: '#333C80', glow: ['#6366F1', 0.22], bright: 0.27, tint: '#9FB2F8', shade: 0.40 },
  { h: 21.3,  top: '#090D2A', mid: '#161B40', bot: '#202656', glow: ['#6366F1', 0.18], bright: 0.26, tint: '#9BB2FF', shade: 0.35 },
  { h: 24,    top: '#030712', mid: '#0B0F29', bot: '#111827', glow: ['#38BDF8', 0.10], bright: 0.26, tint: '#9BB2FF', shade: 0.35 },
];

// ---- The sun and moon's paths ------------------------------------------------------------------------------------

/** A body on its arc across the sky, in % of the scene. `elevation` is 0 on the horizon and 1 at the top of its path. */
export type Arc = { left: number; top: number; elevation: number };

// On a phone the form fills the screen, so both bodies travel a shallow arc through the band of sky above it instead of the wide desktop sweep.
const arc = (progress: number, compact: boolean): Arc => {
  const lift = Math.sin(progress * Math.PI);
  return compact ? { left: 36 + progress * 28, top: 13 - lift * 7, elevation: lift } : { left: 5 + progress * 90, top: 84 - lift * 74, elevation: lift };
};
const sunArc = (hour: number, compact: boolean) => arc(clamp((hour - SUN_UP) / (SUN_DOWN - SUN_UP)), compact);
const moonArc = (hour: number, compact: boolean) => arc(clamp((hour >= SUN_DOWN ? hour - SUN_DOWN : hour + 24 - SUN_DOWN) / (24 - SUN_DOWN + SUN_UP)), compact);

// ---- Light -------------------------------------------------------------------------------------------------------

/**
 * The single light on the scene. (x, y) points from the scene toward the light in screen terms (y is negative when it comes from above);
 * `strength` is how one-sided it is (a high sun lights evenly, a low one rakes across), `intensity` how bright, and `at` is where along the
 * width (0 to 1) it is strongest. The sun, the glow of the horizon after it sets or before it rises, and the moon all feed one blend, so the
 * direction turns smoothly through dusk and dawn instead of flipping.
 */
export type Light = { x: number; y: number; strength: number; intensity: number; at: number; left: number; top: number };
// `left` / `top`: where the light comes from, in % of the scene (the sun, the moon, or the glow where the sun has just set or is about to
// rise, blended like the direction). Each object lights itself from its own position toward this point, so a cloud on the far side of the
// sun is lit from the other side, and every tree casts its shadow its own way.

const direction = (body: Arc) => { const side = clamp((body.left - 50) / 45, -1, 1), angle = body.elevation * 1.25; return [side * Math.cos(angle), -Math.sin(angle)]; };

const lightAt = (hour: number, compact: boolean): Light => {
  const sun = sunArc(hour, compact), moon = moonArc(hour, compact);
  const sources = [
    { w: along(SUN, hour) * (0.55 + 0.45 * sun.elevation), d: direction(sun), at: sun.left / 100, pos: [sun.left, sun.top] },
    // the glow where the sun is, just beyond the horizon
    { w: along(TWILIGHT, hour), d: [hour < 12 ? -0.998 : 0.998, -0.06], at: hour < 12 ? 0.02 : 0.98, pos: [hour < 12 ? 2 : 98, 97] },
    { w: along(MOON, hour) * 0.5 * (0.7 + 0.3 * moon.elevation), d: direction(moon), at: moon.left / 100, pos: [moon.left, moon.top] },
  ];
  const total = sources.reduce((sum, item) => sum + item.w, 0);
  if (total < 1e-4) return { x: 0, y: -1, strength: 0, intensity: 0, at: 0.5, left: 50, top: -40 };
  const x = sources.reduce((sum, item) => sum + item.w * item.d[0], 0) / total, y = sources.reduce((sum, item) => sum + item.w * item.d[1], 0) / total;
  // Where the light comes from: the sun's own disc while it is up; the glow beyond the horizon takes over only as the disc goes, so shadows
  // always point away from the sun that is actually on screen.
  const disc = along(SUN, hour), place = sources.map((item, i) => i === 1 ? item.w * (1 - disc) : item.w);
  const placed = place.reduce((sum, w) => sum + w, 0) || 1;
  const blend = (i: 0 | 1) => sources.reduce((sum, item, n) => sum + place[n] * item.pos[i], 0) / placed;
  return { x, y, strength: clamp(Math.hypot(x, y)), intensity: clamp(total), at: sources.reduce((sum, item) => sum + item.w * item.at, 0) / total,
    left: blend(0), top: blend(1) };
};

/**
 * The direction from a point of the scene (in % of its width and height) toward the light, as a unit vector in screen terms
 * (y negative when the light is above). The scene's size in pixels keeps the angle true on a wide or a tall screen.
 */
export const towardLight = (light: Light, x: number, y: number, width: number, height: number) => {
  const dx = ((light.left - x) / 100) * width, dy = ((light.top - y) / 100) * height;
  const length = Math.hypot(dx, dy) || 1;
  return { lx: dx / length, ly: dy / length };
};

/** The sun's disc colours: pale and bright high up, soft peach at the horizon (never a hard red). */
export const sunColors = (elevation: number) => {
  const warmth = clamp(1.15 - elevation * 1.9);   // peach below about a quarter of the way up, white-gold above half way
  return { core: mix('#FFFDF2', '#FFE5C2', warmth), mid: mix('#FDE68A', '#FFBE84', warmth), edge: mix('#FBBF24', '#FF9B62', warmth), glow: mix('#FBBF24', '#FF9B62', warmth) };
};

// ---- The look at one moment --------------------------------------------------------------------------------------

export type Look = {
  hour: number;
  sky: { gradient: string; top: string; mid: string; bottom: string; glow: string; tint: string };
  sun: Arc & { opacity: number };
  moon: Arc & { opacity: number };
  stars: number;
  clouds: number;
  birds: number;
  light: Light;
  /** How dense and dark shadows are, 0 to 1. */
  shade: number;
  /** 0 under a bright sky, 1 under a dark one; drives how solid the sign-in glass needs to be. */
  darkness: number;
  ground: { far: string; near: string; hill: string; shadow: string; rim: string; trunk: string; leaves: [string, string, string] };
  cloud: { lit: string; base: string; shade: string };
};

const ALBEDO = { far: '#2E9C86', near: '#27A06B', hill: '#1FA766', trunk: '#3F2F25', leaves: ['#13794F', '#18935F', '#23AE70'] as const };

export const lookAt = (hourInput: number, compact = false): Look => {
  const hour = clamp(hourInput, 0, 24);
  let i = 1;
  while (i < KEYS.length - 1 && hour > KEYS[i].h) i++;
  const a = KEYS[i - 1], b = KEYS[i], t = clamp((hour - a.h) / (b.h - a.h));
  const top = mix(a.top, b.top, t), mid = mix(a.mid, b.mid, t), bot = mix(a.bot, b.bot, t), tint = mix(a.tint, b.tint, t);
  const bright = lerp(a.bright, b.bright, t), shade = lerp(a.shade, b.shade, t);
  const sunPos = sunArc(hour, compact), moonPos = moonArc(hour, compact);
  const light = lightAt(hour, compact);
  const shadow = mix('#07122A', top, 0.3);   // the cool colour that shade falls toward
  const haze = (color: string, amount: number) => mix(lit(color, tint, bright), bot, amount);   // far things take on the colour of the horizon
  return {
    hour,
    sky: { gradient: `linear-gradient(to bottom, ${top} 0%, ${mid} 45%, ${bot} 100%)`, bottom: bot, top, mid, glow: withAlpha(mix(a.glow[0], b.glow[0], t), lerp(a.glow[1], b.glow[1], t)), tint },
    sun: { ...sunPos, opacity: along(SUN, hour) },
    moon: { ...moonPos, opacity: along(MOON, hour) },
    stars: along(STARS, hour), clouds: along(CLOUDS, hour), birds: along(BIRDS, hour),
    light, shade,
    darkness: clamp(1 - (0.3 * luma(top) + 0.4 * luma(mid) + 0.3 * luma(bot) - 0.07) / 0.38),   // from the sky the form sits over: its top, middle and horizon
    ground: {
      far: haze(ALBEDO.far, 0.32), near: haze(ALBEDO.near, 0.1), hill: lit(ALBEDO.hill, tint, bright), shadow,
      rim: mix(tint, '#FFFFFF', 0.4), trunk: lit(ALBEDO.trunk, tint, bright),
      leaves: ALBEDO.leaves.map(color => lit(color, tint, bright)) as [string, string, string],
    },
    cloud: { lit: lit('#FFFFFF', tint, 0.62 + 0.38 * bright), base: mix(lit('#F1F5F9', tint, 0.55 + 0.45 * bright), mid, 0.18), shade: mix(lit('#CBD5E1', tint, 0.5 + 0.5 * bright), top, 0.3 + 0.3 * shade) },
  };
};

/**
 * Where an upright thing's shadow falls, given its own direction to the light (from `towardLight`). The scene looks toward the sky the light is
 * in, so a shadow is cast on the ground toward the viewer (down the screen) and to the side away from the light: short and nearly under it when
 * the light stands high, long and slanting when it is low. A point `h` above the foot lands `h * slant` sideways and `h * length` down.
 */
export const castShadow = (lx: number, ly: number) => {
  const up = clamp(-ly, 0.12, 1);                                  // how high the light stands over it (0 = on the horizon)
  const length = clamp(0.12 + (0.42 * (1 - up)) / Math.max(up, 0.35), 0.12, 0.62);
  const slant = clamp((-lx / up) * 0.55, -1.9, 1.9);              // away from the light
  return { length, slant };
};

/** The darkness of a shadow, from how dense the air makes shade and how much light there is to cast one. */
export const shadowAlpha = (look: Look) => clamp(0.12 + look.shade * 0.34 * (0.35 + 0.65 * look.light.intensity), 0, 0.6);
