import { useEffect, useRef, useState, type ReactNode } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ArrowRight, ChevronDown, Download } from 'lucide-react';
import { APP_DOWNLOAD_URL, goTo } from '../../utils/publicRoute';
import { Backdrop, Tiles } from './Backdrop';
import { Book } from './Book';
import { PublicHeader } from './PublicHeader';
import { Monitor, Phone, type DeviceScript } from './scenes';
import { BOOK, BOOK_CLOSE, BOOK_FLIP, MONITOR, PHONE } from './sceneConfig';
import { GlitterWarp } from './GlitterWarp';
import { Intro } from './Intro';
import LightRays from './reactbits/LightRays';
import { interpolate, useRange, useViewport } from './range';
import './public.css';

/*
 * Before the story: the interactive intro (Intro.tsx), which the story's stage slides up over.
 * Storyboard (story progress 0-1, driven only by scrolling, so it can be read forwards and backwards at the reader's own pace):
 *   0.00-0.39  About USAS: a closed book seen from the side turns upright, opens and turns its pages: welcome, the school, students, staff;
 *              then it shuts from the back, turns round to its front cover and is lifted away up to the bar.
 *   0.39-0.65  The app: a phone powers on, the app opens and shows sign-in, the student dashboard, the face check-in, Recorded.
 *   0.64-0.92  The web portal: a monitor powers on, the camera moves in: portal choice, student sign-in, dashboard, timetable.
 *   0.91-1.00  Closing: the phone and the monitor together, with Open Portal and Get the App.
 * Every screen is a capture of the real app or web portal running on sample data (see public/demo), never a real account.
 * The stage follows the references the owner chose (puture.co.kr, karma-tracks.com, anniversary.troispasdecote.fr): a deep blue night with a light cone, a
 * grid floor, glossy floating tiles that burst outward at each chapter, large editorial type that arrives word by word, and objects that stay in one scene.
 */
// Every object stands in the middle of the stage, so each hand-over is strictly one after the other: the old one is gone before the new one comes.
const T = {
  bookShut: [BOOK_CLOSE[0] * 0.34, BOOK_CLOSE[1] * 0.34], bookRise: [BOOK_FLIP[1] * 0.34, 0.388], bookOut: [0.38, 0.388],
  phoneIn: [0.388, 0.403], phoneOn: [0.403, 0.407], phoneBoot: [0.407, 0.414] as [number, number], phoneOut: [0.625, 0.64],
  monitorIn: [0.64, 0.67], monitorOn: [0.67, 0.68], monitorBoot: [0.68, 0.7] as [number, number], monitorZoom: [0.68, 0.74], monitorOut: [0.9, 0.925], closingIn: [0.915, 0.95],
} as const;
const PHONE_SCRIPT: DeviceScript = {
  boot: T.phoneBoot,
  screens: [
    { src: '/demo/app-login.webp', alt: 'The mobile app sign-in screen', from: 0.415, to: 0.455 },
    { src: '/demo/app-dashboard.webp', alt: 'The student dashboard in the mobile app', from: 0.47, to: 0.51 },
    { src: '/demo/app-checkin.webp', alt: 'The face check-in screen in the mobile app', from: 0.525, to: 0.565 },
    { src: '/demo/app-recorded.webp', alt: 'The app confirming the attendance is recorded', from: 0.58, to: 0.625 },
  ],
  taps: [{ at: 0.445, x: 0.5, y: 0.699 }, { at: 0.5, x: 0.5, y: 0.479 }],
  scan: [0.53, 0.575],
};
const MONITOR_SCRIPT: DeviceScript = {
  boot: T.monitorBoot,
  screens: [
    { src: '/demo/web-portal.webp', alt: 'The web portal choice: Student or Staff', from: 0.71, to: 0.745 },
    { src: '/demo/web-login.webp', alt: 'The student sign-in page on the web', from: 0.76, to: 0.795 },
    { src: '/demo/web-dashboard.webp', alt: 'The student dashboard on the web', from: 0.81, to: 0.845 },
    { src: '/demo/web-timetable.webp', alt: 'The student timetable on the web', from: 0.86, to: 0.9 },
  ],
  taps: [{ at: 0.735, x: 0.356, y: 0.55 }, { at: 0.785, x: 0.5, y: 0.722 }, { at: 0.835, x: 0.112, y: 0.251 }],
};
type Caption = { from: number; to: number; overline: string; title: string; text?: string };
const CAPTIONS: Caption[] = [
  { from: 0.085, to: 0.15, overline: '01 · About USAS', title: 'Welcome to USAS', text: 'Your classes and attendance, together.' },
  { from: 0.161, to: 0.222, overline: '01 · About USAS', title: 'For the school', text: 'Classes, timetables and semesters in one place.' },
  { from: 0.233, to: 0.29, overline: '01 · About USAS', title: 'For students', text: 'Check in on campus with your face.' },
  { from: 0.301, to: 0.345, overline: '01 · About USAS', title: 'For staff', text: 'Open a class and review who came.' },
  { from: 0.415, to: 0.459, overline: '02 · The app', title: 'Sign in on your phone', text: 'Use your school account.' },
  { from: 0.47, to: 0.514, overline: '02 · The app', title: 'See your classes', text: 'Your dashboard shows what is next.' },
  { from: 0.525, to: 0.569, overline: '02 · The app', title: 'Check in with your face', text: 'In class, on campus Wi-Fi.' },
  { from: 0.58, to: 0.64, overline: '02 · The app', title: 'Recorded', text: 'The app confirms your attendance.' },
  { from: 0.71, to: 0.749, overline: '03 · On the web', title: 'Choose your portal', text: 'Student or Staff.' },
  { from: 0.76, to: 0.799, overline: '03 · On the web', title: 'Sign in', text: 'The same school account.' },
  { from: 0.81, to: 0.849, overline: '03 · On the web', title: 'Your dashboard', text: 'Attendance and notices for this semester.' },
  { from: 0.86, to: 0.915, overline: '03 · On the web', title: 'Your timetable', text: 'Every class of your current semester.' },
];
const CHAPTERS = [{ label: 'About', from: 0, to: 0.385 }, { label: 'The app', from: 0.385, to: 0.64 }, { label: 'The web', from: 0.64, to: 0.91 }, { label: 'Start', from: 0.91, to: 1 }];
// From the web chapter on the tiles are gone entirely: dimmed but still drawn they showed as dark shapes at the edges of the web screen, and the
// closing words need the room they drift through.
const DIM = [[0, 1], [0.08, 0.7], [0.3, 0.75], [0.345, 1], [0.4, 0.45], [0.6, 0.45], [0.645, 1], [0.69, 0], [1, 0]];

/** A scene that is faded out is also hidden: it costs nothing and never covers the others. */
function useVisible(value: MotionValue<number>, warm: boolean) {
  return useTransform(value, current => (warm || current > 0.01 ? 'visible' : 'hidden'));
}

/**
 * True for the first moments after the page opens. The scenes that are not on yet are then drawn at almost no opacity, so the browser rasterises and
 * decodes them once, quietly, instead of at the instant they first appear (which showed as a hitch of about 100 ms when the phone and the screens came in).
 */
function useWarmUp(urls: string[]) {
  const [warm, setWarm] = useState(true);
  useEffect(() => {
    let alive = true;
    const loads = urls.map(url => { const image = new Image(); image.src = url; return image.decode().catch(() => undefined); });
    const done = () => { if (alive) setWarm(false); };
    Promise.race([Promise.all(loads).then(() => new Promise(resolve => setTimeout(resolve, 700))), new Promise(resolve => setTimeout(resolve, 3500))]).then(done);
    return () => { alive = false; };
  }, [urls]);
  return warm;
}

/** One word of a headline: sharpens and rises into place as the story reaches `at`. */
function Word({ p, at, children }: { p: MotionValue<number>; at: number; children: string }) {
  const opacity = useRange(p, [at, at + 0.009], [0, 1]);
  const y = useTransform(opacity, value => (1 - value) * 24);
  const filter = useTransform(opacity, value => `blur(${(1 - value) * 10}px)`);
  return <motion.span className="mr-[0.26em] inline-block" style={{ opacity, y, filter }}>{children}</motion.span>;
}

const HEADLINE = 'font-display font-extrabold leading-[0.98] tracking-tight text-white text-[clamp(1.7rem,min(5.4vw,9.5vh),4.6rem)] [text-shadow:0_2px_30px_rgba(2,6,23,0.55)]';
const HEADLINE_SMALL = 'font-display font-extrabold leading-[1.02] tracking-tight text-white text-[clamp(1.4rem,min(3vw,6vh),2.5rem)]';
const CAPTION_BOX = 'pointer-events-none absolute bottom-8 left-5 right-5 sm:bottom-14 sm:left-10 sm:right-auto sm:max-w-[min(46vw,38rem)]';

/** On a wide screen the words keep to the column left of the centred object: its width, and a headline size that fits it. */
const column = (width?: number) => (width ? { maxWidth: width, fontSize: Math.min(73.6, width / 5) } : undefined);

function CaptionBlock({ p, caption, width }: { p: MotionValue<number>; caption: Caption; width?: number }) {
  const opacity = useRange(p, [caption.from - 0.004, caption.from, caption.to, caption.to + 0.006], [0, 1, 1, 0]);
  const rise = useTransform(opacity, value => (1 - value) * 16);
  // Over the web screen, which fills the view, the words sit on a small piece of dark glass instead of on the picture itself.
  const onScreen = caption.overline.startsWith('03');
  return (
    <motion.div aria-hidden="true" data-caption={caption.title} className={`${CAPTION_BOX} ${onScreen ? 'sm:max-w-[min(40vw,26rem)] rounded-2xl border border-white/15 bg-slate-950/80 p-4 backdrop-blur-xl sm:p-5' : ''}`} style={{ opacity, y: rise, maxWidth: onScreen ? undefined : column(width)?.maxWidth }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-300">{caption.overline}</p>
      <h2 className={`mt-2 ${onScreen ? HEADLINE_SMALL : HEADLINE}`} style={onScreen ? undefined : { fontSize: column(width)?.fontSize }}>{caption.title.split(' ').map((word, index) => <Word key={index} p={p} at={caption.from + index * 0.004}>{word}</Word>)}</h2>
      {caption.text && <p className="mt-3 text-base font-medium text-blue-100/85 sm:text-lg">{caption.text}</p>}
    </motion.div>
  );
}

/** The story's first words, shown as the stage arrives over the intro: the book is about to open. They give way at the first scroll. */
function Hero({ p, width }: { p: MotionValue<number>; width?: number }) {
  const opacity = useRange(p, [0.03, 0.065], [1, 0]);
  const rise = useTransform(opacity, value => (1 - value) * -30);
  return (
    <motion.div aria-hidden="true" data-caption="hero" className={CAPTION_BOX} style={{ opacity, y: rise, maxWidth: column(width)?.maxWidth }}>
      <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-300">01 · About USAS</p>
      <h2 className={`mt-2 ${HEADLINE}`} style={{ fontSize: column(width)?.fontSize }}>Open the book</h2>
      <p className="mt-3 text-base font-medium text-blue-100/85 sm:text-lg">Scroll to turn its pages.</p>
    </motion.div>
  );
}

function Actions({ center = false }: { center?: boolean }) {
  return (
    <div className={`flex flex-wrap gap-3 ${center ? 'justify-center' : ''}`}>
      <button type="button" onClick={() => goTo('/portal')} className="ps-star inline-flex h-12 items-center gap-2 rounded-xl bg-brand-blue px-6 text-sm font-bold text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">Open Portal<ArrowRight className="h-4 w-4" /></button>
      <a href={APP_DOWNLOAD_URL} target="_blank" rel="noreferrer" className="ps-star inline-flex h-12 items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-6 text-sm font-bold text-white backdrop-blur hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"><Download className="h-4 w-4" />Get the App</a>
    </div>
  );
}

/**
 * Chapter marks and progress. On wide screens they sit in the header's bar, between the logo and Open Portal, with a thin line of progress along the
 * bar's lower edge; on narrow screens they are a row of small marks under the bar.
 */
function Rail({ p }: { p: MotionValue<number> }) {
  const fill = useTransform(p, value => `${value * 100}%`);
  return (
    <>
        <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-[63px] z-[60] h-[2px]"><motion.div className="h-full bg-brand-blue" style={{ width: fill }} /></div>
        <div aria-hidden="true" className="pointer-events-none fixed left-1/2 top-[74px] z-[60] flex -translate-x-1/2 items-center gap-2 lg:top-[23px] lg:gap-6">
          {CHAPTERS.map((chapter, index) => <RailMark key={chapter.label} p={p} chapter={chapter} index={index} />)}
        </div>
    </>
  );
}
function RailMark({ p, chapter, index }: { p: MotionValue<number>; chapter: { label: string; from: number; to: number }; index: number }) {
  const active = useRange(p, [chapter.from - 0.01, chapter.from, chapter.to - 0.005, chapter.to], [0, 1, 1, 0]);
  const opacity = useTransform(active, value => 0.45 + value * 0.55);
  const width = useTransform(active, value => 8 + value * 18);
  return (
    <motion.div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-white lg:text-slate-800" style={{ opacity }}>
      <span className="hidden lg:inline">{`0${index + 1} ${chapter.label}`}</span>
      <motion.span className="h-1.5 rounded-full bg-blue-300 lg:bg-brand-blue" style={{ width }} />
    </motion.div>
  );
}
const DEMO_URLS = [...PHONE_SCRIPT.screens, ...MONITOR_SCRIPT.screens].map(screen => screen.src);
const BOOK_SPREAD = BOOK.w * 2 + 20;
const SCENE = 'ps-stage absolute inset-0 flex items-center justify-center pt-16';
// A device is solid for most of its swing in and out (half see-through, the tiles behind showed through its body).
const solid = (share: number) => Math.min(1, share * 2.5);
const GUTTER = 64;   // the words' left margin (40) and the gap to the object (24)

/** The scroll-driven story. Everything is CSS 3D (no WebGL), so it renders wherever the page does. */
function ScrollStory() {
  const container = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: container, offset: ['start start', 'end end'] });
  const { w: vw, h: vh } = useViewport();
  const narrow = vw < 640;
  const short = !narrow && vh < 520;   // a phone held sideways: the words keep the left, the objects the right
  // Wide: every object stands in the middle of the screen and the words keep to the column on its left. Otherwise (phones, tablets, square
  // windows) the object stands in the middle above the words.
  const wide = !narrow && !short && vw >= 1100 && vw / vh >= 1.3;
  const warm = useWarmUp(DEMO_URLS);
  const reserve = narrow ? 210 : wide || short ? 0 : 200;   // room for the words under the objects
  const columnFor = (objectWidth: number) => (wide ? Math.min(560, (vw - objectWidth) / 2 - GUTTER) : undefined);

  // Book
  // Book progress: 0-1 over its story (0-0.34), running on at the same rate while it shuts (BOOK_CLOSE), turns to its front (BOOK_FLIP) and is lifted away.
  const bookT = useRange(p, [0, 0.34, T.bookRise[1]], [0, 1, T.bookRise[1] / 0.34]);
  const bookOpacity = useRange(p, [...T.bookOut], [1, 0]);
  const bookVisible = useVisible(bookOpacity, warm);
  const objectX = short ? vw * 0.2 : 0;
  // Shut, it rises up to the bar as it fades (moved, never resized: a change of size would make the browser draw all of its pages again).
  const bookExit = useRange(p, [...T.bookRise], [0, -vh * 0.55]);
  const bookScale = narrow ? Math.min(1.1, (vw - 28) / BOOK_SPREAD)
    : wide ? Math.min(1.9, (vh - 190) / BOOK.h, (vw - 2 * (280 + GUTTER)) / BOOK_SPREAD)
    : Math.min(1.4, (vw * 0.58) / BOOK_SPREAD, (vh - 190 - reserve) / BOOK.h);
  // Phone
  const phoneIn = useRange(p, [...T.phoneIn], [0, 1]);
  const phoneOn = useRange(p, [...T.phoneOn], [0, 1]);
  const phoneOut = useRange(p, [...T.phoneOut], [0, 1]);
  const phoneOpacity = useTransform([phoneIn, phoneOut], ([a, b]: number[]) => solid(a) * solid(1 - b));
  const phoneVisible = useVisible(phoneOpacity, warm);
  // It swings in, then stands upright and square to the reader while its screens play, and swings away.
  const phoneRotateY = useTransform([phoneIn, phoneOut], ([a, out]: number[]) => (1 - a) * -60 + out * 40);
  const phoneRotateX = useTransform([phoneIn, phoneOut], ([a, out]: number[]) => (1 - a) * 8 - out * 6);
  const phoneY = useTransform([phoneIn, phoneOut], ([a, out]: number[]) => Math.round((1 - a) * 140 - out * 60));
  const phoneZoom = wide ? Math.min(1.9, (vh - 64 - 96) / PHONE.h) : Math.min(1.45, (vh - 64 - 60 - reserve) / PHONE.h, (vw - 40) / PHONE.w);
  // Monitor
  const monitorIn = useRange(p, [...T.monitorIn], [0, 1]);
  const monitorOn = useRange(p, [...T.monitorOn], [0, 1]);
  const monitorOut = useRange(p, [...T.monitorOut], [0, 1]);
  const monitorOpacity = useTransform([monitorIn, monitorOut], ([a, b]: number[]) => solid(a) * solid(1 - b));
  const monitorVisible = useVisible(monitorOpacity, warm);
  const monitorFit = Math.min((vw * 0.66) / MONITOR.w, (vh - 64 - 50 - reserve) / (MONITOR.h + MONITOR.stand), 1.6);
  // The monitor is drawn once at its closest size and only ever scaled down from there, so the screen is sharp when the camera is closest. Closest,
  // the whole monitor (bezel included) fits under the bar with a small margin, centred.
  const monitorZoom = Math.max(monitorFit, Math.min((vw - 32) / MONITOR.w, (vh - 64 - 32 - (narrow ? 150 : 0)) / MONITOR.h));
  const monitorScale = useRange(p, [...T.monitorZoom], [monitorFit / monitorZoom, 1]);
  const monitorRotateY = useTransform([monitorIn, p], ([a, value]: number[]) => (1 - a) * 38 + interpolate(value, [0.68, 0.74], [-6, 0]));
  const monitorRotateX = useRange(p, [...T.monitorZoom], [7, 0]);
  // At the closest view the screen's corner lands on a whole pixel, so the capture is drawn as sharply as a plain image (not shifted by half a pixel).
  const monitorPad = narrow ? 90 : 0;
  const screenLeft = (vw - MONITOR.w * monitorZoom) / 2 + MONITOR.screen.x * monitorZoom;
  const screenTop = 64 + (vh - 64 - monitorPad - (MONITOR.h + MONITOR.stand) * monitorZoom) / 2 + Math.round((MONITOR.stand / 2) * monitorZoom) + MONITOR.screen.y * monitorZoom;
  const snapX = Math.round(screenLeft) - screenLeft, snapY = Math.round(screenTop) - screenTop;
  const monitorY = useTransform([monitorScale, monitorOut], ([scale, out]: number[]) => Math.round((MONITOR.stand / 2) * monitorZoom * scale - out * 40) + snapY);
  // Closing
  const closing = useRange(p, [...T.closingIn], [0, 1]);
  const closingVisible = useVisible(closing, warm);
  const closingY = useTransform(closing, value => (1 - value) * 40);

  // The closing pair keeps its screens on their last image.
  const still = useMotionValue(0.5);
  const lit = useMotionValue(1);
  const closingPhone: DeviceScript = { screens: [{ ...PHONE_SCRIPT.screens[3], from: 0, to: 1 }] };
  const closingMonitor: DeviceScript = { screens: [{ ...MONITOR_SCRIPT.screens[2], from: 0, to: 1 }] };
  const pairScale = Math.max(0.2, Math.min(0.66, (vw - 48) / (MONITOR.w + PHONE.w * 0.9 - 24), (vh - 64 - (narrow ? 250 : 190)) / (MONITOR.h + MONITOR.stand)));
  const dim = useTransform(p, value => interpolate(value, DIM.map(point => point[0]), DIM.map(point => point[1])));
  const hint = useRange(p, [0, 0.02], [1, 0]);
  // From the cover opening (book progress 0.16-0.28) until the book shuts: light rays from above and a glittering warp, added over the existing
  // stage; both stop drawing (display none) while faded out.
  const rays = useRange(p, [0.054, 0.095, T.bookShut[0], T.bookShut[1]], [0, 1, 1, 0]);
  const raysDisplay = useTransform(rays, value => (value > 0.003 ? 'block' : 'none'));
  const warp = useRange(p, [0.054, 0.1, T.bookShut[0], T.bookShut[1]], [0, 1, 1, 0]);
  const warpDisplay = useTransform(warp, value => (value > 0.003 ? 'block' : 'none'));

  return (
    <>
    <div ref={container} id="tour" className="relative z-10" style={{ height: '1700vh' }}>
      <div className="sticky top-0 h-screen overflow-hidden bg-[#040a1c] shadow-[0_-40px_90px_rgba(2,6,23,0.85)]">
        <Backdrop p={p} />
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ opacity: warp, display: warpDisplay }}>
          <GlitterWarp color="#0085f0" brightness={1.5} />
        </motion.div>
        <Tiles p={p} dim={dim} vw={vw} vh={vh} fore={false} />
        <motion.div aria-hidden="true" data-book-rays className="pointer-events-none absolute inset-0" style={{ opacity: rays, display: raysDisplay }}>
          <LightRays raysOrigin="top-center" raysColor="#007aff" raysSpeed={1} lightSpread={0.5} rayLength={3} glow={0.6} haze={0.25} followMouse mouseInfluence={0.1}
            rayDensity={4} raySharpness={0.5} intensity={1.5} cursorShadow={false} />
        </motion.div>
        <motion.div className={SCENE} style={{ opacity: bookOpacity, visibility: bookVisible, paddingBottom: reserve, y: bookExit }}>
          <motion.div className="ps-3d" style={{ x: objectX }}><div className="ps-3d" style={{ zoom: bookScale }}><Book t={bookT} interactive /></div></motion.div>
        </motion.div>
        <motion.div className={`${SCENE} pointer-events-none`} style={{ opacity: warm ? 0.002 : phoneOpacity, visibility: phoneVisible, paddingBottom: reserve }}>
          <motion.div className="ps-3d relative" style={{ x: objectX, y: phoneY, rotateY: phoneRotateY, rotateX: phoneRotateX }}>
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-full h-10 w-[70%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-blue-500/25 blur-2xl" />
            <div className="ps-3d" style={{ zoom: phoneZoom }}><Phone p={p} on={phoneOn} script={PHONE_SCRIPT} warm={warm} /></div>
          </motion.div>
        </motion.div>
        <motion.div className={`${SCENE} pointer-events-none`} style={{ opacity: warm ? 0.002 : monitorOpacity, visibility: monitorVisible, paddingBottom: monitorPad }}>
          <motion.div className="ps-3d" style={{ rotateY: monitorRotateY, rotateX: monitorRotateX, scale: monitorScale, x: snapX, y: monitorY }}>
            <div className="ps-3d" style={{ zoom: monitorZoom }}><Monitor p={p} on={monitorOn} script={MONITOR_SCRIPT} warm={warm} /></div>
          </motion.div>
        </motion.div>
        <motion.div className={`${SCENE} flex-col gap-6 px-4`} style={{ opacity: warm ? 0.002 : closing, y: closingY, visibility: closingVisible, pointerEvents: warm ? 'none' : undefined }}>
          <div className="ps-3d flex items-end justify-center" style={{ height: (MONITOR.h + MONITOR.stand) * pairScale }}>
            <div className="ps-3d" style={{ transform: `rotateY(12deg)`, transformOrigin: 'bottom center', width: MONITOR.w * pairScale }}>
              <div className="ps-3d" style={{ zoom: pairScale, width: MONITOR.w }}><Monitor p={still} on={lit} script={closingMonitor} /></div>
            </div>
            <div className="ps-3d -ml-6" style={{ transform: `rotateY(-14deg)`, transformOrigin: 'bottom center', width: PHONE.w * pairScale * 0.9 }}>
              <div className="ps-3d" style={{ zoom: pairScale * 0.9, width: PHONE.w }}><Phone p={still} on={lit} script={closingPhone} /></div>
            </div>
          </div>
          <div className="text-center">
            <h2 className={HEADLINE}>Ready when you are</h2>
            <p className="mt-3 text-base font-medium text-blue-100/85">Open the portal on the web, or get the Android app. Every screen in this tour shows sample data.</p>
          </div>
          <Actions center />
        </motion.div>
        <Tiles p={p} dim={dim} vw={vw} vh={vh} fore />
        <Hero p={p} width={columnFor(BOOK_SPREAD * bookScale)} />
        {CAPTIONS.map(caption => <CaptionBlock key={caption.title} p={p} caption={caption} width={columnFor(caption.overline.startsWith('01') ? BOOK_SPREAD * bookScale : PHONE.w * phoneZoom)} />)}
        <motion.div aria-hidden="true" className="pointer-events-none absolute bottom-6 right-5 hidden flex-col items-center sm:flex text-[10px] font-bold uppercase tracking-[0.25em] text-blue-200 sm:right-10" style={{ opacity: hint }}>
          Scroll<ChevronDown className="mt-1 h-5 w-5 animate-bounce motion-reduce:animate-none" />
        </motion.div>
      </div>
    </div>
    {/* outside the story's layer (which slides over the intro), so the marks sit in the header's bar above it */}
    <Rail p={p} />
    </>
  );
}

/** With reduced motion: the same content as still, readable sections on the same stage. */
function StillStory() {
  const done = useMotionValue(0.5);
  const lit = useMotionValue(1);
  const bookT = useMotionValue(0.3);
  const section = (id: string, overline: string, title: string, text: string, children: ReactNode) => (
    <section aria-labelledby={id} className="space-y-6">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-300">{overline}</p><h2 id={id} className={`mt-2 ${HEADLINE}`}>{title}</h2><p className="mt-2 text-base font-medium text-blue-100/85">{text}</p></div>
      {children}
    </section>
  );
  const shots = (script: DeviceScript, kind: 'phone' | 'monitor') => (
    <ol className={`grid gap-6 ${kind === 'phone' ? 'grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-2'}`}>
      {script.screens.map(screen => {
        const caption = CAPTIONS.find(item => Math.abs(item.from - screen.from) < 0.003);
        const one: DeviceScript = { screens: [{ ...screen, from: 0, to: 1 }] };
        const scale = kind === 'phone' ? 0.62 : 0.5;
        const box = kind === 'phone' ? { width: PHONE.w * scale, height: PHONE.h * scale } : { width: MONITOR.w * scale, height: (MONITOR.h + MONITOR.stand) * scale };
        return (
          <li key={screen.src} className="space-y-2">
            <div className="ps-stage flex justify-center overflow-hidden"><div style={box}><div style={{ zoom: scale }}>{kind === 'phone' ? <Phone p={done} on={lit} script={one} /> : <Monitor p={done} on={lit} script={one} />}</div></div></div>
            <p className="text-sm font-bold text-white">{caption?.title}</p>
            {caption?.text && <p className="text-xs text-blue-100/80">{caption.text}</p>}
          </li>
        );
      })}
    </ol>
  );
  return (
    <div id="tour" className="relative overflow-hidden">
      <Backdrop p={done} reduce />
      <div className="relative mx-auto max-w-5xl space-y-20 px-4 pb-20 pt-28 sm:px-6">
        {section('still-about', '01 · About USAS', 'Welcome to USAS', 'Your classes and attendance, together. For the school: classes, timetables and semesters in one place. For students: check in on campus with your face. For staff: open a class and review who came.',
          <div className="ps-stage flex justify-center py-4"><div className="ps-3d" style={{ zoom: 0.9 }}><Book t={bookT} /></div></div>)}
        {section('still-phone', '02 · The app', 'Check in from your phone', 'Sign in, see your classes, check in with your face.', shots(PHONE_SCRIPT, 'phone'))}
        {section('still-monitor', '03 · On the web', 'Everything on the web too', 'The same school account, the same classes.', shots(MONITOR_SCRIPT, 'monitor'))}
        <section aria-labelledby="still-end" className="text-center">
          <h2 id="still-end" className={HEADLINE}>Ready when you are</h2>
          <p className="mb-6 mt-3 text-base font-medium text-blue-100/85">Open the portal on the web, or get the Android app. Every screen here shows sample data.</p>
          <Actions center />
        </section>
      </div>
    </div>
  );
}

/** smartsystem.live: what USAS is, then a scroll walk-through of the app and the web portal, then the way in. */
export function PublicHome() {
  const reduced = useReducedMotion();
  useEffect(() => { document.title = 'USAS - University Smart Attendance System'; }, []);
  return (
    <div className="min-h-screen bg-[#040a1c] text-slate-100">
      <PublicHeader />
      <h1 className="sr-only">USAS - University Smart Attendance System</h1>
      <ol className="sr-only">
        <li>About USAS: Welcome to USAS. Your classes and attendance, together.</li>
        {CAPTIONS.slice(1).map(caption => <li key={caption.title}>{caption.overline.slice(5)}: {caption.title}. {caption.text}</li>)}
        <li>Every screen shown is a sample, not a real account.</li>
      </ol>
      <main><Intro still={!!reduced} />{reduced ? <StillStory /> : <ScrollStory />}</main>
    </div>
  );
}
