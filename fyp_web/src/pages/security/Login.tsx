import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Key, Mail, AlertCircle, Sparkles, GraduationCap, CheckCircle2, Check } from 'lucide-react';
import { swalError, swalSuccess } from '../../utils/swal';
import Swal from 'sweetalert2';
import sasLogoLocal from '../../assets/saslogo.png';

export type SceneId = 'early_morning' | 'morning' | 'noon' | 'afternoon' | 'evening' | 'night' | 'late_night';

interface SceneData {
  id: SceneId;
  name: string;
  emoji: string;
  range: string;
  skyBg: string;
  sunGradient: string;
  sunShadow: string;
  backMountain: string;
  middleMountain: string;
  foreMountain: string;
  cloudOpacity: string;
  isNight: boolean;
}

const SCENES: Record<SceneId, SceneData> = {
  early_morning: {
    id: 'early_morning',
    name: 'Early Morning',
    emoji: '🌅',
    range: '5:00 AM – 8:00 AM',
    skyBg: 'from-amber-300 via-rose-300 to-sky-300 dark:from-slate-950 dark:via-rose-950/70 dark:to-slate-900',
    sunGradient: 'from-amber-500 via-orange-400 to-yellow-300',
    sunShadow: 'shadow-[0_0_90px_rgba(245,158,11,0.8)]',
    backMountain: 'text-rose-900/40 dark:text-rose-950/70',
    middleMountain: 'text-emerald-800/60 dark:text-emerald-950/80',
    foreMountain: 'text-emerald-600/80 dark:text-emerald-900/90',
    cloudOpacity: 'opacity-70',
    isNight: false,
  },
  morning: {
    id: 'morning',
    name: 'Morning',
    emoji: '☀️',
    range: '8:00 AM – 12:00 PM',
    skyBg: 'from-sky-400 via-sky-200 to-emerald-100 dark:from-slate-950 dark:via-teal-950/70 dark:to-slate-900',
    sunGradient: 'from-amber-400 via-yellow-300 to-amber-200',
    sunShadow: 'shadow-[0_0_80px_rgba(245,158,11,0.6)]',
    backMountain: 'text-emerald-800/40 dark:text-emerald-950/70',
    middleMountain: 'text-emerald-700/60 dark:text-emerald-900/80',
    foreMountain: 'text-emerald-600/90 dark:text-emerald-800/90',
    cloudOpacity: 'opacity-80',
    isNight: false,
  },
  noon: {
    id: 'noon',
    name: 'Noon (Midday)',
    emoji: '🕛',
    range: '12:00 PM – 12:30 PM',
    skyBg: 'from-sky-500 via-cyan-200 to-emerald-100 dark:from-slate-950 dark:via-cyan-950/80 dark:to-slate-900',
    sunGradient: 'from-yellow-200 via-amber-300 to-white',
    sunShadow: 'shadow-[0_0_110px_rgba(253,224,71,0.95)]',
    backMountain: 'text-emerald-800/50 dark:text-emerald-950/80',
    middleMountain: 'text-emerald-700/70 dark:text-emerald-900/90',
    foreMountain: 'text-emerald-500 dark:text-emerald-800',
    cloudOpacity: 'opacity-90',
    isNight: false,
  },
  afternoon: {
    id: 'afternoon',
    name: 'Afternoon',
    emoji: '🌤️',
    range: '12:30 PM – 5:00 PM',
    skyBg: 'from-sky-400 via-amber-100 to-emerald-50 dark:from-slate-950 dark:via-emerald-950/60 dark:to-slate-900',
    sunGradient: 'from-amber-400 via-yellow-300 to-amber-200',
    sunShadow: 'shadow-[0_0_80px_rgba(245,158,11,0.6)]',
    backMountain: 'text-emerald-800/40 dark:text-emerald-950/70',
    middleMountain: 'text-emerald-700/60 dark:text-emerald-900/80',
    foreMountain: 'text-emerald-600/90 dark:text-emerald-800/90',
    cloudOpacity: 'opacity-70',
    isNight: false,
  },
  evening: {
    id: 'evening',
    name: 'Evening (Sunset)',
    emoji: '🌇',
    range: '5:00 PM – 8:00 PM',
    skyBg: 'from-purple-900 via-indigo-700 to-amber-500 dark:from-slate-950 dark:via-purple-950 dark:to-amber-950/70',
    sunGradient: 'from-rose-500 via-orange-500 to-amber-400',
    sunShadow: 'shadow-[0_0_100px_rgba(225,29,72,0.9)]',
    backMountain: 'text-purple-950/60 dark:text-purple-950/90',
    middleMountain: 'text-indigo-900/75 dark:text-indigo-950/90',
    foreMountain: 'text-emerald-800/90 dark:text-emerald-950',
    cloudOpacity: 'opacity-50',
    isNight: false,
  },
  night: {
    id: 'night',
    name: 'Night',
    emoji: '🌃',
    range: '8:00 PM – 12:00 AM',
    skyBg: 'from-slate-950 via-indigo-950 to-slate-900',
    sunGradient: 'from-slate-100 via-slate-200 to-slate-300',
    sunShadow: 'shadow-[0_0_70px_rgba(226,232,240,0.6)]',
    backMountain: 'text-slate-900 dark:text-slate-950',
    middleMountain: 'text-indigo-950 dark:text-slate-950',
    foreMountain: 'text-emerald-950 dark:text-slate-900',
    cloudOpacity: 'opacity-30',
    isNight: true,
  },
  late_night: {
    id: 'late_night',
    name: 'Late Night',
    emoji: '🌙',
    range: '12:00 AM – 5:00 AM',
    skyBg: 'from-slate-950 via-slate-900 to-indigo-950',
    sunGradient: 'from-slate-200 via-slate-100 to-blue-200',
    sunShadow: 'shadow-[0_0_60px_rgba(203,213,225,0.5)]',
    backMountain: 'text-slate-950 dark:text-slate-950',
    middleMountain: 'text-slate-900 dark:text-indigo-950',
    foreMountain: 'text-emerald-950 dark:text-slate-950',
    cloudOpacity: 'opacity-20',
    isNight: true,
  },
};

const getMalaysiaTimeDetails = () => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false,
  };
  const formatter = new Intl.DateTimeFormat([], options);
  const parts = formatter.formatToParts(now);
  let h = 0, m = 0, s = 0;
  for (const p of parts) {
    if (p.type === 'hour') h = parseInt(p.value, 10);
    if (p.type === 'minute') m = parseInt(p.value, 10);
    if (p.type === 'second') s = parseInt(p.value, 10);
  }

  const fractionalHour = h + m / 60 + s / 3600;

  const formattedTime = new Date().toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kuala_Lumpur',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  return { h, m, s, fractionalHour, formattedTime };
};

interface BirdFlockConfig {
  id: string;
  top: number;
  scale: number;
  speed: 'fast' | 'mid' | 'slow';
  delay: string;
  birdCount: number;
  dir?: 'ltr' | 'rtl';
}

const getBirdFlocksForScene = (sceneId: SceneId): BirdFlockConfig[] => {
  if (sceneId === 'night' || sceneId === 'late_night') {
    return []; // Animals are sleeping! Zero birds at night.
  }

  if (sceneId === 'early_morning') {
    return [
      { id: 'em1', top: 8, scale: 0.85, speed: 'fast', delay: '-8s', birdCount: 3, dir: 'ltr' },
      { id: 'em2', top: 18, scale: 0.65, speed: 'slow', delay: '-28s', birdCount: 3, dir: 'rtl' },
    ];
  }

  if (sceneId === 'morning') {
    return [
      { id: 'm1', top: 7, scale: 0.9, speed: 'fast', delay: '-5s', birdCount: 5, dir: 'ltr' },
      { id: 'm2', top: 15, scale: 0.75, speed: 'mid', delay: '-22s', birdCount: 4, dir: 'rtl' },
      { id: 'm3', top: 22, scale: 0.55, speed: 'slow', delay: '-40s', birdCount: 3, dir: 'ltr' },
      { id: 'm4', top: 11, scale: 0.6, speed: 'mid', delay: '-14s', birdCount: 3, dir: 'rtl' },
    ];
  }

  if (sceneId === 'noon') {
    // Noon (Midday): Highly frequent active bird traffic coming & going in both directions!
    return [
      { id: 'n1', top: 7, scale: 0.9, speed: 'fast', delay: '-3s', birdCount: 4, dir: 'ltr' },
      { id: 'n2', top: 13, scale: 0.75, speed: 'mid', delay: '-15s', birdCount: 4, dir: 'rtl' },
      { id: 'n3', top: 19, scale: 0.85, speed: 'fast', delay: '-26s', birdCount: 5, dir: 'ltr' },
      { id: 'n4', top: 24, scale: 0.6, speed: 'mid', delay: '-38s', birdCount: 3, dir: 'rtl' },
      { id: 'n5', top: 10, scale: 0.7, speed: 'fast', delay: '-48s', birdCount: 4, dir: 'rtl' },
      { id: 'n6', top: 16, scale: 0.5, speed: 'slow', delay: '-10s', birdCount: 3, dir: 'ltr' },
    ];
  }

  if (sceneId === 'afternoon') {
    return [
      { id: 'a1', top: 9, scale: 0.8, speed: 'mid', delay: '-10s', birdCount: 3, dir: 'ltr' },
      { id: 'a2', top: 19, scale: 0.6, speed: 'slow', delay: '-32s', birdCount: 3, dir: 'rtl' },
      { id: 'a3', top: 14, scale: 0.7, speed: 'fast', delay: '-24s', birdCount: 4, dir: 'ltr' },
    ];
  }

  if (sceneId === 'evening') {
    // Evening (Sunset): ALL BIRDS returning home (Right to Left)!
    return [
      { id: 'e1', top: 6, scale: 1.0, speed: 'fast', delay: '-6s', birdCount: 6, dir: 'rtl' },
      { id: 'e2', top: 13, scale: 0.85, speed: 'mid', delay: '-18s', birdCount: 5, dir: 'rtl' },
      { id: 'e3', top: 20, scale: 0.65, speed: 'mid', delay: '-34s', birdCount: 4, dir: 'rtl' },
      { id: 'e4', top: 25, scale: 0.5, speed: 'slow', delay: '-48s', birdCount: 3, dir: 'rtl' },
    ];
  }

  return [];
};

interface CloudConfig {
  id: string;
  top: number;
  scale: number;
  dir: 'ltr' | 'rtl';
  speed: 'slow' | 'mid' | 'fast';
  delay: string;
  opacity: string;
}

const getCloudsForScene = (sceneId: SceneId): CloudConfig[] => {
  if (sceneId === 'night' || sceneId === 'late_night' || sceneId === 'noon') {
    return []; // ZERO clouds at Night, Late Night, and Noon!
  }

  if (sceneId === 'early_morning') {
    return [
      { id: 'em1', top: 5, scale: 0.9, dir: 'ltr', speed: 'slow', delay: '-14s', opacity: 'opacity-70' },
      { id: 'em2', top: 14, scale: 1.15, dir: 'rtl', speed: 'mid', delay: '-38s', opacity: 'opacity-80' },
      { id: 'em3', top: 22, scale: 0.75, dir: 'ltr', speed: 'slow', delay: '-60s', opacity: 'opacity-65' },
      { id: 'em4', top: 9, scale: 1.0, dir: 'rtl', speed: 'mid', delay: '-22s', opacity: 'opacity-75' },
    ];
  }

  if (sceneId === 'morning') {
    return [
      { id: 'm1', top: 7, scale: 0.9, dir: 'ltr', speed: 'slow', delay: '-18s', opacity: 'opacity-70' },
      { id: 'm2', top: 17, scale: 1.1, dir: 'rtl', speed: 'mid', delay: '-45s', opacity: 'opacity-75' },
    ];
  }

  if (sceneId === 'afternoon') {
    return [
      { id: 'a1', top: 8, scale: 0.95, dir: 'rtl', speed: 'mid', delay: '-15s', opacity: 'opacity-75' },
      { id: 'a2', top: 19, scale: 0.8, dir: 'ltr', speed: 'slow', delay: '-52s', opacity: 'opacity-65' },
    ];
  }

  if (sceneId === 'evening') {
    return [
      { id: 'e1', top: 5, scale: 1.2, dir: 'ltr', speed: 'mid', delay: '-10s', opacity: 'opacity-80' },
      { id: 'e2', top: 12, scale: 0.85, dir: 'rtl', speed: 'slow', delay: '-32s', opacity: 'opacity-70' },
      { id: 'e3', top: 21, scale: 1.05, dir: 'ltr', speed: 'mid', delay: '-55s', opacity: 'opacity-75' },
      { id: 'e4', top: 16, scale: 0.8, dir: 'rtl', speed: 'slow', delay: '-24s', opacity: 'opacity-65' },
    ];
  }

  return [];
};

export type CosmicObjectType = 'saturn' | 'ice_giant' | 'crimson_planet' | 'black_hole' | 'crater_moonlet';
export type PlanetColorVariant = 'amber' | 'purple' | 'cyan' | 'emerald' | 'rose' | 'copper';

export interface CosmicObjectConfig {
  id: string;
  type: CosmicObjectType;
  top: number;
  left: number;
  size: number;
  opacity: number;
  driftDuration: number;
  ringAngle?: number;
  colorVariant: PlanetColorVariant;
}

const getColorVariantGradients = (variant: PlanetColorVariant) => {
  switch (variant) {
    case 'purple':
      return {
        stop1: '#F5D0FE',
        stop2: '#C084FC',
        stop3: '#581C87',
        ring1: '#E9D5FF',
        ring2: '#A855F7',
        shadow: 'rgba(168,85,247,0.55)',
      };
    case 'cyan':
      return {
        stop1: '#E0F2FE',
        stop2: '#38BDF8',
        stop3: '#0369A1',
        ring1: '#BAE6FD',
        ring2: '#0284C7',
        shadow: 'rgba(56,189,248,0.55)',
      };
    case 'emerald':
      return {
        stop1: '#D1FAE5',
        stop2: '#34D399',
        stop3: '#065F46',
        ring1: '#A7F3D0',
        ring2: '#059669',
        shadow: 'rgba(52,211,153,0.55)',
      };
    case 'rose':
      return {
        stop1: '#FFE4E6',
        stop2: '#FB7185',
        stop3: '#9F1239',
        ring1: '#FECDD3',
        ring2: '#E11D48',
        shadow: 'rgba(251,113,133,0.55)',
      };
    case 'copper':
      return {
        stop1: '#FFEDD5',
        stop2: '#FB923C',
        stop3: '#7C2D12',
        ring1: '#FED7AA',
        ring2: '#EA580C',
        shadow: 'rgba(251,146,60,0.55)',
      };
    case 'amber':
    default:
      return {
        stop1: '#FEF08A',
        stop2: '#F59E0B',
        stop3: '#78350F',
        ring1: '#FDE047',
        ring2: '#D97706',
        shadow: 'rgba(245,158,11,0.55)',
      };
  }
};

const generateRandomCosmicObjects = (): CosmicObjectConfig[] => {
  const planetTypes: CosmicObjectType[] = ['saturn', 'ice_giant', 'crimson_planet', 'crater_moonlet'];
  const variants: PlanetColorVariant[] = ['amber', 'purple', 'cyan', 'emerald', 'rose', 'copper'];

  const selectedTypes: CosmicObjectType[] = [
    'black_hole', // STRICTLY EXACTLY 1 Black Hole
    'saturn',
    planetTypes[Math.floor(Math.random() * planetTypes.length)],
    planetTypes[Math.floor(Math.random() * planetTypes.length)],
  ];

  const generated: CosmicObjectConfig[] = [];

  // Quadrant zones to guarantee wide spatial separation across the sky canvas
  const quadrantZones = [
    { minLeft: 4, maxLeft: 28, minTop: 6, maxTop: 20 },
    { minLeft: 68, maxLeft: 90, minTop: 6, maxTop: 20 },
    { minLeft: 4, maxLeft: 28, minTop: 25, maxTop: 42 },
    { minLeft: 68, maxLeft: 90, minTop: 25, maxTop: 42 },
  ];

  // Shuffle quadrant zones for varied celestial placement
  const shuffledZones = [...quadrantZones].sort(() => Math.random() - 0.5);

  selectedTypes.forEach((type, idx) => {
    const zone = shuffledZones[idx];
    let top = Math.floor(zone.minTop + Math.random() * (zone.maxTop - zone.minTop));
    let left = Math.floor(zone.minLeft + Math.random() * (zone.maxLeft - zone.minLeft));

    // Spatial Exclusion Check: Guarantee minimum 18% distance separation between all celestial bodies
    let retries = 0;
    while (retries < 25) {
      const isTooClose = generated.some(existing => {
        const dL = left - existing.left;
        const dT = top - existing.top;
        return Math.sqrt(dL * dL + dT * dT) < 18;
      });

      if (!isTooClose) break;

      top = Math.floor(zone.minTop + Math.random() * (zone.maxTop - zone.minTop));
      left = Math.floor(zone.minLeft + Math.random() * (zone.maxLeft - zone.minLeft));
      retries++;
    }

    const colorVariant = variants[Math.floor(Math.random() * variants.length)];

    generated.push({
      id: `cosmic_${idx}_${Math.random().toString(36).substring(2, 7)}`,
      type,
      top,
      left,
      size: type === 'black_hole' ? 54 : Math.floor(34 + Math.random() * 22),
      opacity: parseFloat((0.80 + Math.random() * 0.18).toFixed(2)),
      driftDuration: Math.floor(120 + Math.random() * 60),
      ringAngle: Math.floor(-30 + Math.random() * 60),
      colorVariant,
    });
  });

  return generated;
};

export interface ConstellationPattern {
  id: string;
  name: string;
  latinName: string;
  nodes: { x: number; y: number }[];
  edges: [number, number][];
}

export const CONSTELLATIONS: ConstellationPattern[] = [
  {
    id: 'dipper',
    name: 'Big Dipper',
    latinName: 'Ursa Major',
    nodes: [
      { x: 12, y: 35 }, { x: 28, y: 48 }, { x: 44, y: 42 }, { x: 58, y: 58 },
      { x: 62, y: 82 }, { x: 88, y: 80 }, { x: 84, y: 52 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 3]],
  },
  {
    id: 'cassiopeia',
    name: 'Cassiopeia',
    latinName: 'Queen Cassiopeia (W)',
    nodes: [
      { x: 10, y: 25 }, { x: 30, y: 68 }, { x: 50, y: 35 }, { x: 74, y: 76 }, { x: 92, y: 28 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 4]],
  },
  {
    id: 'orion',
    name: 'Orion Belt',
    latinName: 'Orion the Hunter',
    nodes: [
      { x: 25, y: 15 }, { x: 75, y: 15 },
      { x: 38, y: 50 }, { x: 50, y: 50 }, { x: 62, y: 50 },
      { x: 20, y: 85 }, { x: 80, y: 85 },
    ],
    edges: [[0, 2], [1, 4], [2, 3], [3, 4], [2, 5], [4, 6], [0, 1], [5, 6]],
  },
  {
    id: 'cygnus',
    name: 'Cygnus Swan',
    latinName: 'Northern Cross',
    nodes: [
      { x: 50, y: 10 }, { x: 50, y: 45 }, { x: 50, y: 85 },
      { x: 15, y: 45 }, { x: 85, y: 45 },
    ],
    edges: [[0, 1], [1, 2], [3, 1], [1, 4]],
  },
  {
    id: 'phoenix',
    name: 'Phoenix Bird',
    latinName: 'Celestial Phoenix',
    nodes: [
      { x: 50, y: 15 }, { x: 50, y: 45 }, { x: 50, y: 80 },
      { x: 20, y: 55 }, { x: 80, y: 55 }, { x: 10, y: 35 }, { x: 90, y: 35 },
    ],
    edges: [[0, 1], [1, 2], [1, 3], [1, 4], [3, 5], [4, 6]],
  },
  {
    id: 'pegasus',
    name: 'Pegasus Square',
    latinName: 'Great Pegasus',
    nodes: [
      { x: 25, y: 25 }, { x: 75, y: 25 }, { x: 80, y: 75 }, { x: 20, y: 70 },
      { x: 92, y: 40 }, { x: 10, y: 88 },
    ],
    edges: [[0, 1], [1, 2], [2, 3], [3, 0], [1, 4], [3, 5]],
  },
];

export interface ConstellationNodeOffset {
  startDx: number;
  startDy: number;
  endDx: number;
  endDy: number;
}

export interface ActiveConstellationState {
  pattern: ConstellationPattern;
  top: number;
  left: number;
  size: number;
  offsets: ConstellationNodeOffset[];
  phase: 'appearing' | 'arranging' | 'linking' | 'linked' | 'unlinking' | 'disappearing';
}

interface DynamicStar {
  id: string;
  top: number;
  left: number;
  size: number;
  delay: number;
  duration: number;
  type: 'sparkle' | 'dot' | 'cross';
}

const isTooCloseToCosmicObject = (top: number, left: number, cosmicObjects: CosmicObjectConfig[]): boolean => {
  return cosmicObjects.some(obj => {
    const dTop = top - obj.top;
    const dLeft = left - obj.left;
    const dist = Math.sqrt(dTop * dTop + dLeft * dLeft);
    return dist < 9.0; // 9% spatial clearance radius around planets & black holes
  });
};

const generateRandomStars = (count: number, isNightSlow: boolean = false, cosmicObjects: CosmicObjectConfig[] = []): DynamicStar[] => {
  const types: ('sparkle' | 'dot' | 'cross')[] = ['sparkle', 'sparkle', 'sparkle', 'dot', 'cross'];
  const stars: DynamicStar[] = [];

  let attempts = 0;
  while (stars.length < count && attempts < count * 4) {
    attempts++;
    const top = Math.floor(Math.random() * 60) + 4;
    const left = Math.floor(Math.random() * 92) + 4;

    if (cosmicObjects.length > 0 && isTooCloseToCosmicObject(top, left, cosmicObjects)) {
      continue; // Skip if candidate position overlaps with a planet or black hole
    }

    const starType = types[stars.length % types.length];
    const minDur = isNightSlow ? 5.5 : 3.0;
    const maxAdd = isNightSlow ? 4.0 : 2.0;

    stars.push({
      id: `star-${stars.length}-${Math.random().toString(36).substring(2, 7)}`,
      top,
      left,
      size: starType === 'dot' ? Math.floor(Math.random() * 3) + 4 : Math.floor(Math.random() * 6) + 10,
      delay: parseFloat((Math.random() * (isNightSlow ? 4 : 3)).toFixed(1)),
      duration: parseFloat((Math.random() * maxAdd + minDur).toFixed(1)),
      type: starType,
    });
  }

  return stars;
};

export const Login: React.FC = () => {
  const { login } = useAuth();
  
  // Real-Time Malaysia (UTC+8) Time State
  const [timeState, setTimeState] = useState(() => getMalaysiaTimeDetails());
  
  // Supabase Storage & Database System Logo with Local Asset Fallback
  const SUPABASE_LOGO_URL = 'https://iekqyzdevnzeohmiddjc.supabase.co/storage/v1/object/public/assets/saslogo.png';
  const [logoSrc, setLogoSrc] = useState<string>(SUPABASE_LOGO_URL);

  useEffect(() => {
    // Attempt fetching remote logo from API / Supabase setting
    fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/public/logo`)
      .then(res => res.json())
      .then(data => {
        if (data && data.logo_url) {
          setLogoSrc(data.logo_url);
        }
      })
      .catch(() => {
        setLogoSrc(sasLogoLocal);
      });
  }, []);

  const handleLogoError = () => {
    if (logoSrc !== sasLogoLocal) {
      setLogoSrc(sasLogoLocal);
    }
  };

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeState(getMalaysiaTimeDetails());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Portal Mode State with sessionStorage persistence across logouts
  const [portalMode, setPortalMode] = useState<'student' | 'staff'>(() => {
    const saved = sessionStorage.getItem('active_portal_mode');
    return saved === 'staff' ? 'staff' : 'student';
  });

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field Specific Validation States
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Remember Me State (Student Portal)
  const [rememberMe, setRememberMe] = useState<boolean>(() => {
    return localStorage.getItem('remember_me_student') === 'true';
  });

  useEffect(() => {
    const savedRemember = localStorage.getItem('remember_me_student') === 'true';
    const savedEmail = localStorage.getItem('remember_student_email');
    if (savedRemember && savedEmail && portalMode === 'student') {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  // Global UI States
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Active Hour from Live Malaysia Clock Time
  const activeHour = timeState.fractionalHour;

  // Derive active Scene ID from activeHour
  let computedSceneId: SceneId = 'morning';
  if (activeHour >= 4.9833 && activeHour < 7.9833) computedSceneId = 'early_morning';
  else if (activeHour >= 7.9833 && activeHour < 11.9833) computedSceneId = 'morning';
  else if (activeHour >= 11.9833 && activeHour < 12.4833) computedSceneId = 'noon';
  else if (activeHour >= 12.4833 && activeHour < 16.9833) computedSceneId = 'afternoon';
  else if (activeHour >= 16.9833 && activeHour < 19.9833) computedSceneId = 'evening';
  else if (activeHour >= 19.9833 && activeHour < 23.9833) computedSceneId = 'night';
  else computedSceneId = 'late_night';

  const activeSceneId = computedSceneId;
  const activeScene = SCENES[activeSceneId];

  const isNightSlow = activeSceneId === 'night';

  // Dynamic Night Cosmic Objects State (Generates fresh random planets & black hole layout each night)
  const [cosmicObjects, setCosmicObjects] = useState<CosmicObjectConfig[]>(() => generateRandomCosmicObjects());

  // Dynamic Night Constellation State (Periodically respawns stars in new random positions across the sky)
  const [dynamicStars, setDynamicStars] = useState<DynamicStar[]>(() => generateRandomStars(38, isNightSlow, cosmicObjects));

  // Rare Late-Night Constellation Linking Event State
  const [activeConstellation, setActiveConstellation] = useState<ActiveConstellationState | null>(null);

  useEffect(() => {
    if (activeScene.isNight) {
      const freshCosmic = generateRandomCosmicObjects();
      setCosmicObjects(freshCosmic);
      setDynamicStars(generateRandomStars(38, isNightSlow, freshCosmic));
    }
  }, [activeSceneId]);

  // Rare Constellation Trigger Interval (Every 3 minutes in Late Night, plus initial trigger at 6s)
  useEffect(() => {
    if (activeSceneId === 'late_night') {
      const initialTimer = setTimeout(() => {
        triggerRareConstellation();
      }, 5000);

      const intervalTimer = setInterval(() => {
        triggerRareConstellation();
      }, 180000); // 3 Minutes (180,000ms)

      return () => {
        clearTimeout(initialTimer);
        clearInterval(intervalTimer);
      };
    }
  }, [activeSceneId]);

  useEffect(() => {
    const intervalMs = isNightSlow ? 9000 : 5000;
    const starInterval = setInterval(() => {
      setDynamicStars(prev =>
        prev.map(star => {
          if (Math.random() < (isNightSlow ? 0.35 : 0.45)) {
            const minDur = isNightSlow ? 5.5 : 3.0;
            const maxAdd = isNightSlow ? 4.0 : 2.0;

            let newTop = Math.floor(Math.random() * 60) + 4;
            let newLeft = Math.floor(Math.random() * 92) + 4;
            let retries = 0;
            while (isTooCloseToCosmicObject(newTop, newLeft, cosmicObjects) && retries < 10) {
              newTop = Math.floor(Math.random() * 60) + 4;
              newLeft = Math.floor(Math.random() * 92) + 4;
              retries++;
            }

            return {
              ...star,
              id: `star-reloc-${Math.random().toString(36).substring(2, 7)}`,
              top: newTop,
              left: newLeft,
              delay: 0,
              duration: parseFloat((Math.random() * maxAdd + minDur).toFixed(1)),
            };
          }
          return star;
        })
      );
    }, intervalMs);

    return () => clearInterval(starInterval);
  }, [isNightSlow, cosmicObjects]);

  // Effective hour calculation for celestial arc & lighting engine
  const effectiveHour = activeHour;

  // Determine Daytime vs Nighttime
  const isDaytime = effectiveHour >= 5.0 && effectiveHour < 20.0;

  // 1. Daytime Arc Trajectory (Sun: 5:00 AM to 8:00 PM -> 15 Hours)
  // Rises from Bottom-Left (left: 5%, top: 75%) -> High Zenith (left: 50%, top: 10%) -> Sets to Bottom-Right (left: 95%, top: 75%)
  const dayProgress = Math.max(0, Math.min(1, (effectiveHour - 5.0) / 15.0));
  const sunLeft = 5 + dayProgress * 90;
  const sunTop = 75 - Math.sin(dayProgress * Math.PI) * 65;

  // 2. Nighttime Arc Trajectory (Moon: 8:00 PM to 5:00 AM -> 9 Hours)
  // Rises from Bottom-Left (left: 5%, top: 75%) -> High Zenith (left: 50%, top: 12%) -> Sets to Bottom-Right (left: 95%, top: 75%)
  const nightHour = effectiveHour >= 20.0 ? (effectiveHour - 20.0) : (effectiveHour + 4.0);
  const nightProgress = Math.max(0, Math.min(1, nightHour / 9.0));
  const moonLeft = 5 + nightProgress * 90;
  const moonTop = 75 - Math.sin(nightProgress * Math.PI) * 63;

  // Active Celestial Coordinates & Opacity
  const celestialLeft = isDaytime ? sunLeft : moonLeft;
  const celestialTop = isDaytime ? sunTop : moonTop;

  // Dynamic Environment Lighting Engine: 100% Smooth Continuous RGB Color & Opacity Interpolation
  const getDynamicEnvironmentLighting = (hour: number) => {
    const hexToRgb = (hex: string): [number, number, number] => {
      let clean = hex.replace('#', '');
      if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
      const n = parseInt(clean, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    };

    const rgbToHex = (r: number, g: number, b: number): string => {
      const clamp = (x: number) => Math.max(0, Math.min(255, Math.round(x)));
      return '#' + [r, g, b].map(x => clamp(x).toString(16).padStart(2, '0')).join('');
    };

    const lerpColor = (colorA: string, colorB: string, t: number): string => {
      const [r1, g1, b1] = hexToRgb(colorA);
      const [r2, g2, b2] = hexToRgb(colorB);
      return rgbToHex(r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t);
    };

    interface Keyframe {
      hour: number;
      skyTop: string;
      skyMid: string;
      skyBot: string;
      horizonGlow: string;
      mountainDark: string;
      mountainLight: string;
      sunOpacity: number;
      nightOpacity: number;
    }

    const KEYFRAMES: Keyframe[] = [
      { hour: 0.0,  skyTop: '#030712', skyMid: '#0B0F29', skyBot: '#111827', horizonGlow: 'rgba(56, 189, 248, 0.15)', mountainDark: '#020617', mountainLight: '#0F172A', sunOpacity: 0.0, nightOpacity: 1.0 },
      { hour: 4.5,  skyTop: '#050719', skyMid: '#0E1133', skyBot: '#161B3D', horizonGlow: 'rgba(56, 189, 248, 0.20)', mountainDark: '#040921', mountainLight: '#111833', sunOpacity: 0.0, nightOpacity: 1.0 },
      { hour: 4.85, skyTop: '#0C0A2E', skyMid: '#240F3F', skyBot: '#5E1442', horizonGlow: 'rgba(217, 70, 239, 0.35)', mountainDark: '#12092B', mountainLight: '#23103D', sunOpacity: 0.0, nightOpacity: 0.4 },
      { hour: 5.0,  skyTop: '#1B1748', skyMid: '#6B1870', skyBot: '#ED3B59', horizonGlow: 'rgba(251, 146, 60, 0.65)', mountainDark: '#31103F', mountainLight: '#4A1D54', sunOpacity: 0.2, nightOpacity: 0.0 },
      { hour: 6.0,  skyTop: '#0F3763', skyMid: '#0284C7', skyBot: '#BAE6FD', horizonGlow: 'rgba(253, 224, 71, 0.60)', mountainDark: '#0B4D36', mountainLight: '#087352', sunOpacity: 1.0, nightOpacity: 0.0 },
      { hour: 9.5,  skyTop: '#0284C7', skyMid: '#38BDF8', skyBot: '#BAE6FD', horizonGlow: 'rgba(254, 240, 138, 0.50)', mountainDark: '#047857', mountainLight: '#059669', sunOpacity: 1.0, nightOpacity: 0.0 },
      { hour: 12.0, skyTop: '#0369A1', skyMid: '#0284C7', skyBot: '#7DD3FC', horizonGlow: 'rgba(255, 255, 255, 0.65)', mountainDark: '#065F46', mountainLight: '#047857', sunOpacity: 1.0, nightOpacity: 0.0 },
      { hour: 16.5, skyTop: '#0284C7', skyMid: '#38BDF8', skyBot: '#FDBA74', horizonGlow: 'rgba(251, 146, 60, 0.55)', mountainDark: '#047857', mountainLight: '#059669', sunOpacity: 1.0, nightOpacity: 0.0 },
      { hour: 18.8, skyTop: '#311B92', skyMid: '#881337', skyBot: '#E65100', horizonGlow: 'rgba(245, 158, 11, 0.70)', mountainDark: '#1A0B2E', mountainLight: '#2D124D', sunOpacity: 0.8, nightOpacity: 0.0 },
      { hour: 19.8, skyTop: '#17113E', skyMid: '#3A133A', skyBot: '#541A35', horizonGlow: 'rgba(168, 85, 247, 0.40)', mountainDark: '#100B2B', mountainLight: '#1E123D', sunOpacity: 0.2, nightOpacity: 0.0 },
      { hour: 20.0, skyTop: '#0C0C2D', skyMid: '#1A1744', skyBot: '#28245D', horizonGlow: 'rgba(99, 102, 241, 0.35)', mountainDark: '#0B0D26', mountainLight: '#14183B', sunOpacity: 0.0, nightOpacity: 0.2 },
      { hour: 21.0, skyTop: '#090D2A', skyMid: '#161B40', skyBot: '#202656', horizonGlow: 'rgba(99, 102, 241, 0.35)', mountainDark: '#0A0E26', mountainLight: '#131A3D', sunOpacity: 0.0, nightOpacity: 1.0 },
      { hour: 24.0, skyTop: '#030712', skyMid: '#0B0F29', skyBot: '#111827', horizonGlow: 'rgba(56, 189, 248, 0.15)', mountainDark: '#020617', mountainLight: '#0F172A', sunOpacity: 0.0, nightOpacity: 1.0 },
    ];

    const h = Math.max(0, Math.min(24, hour));
    let k1 = KEYFRAMES[0];
    let k2 = KEYFRAMES[KEYFRAMES.length - 1];

    for (let i = 0; i < KEYFRAMES.length - 1; i++) {
      if (h >= KEYFRAMES[i].hour && h <= KEYFRAMES[i + 1].hour) {
        k1 = KEYFRAMES[i];
        k2 = KEYFRAMES[i + 1];
        break;
      }
    }

    const range = k2.hour - k1.hour;
    const t = range > 0 ? (h - k1.hour) / range : 0;

    const skyTop = lerpColor(k1.skyTop, k2.skyTop, t);
    const skyMid = lerpColor(k1.skyMid, k2.skyMid, t);
    const skyBot = lerpColor(k1.skyBot, k2.skyBot, t);

    return {
      skyGradient: `linear-gradient(to bottom, ${skyTop} 0%, ${skyMid} 45%, ${skyBot} 100%)`,
      horizonGlow: k1.horizonGlow,
      mountainDark: lerpColor(k1.mountainDark, k2.mountainDark, t),
      mountainLight: lerpColor(k1.mountainLight, k2.mountainLight, t),
      treeColor: '#065F46',
      sunMoonGlow: '0 0 60px rgba(251, 146, 60, 0.85)',
      sunOpacity: k1.sunOpacity + (k2.sunOpacity - k1.sunOpacity) * t,
      nightOpacity: k1.nightOpacity + (k2.nightOpacity - k1.nightOpacity) * t,
    };
  };

  const envLighting = getDynamicEnvironmentLighting(effectiveHour);

  // Rare Constellation Trigger Function with Moon & Planet Spatial Clearance Check
  const triggerRareConstellation = () => {
    const pattern = CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
    const size = Math.floor(150 + Math.random() * 40);

    let top = Math.floor(10 + Math.random() * 22);
    let left = Math.floor(10 + Math.random() * 70);

    let attempts = 0;
    while (attempts < 25) {
      attempts++;
      const dLeftMoon = left - celestialLeft;
      const dTopMoon = top - celestialTop;
      const distMoon = Math.sqrt(dLeftMoon * dLeftMoon + dTopMoon * dTopMoon);

      const tooCloseCosmic = cosmicObjects.some(obj => {
        const dL = left - obj.left;
        const dT = top - obj.top;
        return Math.sqrt(dL * dL + dT * dT) < 15;
      });

      if (distMoon >= 22 && !tooCloseCosmic) {
        break;
      }

      const side = Math.random() < 0.5 ? 'left' : 'right';
      left = side === 'left' ? Math.floor(6 + Math.random() * 28) : Math.floor(62 + Math.random() * 28);
      top = Math.floor(8 + Math.random() * 24);
    }

    const offsets: ConstellationNodeOffset[] = pattern.nodes.map(() => ({
      startDx: Math.floor(-25 + Math.random() * 50),
      startDy: Math.floor(-25 + Math.random() * 50),
      endDx: Math.floor(-20 + Math.random() * 40),
      endDy: Math.floor(-20 + Math.random() * 40),
    }));

    // Step 1: Stars appear scattered
    setActiveConstellation({
      pattern,
      top,
      left,
      size,
      offsets,
      phase: 'appearing',
    });

    // Step 2: Stars smoothly arrange themselves into position
    setTimeout(() => {
      setActiveConstellation(prev => prev ? { ...prev, phase: 'arranging' } : null);
    }, 250);

    // Step 3: Stars start linking slowly line by line
    setTimeout(() => {
      setActiveConstellation(prev => prev ? { ...prev, phase: 'linking' } : null);
    }, 2900);

    // Step 4: Full constellation connected & holding
    setTimeout(() => {
      setActiveConstellation(prev => prev ? { ...prev, phase: 'linked' } : null);
    }, 6800);

    // Step 5: Lines un-link slowly
    setTimeout(() => {
      setActiveConstellation(prev => prev ? { ...prev, phase: 'unlinking' } : null);
    }, 11800);

    // Step 6: Lines 100% gone, stars float out & dim/disappear
    setTimeout(() => {
      setActiveConstellation(prev => prev ? { ...prev, phase: 'disappearing' } : null);
    }, 15000);

    // Step 7: Clear state
    setTimeout(() => {
      setActiveConstellation(null);
    }, 17800);
  };

  // Validation Logic Helpers
  const validateEmail = (val: string): string | null => {
    const trimmed = val.trim();
    // Do NOT show error if email is empty (until user inputs text)
    if (!trimmed) {
      return null;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmed)) {
      return 'Please enter a valid school email address (e.g. student@school.edu)';
    }
    return null;
  };

  const validatePassword = (val: string, isSubmit = false): string | null => {
    if (!val) {
      // Only show "cannot be left blank" if user pressed submit button while empty
      return isSubmit ? 'Password field cannot be left blank' : null;
    }
    if (val.length < 4) {
      return 'Password must be at least 4 characters long';
    }
    return null;
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const isEmailValid = email.trim() !== '' && emailRegex.test(email.trim());
  const isPasswordValid = password !== '' && password.length >= 4;
  const isFormValid = isEmailValid && isPasswordValid;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setEmail(val);
    setEmailError(validateEmail(val));
  };

  const handleEmailBlur = () => {
    setEmailError(validateEmail(email));
  };

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(validatePassword(val, false));
  };

  const handlePasswordBlur = () => {
    setPasswordError(validatePassword(password, false));
  };

  const switchPortal = (mode: 'student' | 'staff') => {
    setPortalMode(mode);
    sessionStorage.setItem('active_portal_mode', mode);
    if (mode === 'student') {
      const savedRemember = localStorage.getItem('remember_me_student') === 'true';
      const savedEmail = localStorage.getItem('remember_student_email');
      if (savedRemember && savedEmail) {
        setEmail(savedEmail);
        setRememberMe(true);
      } else {
        setEmail('');
      }
    } else {
      setEmail('');
    }
    setPassword('');
    setEmailError(null);
    setPasswordError(null);
    setError(null);
    setInfo(null);
    setSubmitting(false);
  };

  const handleDemoFill = () => {
    setError(null);
    setEmailError(null);
    setPasswordError(null);

    if (portalMode === 'student') {
      setEmail('low@student.school.edu');
      setPassword('1111');
      setInfo('Autofilled Student Demo (Alice)');
    } else {
      setEmail('low@staff.school.edu');
      setPassword('1111');
      setInfo('Autofilled Staff Demo (Mr. Lee)');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const eErr = validateEmail(email);
    const pErr = validatePassword(password, true);

    setEmailError(eErr);
    setPasswordError(pErr);

    if (eErr || pErr || !isFormValid) {
      return;
    }

    setSubmitting(true);

    try {
      await login(email, password, portalMode === 'student' ? 'student' : 'staff_admin');
      if (portalMode === 'student') {
        if (rememberMe) {
          localStorage.setItem('remember_me_student', 'true');
          localStorage.setItem('remember_student_email', email);
        } else {
          localStorage.removeItem('remember_me_student');
          localStorage.removeItem('remember_student_email');
        }
      }
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'An error occurred. Make sure the backend server (FastAPI) is running at port 8000.';
      setError(detail);
      await swalError('Login Failed', detail);
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const { value: emailInput } = await Swal.fire({
      title: 'Password Reset Request',
      text: 'Enter your registered student email address to receive password recovery instructions.',
      input: 'email',
      inputValue: email || '',
      inputPlaceholder: 'e.g. student@student.school.edu',
      showCancelButton: true,
      confirmButtonText: 'Send Reset Link',
      cancelButtonText: 'Cancel',
      customClass: {
        popup: '!rounded-2xl !shadow-2xl !border border-slate-200 dark:border-slate-800 !font-sans uipro-card',
        title: '!text-slate-900 dark:!text-slate-100 !font-display !font-bold !text-base',
        htmlContainer: '!text-slate-600 dark:!text-slate-300 !text-xs',
        input: '!rounded-xl !border-slate-300 !text-xs !py-2.5',
        confirmButton: '!rounded-xl !px-5 !py-2.5 !text-xs !font-semibold uipro-button uipro-button-primary',
        cancelButton: '!rounded-xl !px-5 !py-2.5 !text-xs !font-semibold uipro-button uipro-button-secondary',
      },
      buttonsStyling: false,
    });

    if (emailInput) {
      swalSuccess(
        'Request Submitted',
        `Password recovery instructions have been sent to ${emailInput}. Please check your email inbox.`
      );
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden transition-all duration-1000 ease-in-out"
      style={{ background: envLighting.skyGradient }}
    >




      {/* 2D Night Sky Cosmos: Distant Solar System Planets, 25+ Twinkling Rotating 4-Point Stars & Rare Shooting Star */}
      {activeScene.isNight && (
        <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 overflow-hidden">
          {/* Layer 1: Background Constellation Layer (Z-0) */}
          <div className="absolute inset-0 z-0">
            {dynamicStars.map((star) => (
              <div
                key={star.id}
                className="absolute animate-star-sparkle pointer-events-none text-cyan-100/90 dark:text-slate-100/90 transition-all duration-1000"
                style={{
                  top: `${star.top}%`,
                  left: `${star.left}%`,
                  ['--star-duration' as any]: `${star.duration}s`,
                  animationDelay: `${star.delay}s`,
                }}
              >
                {star.type === 'sparkle' ? (
                  <svg className="fill-current drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" style={{ width: `${star.size}px`, height: `${star.size}px` }} viewBox="0 0 24 24">
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                  </svg>
                ) : star.type === 'cross' ? (
                  <svg className="fill-current drop-shadow-[0_0_6px_rgba(255,255,255,0.8)]" style={{ width: `${star.size}px`, height: `${star.size}px` }} viewBox="0 0 24 24">
                    <path d="M11 0h2v24h-2zM0 11h24v2H0z" />
                  </svg>
                ) : (
                  <div
                    className="rounded-full bg-white drop-shadow-[0_0_6px_rgba(255,255,255,0.95)]"
                    style={{ width: '2px', height: '2px' }}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Layer 2: Foreground Celestial Objects Layer (Z-10, Occludes Stars Behind Planets & Black Hole) */}
          <div className="absolute inset-0 z-10">
            {cosmicObjects.map((obj) => {
            if (obj.type === 'black_hole') {
              const accretionId = `accretion_${obj.id}`;
              const photonId = `photon_${obj.id}`;
              return (
                <div
                  key={obj.id}
                  className="absolute z-0 pointer-events-none filter drop-shadow-[0_0_25px_rgba(168,85,247,0.75)] animate-cosmic-drift transition-all duration-1000"
                  style={{
                    top: `${obj.top}%`,
                    left: `${obj.left}%`,
                    width: `${obj.size * 1.5}px`,
                    height: `${obj.size * 1.5}px`,
                    ['--orbit-duration' as any]: `${obj.driftDuration}s`,
                    opacity: obj.opacity,
                  }}
                >
                  {/* Black Hole SVG: Unclipped ViewBox with Photon Accretion Ring & Deep Singularity Void */}
                  <svg viewBox="-20 -20 140 140" className="w-full h-full overflow-visible">
                    {/* Concentric Gravitational Lensing Distortion Aura */}
                    <circle cx="50" cy="50" r="38" fill="none" stroke="rgba(192,132,252,0.35)" strokeWidth="2" className="animate-pulse" style={{ animationDuration: '4s' }} />
                    <circle cx="50" cy="50" r="30" fill="rgba(168,85,247,0.08)" />
                    
                    {/* Rotating Accretion Disk */}
                    <g className="animate-blackhole-spin" style={{ transformOrigin: '50px 50px' }}>
                      <ellipse cx="50" cy="50" rx="46" ry="16" fill="none" stroke={`url(#${accretionId})`} strokeWidth="6" transform="rotate(-25 50 50)" />
                      <ellipse cx="50" cy="50" rx="38" ry="11" fill="none" stroke={`url(#${photonId})`} strokeWidth="4" transform="rotate(30 50 50)" />
                    </g>
                    
                    {/* Deep Singularity Void Event Horizon */}
                    <circle cx="50" cy="50" r="21" fill="#000000" />
                    <circle cx="50" cy="50" r="21" fill="none" stroke="#E9D5FF" strokeWidth="2" opacity="0.9" />
                    <circle cx="50" cy="50" r="18" fill="none" stroke="#67E8F9" strokeWidth="1" opacity="0.7" />

                    <defs>
                      <linearGradient id={accretionId} x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#F43F5E" />
                        <stop offset="40%" stopColor="#A855F7" />
                        <stop offset="80%" stopColor="#3B82F6" />
                        <stop offset="100%" stopColor="#06B6D4" />
                      </linearGradient>
                      <linearGradient id={photonId} x1="100%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stopColor="#FDE047" />
                        <stop offset="50%" stopColor="#EC4899" />
                        <stop offset="100%" stopColor="#C084FC" />
                      </linearGradient>
                    </defs>
                  </svg>
                </div>
              );
            }

            if (obj.type === 'saturn') {
              const pal = getColorVariantGradients(obj.colorVariant);
              const gradId = `saturnGrad_${obj.id}`;
              return (
                <div
                  key={obj.id}
                  className="absolute z-0 pointer-events-none animate-cosmic-drift transition-all duration-1000"
                  style={{
                    top: `${obj.top}%`,
                    left: `${obj.left}%`,
                    width: `${obj.size * 1.3}px`,
                    height: `${obj.size}px`,
                    filter: `drop-shadow(0 0 16px ${pal.shadow})`,
                    ['--orbit-duration' as any]: `${obj.driftDuration}s`,
                    opacity: obj.opacity,
                  }}
                >
                  <svg viewBox="0 0 120 80" className="w-full h-full">
                    <g transform={`rotate(${obj.ringAngle || -20} 60 40)`}>
                      {/* Back Ring Segment */}
                      <ellipse cx="60" cy="40" rx="50" ry="14" fill="none" stroke={pal.ring1} strokeWidth="4" opacity="0.6" />
                      <ellipse cx="60" cy="40" rx="42" ry="10" fill="none" stroke={pal.ring2} strokeWidth="2.5" opacity="0.8" />
                      {/* Saturn Body */}
                      <circle cx="60" cy="40" r="22" fill={`url(#${gradId})`} />
                      {/* Front Ring Segment */}
                      <path d="M 10 40 A 50 14 0 0 0 110 40" fill="none" stroke={pal.ring1} strokeWidth="4" opacity="0.9" />
                      <path d="M 18 40 A 42 10 0 0 0 102 40" fill="none" stroke={pal.ring2} strokeWidth="2.5" opacity="0.95" />
                    </g>
                    <defs>
                      <radialGradient id={gradId} cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stopColor={pal.stop1} />
                        <stop offset="60%" stopColor={pal.stop2} />
                        <stop offset="100%" stopColor={pal.stop3} />
                      </radialGradient>
                    </defs>
                  </svg>
                </div>
              );
            }

            if (obj.type === 'ice_giant') {
              const pal = getColorVariantGradients(obj.colorVariant);
              const gradId = `iceGrad_${obj.id}`;
              return (
                <div
                  key={obj.id}
                  className="absolute z-0 pointer-events-none animate-cosmic-drift transition-all duration-1000"
                  style={{
                    top: `${obj.top}%`,
                    left: `${obj.left}%`,
                    width: `${obj.size}px`,
                    height: `${obj.size}px`,
                    filter: `drop-shadow(0 0 14px ${pal.shadow})`,
                    ['--orbit-duration' as any]: `${obj.driftDuration}s`,
                    opacity: obj.opacity,
                  }}
                >
                  <svg viewBox="0 0 60 60" className="w-full h-full">
                    <ellipse cx="30" cy="30" rx="28" ry="7" fill="none" stroke={pal.ring1} strokeWidth="1.5" opacity="0.6" transform="rotate(45 30 30)" />
                    <circle cx="30" cy="30" r="18" fill={`url(#${gradId})`} />
                    <defs>
                      <radialGradient id={gradId} cx="30%" cy="30%" r="70%">
                        <stop offset="0%" stopColor={pal.stop1} />
                        <stop offset="50%" stopColor={pal.stop2} />
                        <stop offset="100%" stopColor={pal.stop3} />
                      </radialGradient>
                    </defs>
                  </svg>
                </div>
              );
            }

            if (obj.type === 'crimson_planet') {
              const pal = getColorVariantGradients(obj.colorVariant);
              const gradId = `crimsonGrad_${obj.id}`;
              return (
                <div
                  key={obj.id}
                  className="absolute z-0 pointer-events-none animate-cosmic-drift transition-all duration-1000"
                  style={{
                    top: `${obj.top}%`,
                    left: `${obj.left}%`,
                    width: `${obj.size * 0.85}px`,
                    height: `${obj.size * 0.85}px`,
                    filter: `drop-shadow(0 0 12px ${pal.shadow})`,
                    ['--orbit-duration' as any]: `${obj.driftDuration}s`,
                    opacity: obj.opacity,
                  }}
                >
                  <svg viewBox="0 0 50 50" className="w-full h-full">
                    <circle cx="25" cy="25" r="18" fill={`url(#${gradId})`} />
                    <circle cx="25" cy="25" r="18" fill="none" stroke={pal.stop3} strokeWidth="2" opacity="0.4" />
                    <defs>
                      <radialGradient id={gradId} cx="35%" cy="35%" r="65%">
                        <stop offset="0%" stopColor={pal.stop1} />
                        <stop offset="50%" stopColor={pal.stop2} />
                        <stop offset="100%" stopColor={pal.stop3} />
                      </radialGradient>
                    </defs>
                  </svg>
                </div>
              );
            }

            return (
              <div
                key={obj.id}
                className="absolute z-10 pointer-events-none filter drop-shadow-[0_0_8px_rgba(203,213,225,0.4)] animate-cosmic-drift transition-all duration-1000"
                style={{
                  top: `${obj.top}%`,
                  left: `${obj.left}%`,
                  width: `${obj.size * 0.75}px`,
                  height: `${obj.size * 0.75}px`,
                  ['--orbit-duration' as any]: `${obj.driftDuration}s`,
                  opacity: obj.opacity,
                }}
              >
                <svg viewBox="0 0 40 40" className="w-full h-full">
                  <circle cx="20" cy="20" r="14" fill="#94A3B8" />
                  <circle cx="15" cy="16" r="3" fill="#64748B" opacity="0.6" />
                  <circle cx="24" cy="22" r="2.5" fill="#64748B" opacity="0.5" />
                  <circle cx="21" cy="12" r="2" fill="#64748B" opacity="0.4" />
                </svg>
              </div>
            );
          })}
          </div>

          {/* Layer 3: Rare Constellation Starlight Linking Overlay (Z-20) */}
          {activeConstellation && (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                top: `${activeConstellation.top}%`,
                left: `${activeConstellation.left}%`,
                width: `${activeConstellation.size}px`,
                height: `${activeConstellation.size * 0.85}px`,
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* Connecting Starlight Lines: Declarative Smooth Linking & Unlinking */}
                {activeConstellation.pattern.edges.map(([fromIdx, toIdx], eIdx) => {
                  const fromNode = activeConstellation.pattern.nodes[fromIdx];
                  const toNode = activeConstellation.pattern.nodes[toIdx];
                  if (!fromNode || !toNode) return null;

                  const isVisible =
                    activeConstellation.phase === 'linking' ||
                    activeConstellation.phase === 'linked' ||
                    activeConstellation.phase === 'unlinking';

                  const isFullyLinked = activeConstellation.phase === 'linked';
                  const isUnlinking = activeConstellation.phase === 'unlinking';

                  return (
                    <line
                      key={`edge-${eIdx}`}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke="rgba(255, 255, 255, 0.75)"
                      strokeWidth="1.2"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: 200,
                        strokeDashoffset: isFullyLinked
                          ? 0
                          : isUnlinking
                          ? 200
                          : isVisible
                          ? 0
                          : 200,
                        opacity: isVisible ? (isUnlinking ? 0 : 0.85) : 0,
                        transition: isUnlinking
                          ? `stroke-dashoffset 2.8s ease-in-out ${eIdx * 0.2}s, opacity 2.8s ease-in-out ${eIdx * 0.2}s`
                          : `stroke-dashoffset 3.2s ease-in-out ${eIdx * 0.3}s, opacity 1s ease-in-out`,
                      }}
                      className="drop-shadow-[0_0_6px_rgba(255,255,255,0.85)]"
                    />
                  );
                })}

                {/* Natural Star Nodes: Smoothly Glide & Arrange into Constellation */}
                {activeConstellation.pattern.nodes.map((node, nIdx) => {
                  const offset = activeConstellation.offsets[nIdx] || { startDx: 0, startDy: 0, endDx: 0, endDy: 0 };
                  let dx = 0;
                  let dy = 0;
                  let opacity = 1;

                  if (activeConstellation.phase === 'appearing') {
                    dx = offset.startDx;
                    dy = offset.startDy;
                    opacity = 0;
                  } else if (activeConstellation.phase === 'disappearing') {
                    dx = offset.endDx;
                    dy = offset.endDy;
                    opacity = 0;
                  }

                  return (
                    <g
                      key={`node-${nIdx}`}
                      transform={`translate(${node.x + dx}, ${node.y + dy})`}
                      style={{
                        transition: 'transform 2.5s ease-out, opacity 2.5s ease-in-out',
                        opacity,
                      }}
                    >
                      {/* Natural Star Sparkle Core (Pure White / Soft Starlight) */}
                      <circle r="3" fill="rgba(255, 255, 255, 0.3)" />
                      <circle r="1.6" fill="#FFFFFF" className="drop-shadow-[0_0_6px_#FFFFFF]" />

                      {/* Delicate 4-Point Starlight Flare Diamond */}
                      <path
                        d="M 0 -8 Q 0 0 8 0 Q 0 0 0 8 Q 0 0 -8 0 Q 0 0 0 -8 Z"
                        fill="rgba(255, 255, 255, 0.85)"
                        className="animate-pulse"
                        style={{ animationDuration: '3s', animationDelay: `${nIdx * 0.15}s` }}
                      />
                    </g>
                  );
                })}
              </svg>
            </div>
          )}

          {/* Natural Cosmic Loop Meteor Flight */}
          <div
            className="absolute z-0 pointer-events-none animate-natural-meteor-loop"
            style={{ top: '-40px', right: '-80px' }}
          >
            <div className="relative flex items-center flex-row scale-75 sm:scale-90">
              <div className="absolute -left-2 -top-2 w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-cyan-300/30 animate-ping" style={{ animationDuration: '1.2s' }} />
              <div className="relative w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-white shadow-[0_0_20px_#06b6d4,0_0_40px_#a855f7,0_0_60px_#ffffff] border border-cyan-100 shrink-0 z-20 -mr-3 flex items-center justify-center">
                <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-100 shadow-[0_0_8px_#ffffff] animate-pulse" />
              </div>
              <div className="w-56 sm:w-[360px] h-2 sm:h-2.5 bg-gradient-to-r from-white via-cyan-200 via-sky-400 to-transparent rounded-full shadow-[0_0_16px_#06b6d4] z-10" />
              <div className="absolute left-0 w-64 sm:w-[420px] h-5 sm:h-8 bg-gradient-to-r from-cyan-400/90 via-sky-500/50 via-purple-600/40 to-transparent rounded-full filter blur-[3px] -z-10 animate-pulse" style={{ animationDuration: '2s' }} />
              <div className="absolute right-16 -top-3 text-cyan-200 text-xs font-mono animate-pulse drop-shadow-[0_0_6px_#38bdf8]">✦</div>
              <div className="absolute right-36 top-3 text-purple-200 text-[10px] font-mono animate-ping" style={{ animationDuration: '1.5s' }}>★</div>
            </div>
          {/* Rare Late Night Astronomical Constellation Linking Event (Every 3 minutes in Late Night) */}
          {activeConstellation && (
            <div
              className={`absolute z-20 pointer-events-none transition-all duration-1000 ${
                activeConstellation.phase === 'unlinking' ? 'animate-constellation-fadeout' : 'opacity-100'
              }`}
              style={{
                top: `${activeConstellation.top}%`,
                left: `${activeConstellation.left}%`,
                width: `${activeConstellation.size}px`,
                height: `${activeConstellation.size * 0.85}px`,
              }}
            >
              <svg viewBox="0 0 100 100" className="w-full h-full overflow-visible">
                {/* Connecting Starlight Beams */}
                {activeConstellation.pattern.edges.map(([fromIdx, toIdx], eIdx) => {
                  const fromNode = activeConstellation.pattern.nodes[fromIdx];
                  const toNode = activeConstellation.pattern.nodes[toIdx];
                  if (!fromNode || !toNode) return null;

                  return (
                    <line
                      key={`edge-${eIdx}`}
                      x1={fromNode.x}
                      y1={fromNode.y}
                      x2={toNode.x}
                      y2={toNode.y}
                      stroke="url(#starlightLineGrad)"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      className="animate-constellation-link drop-shadow-[0_0_8px_rgba(56,189,248,0.95)]"
                      style={{ animationDelay: `${eIdx * 0.35}s` }}
                    />
                  );
                })}

                {/* Star Nodes (Glowing Specks with Pulsing Halo) */}
                {activeConstellation.pattern.nodes.map((node, nIdx) => (
                  <g key={`node-${nIdx}`} transform={`translate(${node.x}, ${node.y})`}>
                    {/* Pulsing Outer Halo */}
                    <circle r="4.5" fill="rgba(56,189,248,0.35)" className="animate-ping" style={{ animationDuration: '3s', animationDelay: `${nIdx * 0.2}s` }} />
                    {/* Hot White Star Nucleus */}
                    <circle r="2.2" fill="#FFFFFF" className="drop-shadow-[0_0_8px_#38BDF8]" />
                    {/* Sparkle Diamond Overlay */}
                    <path d="M0 -3.5 L0.8 0 L0 3.5 L-0.8 0 Z" fill="#E0F2FE" />
                  </g>
                ))}

                <defs>
                  <linearGradient id="starlightLineGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="#E0F2FE" />
                    <stop offset="50%" stopColor="#38BDF8" />
                    <stop offset="100%" stopColor="#C084FC" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Sleek Constellation Label Badge */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap px-2.5 py-0.5 rounded-full bg-slate-950/75 border border-cyan-400/40 text-[10px] font-mono text-cyan-200 shadow-lg backdrop-blur-md animate-pulse">
                ✦ Constellation: <span className="font-semibold text-white">{activeConstellation.pattern.name}</span>
              </div>
            </div>
          )}
          </div>
        </div>
      )}

      {/* 2D Celestial Body (Sun & Moon Arc Trajectory) with Continuous Cross-Fading */}
      {/* 1. Daytime Sun */}
      {envLighting.sunOpacity > 0.01 && (
        <div
          className="absolute z-0 pointer-events-none flex items-center justify-center transition-all duration-300 ease-out"
          style={{
            left: `${sunLeft}%`,
            top: `${sunTop}%`,
            transform: 'translate(-50%, -50%)',
            opacity: envLighting.sunOpacity,
          }}
        >
          {/* Glowing Sun with Rotating Solar Rays */}
          <div className="absolute w-44 h-44 md:w-60 md:h-60 rounded-full border border-white/30 border-dashed animate-sun-spin" />
          <div className="absolute w-56 h-56 md:w-72 md:h-72 rounded-full border border-amber-200/20 animate-sun-spin" style={{ animationDirection: 'reverse', animationDuration: '45s' }} />
          <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-tr ${activeScene.sunGradient || 'from-amber-400 via-orange-400 to-yellow-200'} animate-sun-pulse shadow-[0_0_60px_rgba(251,146,60,0.85)] transition-all duration-1000`} />
        </div>
      )}

      {/* 2. Nighttime Moon (Crescent vs Full Moon) */}
      {envLighting.nightOpacity > 0.01 && (
        <div
          className="absolute z-0 pointer-events-none flex items-center justify-center transition-all duration-300 ease-out"
          style={{
            left: `${moonLeft}%`,
            top: `${moonTop}%`,
            transform: 'translate(-50%, -50%)',
            opacity: envLighting.nightOpacity,
          }}
        >
          {activeSceneId === 'night' ? (
            /* Razor-Sharp Luminous Crescent Moon */
            <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center filter drop-shadow-[0_0_25px_rgba(255,248,220,0.85)]">
              <svg viewBox="0 0 100 100" className="w-full h-full transition-all duration-1000">
                <g transform="rotate(-15 50 50)">
                  <path d="M 50 5 A 43 43 0 0 0 50 93 A 47 47 0 0 1 50 5 Z" fill="#FFF8E7" className="opacity-25 filter blur-sm" />
                  <path d="M 50 5 A 43 43 0 0 0 50 93 A 47 47 0 0 1 50 5 Z" fill="#FFF5CB" />
                  <path d="M 50 5 A 43 43 0 0 0 50 93 A 50 50 0 0 1 43 18 A 40 40 0 0 1 50 5 Z" fill="#FFFFFF" opacity="0.6" />
                </g>
              </svg>
            </div>
          ) : (
            /* Detailed Glowing Full Moon for Late Night */
            <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
              <div className="absolute w-36 h-36 md:w-48 md:h-48 rounded-full bg-slate-200/15 animate-pulse" />
              <div className="w-22 h-22 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-slate-300 via-slate-100 to-white shadow-[0_0_80px_rgba(241,245,249,0.9)] relative overflow-hidden flex items-center justify-center transition-all duration-1000">
                <div className="absolute top-3 left-4 w-4 h-4 rounded-full bg-slate-300/40" />
                <div className="absolute top-8 right-5 w-6 h-6 rounded-full bg-slate-300/30" />
                <div className="absolute bottom-4 left-7 w-5 h-5 rounded-full bg-slate-300/35" />
                <div className="absolute bottom-7 right-7 w-3 h-3 rounded-full bg-slate-300/25" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2D Realistic Distant Flying Birds System (Daytime Only; Edge-to-Edge Flight) */}
      {!activeScene.isNight && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {getBirdFlocksForScene(activeSceneId).map((flock) => {
            const isEvening = activeSceneId === 'evening';
            const birdColor = isEvening
              ? 'text-slate-900/80 dark:text-amber-950/80'
              : 'text-slate-800/60 dark:text-emerald-300/40';
            const dir = flock.dir || (isEvening ? 'rtl' : 'ltr');
            const flightAnimClass = `animate-birds-${dir}-${flock.speed}`;

            return (
              <div
                key={flock.id}
                className={`absolute left-0 z-0 pointer-events-none ${flightAnimClass}`}
                style={{
                  top: `${flock.top}%`,
                  animationDelay: flock.delay,
                }}
              >
                <svg
                  className={`w-36 h-12 ${birdColor} drop-shadow-sm`}
                  viewBox="0 0 140 50"
                  style={{ transform: `scale(${flock.scale})`, transformOrigin: 'top left' }}
                >
                  {/* Leader Bird */}
                  <path className="animate-wing-flap" d="M10,25 Q20,10 30,25 Q40,10 50,25" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                  {/* Right Follower Bird */}
                  <path className="animate-wing-flap-stagger1" d="M55,14 Q63,4 71,14 Q79,4 87,14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  {/* Left Follower Bird */}
                  <path className="animate-wing-flap-stagger2" d="M35,38 Q42,28 50,38 Q58,28 66,38" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  {flock.birdCount >= 4 && (
                    <path className="animate-wing-flap-stagger3" d="M92,26 Q98,18 104,26 Q110,18 116,26" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  )}
                  {flock.birdCount >= 5 && (
                    <path className="animate-wing-flap-stagger1" d="M15,44 Q20,38 25,44 Q30,38 35,44" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                  )}
                  {flock.birdCount >= 6 && (
                    <path className="animate-wing-flap-stagger2" d="M120,18 Q125,12 130,18 Q135,12 140,18" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
                  )}
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* 2D Dynamic Multi-Directional Edge-to-Edge Floating SVG Clouds (Daytime Only, None at Noon/Night) */}
      {!activeScene.isNight && activeSceneId !== 'noon' && (
        <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
          {getCloudsForScene(activeSceneId).map((cloud) => {
            const cloudAnimClass = `animate-cloud-${cloud.dir}-${cloud.speed}`;
            const cloudFill = activeSceneId === 'evening'
              ? 'fill-amber-100/70 dark:fill-orange-950/40'
              : 'fill-white/80 dark:fill-slate-800/40';

            return (
              <div
                key={cloud.id}
                className={`absolute left-0 z-0 pointer-events-none ${cloud.opacity} ${cloudAnimClass}`}
                style={{
                  top: `${cloud.top}%`,
                  animationDelay: cloud.delay,
                }}
              >
                <svg
                  className={`w-36 h-18 md:w-48 md:h-24 ${cloudFill} drop-shadow-sm`}
                  viewBox="0 0 24 24"
                  style={{ transform: `scale(${cloud.scale})`, transformOrigin: 'top left' }}
                >
                  <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
                </svg>
              </div>
            );
          })}
        </div>
      )}

      {/* 2D Curved Layered Mountain Ranges & Distant Trees (Seamless Environment Synchronization) */}
      <div className="absolute inset-x-0 bottom-0 z-0 pointer-events-none h-56 sm:h-72 md:h-96 overflow-hidden">
        {/* Layer 1: Back Mountain Curve */}
        <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full h-full transition-all duration-1000" preserveAspectRatio="none" style={{ fill: envLighting.mountainDark }}>
          <path d="M0,192L60,181.3C120,171,240,149,360,160C480,171,600,213,720,208C840,203,960,149,1080,144C1200,139,1320,181,1380,202.7L1440,224L1440,320L1380,320C1320,320,1200,320,1080,320C960,320,840,320,720,320C600,320,480,320,360,320C240,320,120,320,60,320L0,320Z"></path>
        </svg>

        {/* Layer 2: Front Mountain Curve */}
        <svg viewBox="0 0 1440 320" className="absolute bottom-0 w-full h-full transition-all duration-1000" preserveAspectRatio="none" style={{ fill: envLighting.mountainLight }}>
          <path d="M0,256L80,229.3C160,203,320,149,480,165.3C640,181,800,267,960,266.7C1120,267,1280,181,1360,138.7L1440,96L1440,320L1360,320C1280,320,1120,320,960,320C800,320,640,320,480,320C320,320,160,320,80,320L0,320Z"></path>
        </svg>

        {/* Distant 2D Vector Trees (Upright Lush & Pine Trees resting on ridge) */}
        <div className="absolute bottom-20 sm:bottom-28 md:bottom-36 inset-x-0 flex justify-between px-8 sm:px-16 md:px-32 opacity-90 z-0 pointer-events-none">
          {/* Left Tree Cluster */}
          <svg className="w-16 h-12 sm:w-24 sm:h-16 md:w-32 md:h-20 drop-shadow-sm" viewBox="0 0 100 50">
            <rect x="23" y="28" width="4" height="18" rx="1" className="fill-emerald-950 dark:fill-slate-950" />
            <circle cx="25" cy="20" r="14" className="fill-emerald-800 dark:fill-emerald-950" />
            <circle cx="17" cy="22" r="10" className="fill-emerald-700 dark:fill-emerald-900" />
            <circle cx="33" cy="22" r="10" className="fill-emerald-600 dark:fill-emerald-800" />

            <rect x="63" y="30" width="4" height="16" rx="1" className="fill-emerald-950 dark:fill-slate-950" />
            <polygon points="65,6 50,22 56,22 45,34 85,34 74,22 80,22" className="fill-emerald-800 dark:fill-emerald-950" />
            <polygon points="65,0 54,14 59,14 50,24 80,24 71,14 76,14" className="fill-emerald-700 dark:fill-emerald-900" />
          </svg>

          {/* Right Tree Cluster */}
          <svg className="w-20 h-14 sm:w-28 sm:h-18 md:w-36 md:h-22 drop-shadow-sm" viewBox="0 0 120 50">
            <rect x="28" y="28" width="4" height="18" rx="1" className="fill-emerald-950 dark:fill-slate-950" />
            <polygon points="30,4 16,20 22,20 12,32 48,32 38,20 44,20" className="fill-emerald-800 dark:fill-emerald-950" />
            <polygon points="30,0 20,12 24,12 16,22 44,22 36,12 40,12" className="fill-emerald-700 dark:fill-emerald-900" />

            <rect x="73" y="28" width="4" height="18" rx="1" className="fill-emerald-950 dark:fill-slate-950" />
            <circle cx="75" cy="18" r="15" className="fill-emerald-800 dark:fill-emerald-950" />
            <circle cx="66" cy="20" r="11" className="fill-emerald-700 dark:fill-emerald-900" />
            <circle cx="84" cy="20" r="11" className="fill-emerald-600 dark:fill-emerald-800" />
          </svg>
        </div>

        {/* Layer 3: Foreground Curved Hill */}
        <svg viewBox="0 0 1440 320" className={`absolute bottom-0 w-full h-[62%] ${activeScene.foreMountain} animate-mountain-wave transition-colors duration-1000`} preserveAspectRatio="none">
          <path fill="currentColor" d="M0,190 C360,110 600,230 900,140 C1200,50 1380,190 1440,150 L1440,320 L0,320 Z" />
        </svg>
      </div>

      <div className="max-w-md w-full uipro-card relative z-30 space-y-6 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 shadow-2xl">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src={logoSrc}
            onError={handleLogoError}
            alt="Smart Attendance Logo"
            className="h-36 w-36 sm:h-44 sm:w-44 md:h-48 md:w-48 object-contain drop-shadow-lg mx-auto transition-transform duration-300 transform hover:scale-105"
          />
          
          <div className="flex flex-col items-center">
            <h2 className="text-3xl font-display font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Smart Attendance System
            </h2>
            <span className="text-[11px] font-sans font-bold uppercase tracking-wider px-3.5 py-1 rounded-full mt-1.5 transition-all bg-blue-50 dark:bg-blue-900/30 text-brand-blue dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50">
              {portalMode === 'student' ? 'Student Portal' : 'Staff Portal'}
            </span>
          </div>
        </div>

        {/* Main Form (noValidate disables default native browser popups) */}
        <form className="mt-4 space-y-4" onSubmit={handleSubmit} noValidate>
          {error && (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl flex gap-3 text-xs text-rose-600 dark:text-rose-400 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex gap-3 text-xs text-emerald-600 dark:text-emerald-400 animate-in fade-in duration-200">
              <Sparkles className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          {/* Email Address */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Email Address</label>
              {isEmailValid && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 animate-in fade-in duration-200" />
              )}
            </div>
            <div className="relative">
              <Mail className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                emailError ? 'text-rose-500' : 'text-slate-400'
              }`} />
              <input
                type="email"
                value={email}
                onChange={handleEmailChange}
                onBlur={handleEmailBlur}
                placeholder={
                  portalMode === 'student'
                    ? 'e.g. student@student.school.edu'
                    : 'e.g. staff@staff.school.edu'
                }
                className={`w-full uipro-input !pl-11 transition-all ${
                  emailError
                    ? '!border-rose-500 focus:!border-rose-500 ring-2 ring-rose-500/20'
                    : ''
                }`}
              />
            </div>
            {emailError && (
              <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{emailError}</span>
              </p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Password</label>
              {isPasswordValid && (
                <CheckCircle2 className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 animate-in fade-in duration-200" />
              )}
            </div>
            <div className="relative">
              <Key className={`absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 transition-colors ${
                passwordError ? 'text-rose-500' : 'text-slate-400'
              }`} />
              <input
                type="password"
                value={password}
                onChange={handlePasswordChange}
                onBlur={handlePasswordBlur}
                placeholder="••••••••"
                className={`w-full uipro-input !pl-11 transition-all ${
                  passwordError
                    ? '!border-rose-500 focus:!border-rose-500 ring-2 ring-rose-500/20'
                    : ''
                }`}
              />
            </div>
            {passwordError && (
              <p className="text-[11px] font-medium text-rose-500 dark:text-rose-400 flex items-center gap-1 mt-1 animate-in fade-in duration-150">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{passwordError}</span>
              </p>
            )}
          </div>

          {/* Submit and Quick Demo Autofill Panel */}
          <div className="flex gap-3 mt-2">
            <button
              type="submit"
              disabled={!isFormValid || submitting}
              className={`flex-grow transition-all duration-200 flex items-center justify-center min-h-[44px] rounded-xl font-semibold text-sm ${
                !isFormValid
                  ? 'bg-slate-200 dark:bg-slate-800/80 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-300/40 dark:border-slate-700/50 shadow-none'
                  : 'uipro-button uipro-button-primary cursor-pointer shadow-md hover:shadow-lg'
              }`}
            >
              {submitting ? (
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>Sign In</>
              )}
            </button>
            <button
              type="button"
              onClick={handleDemoFill}
              className="px-4 uipro-button uipro-button-secondary text-xs flex items-center justify-center cursor-pointer min-h-[44px]"
              title={portalMode === 'student' ? 'Auto-fill Student Demo' : 'Auto-fill Staff Demo'}
            >
              <Sparkles className="h-4 w-4 text-brand-blue" />
            </button>
          </div>

          {/* Student Portal Only: Custom High-Quality UI Remember Me Checkbox (left) & Forgot Password Link (far right) */}
          {portalMode === 'student' && (
            <div className="flex items-center justify-between pt-2.5 px-0.5 text-xs">
              <label className="flex items-center gap-2.5 cursor-pointer select-none group text-slate-600 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-slate-100 transition-colors">
                <div className="relative flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4.5 h-4.5 rounded-md flex items-center justify-center transition-all duration-200 shadow-xs border ${
                    rememberMe
                      ? 'bg-brand-blue border-brand-blue text-white ring-2 ring-brand-blue/25 scale-105'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-700 group-hover:border-brand-blue/60 dark:group-hover:border-blue-400/60'
                  }`}>
                    <Check className={`w-3.5 h-3.5 stroke-[3] transition-all duration-200 ${
                      rememberMe ? 'opacity-100 scale-100' : 'opacity-0 scale-50'
                    }`} />
                  </div>
                </div>
                <span>Remember Me</span>
              </label>

              <button
                type="button"
                onClick={handleForgotPassword}
                className="text-brand-blue dark:text-blue-400 hover:underline font-semibold cursor-pointer transition-colors"
              >
                Forgot password?
              </button>
            </div>
          )}
        </form>

        {/* Portal Switcher */}
        <div className="mt-6 border-t border-slate-100 dark:border-slate-800 pt-5 text-center">
          {portalMode === 'student' ? (
            <button
              type="button"
              onClick={() => switchPortal('staff')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-brand-blue font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <Shield className="h-4 w-4 text-brand-blue dark:text-blue-400" />
              Switch to Staff Portal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchPortal('student')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-brand-blue font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <GraduationCap className="h-4 w-4 text-brand-blue dark:text-blue-400" />
              Switch to Student Portal
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
