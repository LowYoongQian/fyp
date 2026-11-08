import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Monitor, Moon, Sun } from 'lucide-react';
import { lookAt } from '../pages/security/loginLighting';
import { campusHour, cycleIsDark } from '../theme/themePreference';

// A picture, not themed UI: every colour is inline so the page's dark-mode class overrides never repaint it.
// Positions are percentages of the banner, so the scene fills a wide desktop card as well as a phone.
const DAY_SKY = 'linear-gradient(to bottom, #BFDBFE 0%, #EAF4FF 55%, #F8FAFC 100%)';
const NIGHT_SKY = 'linear-gradient(to bottom, #121212 0%, #181818 55%, #222222 100%)';
// Fixed star positions (% of the banner), so the picture never jumps between renders.
const STARS = [[6, 14], [14, 52], [21, 28], [29, 9], [36, 44], [44, 20], [51, 58], [57, 12], [63, 36], [70, 22], [76, 50], [83, 10], [90, 34], [95, 60], [9, 66], [40, 64], [67, 62], [33, 24], [48, 40], [60, 70], [25, 72], [86, 72]];

const partOfDay = (hour: number) => hour >= 4.9833 && hour < 7.9833 ? 'Early morning' : hour < 4.9833 ? 'Late night'
  : hour < 11.9833 ? 'Morning' : hour < 12.4833 ? 'Noon' : hour < 16.9833 ? 'Afternoon' : hour < 19.9833 ? 'Evening' : hour < 23.9833 ? 'Night' : 'Late night';
const clockOf = (hour: number) => { const minutes = Math.floor(hour * 60) % 1440; return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`; };
/** The campus hour when the Day/Night theme next turns light or dark (checked minute by minute, as on mobile). */
const nextThemeTurn = (hour: number) => {
  const dark = cycleIsDark(hour);
  for (let minute = 1; minute <= 1440; minute++) { const next = (hour + minute / 60) % 24; if (cycleIsDark(next) !== dark) return next; }
  return hour;
};

const abs = (style: CSSProperties): CSSProperties => ({ position: 'absolute', ...style });
const SunDisc = ({ left, top, opacity = 1 }: { left: string; top: string; opacity?: number }) => <>
  <span style={abs({ left, top, width: 84, height: 84, marginLeft: -42, marginTop: -42, borderRadius: '50%', opacity, background: 'radial-gradient(circle, rgba(253,230,138,.55) 0%, rgba(253,230,138,0) 70%)' })} />
  <span style={abs({ left, top, width: 26, height: 26, marginLeft: -13, marginTop: -13, borderRadius: '50%', opacity, background: 'radial-gradient(circle at 40% 40%, #FFFBEB 0%, #FDE68A 65%, #FBBF24 100%)' })} />
</>;
// A crescent from an inset shadow: the lit edge is the shadow, the rest of the disc is transparent.
const MoonDisc = ({ left, top, opacity = 1 }: { left: string; top: string; opacity?: number }) => <>
  <span style={abs({ left, top, width: 70, height: 70, marginLeft: -35, marginTop: -35, borderRadius: '50%', opacity, background: 'radial-gradient(circle, rgba(255,255,255,.13) 0%, rgba(255,255,255,0) 70%)' })} />
  <span style={abs({ left, top, width: 24, height: 24, marginLeft: -12, marginTop: -12, borderRadius: '50%', opacity, boxShadow: 'inset -7px 5px 0 0 #F5F5F4', transform: 'rotate(-20deg)' })} />
</>;
const Cloud = ({ left, top, scale = 1 }: { left: string; top: string; scale?: number }) => <span style={abs({ left, top, width: 0, height: 0, transform: `scale(${scale})` })}>
  {[[-16, 4, 8], [-5, -2, 11], [8, 3, 9], [18, 6, 6]].map(([dx, dy, r], i) =>
    <span key={i} style={abs({ left: dx - r, top: dy - r, width: r * 2, height: r * 2, borderRadius: '50%', background: 'rgba(255,255,255,.9)' })} />)}
</span>;
const Stars = ({ opacity }: { opacity: number }) => <>{STARS.map(([x, y], i) =>
  <span key={i} style={abs({ left: `${x}%`, top: `${y}%`, width: i % 3 ? 2 : 3, height: i % 3 ? 2 : 3, borderRadius: '50%', background: '#fff', opacity: opacity * (0.45 + (i % 4) * 0.15) })} />)}</>;
const Hills = ({ back, front }: { back: string; front: string }) => <svg aria-hidden="true" viewBox="0 0 100 20" preserveAspectRatio="none" style={abs({ left: 0, right: 0, bottom: 0, width: '100%', height: 22 })}>
  <path d="M0 20 L0 9 C 15 3, 28 12, 45 7 C 62 2, 78 11, 100 5 L100 20 Z" fill={back} />
  <path d="M0 20 L0 14 C 20 9, 35 17, 55 13 C 72 10, 86 16, 100 12 L100 20 Z" fill={front} />
</svg>;

/** A small app window in the theme's colours: title bar, side menu, headings, two tiles and a button. */
// Hidden below the sm breakpoint: on a phone-width card it would crowd the words, so phones get the scene and words only.
function AppWindow({ dark, style }: { dark: boolean; style: CSSProperties }) {
  const c = dark ? { bg: '#262626', edge: '#3A3A3A', bar: '#1F1F1F', side: '#1C1C1C', line: '#4B5563', tile: '#303030', accent: '#60A5FA' }
    : { bg: '#FFFFFF', edge: '#E2E8F0', bar: '#F8FAFC', side: '#F1F5F9', line: '#CBD5E1', tile: '#EFF6FF', accent: '#2563EB' };
  return <span className="hidden sm:block" style={abs({ top: '50%', height: 78, marginTop: -39, borderRadius: 10, overflow: 'hidden', background: c.bg, border: `1px solid ${c.edge}`,
    boxShadow: dark ? '0 8px 20px rgba(0,0,0,.45)' : '0 8px 20px rgba(15,23,42,.12)', ...style })}>
    <span style={abs({ left: 0, right: 0, top: 0, height: 12, background: c.bar, borderBottom: `1px solid ${c.edge}` })}>
      {['#F87171', '#FBBF24', '#34D399'].map((dot, i) => <span key={dot} style={abs({ left: 6 + i * 7, top: 4, width: 4, height: 4, borderRadius: '50%', background: dot })} />)}
    </span>
    <span style={abs({ left: 0, top: 12, bottom: 0, width: '22%', background: c.side, borderRight: `1px solid ${c.edge}` })}>
      {[0, 1, 2].map(i => <span key={i} style={abs({ left: '20%', right: '20%', top: 8 + i * 10, height: 4, borderRadius: 2, background: i === 0 ? c.accent : c.line, opacity: i === 0 ? 0.9 : 0.7 })} />)}
    </span>
    <span style={abs({ left: '28%', top: 19, width: '50%', height: 5, borderRadius: 3, background: c.accent, opacity: 0.85 })} />
    <span style={abs({ left: '28%', top: 28, width: '34%', height: 4, borderRadius: 2, background: c.line })} />
    {[0, 1].map(i => <span key={i} style={abs({ left: `${28 + i * 34}%`, top: 38, width: '30%', height: 18, borderRadius: 5, background: c.tile, border: `1px solid ${c.edge}` })} />)}
    <span style={abs({ right: '8%', bottom: 7, width: '24%', height: 8, borderRadius: 4, background: c.accent })} />
  </span>;
}

const WINDOW: CSSProperties = { right: '3%', width: 'clamp(124px, 24%, 200px)' };
const Day = ({ sunLeft = '52%', sunTop = '36%' }) => <><span style={abs({ inset: 0, background: DAY_SKY })} />
  <SunDisc left={sunLeft} top={sunTop} /><Cloud left="44%" top="62%" scale={0.9} /><Cloud left="64%" top="26%" scale={0.75} />
  <Hills back="#D1FAE5" front="#BBF7D0" /></>;
const Night = ({ moonLeft = '54%', moonTop = '36%' }) => <><span style={abs({ inset: 0, background: NIGHT_SKY })} /><Stars opacity={1} />
  <MoonDisc left={moonLeft} top={moonTop} /><Hills back="#262626" front="#2E2E2E" /></>;

function Banner({ label, title, line, badge, badgeIcon, lightText, lightBadge, textWidth = 'sm:max-w-[40%]', children }: {
  label: string; title: string; line: string; badge: string; badgeIcon: ReactNode; lightText: boolean; lightBadge: boolean; textWidth?: string; children: ReactNode;
}) {
  const ink = lightText ? '#0F172A' : '#FFFFFF', shadow = lightText ? 'none' : '0 1px 6px rgba(0,0,0,.4)';
  return <div role="img" aria-label={label} className="relative h-28 w-full overflow-hidden rounded-2xl" style={{ isolation: 'isolate' }}>
    {children}
    <span style={abs({ left: 16, top: 14 })} className={`flex max-w-[70%] flex-col items-start ${textWidth}`}>
      <span className="block text-sm font-extrabold" style={{ color: ink, textShadow: shadow }}>{title}</span>
      <span className="block text-[11px] leading-snug" style={{ color: ink, opacity: 0.85, textShadow: shadow }}>{line}</span>
      <span className="mt-2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold" style={{
        background: lightBadge ? 'rgba(255,255,255,.8)' : 'rgba(0,0,0,.3)', border: `1px solid ${lightBadge ? '#BFDBFE' : 'rgba(255,255,255,.25)'}`, color: lightBadge ? '#1E3A8A' : '#FFFFFF' }}>
        {badgeIcon}{badge}</span>
    </span>
  </div>;
}

/** The live Day/Night sky right now, from the same clock as the sign-in page; it updates every 30 seconds. */
function CycleBanner({ hour }: { hour: number }) {
  const look = lookAt(hour), dark = cycleIsDark(hour), turn = clockOf(nextThemeTurn(hour));
  const next = dark ? `Light theme from ${turn}` : `Dark theme from ${turn}`;
  const at = (arc: { left: number; elevation: number }) => ({ left: `${arc.left}%`, top: `${92 - arc.elevation * 66}%` });
  return <Banner label={`Day and night sky now: ${partOfDay(hour)}, ${clockOf(hour)}. ${next}.`} title={partOfDay(hour)} line={`Campus time ${clockOf(hour)}`}
    badge={next} badgeIcon={dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />} lightText={false} lightBadge={false}>
    <span style={abs({ inset: 0, background: look.sky.gradient })} />
    <span style={abs({ inset: 0, background: `radial-gradient(ellipse at 50% 100%, ${look.sky.glow} 0%, transparent 70%)` })} />
    {look.stars > 0.01 && <Stars opacity={look.stars} />}
    {look.sun.opacity > 0.01 && <SunDisc {...at(look.sun)} opacity={look.sun.opacity} />}
    {look.moon.opacity > 0.01 && <MoonDisc {...at(look.moon)} opacity={look.moon.opacity} />}
    <Hills back={look.ground.far} front={look.ground.hill} />
    {/* The app as it looks right now under Day/Night. */}
    <AppWindow dark={dark} style={WINDOW} />
  </Banner>;
}

function ModeBanner({ mode }: { mode: string }) {
  const [hour, setHour] = useState(campusHour);
  const [deviceDark, setDeviceDark] = useState(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false);
  useEffect(() => {
    if (mode === 'cycle') { const timer = window.setInterval(() => setHour(campusHour()), 30_000); return () => window.clearInterval(timer); }
    if (mode !== 'system' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-color-scheme: dark)'), onChange = () => setDeviceDark(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, [mode]);
  if (mode === 'cycle') return <CycleBanner hour={hour} />;
  if (mode === 'dark') return <Banner label="Dark theme preview: soft dark greys, easy on the eyes. Always dark." title="Dark" line="Soft dark greys, easy on the eyes"
    badge="Always dark" badgeIcon={<Moon className="h-3.5 w-3.5" />} lightText={false} lightBadge={false}><Night /><AppWindow dark style={WINDOW} /></Banner>;
  if (mode === 'system') {
    const badge = deviceDark ? 'Device is dark now' : 'Device is light now';
    // Light on the left with a light app window, dark on the right with a dark one, split on a slant.
    return <Banner label={`System theme preview: follows your device's look, light or dark. ${badge}.`} title="System" line="Follows your device's look"
      badge={badge} badgeIcon={<Monitor className="h-3.5 w-3.5" />} lightText lightBadge textWidth="sm:max-w-[26%]">
      <Day sunLeft="51%" sunTop="22%" />
      <AppWindow dark={false} style={{ left: '27%', width: 'clamp(110px, 19%, 180px)' }} />
      <span style={abs({ inset: 0, clipPath: 'polygon(57% 0, 100% 0, 100% 100%, 47% 100%)' })}>
        <Night moonLeft="66%" moonTop="30%" /><AppWindow dark style={{ right: '3%', width: 'clamp(110px, 19%, 180px)' }} />
      </span>
    </Banner>;
  }
  return <Banner label="Light theme preview: bright, clean screens all day. Always light." title="Light" line="Bright, clean screens all day"
    badge="Always light" badgeIcon={<Sun className="h-3.5 w-3.5 text-[#2563eb]" />} lightText lightBadge><Day /><AppWindow dark={false} style={WINDOW} /></Banner>;
}

/** The banner under the Theme Mode buttons showing what the chosen mode looks like; it cross-fades when the choice changes. */
export function ThemeModePreview({ mode }: { mode: string }) {
  const reduce = !!useReducedMotion();
  return <div className="relative" data-theme-preview={mode}>
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={mode} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: reduce ? 0 : 0.18, ease: 'easeOut' }}>
        <ModeBanner mode={mode} />
      </motion.div>
    </AnimatePresence>
  </div>;
}
