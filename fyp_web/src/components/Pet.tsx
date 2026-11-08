import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { AnimatePresence, motion } from 'motion/react';
import { MessageCircle, RotateCcw, Send, X } from 'lucide-react';
import { PetBubble } from './PetBubble';
import { pickLine, speechMs } from './petSpeech';
import { useAuth } from '../context/AuthContext';
import { usePetPreferences } from '../hooks/usePetPreferences';
import { apiService } from '../services/api';
import type { PetId, PetOffset } from '../utils/petPreference';
import { PET_SHEETS } from './petSheets';
import { lookFrame, lookSector } from './petLook';

type Mode = 'idle' | 'runRight' | 'runLeft' | 'waving' | 'jumping' | 'review';
// Rows 5-7 (failed, waiting, running) are deliberately unused: no trigger was asked for, and running is not wanted.
const ROWS: Record<Mode, { row: number; frames: number; ms: number }> = {
  idle: { row: 0, frames: 6, ms: 230 },
  runRight: { row: 1, frames: 8, ms: 90 },
  runLeft: { row: 2, frames: 8, ms: 90 },
  waving: { row: 3, frames: 4, ms: 160 },
  jumping: { row: 4, frames: 5, ms: 110 },
  review: { row: 8, frames: 6, ms: 180 },
};
const NEUTRAL = { col: 6, row: 0, flip: false };
const WAVE_AFTER_MS = 5000;   // the first wave, and the next one after anything the user does
const WAVE_GAP_MS = [14000, 30000] as const;   // later waves (each with something new to say) come at random, not every few seconds
const WAVE_LOOPS = 2;
const LOOK_HOLD_MS = 1200;
const DRAG_THRESHOLD = 4;     // pixels a press may wander and still count as a click, not a drag

const BASE_WIDTH = 120;       // 192 x 208 cells shown at 0.625
const BASE_HEIGHT = 130;
const INSET = 28;             // design-system gap kept to every edge of the body
const COMPACT_INSET = 12;     // used only when the body is too small for the full gap
const BUBBLE_SPACE = 48;      // the bubble or the foot of the reply panel above the sprite; always reserved
const CONTROL_SPACE = 52;     // the chat control under the sprite (44 px plus its gap); always reserved, so opening it never moves the pet
const FULL_MIN_INNER_WIDTH = 240;   // room between the two insets for a usable question box
const MIN_SCALE = 0.6;        // below this the pet is hidden until space returns
const PANEL_WIDTH = 300;
const PANEL_MAX_HEIGHT = 260;
const PANEL_MIN_HEIGHT = 96;
const LAUNCHER_WIDTH = 148;
const QUICK_CHAT_TURNS = 16;  // the same bound the full temporary chat sends

type Position = { x: number; y: number };
type Bounds = { left: number; top: number; right: number; bottom: number };
type Fit = { scale: number; full: boolean; minX: number; minY: number; maxX: number; maxY: number; width: number; height: number; body: Bounds };
/** Everything the pet and its attached surfaces are drawn from. It is replaced whole, so no part of the screen can use an older measurement. */
type Layout = { fit: Fit; pos: Position };
type ChatView = 'closed' | 'launcher' | 'open';
type Reply = { status: 'pending' | 'answer' | 'error'; question: string; text?: string };

// Remembered drop point, per account, as the distance from the top-left of the allowed area; read and written defensively.
const positionKey = (userId: string) => `pet_position_${userId}`;
const LEGACY_CORNER_KEY = 'staff-dashboard-pet-corner';
const LEGACY_CHAT_CORNER_KEY = 'chat-pet-corner';
const readItem = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const removeItem = (key: string) => { try { localStorage.removeItem(key); } catch { /* Optional cleanup. */ } };
const readSaved = (userId: string, account: PetOffset | null): { offset?: Position; corner?: string } => {
  if (account) return { offset: { x: account.dx, y: account.dy } };   // the account's copy wins: the same place in every browser and on the live site
  try {
    const value = JSON.parse(readItem(positionKey(userId)) || 'null');
    if (Number.isFinite(value?.dx) && Number.isFinite(value?.dy)) return { offset: { x: Math.max(0, value.dx), y: Math.max(0, value.dy) } };
  } catch { /* An unreadable value is ignored. */ }
  // One-time carry-over of the old corner choice from before free placement.
  const corner = readItem(LEGACY_CORNER_KEY);
  return corner && /^(top|bottom)-(left|right)$/.test(corner) ? { corner } : {};
};
const saveOffset = (userId: string, fit: Fit, position: Position) => {
  try { localStorage.setItem(positionKey(userId), JSON.stringify({ dx: Math.round(position.x - fit.minX), dy: Math.round(position.y - fit.minY) })); } catch { /* Position memory is optional. */ }
  removeItem(LEGACY_CORNER_KEY);
  removeItem(LEGACY_CHAT_CORNER_KEY);
};

/** The visible page body in viewport coordinates: right of the app sidebar, below its own header, left of any scrollbar. */
const bodyBounds = (pane: HTMLElement | null): Bounds => {
  const viewport = { left: 0, top: 0, right: document.documentElement.clientWidth, bottom: document.documentElement.clientHeight };
  if (!pane) return viewport;
  const rect = pane.getBoundingClientRect();
  const header = pane.querySelector<HTMLElement>(':scope > header');
  return {
    left: Math.max(viewport.left, rect.left),
    top: Math.max(viewport.top, rect.top, header?.getBoundingClientRect().bottom ?? 0),
    right: Math.min(viewport.right, rect.left + pane.clientWidth),
    bottom: Math.min(viewport.bottom, rect.top + pane.clientHeight),
  };
};

/** The pet with room for its bubble above and its chat control below fits with the full gap; otherwise a smaller pet without chat; otherwise hidden. */
const fitPet = (body: Bounds): Fit | null => {
  const w = body.right - body.left, h = body.bottom - body.top;
  if (w >= FULL_MIN_INNER_WIDTH + 2 * INSET && h >= BASE_HEIGHT + BUBBLE_SPACE + CONTROL_SPACE + 2 * INSET) {
    return { scale: 1, full: true, width: BASE_WIDTH, height: BASE_HEIGHT, body, minX: body.left + INSET, minY: body.top + INSET + BUBBLE_SPACE, maxX: body.right - INSET - BASE_WIDTH, maxY: body.bottom - INSET - CONTROL_SPACE - BASE_HEIGHT };
  }
  const scale = Math.min(1, (w - 2 * COMPACT_INSET) / BASE_WIDTH, (h - 2 * COMPACT_INSET) / BASE_HEIGHT);
  if (!(scale >= MIN_SCALE)) return null;
  const width = BASE_WIDTH * scale, height = BASE_HEIGHT * scale;
  return { scale, full: false, width, height, body, minX: body.left + COMPACT_INSET, minY: body.top + COMPACT_INSET, maxX: body.right - COMPACT_INSET - width, maxY: body.bottom - COMPACT_INSET - height };
};

const clamp = (fit: Fit, { x, y }: Position): Position => ({ x: Math.min(Math.max(fit.minX, x), fit.maxX), y: Math.min(Math.max(fit.minY, y), fit.maxY) });
const sameFit = (a: Fit, b: Fit) => a.full === b.full && a.scale === b.scale && a.width === b.width && a.height === b.height && a.minX === b.minX && a.minY === b.minY && a.maxX === b.maxX && a.maxY === b.maxY
  && a.body.left === b.body.left && a.body.top === b.body.top && a.body.right === b.body.right && a.body.bottom === b.body.bottom;

type LookState = number | 'center' | null;

const PetBody: React.FC<{ pet: PetId; userId: string; account: PetOffset | null; saveToAccount: (offset: PetOffset) => void }> = ({ pet, userId, account, saveToAccount }) => {
  const petRef = useRef<HTMLButtonElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [saved] = useState(() => readSaved(userId, account));   // read once, not on every render
  // A place remembered only by this browser (from before account saving) is carried over to the account once.
  useEffect(() => { if (!account && saved.offset) saveToAccount({ dx: saved.offset.x, dy: saved.offset.y }); }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const [layout, setLayout] = useState<Layout | null>(null);
  const layoutRef = useRef<Layout | null>(null);
  const desiredRef = useRef<Position | null>(null);     // where the user last left the pet; the pet shows the nearest allowed spot to it
  const dragRef = useRef<{ offset: Position; start: Position; lastX: number; moved: boolean } | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const pendingRef = useRef<Position | null>(null);
  const [dragging, setDragging] = useState(false);
  const [dragMode, setDragMode] = useState<'runRight' | 'runLeft' | null>(null);
  const [oneShot, setOneShot] = useState<'jumping' | 'waving' | null>(null);
  const [look, setLook] = useState<LookState>(null);
  const [speech, setSpeech] = useState<string | null>(null);   // what the bubble says; a different line each time the pet waves
  const lastLineRef = useRef<string | undefined>(undefined);
  const waveDelayRef = useRef(WAVE_AFTER_MS);
  const [frame, setFrame] = useState<{ mode: Mode; index: number }>({ mode: 'idle', index: 0 });
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [pageVisible, setPageVisible] = useState(() => !document.hidden);
  // Quick chat: a temporary conversation of its own, held only in memory and gone with this pet (route exit, sign-out, OFF).
  const [chat, setChat] = useState<ChatView>('closed');
  const [draft, setDraft] = useState('');
  const [reply, setReply] = useState<Reply | null>(null);
  const turnsRef = useRef<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const contextRef = useRef<Record<string, string | null>>({});
  const requestRef = useRef<{ id: number; controller: AbortController } | null>(null);
  const requestIdRef = useRef(0);

  /**
   * The one place the layout changes: measure, clamp the wanted position into the current body, and replace the whole snapshot.
   * `sync` commits before the browser paints (resize, drag and visibility callbacks run outside React), so a frame never shows the
   * sprite from one measurement and its question box or reply from another.
   */
  const lay = useCallback((fit: Fit | null, sync: boolean) => {
    let next: Layout | null = null;
    if (fit) {
      if (!desiredRef.current) {
        desiredRef.current = saved.offset ? { x: fit.minX + saved.offset.x, y: fit.minY + saved.offset.y }
          : { x: saved.corner?.endsWith('left') ? fit.minX : fit.maxX, y: saved.corner?.startsWith('top') ? fit.minY : fit.maxY };
      }
      next = { fit, pos: clamp(fit, desiredRef.current) };
    }
    const previous = layoutRef.current;
    if (!previous && !next) return;
    if (previous && next && previous.pos.x === next.pos.x && previous.pos.y === next.pos.y && sameFit(previous.fit, next.fit)) return;
    layoutRef.current = next;
    if (sync) flushSync(() => setLayout(next)); else setLayout(next);
  }, [saved]);

  // Placement follows the body: window size, sidebar, header and scrollbar changes, coming back to a window that was minimised or in the
  // background, and device rotation. A change moves the pet only when it would otherwise leave the body, and only as far as needed.
  useEffect(() => {
    const measure = () => fitPet(bodyBounds(document.querySelector<HTMLElement>('[data-pet-body]')));
    const settle = () => { if (!document.hidden) lay(measure(), true); };
    lay(measure(), false);
    const pane = document.querySelector<HTMLElement>('[data-pet-body]');
    const observer = new ResizeObserver(settle);
    if (pane) {
      observer.observe(pane);
      const header = pane.querySelector(':scope > header');
      if (header) observer.observe(header);
    }
    observer.observe(document.documentElement);
    window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
    window.addEventListener('pageshow', settle);
    document.addEventListener('visibilitychange', settle);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', settle);
      window.removeEventListener('orientationchange', settle);
      window.removeEventListener('pageshow', settle);
      document.removeEventListener('visibilitychange', settle);
    };
  }, [lay]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const motionChange = () => setReducedMotion(media.matches);
    const visibility = () => setPageVisible(!document.hidden);
    media.addEventListener('change', motionChange);
    document.addEventListener('visibilitychange', visibility);
    return () => { media.removeEventListener('change', motionChange); document.removeEventListener('visibilitychange', visibility); };
  }, []);

  // Leaving the page, signing out or turning the pet off ends any open question; its answer can never reach another view.
  useEffect(() => () => {
    requestRef.current?.controller.abort();
    if (frameRequestRef.current !== null) cancelAnimationFrame(frameRequestRef.current);
  }, []);

  // Look toward the cursor; hold the last direction briefly after it stops, then rest. Close to the pet it faces forward.
  const hasLayout = layout !== null;
  useEffect(() => {
    if (reducedMotion || !pageVisible || !hasLayout) return;
    let timer = 0;
    const move = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || dragRef.current || !petRef.current) return;
      const box = petRef.current.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2), dy = event.clientY - (box.top + box.height / 2);
      setLook(Math.hypot(dx, dy) < box.width * 0.35 ? 'center' : lookSector(dx, dy));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setLook(null), LOOK_HOLD_MS);
    };
    const leave = () => { window.clearTimeout(timer); setLook(null); };
    window.addEventListener('pointermove', move, { passive: true });
    document.documentElement.addEventListener('pointerleave', leave);
    return () => { window.clearTimeout(timer); window.removeEventListener('pointermove', move); document.documentElement.removeEventListener('pointerleave', leave); };
  }, [reducedMotion, pageVisible, hasLayout]);

  // Strongest first: dragging, the click jump, the user's own question in progress, then the idle wave, then looking, then resting.
  const reviewing = reply?.status === 'pending';
  const feedback = reducedMotion ? null : oneShot;   // switching motion off mid-wave must not leave it waving
  const mode: Mode = dragging ? (dragMode ?? 'idle') : feedback === 'jumping' ? 'jumping' : reviewing ? 'review' : feedback ?? 'idle';
  const showLook = mode === 'idle' && look !== null && !reducedMotion && pageVisible;

  // Wave after five seconds of uninterrupted rest, saying something; any interaction, open chat or question starts the count again from five.
  // Later waves follow at random gaps, each with a different line.
  useEffect(() => {
    if (reducedMotion || !pageVisible || mode !== 'idle' || showLook || chat !== 'closed') return;
    const timer = window.setTimeout(() => {
      const line = pickLine(lastLineRef.current);
      lastLineRef.current = line;
      waveDelayRef.current = WAVE_GAP_MS[0] + Math.random() * (WAVE_GAP_MS[1] - WAVE_GAP_MS[0]);
      setSpeech(line);
      setOneShot('waving');
    }, waveDelayRef.current);
    return () => window.clearTimeout(timer);
  }, [mode, showLook, reducedMotion, pageVisible, chat]);

  // A line stays up long enough to read, then the bubble goes.
  useEffect(() => {
    if (!speech) return;
    const timer = window.setTimeout(() => setSpeech(null), speechMs(speech));
    return () => window.clearTimeout(timer);
  }, [speech]);

  useEffect(() => {
    if (reducedMotion || !pageVisible || showLook) return;
    const { frames, ms } = ROWS[mode];
    const total = mode === 'waving' ? frames * WAVE_LOOPS : mode === 'jumping' ? frames : Infinity;
    let shown = 0;
    const interval = window.setInterval(() => {
      shown += 1;
      if (shown >= total) { window.clearInterval(interval); setOneShot(null); return; }
      setFrame({ mode, index: shown % frames });
    }, ms);
    return () => window.clearInterval(interval);
  }, [mode, reducedMotion, pageVisible, showLook]);

  useLayoutEffect(() => { if (chat === 'open') inputRef.current?.focus(); }, [chat]);

  const queue = (position: Position) => {
    pendingRef.current = position;
    if (frameRequestRef.current !== null) return;
    frameRequestRef.current = requestAnimationFrame(() => {
      frameRequestRef.current = null;
      const target = pendingRef.current;
      pendingRef.current = null;
      if (target && layoutRef.current) { desiredRef.current = target; lay(layoutRef.current.fit, true); }
    });
  };

  const interrupt = () => { waveDelayRef.current = WAVE_AFTER_MS; setSpeech(null); };   // anything the user does ends the line and restarts the count

  const toggleChat = () => {
    interrupt();
    if (!layoutRef.current?.fit.full) { if (!reducedMotion) setOneShot('jumping'); return; }   // too little room for chat: a jump only
    setChat(current => (current === 'closed' ? 'launcher' : 'closed'));
    if (!reducedMotion) setOneShot('jumping');
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    const current = layoutRef.current;
    if (event.button !== 0 || !current) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { offset: { x: event.clientX - current.pos.x, y: event.clientY - current.pos.y }, start: { x: event.clientX, y: event.clientY }, lastX: event.clientX, moved: false };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (!drag.moved && Math.hypot(event.clientX - drag.start.x, event.clientY - drag.start.y) < DRAG_THRESHOLD) return;
    if (!drag.moved) { drag.moved = true; interrupt(); setDragging(true); setOneShot(null); setLook(null); }
    const dx = event.clientX - drag.lastX;
    if (Math.abs(dx) >= 2) { setDragMode(dx > 0 ? 'runRight' : 'runLeft'); drag.lastX = event.clientX; }
    queue({ x: event.clientX - drag.offset.x, y: event.clientY - drag.offset.y });
  };

  const finish = (event: React.PointerEvent<HTMLButtonElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (frameRequestRef.current !== null) { cancelAnimationFrame(frameRequestRef.current); frameRequestRef.current = null; }
    const pending = pendingRef.current;
    pendingRef.current = null;
    setDragging(false);
    setDragMode(null);
    if (!drag.moved) {
      if (!cancelled) toggleChat();   // a press that never became a drag is a click; a cancelled press does nothing
      return;
    }
    const current = layoutRef.current;
    if (!current) return;
    // A drop stays exactly where it was let go (inside the body); no corner pull. A cancelled drag keeps the last shown spot.
    desiredRef.current = clamp(current.fit, pending && !cancelled ? pending : current.pos);
    lay(current.fit, true);
    if (layoutRef.current) {
      saveOffset(userId, layoutRef.current.fit, layoutRef.current.pos);
      const { fit, pos } = layoutRef.current;
      saveToAccount({ dx: Math.round(pos.x - fit.minX), dy: Math.round(pos.y - fit.minY) });
    }
  };

  const ask = async (question: string) => {
    const text = question.trim();
    if (!text || reply?.status === 'pending') return;   // one question at a time; an empty one is never sent
    const id = ++requestIdRef.current;
    const controller = new AbortController();
    requestRef.current = { id, controller };
    setReply({ status: 'pending', question: text });
    try {
      const response = await apiService.queryNatural(text, undefined, { temporary: true, signal: controller.signal, context_state: contextRef.current, messages: turnsRef.current.slice(-QUICK_CHAT_TURNS) });
      if (requestRef.current?.id !== id) return;   // an older question must not overwrite a newer one
      const answer = typeof response?.answer === 'string' && response.answer.trim() ? response.answer : 'No answer was returned. Try asking another way.';
      turnsRef.current = [...turnsRef.current, { role: 'user' as const, content: text.slice(0, 2000) }, { role: 'assistant' as const, content: answer.slice(0, 2000) }].slice(-QUICK_CHAT_TURNS);
      contextRef.current = response?.context_state || {};
      setReply({ status: 'answer', question: text, text: answer });
      setDraft(current => (current.trim() === text ? '' : current));
    } catch (error) {
      if (requestRef.current?.id !== id || controller.signal.aborted) return;
      const detail = (error as { response?: { data?: { detail?: unknown } } }).response?.data?.detail;
      setReply({ status: 'error', question: text, text: typeof detail === 'string' && detail.length <= 160 ? detail : 'Could not get an answer. Try again.' });
    } finally {
      if (requestRef.current?.id === id) requestRef.current = null;
    }
  };

  const close = () => {
    // Closing cancels a question still in progress (the draft stays); a finished answer stays until the next question.
    if (requestRef.current) { requestRef.current.controller.abort(); requestRef.current = null; setReply(null); }
    setChat('closed');
    petRef.current?.focus();
  };

  if (!layout) return null;
  const { fit, pos } = layout;
  const lookCell = showLook ? (look === 'center' ? NEUTRAL : lookFrame(pet, look as number)) : null;
  const [column, row] = lookCell ? [lookCell.col, lookCell.row] : [frame.mode === mode && !reducedMotion ? frame.index : 0, ROWS[mode].row];
  const chatAvailable = fit.full;
  const view: ChatView = chatAvailable ? chat : 'closed';
  const panelShown = view !== 'closed' && reply !== null;
  const bubble = !fit.full || dragging || panelShown || view !== 'closed' || !pageVisible ? null : speech;
  const innerWidth = fit.body.right - fit.body.left - 2 * INSET;
  const panelWidth = Math.min(PANEL_WIDTH, innerWidth);
  const controlWidth = view === 'open' ? panelWidth : Math.min(LAUNCHER_WIDTH, innerWidth);
  // Centred on the pet, nudged sideways only as far as the body's gap requires. Taken from the same snapshot as the sprite.
  const shiftFor = (width: number) => {
    const left = pos.x + fit.width / 2 - width / 2;
    return Math.min(Math.max(left, fit.body.left + INSET), fit.body.right - INSET - width) - left;
  };
  // Not enough room above for a readable reply: the pet steps down only while it shows, never saved.
  const above = pos.y - 8 - (fit.body.top + INSET);
  const lift = panelShown && above < PANEL_MIN_HEIGHT ? Math.max(0, Math.min(PANEL_MIN_HEIGHT - above, fit.maxY - pos.y)) : 0;
  const panelHeight = Math.min(PANEL_MAX_HEIGHT, above + lift);
  const transition = reducedMotion ? { duration: 0 } : { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div
      data-pet-wrapper
      data-pet-layout={fit.full ? 'full' : 'compact'}
      className="pointer-events-none fixed left-0 top-0 z-40 !m-0"
      style={{ width: fit.width, height: fit.height, transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`, willChange: dragging ? 'transform' : 'auto' }}
      onKeyDown={event => { if (event.key === 'Escape' && view !== 'closed') { event.stopPropagation(); close(); } }}
    >
      {/* Everything attached to the pet lives in here, so it can only ever move with it. The step down for a tall reply is immediate: an animated one would leave the reply outside the body for a moment. */}
      <div className="relative h-full w-full" style={{ transform: lift ? `translateY(${lift}px)` : undefined }}>
        {/* Reply above the pet: the real answer, plain text, scrolling inside its own bounded box. */}
        <AnimatePresence initial={false}>
          {panelShown && (
            <motion.div
              key="reply"
              id="pet-quick-reply"
              data-pet-reply
              role="region"
              aria-label="Pet reply"
              aria-live="polite"
              initial={reducedMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 6, scale: 0.98 }}
              transition={transition}
              className="pointer-events-auto absolute bottom-[calc(100%+8px)] flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white/95 text-xs text-slate-700 shadow-xl backdrop-blur dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-200"
              style={{ width: panelWidth, maxHeight: panelHeight, left: '50%', x: '-50%', marginLeft: shiftFor(panelWidth) }}
            >
              <p className="shrink-0 truncate border-b border-slate-100 px-3.5 py-2 text-[11px] font-semibold text-slate-500 dark:border-slate-800 dark:text-slate-400" title={reply.question}>{reply.question}</p>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3.5 py-2.5 leading-relaxed">
                {reply.status === 'pending' && <p role="status" className="text-slate-500 dark:text-slate-400">Checking…</p>}
                {reply.status === 'answer' && <p className="whitespace-pre-wrap break-words">{reply.text}</p>}
                {reply.status === 'error' && (
                  <div role="alert" className="flex items-center justify-between gap-3 text-rose-600 dark:text-rose-400">
                    <span>{reply.text}</span>
                    <button type="button" onClick={() => void ask(reply.question)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-rose-200 px-2 py-1 font-semibold hover:bg-rose-50 dark:border-rose-800 dark:hover:bg-rose-950">
                      <RotateCcw className="h-3 w-3" aria-hidden="true" />Retry
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none">
          <AnimatePresence>
            {bubble && <PetBubble key={bubble} text={bubble} reduceMotion={reducedMotion} anchorX={pos.x + fit.width / 2} minX={fit.body.left + INSET} maxX={fit.body.right - INSET} />}
          </AnimatePresence>
        </div>

        <button
          ref={petRef}
          type="button"
          data-pet={pet}
          data-pet-state={showLook ? 'look' : mode}
          aria-label={`${PET_SHEETS[pet].name}, your assistant. Press to chat, drag to move.`}
          aria-expanded={chatAvailable ? view !== 'closed' : undefined}
          title="Press to chat, drag to move"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={event => finish(event, false)}
          onPointerCancel={event => finish(event, true)}
          onLostPointerCapture={event => finish(event, true)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); toggleChat(); } }}
          className={`pointer-events-auto absolute inset-0 !m-0 select-none border-0 bg-transparent p-0 outline-none transition-[filter,opacity] duration-200 focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-blue-500/60 ${dragging ? 'cursor-grabbing drop-shadow-[0_16px_16px_rgba(15,23,42,0.28)]' : 'cursor-grab drop-shadow-[0_10px_10px_rgba(15,23,42,0.20)] hover:brightness-105'}`}
          style={{ touchAction: 'none' }}
        >
          {/* Only this sprite layer is ever mirrored (for the upper-left look frames); the box, labels and controls never are. */}
          <span
            aria-hidden="true"
            data-pet-sprite
            className="block h-full w-full"
            style={{ backgroundImage: `url(${PET_SHEETS[pet].sheet})`, backgroundRepeat: 'no-repeat', backgroundSize: '800% 1100%', backgroundPosition: `${(column / 7) * 100}% ${(row / 10) * 100}%`, transform: lookCell?.flip ? 'scaleX(-1)' : undefined }}
          />
        </button>

        {/* Chat control under the pet: a Start chat pill that widens into the question box, growing evenly from the pet's centre. */}
        <AnimatePresence initial={false}>
          {view !== 'closed' && (
            <motion.form
              key="control"
              data-pet-control={view}
              initial={reducedMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, width: controlWidth }}
              exit={reducedMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: -4 }}
              transition={transition}
              onSubmit={event => { event.preventDefault(); if (view === 'open') void ask(draft); }}
              className="pointer-events-auto absolute top-[calc(100%+8px)] flex h-11 items-center gap-1 overflow-hidden rounded-full border border-slate-200 bg-white p-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
              style={{ left: '50%', x: '-50%', marginLeft: shiftFor(controlWidth) }}
            >
              {view === 'launcher' ? (
                <button type="button" onClick={() => setChat('open')} className="flex h-full min-w-0 flex-1 items-center justify-center gap-2 rounded-full text-xs font-semibold text-brand-blue hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue dark:text-blue-300 dark:hover:bg-slate-800">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />Start chat
                </button>
              ) : (
                <>
                  <input
                    ref={inputRef}
                    value={draft}
                    maxLength={2000}
                    onChange={event => setDraft(event.target.value)}
                    aria-label="Ask a question"
                    placeholder="Ask a question"
                    className="h-full min-w-0 flex-1 rounded-full bg-transparent px-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 dark:text-slate-100"
                  />
                  <button type="submit" aria-label="Send" title="Send" disabled={!draft.trim() || reviewing} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white transition-opacity hover:bg-brand-blue-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-blue disabled:cursor-not-allowed disabled:opacity-40">
                    <Send className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </>
              )}
              <button type="button" aria-label="Close" title="Close" onClick={close} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand-blue dark:hover:bg-slate-800 dark:hover:text-slate-200">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

/** The account's chosen pet on the Dashboard, unless the account turned it off; nothing is drawn until that choice has loaded. */
export const Pet: React.FC = () => {
  const { user } = useAuth();
  const { ready, visible, pet, position, save } = usePetPreferences(user?.user_id);
  return ready && visible && pet && user ? <PetBody key={`${user.user_id}-${pet}`} pet={pet} userId={String(user.user_id)} account={position} saveToAccount={offset => { void save({ position: offset }); }} /> : null;
};
