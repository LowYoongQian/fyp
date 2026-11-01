import { motion, useTransform, type MotionValue } from 'motion/react';
import { BookOpen, Check, Monitor, ScanFace, Smartphone, Wifi } from 'lucide-react';
import type { ReactNode } from 'react';
import { Box3D } from './Box3D';
import { Mark } from './Mark';
import { interpolate, useRange } from './range';
import { BOOK } from './sceneConfig';

/*
 * The book. Every opaque sheet hides what is under it until it is physically turned away:
 *   - the right pages are the FRONT of each turning leaf (R0, R1, R2) and, last, the face of the page block (R3);
 *   - the left pages are the BACK of each leaf (L1, L2, L3) and, first, the inside of the front cover (L0).
 * Heights above the page block (px, towards the reader): block face 14, right stack 14.5-15.5 (first leaf on top), left stack 12-13 (last leaf on top),
 * open cover 9, closed cover 18. A leaf slides smoothly between its right and left height while it turns, so no layer ever swaps.
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

/* ---------------- Pages ---------------- */
function PageFrame({ side, no, children }: { side: 'left' | 'right'; no: string; children: ReactNode }) {
  const gutter = side === 'right' ? 'linear-gradient(90deg, rgba(15,23,42,0.2), rgba(15,23,42,0) 15%)' : 'linear-gradient(270deg, rgba(15,23,42,0.2), rgba(15,23,42,0) 15%)';
  return (
    <div className="absolute inset-0" style={{ background: `${gutter}, ${PAPER_GRAIN}, ${PAPER}`, backgroundBlendMode: 'normal, multiply, normal' }}>
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
        <p className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700">{kicker}</p>
        <p className="mt-2 font-display text-[23px] font-extrabold leading-[1.08] text-slate-900">{title}</p>
        <div className="mt-3 h-[2px] w-9 rounded bg-blue-600" />
        <p className="mt-3 text-[11.5px] leading-[1.5] text-slate-600">{text}</p>
      </div>
      {children}
    </PageFrame>
  );
}

const WelcomePage = () => (
  <PageFrame side="right" no="1">
    <div className="absolute inset-x-7 top-[56px] flex flex-col items-start">
      <Mark height={52} />
      <p className="mt-5 text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700">About USAS</p>
      <p className="mt-2 font-display text-[27px] font-extrabold leading-[1.05] text-slate-900">Welcome to USAS</p>
      <p className="mt-1.5 text-[11px] font-semibold text-slate-500">University Smart Attendance System</p>
      <div className="mt-3 h-[2px] w-9 rounded bg-blue-600" />
      <p className="mt-3 text-[11.5px] leading-[1.5] text-slate-600">A school system for classes, timetables and attendance, together in one place.</p>
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
    <div className="absolute inset-x-7 bottom-12 flex items-center gap-2 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">
      <span>Next</span><Smartphone className="h-4 w-4 text-blue-600" /><span className="text-slate-300">/</span><Monitor className="h-4 w-4 text-blue-600" />
    </div>
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
        <p className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700">This semester</p>
        <div className="mt-3 grid grid-cols-5 gap-1 text-center text-[8px] font-bold text-slate-400">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(day => <span key={day}>{day}</span>)}</div>
        <div className="mt-1.5 grid h-[170px] grid-cols-5 gap-1">
          {columns.map((blocks, index) => (
            <div key={index} className="relative rounded-md bg-slate-100">
              {blocks.map(([top, height, color], inner) => <div key={inner} className="absolute inset-x-0.5 rounded" style={{ top: `${top * 100}%`, height: `${height * 100}%`, background: color }} />)}
            </div>
          ))}
        </div>
        <p className="mt-3 text-[10px] font-semibold text-slate-500">Classes, rooms and times</p>
      </div>
    </PageFrame>
  );
};

const FacePage = () => (
  <PageFrame side="left" no="4">
    <div className="absolute inset-x-6 top-[74px]">
      <p className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700">In class</p>
      <div className="relative mx-auto mt-4 flex h-[150px] w-[150px] items-center justify-center rounded-3xl bg-blue-50">
        <ScanFace className="h-[104px] w-[104px] text-blue-600" strokeWidth={1.25} />
        <Wifi className="absolute right-2 top-2 h-6 w-6 text-blue-500" />
        <span className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white shadow"><Check className="h-5 w-5" strokeWidth={3} /></span>
      </div>
      <p className="mt-6 text-center text-[10px] font-semibold text-slate-500">Your face and the campus Wi-Fi</p>
    </div>
  </PageFrame>
);

const RosterPage = () => {
  const rows: [string, string][] = [['w-20', '#10b981'], ['w-24', '#10b981'], ['w-16', '#f59e0b'], ['w-20', '#ef4444']];
  return (
    <PageFrame side="left" no="6">
      <div className="absolute inset-x-6 top-[74px]">
        <p className="text-[8.5px] font-bold uppercase tracking-[0.22em] text-blue-700">Today's class</p>
        <div className="mt-3 space-y-2">
          {rows.map(([width, color], index) => (
            <div key={index} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
              <span className="h-5 w-5 rounded-full bg-slate-300" /><span className={`h-2 rounded bg-slate-300 ${width}`} /><span className="ml-auto h-2.5 w-2.5 rounded-full" style={{ background: color }} />
            </div>
          ))}
        </div>
        <div className="mt-5 flex h-[48px] items-end gap-1.5">{[0.5, 0.8, 0.65, 0.95, 0.7, 0.85].map((value, index) => <span key={index} className="flex-1 rounded-t bg-blue-500/80" style={{ height: `${value * 100}%` }} />)}</div>
      </div>
    </PageFrame>
  );
};

/* ---------------- Sheets ---------------- */
function Shade({ angle }: { angle: MotionValue<number> }) {
  // A page standing on edge catches less light: darken it as it passes 90 degrees.
  const opacity = useTransform(angle, value => Math.sin((Math.abs(value) * Math.PI) / 180) * 0.3);
  return <motion.div className="pointer-events-none absolute inset-0 bg-slate-900" style={{ opacity }} />;
}

/** One side of a strip of a leaf; `offset` slides the whole page so each strip shows its own part of it. */
function Side({ id, angle, page, offset, width, back }: { id: string; angle: MotionValue<number>; page: ReactNode; offset: number; width: number; back?: boolean }) {
  return (
    <div data-page={id} className="ps-page absolute left-0 top-0 h-full overflow-hidden" style={{ width, ...(back ? { transform: 'rotateY(180deg)' } : {}) }}>
      <div className="absolute top-0" style={{ left: -offset, width: PW, height: PH }}>{page}</div>
      <Shade angle={angle} />
    </div>
  );
}

/**
 * One sheet that turns around the spine. Paper bends: it is three hinged strips that curl mid-turn and lie flat again when they land.
 * Each strip draws its own third of the page on the front and on the back (the back is mirrored, so its offset counts from the other end).
 */
function Leaf({ index, angle, front, back }: { index: number; angle: MotionValue<number>; front: ReactNode; back: ReactNode }) {
  const strip = PW / 3, overlap = 0.5;
  const turn = useTransform(angle, value => -value);
  const curl = useTransform(angle, value => -Math.sin((value * Math.PI) / 178) * 24);
  const z = useTransform(angle, value => interpolate(value, [0, 178], [rightZ(index), leftZ(index)]));
  const sides = (k: 0 | 1 | 2) => {
    const width = strip + (k < 2 ? overlap : 0);
    return (
      <>
        <Side id={`R${index}`} angle={angle} page={front} offset={k * strip} width={width} />
        <Side id={`L${index + 1}`} angle={angle} page={back} offset={PW - width - k * strip} width={width} back />
      </>
    );
  };
  return (
    <motion.div className="ps-3d absolute left-0 top-0" style={{ width: strip + overlap, height: PH, transformOrigin: 'left center', rotateY: turn, z }}>
      {sides(0)}
      <motion.div className="ps-3d absolute top-0" style={{ left: strip, width: strip + overlap, height: PH, transformOrigin: 'left center', rotateY: curl }}>
        {sides(1)}
        <motion.div className="ps-3d absolute top-0" style={{ left: strip, width: strip, height: PH, transformOrigin: 'left center', rotateY: curl }}>
          {sides(2)}
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

function TurningLeaf({ t, start, end, index, front, back }: { t: MotionValue<number>; start: number; end: number; index: number; front: ReactNode; back: ReactNode }) {
  const angle = useRange(t, [start, end], [0, 178]);
  return <Leaf index={index} angle={angle} front={front} back={back} />;
}

const EDGE = (direction: number) => `repeating-linear-gradient(${direction}deg, #f5f0e4 0 2px, #d9d1bf 2px 3px)`;

/**
 * A realistic closed book seen from the side that turns upright, opens its cover and turns its pages, with a soft blue glow (local progress `t` 0-1).
 * Spreads: cover / inside cover + welcome / the school / students / staff and the way on to the app and the web.
 */
export function Book({ t }: { t: MotionValue<number> }) {
  const { w, h, t: thick } = BOOK;
  const rotateY = useRange(t, [0, 0.16], [-78, 0]);
  const rotateX = useRange(t, [0, 0.16], [18, 4]);
  const rotateZ = useRange(t, [0, 0.16], [-8, 0]);
  const x = useRange(t, [0.16, 0.28], [0, w / 2]);
  const cover = useRange(t, [0.16, 0.28], [0, 178]);
  const coverTurn = useTransform(cover, value => -value);
  const coverZ = useTransform(cover, value => interpolate(value, [0, 178], [18, 9]));
  const glow = useRange(t, [0.1, 0.4, 1], [0.15, 0.6, 0.7]);
  const shadowSpread = useRange(t, [0.16, 0.28], [1, 1.9]);
  return (
    <div className="relative" style={{ width: w, height: h }}>
      <motion.div className="pointer-events-none absolute" style={{ opacity: glow, left: -w, right: -w, top: -h * 0.4, bottom: -h * 0.4, background: 'radial-gradient(ellipse at 50% 50%, rgba(96,165,250,0.5), rgba(37,99,235,0.14) 45%, transparent 70%)', filter: 'blur(6px)' }} />
      <motion.div className="pointer-events-none absolute left-0 right-0" style={{ top: h - 6, height: 46, x, opacity: 0.55, background: 'radial-gradient(ellipse at 50% 50%, rgba(2,6,23,0.7), transparent 68%)', filter: 'blur(5px)', scaleX: shadowSpread }} />
      <motion.div className="ps-3d absolute inset-0" style={{ rotateX, rotateY, rotateZ, x }}>
        {/* spine, back cover and the block of pages */}
        <div className="ps-3d absolute" style={{ left: -1, top: 0, transform: 'translateZ(-1px)' }}><Box3D w={2} h={h} d={thick + 5} color="#172554" /></div>
        <div className="ps-3d absolute inset-0" style={{ transform: 'translateZ(-16.5px)' }}><Box3D w={w} h={h} d={5} color="#1e3a8a" /></div>
        <div className="ps-3d absolute" style={{ left: 2, top: 5 }}>
          <Box3D w={PW} h={PH} d={BLOCK_Z * 2} color="#f5f0e4" faces={{
            front: <div data-page="R3" className="absolute inset-0"><StaffPage /></div>,
            right: <div className="absolute inset-0" style={{ background: EDGE(90) }} />,
            top: <div className="absolute inset-0" style={{ background: EDGE(180) }} />,
            bottom: <div className="absolute inset-0" style={{ background: EDGE(180) }} />,
          }} />
        </div>
        {/* the sheets that turn */}
        <div className="ps-3d absolute" style={{ left: 2, top: 5, width: PW, height: PH }}>
          <TurningLeaf t={t} index={0} start={0.4} end={0.49} front={<WelcomePage />} back={<TimetablePage />} />
          <TurningLeaf t={t} index={1} start={0.6} end={0.69} front={<SchoolPage />} back={<FacePage />} />
          <TurningLeaf t={t} index={2} start={0.8} end={0.89} front={<StudentPage />} back={<RosterPage />} />
        </div>
        {/* the front cover: a board with an outside and an inside */}
        <motion.div className="ps-3d absolute left-0 top-0" style={{ width: w, height: h, transformOrigin: 'left center', rotateY: coverTurn, z: coverZ }}>
          <Box3D w={w} h={h} d={4} color="#172554" faces={{
            front: (
              <div data-page="C" className="absolute inset-0 overflow-hidden rounded-r-md" style={{ background: `linear-gradient(90deg, rgba(0,0,0,0.35), rgba(0,0,0,0) 8%), ${COVER_GRAIN}, linear-gradient(135deg, #1e40af, #1e3a8a 55%, #172554)`, backgroundBlendMode: 'normal, soft-light, normal' }}>
                <div className="absolute inset-3 rounded border border-blue-300/40" />
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center">
                  <Mark height={84} />
                  <p className="font-display text-[30px] font-extrabold tracking-[0.2em] text-blue-50" style={{ textShadow: '0 1px 0 rgba(0,0,0,0.4)' }}>USAS</p>
                  <p className="px-8 text-[9px] font-semibold uppercase tracking-[0.18em] text-blue-200">University Smart Attendance System</p>
                  <BookOpen className="h-4 w-4 text-blue-300/70" />
                </div>
                <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(115deg, rgba(255,255,255,0.2), transparent 42%)' }} />
              </div>
            ),
            back: <div data-page="L0" className="absolute inset-0"><EndPaper /></div>,
          }} />
        </motion.div>
      </motion.div>
    </div>
  );
}

