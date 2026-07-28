import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Shield, Key, Mail, AlertCircle, Sparkles, GraduationCap, CheckCircle2 } from 'lucide-react';
import { swalError } from '../../utils/swal';
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

  // Portal Mode State
  const [portalMode, setPortalMode] = useState<'student' | 'staff'>('student');

  // Form States
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Field Specific Validation States
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Global UI States
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Determine active Scene ID from time (with 1-minute lead-in threshold for smooth scene transitions)
  const fractionalHour = timeState.fractionalHour;
  let activeSceneId: SceneId = 'morning';
  if (fractionalHour >= 4.9833 && fractionalHour < 7.9833) activeSceneId = 'early_morning';
  else if (fractionalHour >= 7.9833 && fractionalHour < 11.9833) activeSceneId = 'morning';
  else if (fractionalHour >= 11.9833 && fractionalHour < 12.4833) activeSceneId = 'noon';
  else if (fractionalHour >= 12.4833 && fractionalHour < 16.9833) activeSceneId = 'afternoon';
  else if (fractionalHour >= 16.9833 && fractionalHour < 19.9833) activeSceneId = 'evening';
  else if (fractionalHour >= 19.9833 && fractionalHour < 23.9833) activeSceneId = 'night';
  else activeSceneId = 'late_night';

  const activeScene = SCENES[activeSceneId];
  const effectiveHour = fractionalHour;

  // Calculate Celestial Body (Sun/Moon) Position with Continuous Arc
  const isDay = activeScene.isNight === false;
  let celestialLeft = 50;
  let celestialTop = 25;

  if (isDay) {
    // Daytime Arc: 5:00 AM (05:00) to 8:00 PM (20:00) -> 15 Hours (Rises from Left to Right)
    const progress = Math.max(0, Math.min(1, (effectiveHour - 5.0) / 15.0));
    celestialLeft = 8 + progress * 84;
    celestialTop = 64 - Math.sin(progress * Math.PI) * 54;
  } else {
    // Nighttime Arc: 8:00 PM (20:00) to 5:00 AM (05:00) -> 9 Hours (Rises from Left to Right across Night Sky)
    const nightProgress = effectiveHour >= 20.0 ? (effectiveHour - 20.0) / 9.0 : (effectiveHour + 4.0) / 9.0;
    const progress = Math.max(0, Math.min(1, nightProgress));
    celestialLeft = 12 + progress * 76;
    celestialTop = 58 - Math.sin(progress * Math.PI) * 44;
  }

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
    setEmail('');
    setPassword('');
    setEmailError(null);
    setPasswordError(null);
    setError(null);
    setInfo(null);
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
    } catch (err: any) {
      console.error(err);
      const detail = err.response?.data?.detail || err.message || 'An error occurred. Make sure the backend server (FastAPI) is running at port 8000.';
      setError(detail);
      await swalError('Login Failed', detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden bg-gradient-to-b ${activeScene.skyBg} transition-all duration-1000 ease-in-out`}>
      


      {/* 2D Night Sky Cosmos: Distant Solar System Planets, 25+ Twinkling Rotating 4-Point Stars & Rare 3-Min Shooting Star */}
      {activeScene.isNight && (
        <div className="absolute inset-0 z-0 pointer-events-none transition-opacity duration-1000 overflow-hidden">
          {/* Distant Solar System Planets */}
          {/* Saturn (Ringed Planet in Top-Left Sky) */}
          <div className="absolute top-14 left-10 md:left-24 opacity-80 animate-pulse" style={{ animationDuration: '6s' }}>
            <svg className="w-10 h-10 md:w-14 md:h-14 text-amber-200/90" viewBox="0 0 100 100">
              <ellipse cx="50" cy="50" rx="42" ry="14" fill="none" stroke="currentColor" strokeWidth="4" className="opacity-70" transform="rotate(-20 50 50)" />
              <circle cx="50" cy="50" r="20" fill="currentColor" className="text-amber-300" />
            </svg>
          </div>

          {/* Mars (Red Planet in Top-Right Sky) */}
          <div className="absolute top-20 right-32 md:right-48 opacity-75 animate-pulse" style={{ animationDuration: '4s' }}>
            <svg className="w-6 h-6 md:w-8 md:h-8 text-rose-400" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="16" fill="currentColor" className="shadow-[0_0_15px_rgba(244,63,94,0.8)]" />
            </svg>
          </div>

          {/* Neptune / Azure Gas Giant (Mid-Right Sky) */}
          <div className="absolute top-36 right-12 md:right-24 opacity-70 animate-pulse" style={{ animationDuration: '5s' }}>
            <svg className="w-8 h-8 md:w-10 md:h-10 text-cyan-300" viewBox="0 0 50 50">
              <circle cx="25" cy="25" r="18" fill="currentColor" />
              <ellipse cx="25" cy="25" rx="24" ry="7" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-60" transform="rotate(15 25 25)" />
            </svg>
          </div>

          {/* Constellation of 25+ Shining & Rotating 4-Point Sparkle Stars */}
          {[
            { top: '8%', left: '15%', size: 'w-4 h-4', delay: '0s' },
            { top: '12%', left: '35%', size: 'w-3 h-3', delay: '0.6s' },
            { top: '6%', left: '60%', size: 'w-5 h-5', delay: '1.2s' },
            { top: '18%', left: '78%', size: 'w-3 h-3', delay: '0.4s' },
            { top: '22%', left: '22%', size: 'w-4 h-4', delay: '1.8s' },
            { top: '28%', left: '48%', size: 'w-5 h-5', delay: '0.9s' },
            { top: '14%', left: '88%', size: 'w-3 h-3', delay: '2.1s' },
            { top: '32%', left: '12%', size: 'w-4 h-4', delay: '1.5s' },
            { top: '38%', left: '68%', size: 'w-3 h-3', delay: '0.3s' },
            { top: '25%', left: '82%', size: 'w-4 h-4', delay: '2.4s' },
            { top: '10%', left: '42%', size: 'w-3 h-3', delay: '1.1s' },
            { top: '42%', left: '28%', size: 'w-4 h-4', delay: '0.7s' },
            { top: '16%', left: '5%', size: 'w-5 h-5', delay: '1.9s' },
            { top: '35%', left: '92%', size: 'w-4 h-4', delay: '1.3s' },
            { top: '48%', left: '80%', size: 'w-3 h-3', delay: '2.2s' },
            { top: '5%', left: '25%', size: 'w-3 h-3', delay: '2.5s' },
            { top: '15%', left: '52%', size: 'w-4 h-4', delay: '0.8s' },
            { top: '27%', left: '62%', size: 'w-3 h-3', delay: '1.6s' },
            { top: '30%', left: '38%', size: 'w-4 h-4', delay: '2.7s' },
            { top: '45%', left: '10%', size: 'w-3 h-3', delay: '1.4s' },
            { top: '8%', left: '72%', size: 'w-4 h-4', delay: '0.2s' },
            { top: '20%', left: '95%', size: 'w-3 h-3', delay: '1.7s' },
          ].map((star, i) => (
            <div
              key={i}
              className={`absolute ${star.size} text-white/90 animate-star-sparkle pointer-events-none`}
              style={{ top: star.top, left: star.left, animationDelay: star.delay }}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
              </svg>
            </div>
          ))}

          {/* Realistic Fast Meteor / Shooting Star Fall Event */}
          <div className="absolute top-10 right-1/4 z-10 pointer-events-none animate-shooting-star">
            <div className="flex items-center">
              <div className="w-28 md:w-44 h-0.5 md:h-1 bg-gradient-to-l from-white via-amber-200 to-transparent rounded-full shadow-[0_0_12px_rgba(255,255,255,1)]" />
              <div className="w-2.5 h-2.5 md:w-3.5 md:h-3.5 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,1)] -ml-1.5" />
            </div>
          </div>
        </div>
      )}

      {/* 2D Celestial Body (Sun / Crescent Moon) with Smooth Continuous Arc Movement */}
      <div
        className="absolute z-0 pointer-events-none flex items-center justify-center transition-all duration-1000 ease-linear"
        style={{
          left: `${celestialLeft}%`,
          top: `${celestialTop}%`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        {/* Celestial Body: Daytime Sun vs Night Sickle Moon vs Late Night Full Moon */}
        {!activeScene.isNight ? (
          /* Glowing Sun with Rotating Solar Rays */
          <>
            <div className="absolute w-44 h-44 md:w-60 md:h-60 rounded-full border border-white/30 border-dashed animate-sun-spin" />
            <div className="absolute w-56 h-56 md:w-72 md:h-72 rounded-full border border-amber-200/20 animate-sun-spin" style={{ animationDirection: 'reverse', animationDuration: '45s' }} />
            <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full bg-gradient-to-tr ${activeScene.sunGradient} animate-sun-pulse ${activeScene.sunShadow} transition-all duration-1000`} />
          </>
        ) : activeSceneId === 'night' ? (
          /* Sharp Sickle Crescent Moon for Night (8pm - 12am) */
          <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center filter drop-shadow-[0_0_25px_rgba(226,232,240,0.85)]">
            <svg viewBox="0 0 100 100" className="w-full h-full text-slate-100 dark:text-slate-50 transition-all duration-1000">
              {/* Sharp Sickle Crescent Path */}
              <path d="M52 8 C26 8, 8 28, 8 54 C 8 80, 26 92, 54 92 C 34 80, 26 60, 30 42 C 34 26, 44 16, 52 8 Z" fill="currentColor" />
            </svg>
          </div>
        ) : (
          /* Detailed Glowing Full Moon for Late Night (12am - 5am) */
          <div className="relative w-24 h-24 md:w-32 md:h-32 flex items-center justify-center">
            {/* Outer Lunar Aura Glow */}
            <div className="absolute w-36 h-36 md:w-48 md:h-48 rounded-full bg-slate-200/15 animate-pulse" />
            {/* Full Moon Disc */}
            <div className="w-22 h-22 md:w-28 md:h-28 rounded-full bg-gradient-to-tr from-slate-300 via-slate-100 to-white shadow-[0_0_80px_rgba(241,245,249,0.9)] relative overflow-hidden flex items-center justify-center transition-all duration-1000">
              {/* Subtle Lunar Craters */}
              <div className="absolute top-3 left-4 w-4 h-4 rounded-full bg-slate-300/40" />
              <div className="absolute top-8 right-5 w-6 h-6 rounded-full bg-slate-300/30" />
              <div className="absolute bottom-4 left-7 w-5 h-5 rounded-full bg-slate-300/35" />
              <div className="absolute bottom-7 right-7 w-3 h-3 rounded-full bg-slate-300/25" />
            </div>
          </div>
        )}
      </div>

      {/* 2D Distant Flying Birds Silhouette */}
      <div className="absolute top-20 left-1/4 z-0 pointer-events-none opacity-70 animate-birds-fly">
        <svg className="w-20 h-10 text-slate-800/60 dark:text-emerald-300/40" viewBox="0 0 100 50">
          <path d="M10,25 Q20,10 30,25 Q40,10 50,25" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M55,15 Q62,5 70,15 Q78,5 85,15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M35,38 Q40,30 45,38 Q50,30 55,38" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>

      {/* 2D Floating SVG Clouds */}
      <div className={`absolute top-12 left-10 md:left-24 z-0 pointer-events-none ${activeScene.cloudOpacity} animate-cloud-float transition-opacity duration-1000`}>
        <svg className="w-32 h-16 md:w-48 md:h-24 fill-white/80 dark:fill-slate-800/40 drop-shadow-sm" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
        </svg>
      </div>
      <div className={`absolute top-28 right-1/3 z-0 pointer-events-none ${activeScene.cloudOpacity} animate-cloud-float transition-opacity duration-1000`} style={{ animationDelay: '-12s' }}>
        <svg className="w-24 h-12 md:w-36 md:h-18 fill-white/70 dark:fill-slate-800/30" viewBox="0 0 24 24">
          <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>
        </svg>
      </div>

      {/* 2D Curved Layered Green Mountain Ranges & Distant Trees (Seamless overlay with active scene colors) */}
      <div className="absolute inset-x-0 bottom-0 z-0 pointer-events-none h-56 sm:h-72 md:h-96 overflow-hidden">
        {/* Layer 1: Back Mountain Curve */}
        <svg viewBox="0 0 1440 320" className={`absolute bottom-0 w-full h-full ${activeScene.backMountain} transition-colors duration-1000`} preserveAspectRatio="none">
          <path fill="currentColor" d="M0,120 C320,240 440,60 720,160 C1000,260 1180,80 1440,140 L1440,320 L0,320 Z" />
        </svg>

        {/* Layer 2: Middle Mountain Curve */}
        <svg viewBox="0 0 1440 320" className={`absolute bottom-0 w-full h-[82%] ${activeScene.middleMountain} transition-colors duration-1000`} preserveAspectRatio="none">
          <path fill="currentColor" d="M0,170 C240,80 480,210 720,120 C960,30 1200,170 1440,100 L1440,320 L0,320 Z" />
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

      <div className="max-w-md w-full uipro-card relative z-10 space-y-6 bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/60 dark:border-slate-800/60 shadow-2xl">
        
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
              Staff Login Portal
            </button>
          ) : (
            <button
              type="button"
              onClick={() => switchPortal('student')}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:bg-blue-50/50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 hover:text-brand-blue font-medium text-sm shadow-sm transition-all duration-200 cursor-pointer w-full justify-center"
            >
              <GraduationCap className="h-4 w-4 text-brand-blue dark:text-blue-400" />
              Student Login Portal
            </button>
          )}
        </div>

      </div>
    </div>
  );
};
