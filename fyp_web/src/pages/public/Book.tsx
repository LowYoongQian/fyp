import { animate, motion, useMotionValue, useMotionValueEvent, useTransform, type MotionValue } from 'motion/react';
import { BookOpen, Check, Monitor, ScanFace, Smartphone, Wifi } from 'lucide-react';
import { createContext, useContext, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { Box3D } from './Box3D';
import { Mark } from './Mark';
import { interpolate, useRange } from './range';
import { BOOK, BOOK_CLOSE, BOOK_FLIP } from './sceneConfig';
import ShinyText from './reactbits/ShinyText';

/*
 * The book. Every opaque sheet hides what is under it until it is physically turned away:
 *   - the right pages are the FRONT of each turning leaf (R0, R1, R2) and, last, the face of the page block (R3);
 *   - the left pages are the BACK of each leaf (L1, L2, L3) and, first, the inside of the front cover (L0).
 * Heights above the page block (px, towards the reader): block face 14, right stack 14.5-15.5 (first leaf on top), left stack 12-13 (last leaf on top),
 * open cover 9, closed cover 18. A leaf slides smoothly between its right and left height while it turns, so no layer ever swaps.
 * The words of each open spread are not printed on the paper: they are a separate layer just above it (same ids, same layout) in React Bits'
 * Shiny Text, shown while the spread lies open and gone before a page turns, so a turning page carries only its pictures.
 * After the last spread the book shuts from the back, as a reader closes a finished book: the page block and the back cover (with the spine) swing
 * over onto the left stack, so the back cover faces up; then the closed book turns round to its front cover and is lifted away (PublicHome.tsx).
 */
const PW = BOOK.w - 8;            // a page, a little smaller than the covers
const PH = BOOK.h - 10;
const BLOCK_Z = 14;               // height of the block's face above its middle
const LEAVES = 3;
const rightZ = (index: number) => BLOCK_Z + 0.5 * (LEAVES - index);
const leftZ = (index: number) => 12 + 0.5 * index;
const grain = (strength: number) => `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${strength} 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")`;
const PAPER_GRAIN = grain(0.09);
const COVER_GRAIN = grain(0.35);
const PAPER = '#fbf8f1';
const COVER = `${COVER_GRAIN}, linear-gradient(135deg, #1e40af, #1e3a8a 55%, #172554)`;
const GOLD = 'linear-gradient(90deg, #a16207, #fde68a 45%, #ca8a04 70%, #fef3c7)';

/* ---------------- When the words show ---------------- */
const CLOSE = BOOK_CLOSE;
// Book progress at which each spread lies open (the cover, then each leaf, has landed) and at which the next leaf starts to lift (or the book shuts).
const OPENS = [0.28, 0.49, 0.69, 0.89];
const CLOSES = [0.4, 0.6, 0.8, CLOSE[0]];
/** The spread whose words are shown at book progress `t` (they appear just after it opens and leave just before the next page lifts), or -1. */
const inkedAt = (t: number) => OPENS.findIndex((open, k) => t >= open + 0.006 && t <= CLOSES[k] - 0.022);
/** Whether spread k's words may be drawn at all: only while no page of it is moving. */
const GATES = OPENS.map((open, k) => (t: number): string => (t >= open && t <= CLOSES[k] ? 'visible' : 'hidden'));
// React Bits Shiny Text with the settings the owner chose (speed, width, softness, hover, yoyo, following the pointer). On the cream paper the
// words keep the book's own dark colours so they read well, and the shine is a blue that shows on paper (a white one vanished into it).
const SHINE = { speed: 2, shineWidth: 40, softness: 0.8, trigger: 'hover', yoyo: true, followPointer: true } as const;
const INK = { kicker: { color: '#1d4ed8', shineColor: '#93c5fd' }, title: { color: '#0f172a', shineColor: '#3b82f6' }, text: { color: '#475569', shineColor: '#3b82f6' } } as const;
/** Before the cover opens the reader may spin the book; once it opens (and after it shuts again at the end) it stays facing them. */
const SPIN_UNTIL = 0.15;

/* ---------------- Pages ---------------- */
// 'paper' draws the printed page (pictures; the words keep their place but are invisible); 'ink' draws only the words, over the paper.
const PageMode = createContext<{ ink: boolean; show: boolean }>({ ink: false, show: false });

function Ink({ text, className, kind = 'text' }: { text: string; className: string; kind?: keyof typeof INK }) {
  const { ink } = useContext(PageMode);
  if (ink) return <p className={className}><ShinyText text={text} {...SHINE} {...INK[kind]} /></p>;
  return <p className={className} style={{ visibility: 'hidden' }}>{text}</p>;
}
/** A picture: on the paper; in the words layer it keeps its place without a box of its own (so both layers lay out identically) and is not drawn. */
function Art({ children }: { children: ReactNode }) {
  const { ink } = useContext(PageMode);
  return ink ? <div style={{ display: 'contents', visibility: 'hidden' }}>{children}</div> : <>{children}</>;
}

function PageFrame({ side, no, children }: { side: 'left' | 'right'; no: string; children: ReactNode }) {
  const { ink } = useContext(PageMode);
  if (ink) return <div className="absolute inset-0">{children}</div>;
  // The paper curves down into the gutter and lifts a little toward the outer edge.
  const curve = side === 'right'
    ? 'linear-gradient(90deg, rgba(15,23,42,0.24), rgba(15,23,42,0.06) 9%, rgba(255,255,255,0.07) 28%, rgba(255,255,255,0) 60%, rgba(15,23,42,0.05))'
    : 'linear-gradient(270deg, rgba(15,23,42,0.24), rgba(15,23,42,0.06) 9%, rgba(255,255,255,0.07) 28%, rgba(255,255,255,0) 60%, rgba(15,23,42,0.05))';
  return (
    <div className="absolute inset-0" style={{ background: `${curve}, ${PAPER_GRAIN}, ${PAPER}`, backgroundBlendMode: 'normal, multiply, normal' }}>
      <p className="absolute inset-x-0 top-3.5 text-center text-[7px] font-bold uppercase tracking-[0.34em] text-slate-400">USAS</p>
      {children}
      <p className={`absolute bottom-3.5 text-[8px] font-semibold text-slate-400 ${side === 'right' ? 'right-6' : 'left-6'}`}>{no}</p>
    </div>
  );
}

function TextPage({ side, no, kicker, title, text, children }: { side: 'left' | 'right'; no: string; kicker: string; title: string; text: string; children?: ReactNode }) {
  return (
    <PageFrame side={side} no={no}>
      <div className="absolute inset-x-7 top-[74px]">
        <Ink kind="kicker" className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700" text={kicker} />
        <Ink kind="title" className="mt-2 font-display text-[23px] font-extrabold leading-[1.08] text-slate-900" text={title} />
        <Art><div className="mt-3 h-[2px] w-9 rounded bg-blue-600" /></Art>
        <Ink className="mt-3 text-[11.5px] leading-[1.5] text-slate-600" text={text} />
      </div>
      {children}
    </PageFrame>
  );
}

const WelcomePage = () => (
  <PageFrame side="right" no="1">
    <div className="absolute inset-x-7 top-[56px] flex flex-col items-start">
      <Art><Mark height={52} /></Art>
      <Ink kind="kicker" className="mt-5 text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700" text="About USAS" />
      <Ink kind="title" className="mt-2 font-display text-[27px] font-extrabold leading-[1.05] text-slate-900" text="Welcome to USAS" />
      <Ink className="mt-1.5 text-[11px] font-semibold text-slate-500" text="University Smart Attendance System" />
      <Art><div className="mt-3 h-[2px] w-9 rounded bg-blue-600" /></Art>
      <Ink className="mt-3 text-[11.5px] leading-[1.5] text-slate-600" text="A school system for classes, timetables and attendance, together in one place." />
    </div>
  </PageFrame>
);

const SchoolPage = () => (
  <TextPage side="right" no="3" kicker="For the school" title="Timetables in one place" text="Courses, classes and semesters are kept together, so everyone sees the same plan." />
);
const StudentPage = () => (
  <TextPage side="right" no="5" kicker="For students" title="Check in on campus" text="Open the app, look at the camera, and your attendance is recorded." />
);
const StaffPage = () => (
  <TextPage side="right" no="7" kicker="For staff" title="Open a class, review attendance" text="Lecturers open a class and look over who came.">
    <Art>
      <div className="absolute inset-x-7 bottom-12 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
        <span>Next</span><Smartphone className="h-4 w-4 text-blue-600" /><span className="text-slate-300">/</span><Monitor className="h-4 w-4 text-blue-600" />
      </div>
    </Art>
  </TextPage>
);

const EndPaper = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ background: `linear-gradient(270deg, rgba(0,0,0,0.38), rgba(0,0,0,0) 22%), ${COVER_GRAIN}, linear-gradient(160deg, #1d4ed8, #172554)`, backgroundBlendMode: 'normal, soft-light, normal' }}>
    <div className="absolute inset-4 rounded border border-blue-300/30" />
    <Mark height={78} />
    <p className="font-display text-[20px] font-extrabold tracking-[0.34em] text-blue-50">USAS</p>
  </div>
);

const TimetablePage = () => {
  const columns = [[[0.05, 0.3, '#2563eb'], [0.55, 0.28, '#93c5fd']], [[0.2, 0.34, '#60a5fa']], [[0.05, 0.3, '#93c5fd'], [0.5, 0.32, '#2563eb']], [[0.3, 0.3, '#2563eb']], [[0.1, 0.34, '#60a5fa'], [0.62, 0.22, '#bfdbfe']]] as const;
  return (
    <PageFrame side="left" no="2">
      <div className="absolute inset-x-6 top-[74px]">
        <Ink kind="kicker" className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700" text="This semester" />
        <Art>
          <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[8px] font-bold text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => <span key={day}>{day}</span>)}</div>
          <div className="mt-1.5 grid h-[170px] grid-cols-5 gap-1">
            {columns.map((blocks, index) => (
              <div key={index} className="relative rounded-md bg-slate-100">
                {blocks.map(([top, height, color], inner) => <div key={inner} className="absolute inset-x-0.5 rounded" style={{ top: `${top * 100}%`, height: `${height * 100}%`, background: color }} />)}
              </div>
            ))}
          </div>
        </Art>
        <Ink className="mt-3 text-[10px] font-semibold text-slate-500" text="Classes, rooms and times" />
      </div>
    </PageFrame>
  );
};

const FacePage = () => (
  <PageFrame side="left" no="4">
    <div className="absolute inset-x-6 top-[74px]">
      <Ink kind="kicker" className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700" text="In class" />
      <Art>
        <div className="relative mx-auto mt-4 flex h-[150px] w-[150px] items-center justify-center rounded-3xl bg-blue-50">
          <ScanFace className="h-[104px] w-[104px] text-blue-600" strokeWidth={1.25} />
          <Wifi className="absolute right-2 top-2 h-6 w-6 text-blue-500" />
          <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-5 w-5" strokeWidth={3} /></span>
        </div>
      </Art>
      <Ink className="mt-6 text-center text-[10px] font-semibold text-slate-500" text="Your face and the campus Wi-Fi" />
    </div>
  </PageFrame>
);

const RosterPage = () => {
  const rows: [string, string][] = [['w-20', '#10b981'], ['w-24', '#10b981'], ['w-16', '#f59e0b'], ['w-20', '#ef4444']];
  return (
    <PageFrame side="left" no="6">
      <div className="absolute inset-x-6 top-[74px]">
        <Ink kind="kicker" className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700" text="Today's class" />
        <Art>
          <div className="mt-3 space-y-2">
            {rows.map(([width, color], index) => (
              <div key={index} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                <span className="h-5 w-5 rounded-full bg-slate-300" /><span className={`h-2 rounded bg-slate-300 ${width}`} /><span className="ml-auto h-2.5 w-2.5 rounded-full" style={{ background: color }} />
              </div>
            ))}
          </div>
          <div className="mt-5 flex h-[48px] items-end gap-1.5">{[0.5, 0.8, 0.65, 0.95, 0.7, 0.85].map((value, index) => <span key={index} className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${value * 100}%` }} />)}</div>
        </Art>
      </div>
    </PageFrame>
  );
};

/* ---------------- Sheets ---------------- */
// A leaf bends as it turns: six hinged strips. The free edge leads (it is the part that is lifted), most early in the turn, and the leaf lies flat
// again as it lands. JOINT: how much of the bend each hinge takes (more toward the free edge); BEND: the most the free edge leads by, in degrees.
const STRIPS = 6;
const JOINT = [0, 0.1, 0.15, 0.2, 0.25, 0.3];
const CUM = JOINT.map((_, k) => JOINT.slice(0, k + 1).reduce((sum, value) => sum + value, 0));
const BEND = 62;
const bendAt = (angle: number) => { const u = Math.min(1, Math.max(0, angle / 178)); return BEND * Math.sin(Math.PI * u) * (1 - u) ** 0.6; };
/** How far across its side (0-1) a leaf at `angle` reaches, as seen from straight above: where its shadow ends. */
const reachAt = (angle: number) => Math.min(1, Math.abs(CUM.reduce((sum, c) => sum + Math.cos(((angle + bendAt(angle) * c) * Math.PI) / 180), 0) / STRIPS));
const rad = (degrees: number) => (degrees * Math.PI) / 180;

/** One side of a strip of a leaf; `offset` slides the whole page so each strip shows its own part of it. Lit by the strip's own angle. */
function Side({ id, page, offset, width, back, shade, sheen }: { id: string; page: ReactNode; offset: number; width: number; back?: boolean; shade: MotionValue<number>; sheen: MotionValue<number> }) {
  return (
    <div data-page={id} className="ps-page absolute left-0 top-0 h-full overflow-hidden" style={{ width, ...(back ? { transform: 'rotateY(180deg)' } : {}) }}>
      <div className="absolute top-0" style={{ left: -offset, width: PW, height: PH }}>{page}</div>
      <motion.div className="pointer-events-none absolute inset-0 bg-slate-900" style={{ opacity: shade }} />
      {/* the curve of the paper across the strip: light on the rising side, shade on the falling side */}
      <motion.div className="pointer-events-none absolute inset-0" style={{ opacity: sheen, background: back ? 'linear-gradient(270deg, rgba(255,255,255,0.22), rgba(15,23,42,0.2))' : 'linear-gradient(90deg, rgba(255,255,255,0.22), rgba(15,23,42,0.2))' }} />
    </div>
  );
}

/** Strip k of a leaf, holding the strips after it: strip 0 turns about the spine, each later one about its own hinge. */
function Strip({ k, index, angle, front, back }: { k: number; index: number; angle: MotionValue<number>; front: ReactNode; back: ReactNode }) {
  const strip = PW / STRIPS, width = strip + (k < STRIPS - 1 ? 0.5 : 0);
  const rotateY = useTransform(angle, value => (k === 0 ? -value : -bendAt(value) * JOINT[k]));
  const z = useTransform(angle, value => (k === 0 ? interpolate(value, [0, 178], [rightZ(index), leftZ(index)]) : 0));
  // A page turned edge-on to the reader catches less light; the strip's own angle includes the bend before it.
  const shade = useTransform(angle, value => (1 - Math.abs(Math.cos(rad(value + bendAt(value) * CUM[k])))) * 0.42);
  const sheen = useTransform(angle, value => Math.min(1, (bendAt(value) * JOINT[k]) / 9));
  return (
    <motion.div className="ps-3d absolute top-0" style={{ left: k === 0 ? 0 : strip, width, height: PH, transformOrigin: 'left center', rotateY, z }}>
      <Side id={`R${index}`} page={front} offset={k * strip} width={width} shade={shade} sheen={sheen} />
      <Side id={`L${index + 1}`} page={back} offset={PW - width - k * strip} width={width} back shade={shade} sheen={sheen} />
      {k < STRIPS - 1 && <Strip k={k + 1} index={index} angle={angle} front={front} back={back} />}
    </motion.div>
  );
}

/** The soft shadow a lifted leaf casts on the page under it: from the spine to just short of where the leaf reaches, strongest mid-turn. */
function LeafShadows({ index, angle }: { index: number; angle: MotionValue<number> }) {
  const shadow = (value: number) => {
    const reach = reachAt(value) * 100;
    return `linear-gradient(90deg, rgba(2,6,23,0.85), rgba(2,6,23,0.35) ${reach * 0.6}%, rgba(2,6,23,0) ${reach}%)`;
  };
  const rightOpacity = useTransform(angle, value => (value > 0.5 && value < 90 ? Math.sin(rad(value)) ** 0.7 * 0.3 : 0));
  const leftOpacity = useTransform(angle, value => (value > 90 && value < 177.5 ? Math.sin(rad(value)) ** 0.7 * 0.3 : 0));
  const rightBackground = useTransform(angle, shadow);
  const leftBackground = useTransform(angle, shadow);
  const rightVisible = useTransform(rightOpacity, value => (value > 0.004 ? 'visible' : 'hidden'));
  const leftVisible = useTransform(leftOpacity, value => (value > 0.004 ? 'visible' : 'hidden'));
  return (
    <>
      <motion.div className="pointer-events-none absolute left-0 top-0" style={{ width: PW, height: PH, z: rightZ(index) - 0.25, opacity: rightOpacity, visibility: rightVisible, background: rightBackground }} />
      <motion.div className="pointer-events-none absolute left-0 top-0" style={{ width: PW, height: PH, transformOrigin: 'left center', rotateY: -178, z: leftZ(index) - 0.25, opacity: leftOpacity, visibility: leftVisible, background: leftBackground }} />
    </>
  );
}

function TurningLeaf({ t, start, end, index, front, back }: { t: MotionValue<number>; start: number; end: number; index: number; front: ReactNode; back: ReactNode }) {
  const angle = useRange(t, [start, end], [0, 178]);
  return (
    <>
      <LeafShadows index={index} angle={angle} />
      <Strip k={0} index={index} angle={angle} front={front} back={back} />
    </>
  );
}

/** The words of one page, just above the paper they belong to; shown only while their spread lies open (`gate`), condensing and dissolving. */
function Words({ id, left, z, show, gate, children }: { id: string; left?: boolean; z: number; show: boolean; gate: MotionValue<string>; children: ReactNode }) {
  const page = <div data-words className="absolute inset-0 transition-opacity duration-300 motion-reduce:transition-none" style={{ opacity: show ? 1 : 0 }}><PageMode.Provider value={{ ink: true, show }}>{children}</PageMode.Provider></div>;
  if (!left) return <motion.div data-page={id} className="absolute left-0 top-0" style={{ width: PW, height: PH, z, visibility: gate }}>{page}</motion.div>;
  // A left page lies where a landed leaf lies (turned 178 degrees about the spine); its words face the reader again.
  return (
    <motion.div className="ps-3d absolute left-0 top-0" style={{ width: PW, height: PH, transformOrigin: 'left center', rotateY: -178, z, visibility: gate }}>
      <div data-page={id} className="absolute inset-0" style={{ transform: 'rotateY(180deg)' }}>{page}</div>
    </motion.div>
  );
}

const EDGE = (direction: number) => `repeating-linear-gradient(${direction}deg, #f5f0e4 0 1.5px, #ddd5c3 1.5px 2.5px, #f2ecdf 2.5px 3.5px)`;

/** The spine, seen when the book is spun: a rounded board with gold bands, the emblem and the title running down it. */
const Spine = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-between overflow-hidden py-5" style={{ background: 'linear-gradient(90deg, #0b1437, #1e3a8a 22%, #3155c4 50%, #1e3a8a 78%, #0b1437)' }}>
    <span className="absolute inset-x-0 top-2 h-[2px]" style={{ background: GOLD }} /><span className="absolute inset-x-0 top-[13px] h-px" style={{ background: GOLD, opacity: 0.6 }} />
    <Mark height={24} />
    <p className="font-display text-[15px] font-extrabold tracking-[0.42em] text-blue-50" style={{ writingMode: 'vertical-rl' }}>USAS</p>
    <p className="text-[6.5px] font-bold uppercase tracking-[0.3em] text-blue-200/80" style={{ writingMode: 'vertical-rl' }}>Smart Attendance</p>
    <span className="absolute inset-x-0 bottom-2 h-[2px]" style={{ background: GOLD }} /><span className="absolute inset-x-0 bottom-[13px] h-px" style={{ background: GOLD, opacity: 0.6 }} />
  </div>
);

/** The back cover, seen when the book is spun: the emblem, one line about the system and a printed code, like a real hardback. */
const BackCover = () => (
  <div className="absolute inset-0 overflow-hidden rounded-l-md" style={{ background: `linear-gradient(270deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 8%), ${COVER}`, backgroundBlendMode: 'normal, soft-light, normal' }}>
    <div className="absolute inset-3 rounded border border-blue-300/30" />
    <div className="absolute inset-x-8 top-14 flex flex-col items-center text-center">
      <Mark height={46} />
      <p className="mt-5 font-display text-[17px] font-bold leading-snug text-blue-50">Attendance, made smart.</p>
      <div className="mt-3 h-px w-10" style={{ background: GOLD }} />
      <p className="mt-3 text-[9.5px] leading-relaxed text-blue-100/80">Face check-in on campus Wi-Fi, timetables and attendance for students, lecturers and the school, on the phone and on the web.</p>
    </div>
    <div className="absolute bottom-7 right-7 flex h-9 items-end gap-[1.5px] rounded-sm bg-white px-1.5 pb-1 pt-1.5">
      {[2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3, 1, 2, 1].map((width, index) => <span key={index} className="h-full bg-slate-900" style={{ width }} />)}
    </div>
    <p className="absolute bottom-7 left-7 text-[7px] font-bold uppercase tracking-[0.3em] text-blue-200/70">smartsystem.live</p>
  </div>
);

/**
 * A realistic hardback seen from the side that turns upright, opens its cover and turns its bending pages (local progress `t` 0-1), with a soft
 * blue glow. Spreads: cover / inside cover + welcome / the school / students / staff and the way on to the app and the web.
 * `interactive`: while the book is still closed at the start, the reader can drag (or flick) it to spin it all the way round, or use the arrow
 * keys; it settles facing them again. Open (and shut again at the end) it does not spin.
 */
export function Book({ t, interactive = false }: { t: MotionValue<number>; interactive?: boolean }) {
  const { w, h, t: thick } = BOOK;
  const rotateY = useRange(t, [0, 0.16], [-78, 0]);
  const rotateX = useRange(t, [0, 0.16], [18, 4]);
  const rotateZ = useRange(t, [0, 0.16], [-8, 0]);
  // Open, the spine sits in the middle (x w/2); shut from the back, the book lies left of the spine, so it slides on to x w to stay centred.
  const x = useRange(t, [0.16, 0.28, CLOSE[0], CLOSE[1]], [0, w / 2, w / 2, w]);
  const cover = useRange(t, [0.16, 0.28], [0, 178]);
  const coverTurn = useTransform(cover, value => -value);
  const coverZ = useTransform(cover, value => interpolate(value, [0, 178], [18, 9]));
  // Shutting: the back half (spine, page block, back cover) turns about the spine at the height of the page face, so it lands on the left stack.
  const backTurn = useRange(t, [...CLOSE], [0, -178]);
  // Then the shut book (back cover up) turns round to its front cover.
  const flip = useRange(t, [...BOOK_FLIP], [0, 180]);
  const glow = useRange(t, [0.1, 0.4, 1], [0.15, 0.6, 0.7]);
  const shadowSpread = useRange(t, [0.16, 0.28, CLOSE[0], CLOSE[1]], [1, 1.9, 1.9, 1]);

  // Which spread's words are shown, and when each words layer may be drawn at all (never while a page is moving over it).
  const [inked, setInked] = useState(() => inkedAt(t.get()));
  useMotionValueEvent(t, 'change', value => setInked(inkedAt(value)));
  const gate0 = useTransform(t, GATES[0]), gate1 = useTransform(t, GATES[1]), gate2 = useTransform(t, GATES[2]), gate3 = useTransform(t, GATES[3]);

  // Spinning: the reader's turn on top of the story's own, eased back to facing them (the nearest whole turn) when let go.
  const spin = useMotionValue(0), lean = useMotionValue(0);
  const drag = useRef<{ id: number; x: number; y: number; at: number; speed: number } | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [canSpin, setCanSpin] = useState(() => interactive && t.get() < SPIN_UNTIL);
  const settle = (speed: number) => {
    animate(spin, Math.round((spin.get() + speed * 0.35) / 360) * 360, { type: 'spring', stiffness: 38, damping: 11, velocity: speed });
    animate(lean, 0, { type: 'spring', stiffness: 120, damping: 15 });
  };
  useMotionValueEvent(t, 'change', value => {
    const next = interactive && value < SPIN_UNTIL;
    if (!next && canSpin) {   // the cover starts to open: let go of any spin and ease back to facing the reader
      drag.current = null; setGrabbing(false);
      settle(0);
    }
    setCanSpin(next);
  });
  const turned = useTransform([spin, flip], ([extra, end]: number[]) => extra + end);
  const gloss = useTransform([rotateY, turned], ([turn, extra]: number[]) => `${50 + Math.sin(rad(turn + extra)) * 70}% 0%`);
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!canSpin || (event.pointerType === 'mouse' && event.button !== 0)) return;
    spin.stop(); lean.stop();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, at: performance.now(), speed: 0 };
    setGrabbing(true);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    const now = performance.now(), dx = event.clientX - d.x, dy = event.clientY - d.y, step = dx * 0.6;
    spin.set(spin.get() + step);
    lean.set(Math.max(-26, Math.min(26, lean.get() - dy * 0.25)));
    d.speed = d.speed * 0.6 + (step / Math.max(8, now - d.at)) * 1000 * 0.4;   // degrees per second, smoothed
    d.x = event.clientX; d.y = event.clientY; d.at = now;
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null; setGrabbing(false);
    settle(performance.now() - d.at > 120 ? 0 : d.speed);   // a drag that stopped before letting go has no flick left
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!canSpin || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return;
    event.preventDefault();
    const base = Math.round(spin.get() / 360) * 360;
    animate(spin, base + (event.key === 'ArrowRight' ? 360 : -360), { type: 'spring', stiffness: 30, damping: 12 });
  };

  return (
    <div className="relative" style={{ width: w, height: h }}>
      <motion.div className="pointer-events-none absolute" style={{ opacity: glow, left: -w, right: -w, top: -h * 0.4, bottom: -h * 0.4, background: 'radial-gradient(ellipse at 50% 50%, rgba(96,165,250,0.5), rgba(37,99,235,0.14) 45%, transparent 70%)', filter: 'blur(6px)' }} />
      <motion.div className="pointer-events-none absolute left-0 right-0" style={{ top: h - 6, height: 46, x, opacity: 0.55, background: 'radial-gradient(ellipse at 50% 50%, rgba(2,6,23,0.7), transparent 68%)', filter: 'blur(5px)', scaleX: shadowSpread }} />
      <motion.div data-book-spin className={`ps-3d absolute inset-0 select-none outline-none ${canSpin ? (grabbing ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
        style={{ rotateY: turned, rotateX: lean, touchAction: canSpin ? 'pan-y' : undefined }}
        tabIndex={canSpin ? 0 : undefined} aria-label={canSpin ? 'The USAS book: drag it, or press the arrow keys, to spin it round' : undefined}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}>
        <motion.div className="ps-3d absolute inset-0" style={{ rotateX, rotateY, rotateZ, x }}>
          {/* spine, back cover and the block of pages: the back half, which swings over to shut the book at the end */}
          <motion.div data-book-back className="ps-3d absolute inset-0" style={{ transformOrigin: `0px ${h / 2}px ${BLOCK_Z}px`, rotateY: backTurn }}>
          <div className="ps-3d absolute" style={{ left: -1, top: 0, transform: 'translateZ(-1px)' }}><Box3D w={2} h={h} d={thick + 5} color="#172554" faces={{ left: <Spine /> }} /></div>
          <div className="ps-3d absolute inset-0" style={{ transform: 'translateZ(-16.5px)' }}><Box3D w={w} h={h} d={5} color="#1e3a8a" faces={{ back: <div data-back-cover className="absolute inset-0"><BackCover /></div> }} /></div>
          <div className="ps-3d absolute" style={{ left: 2, top: 5 }}>
            <Box3D w={PW} h={PH} d={BLOCK_Z * 2} color="#f5f0e4" faces={{
              front: <div data-page="R3" className="absolute inset-0"><StaffPage /></div>,
              right: <div className="absolute inset-0" style={{ background: `linear-gradient(90deg, rgba(120,100,60,0.18), transparent 30%, transparent 70%, rgba(120,100,60,0.18)), ${EDGE(90)}` }} />,
              top: <div className="absolute inset-0" style={{ background: `linear-gradient(0deg, rgba(120,100,60,0.16), transparent), ${EDGE(180)}` }} />,
              bottom: <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, rgba(120,100,60,0.16), transparent), ${EDGE(180)}` }} />,
            }} />
          </div>
          </motion.div>
          {/* the sheets that turn, their shadows, and the words of the open spread */}
          <div className="ps-3d absolute" style={{ left: 2, top: 5, width: PW, height: PH }}>
            <TurningLeaf t={t} index={0} start={0.4} end={0.49} front={<WelcomePage />} back={<TimetablePage />} />
            <TurningLeaf t={t} index={1} start={0.6} end={0.69} front={<SchoolPage />} back={<FacePage />} />
            <TurningLeaf t={t} index={2} start={0.8} end={0.89} front={<StudentPage />} back={<RosterPage />} />
            <Words id="R0" z={rightZ(0) + 0.3} show={inked === 0} gate={gate0}><WelcomePage /></Words>
            <Words id="L1" left z={leftZ(0) + 0.3} show={inked === 1} gate={gate1}><TimetablePage /></Words>
            <Words id="R1" z={rightZ(1) + 0.3} show={inked === 1} gate={gate1}><SchoolPage /></Words>
            <Words id="L2" left z={leftZ(1) + 0.3} show={inked === 2} gate={gate2}><FacePage /></Words>
            <Words id="R2" z={rightZ(2) + 0.3} show={inked === 2} gate={gate2}><StudentPage /></Words>
            <Words id="L3" left z={leftZ(2) + 0.3} show={inked === 3} gate={gate3}><RosterPage /></Words>
            <Words id="R3" z={BLOCK_Z + 0.3} show={inked === 3} gate={gate3}><StaffPage /></Words>
          </div>
          {/* the front cover: a board with an outside and an inside */}
          <motion.div className="ps-3d absolute left-0 top-0" style={{ width: w, height: h, transformOrigin: 'left center', rotateY: coverTurn, z: coverZ }}>
            <Box3D w={w} h={h} d={4} color="#172554" faces={{
              front: (
                <div data-page="C" className="absolute inset-0 overflow-hidden rounded-r-md" style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 8%), ${COVER}`, backgroundBlendMode: 'normal, soft-light, normal' }}>
                  <div className="absolute inset-3 rounded border border-blue-300/40" />
                  <div className="absolute inset-[18px] rounded-sm border border-amber-200/25" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                    <Mark height={84} />
                    <p className="font-display text-[30px] font-extrabold tracking-[0.2em] text-blue-50" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>USAS</p>
                    <p className="px-8 text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-200">University Smart Attendance System</p>
                    <BookOpen className="h-4 w-4 text-blue-300/70" />
                  </div>
                  {/* the light on the board's laminate, moving as the book turns */}
                  <motion.div className="pointer-events-none absolute inset-0" style={{ backgroundImage: 'linear-gradient(115deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.22) 45%, rgba(255,255,255,0) 60%)', backgroundSize: '300% 100%', backgroundPosition: gloss }} />
                </div>
              ),
              back: <div data-page="L0" className="absolute inset-0"><EndPaper /></div>,
            }} />
          </motion.div>
        </motion.div>
      </motion.div>
    </div>
  );
}
