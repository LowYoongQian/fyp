import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import spriteSheet from '../assets/xiao-ji-zai/spritesheet.webp';
import { Terminal } from './loading-ui/terminal';

type PetAnimation = 'idle' | 'drag' | 'land' | 'play' | 'sit';
type Position = { x: number; y: number };
type CornerAnchor = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const PET_WIDTH = 126;
const PET_HEIGHT = 137;
const EDGE_GAP = 12;
const DEFAULT_RIGHT_GAP = 72;
const DEFAULT_BOTTOM_GAP = 28;
const TOP_MESSAGE_SPACE = 54;
const STORAGE_KEY = 'staff-dashboard-pet-corner';

const ANIMATIONS: Record<PetAnimation, { frames: Array<[number, number]>; speed: number }> = {
  idle: { frames: [[0, 6], [1, 6], [2, 6], [3, 6], [4, 6], [5, 6], [4, 6], [3, 6]], speed: 420 },
  drag: { frames: [[0, 7], [1, 7], [2, 7], [3, 7], [4, 7], [5, 7]], speed: 90 },
  land: { frames: [[0, 3], [1, 3], [2, 3], [3, 3]], speed: 110 },
  play: { frames: [[0, 4], [1, 4], [2, 4], [3, 4], [4, 4]], speed: 125 },
  sit: { frames: [[0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8]], speed: 360 },
};

const clampPosition = ({ x, y }: Position): Position => ({
  x: Math.min(Math.max(EDGE_GAP, x), Math.max(EDGE_GAP, window.innerWidth - PET_WIDTH - EDGE_GAP)),
  y: Math.min(Math.max(EDGE_GAP, y), Math.max(EDGE_GAP, window.innerHeight - PET_HEIGHT - EDGE_GAP)),
});

const isCornerAnchor = (value: unknown): value is CornerAnchor => (
  value === 'top-left' || value === 'top-right' || value === 'bottom-left' || value === 'bottom-right'
);

const positionForCorner = (corner: CornerAnchor): Position => ({
  x: corner.endsWith('left')
    ? DEFAULT_RIGHT_GAP
    : window.innerWidth - PET_WIDTH - DEFAULT_RIGHT_GAP,
  y: corner.startsWith('top')
    ? DEFAULT_BOTTOM_GAP + TOP_MESSAGE_SPACE
    : window.innerHeight - PET_HEIGHT - DEFAULT_BOTTOM_GAP,
});

const nearestCorner = ({ x, y }: Position): CornerAnchor => {
  const horizontal = x + PET_WIDTH / 2 < window.innerWidth / 2 ? 'left' : 'right';
  const vertical = y + PET_HEIGHT / 2 < window.innerHeight / 2 ? 'top' : 'bottom';
  return `${vertical}-${horizontal}` as CornerAnchor;
};

export const Pet: React.FC = () => {
  const petRef = useRef<HTMLButtonElement | null>(null);
  const positionRef = useRef<Position>({ x: 0, y: 0 });
  const dragOffsetRef = useRef<Position>({ x: 0, y: 0 });
  const pendingPositionRef = useRef<Position | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const snapTimerRef = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const cornerRef = useRef<CornerAnchor>('bottom-right');
  const [ready, setReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [snapping, setSnapping] = useState(false);
  const [animation, setAnimation] = useState<PetAnimation>('idle');
  const [frameIndex, setFrameIndex] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [messageVisible, setMessageVisible] = useState(true);

  const placePet = (position: Position) => {
    const next = clampPosition(position);
    positionRef.current = next;
    if (petRef.current) {
      petRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`;
    }
  };

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () => setReducedMotion(media.matches);
    updatePreference();
    media.addEventListener('change', updatePreference);
    return () => media.removeEventListener('change', updatePreference);
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (isCornerAnchor(saved)) cornerRef.current = saved;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
    placePet(positionForCorner(cornerRef.current));
    setReady(true);

    const handleResize = () => placePet(positionForCorner(cornerRef.current));
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setFrameIndex(0);
    if (reducedMotion) return;
    const current = ANIMATIONS[animation];
    const interval = window.setInterval(() => {
      setFrameIndex(previous => (previous + 1) % current.frames.length);
    }, current.speed);
    return () => window.clearInterval(interval);
  }, [animation, reducedMotion]);

  useEffect(() => {
    const timer = window.setTimeout(
      () => setMessageVisible(current => !current),
      messageVisible ? 5000 : 10000,
    );
    return () => window.clearTimeout(timer);
  }, [messageVisible]);

  useEffect(() => {
    if (reducedMotion || animation === 'drag') return;
    const current = ANIMATIONS[animation];
    const delay = animation === 'idle'
      ? 4200 + Math.round(Math.random() * 4200)
      : current.frames.length * current.speed;
    const timer = window.setTimeout(() => {
      if (draggingRef.current) return;
      if (animation === 'idle') {
        setAnimation(Math.random() > 0.45 ? 'play' : 'sit');
      } else {
        setAnimation('idle');
      }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [animation, reducedMotion]);

  useEffect(() => () => {
    if (animationFrameRef.current !== null) cancelAnimationFrame(animationFrameRef.current);
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
  }, []);

  const queuePosition = (position: Position) => {
    pendingPositionRef.current = position;
    if (animationFrameRef.current !== null) return;
    animationFrameRef.current = requestAnimationFrame(() => {
      if (pendingPositionRef.current) placePet(pendingPositionRef.current);
      pendingPositionRef.current = null;
      animationFrameRef.current = null;
    });
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOffsetRef.current = {
      x: event.clientX - positionRef.current.x,
      y: event.clientY - positionRef.current.y,
    };
    draggingRef.current = true;
    setDragging(true);
    setAnimation('drag');
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    queuePosition({
      x: event.clientX - dragOffsetRef.current.x,
      y: event.clientY - dragOffsetRef.current.y,
    });
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!draggingRef.current) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (pendingPositionRef.current) placePet(pendingPositionRef.current);
    pendingPositionRef.current = null;
    draggingRef.current = false;
    const corner = nearestCorner(positionRef.current);
    cornerRef.current = corner;
    setDragging(false);
    setSnapping(true);
    setAnimation(reducedMotion ? 'idle' : 'land');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => placePet(positionForCorner(corner)));
    });
    if (snapTimerRef.current !== null) window.clearTimeout(snapTimerRef.current);
    snapTimerRef.current = window.setTimeout(() => setSnapping(false), 320);
    try {
      localStorage.setItem(STORAGE_KEY, corner);
    } catch {
      // Position persistence is optional when browser storage is unavailable.
    }
  };

  const [column, row] = ANIMATIONS[animation].frames[frameIndex] ?? ANIMATIONS.idle.frames[0];

  return (
    <button
      ref={petRef}
      type="button"
      aria-label="Draggable dashboard pet"
      title="Drag me to another corner"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      className={`fixed left-0 top-0 z-40 select-none border-0 bg-transparent p-0 outline-none focus-visible:rounded-2xl focus-visible:ring-2 focus-visible:ring-blue-500/60 ${snapping ? 'transition-transform duration-300 ease-out' : 'transition-[filter,opacity] duration-200'} ${ready ? 'opacity-100' : 'pointer-events-none opacity-0'} ${dragging ? 'cursor-grabbing drop-shadow-[0_16px_16px_rgba(15,23,42,0.28)]' : 'cursor-grab drop-shadow-[0_10px_10px_rgba(15,23,42,0.20)] hover:brightness-105'}`}
      style={{
        width: PET_WIDTH,
        height: PET_HEIGHT,
        touchAction: 'none',
        willChange: dragging ? 'transform' : 'auto',
      }}
    >
      <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2">
        <AnimatePresence>
          {messageVisible && !dragging && (
            <Terminal key="pet-message" text="鸡你太美" reduceMotion={reducedMotion} />
          )}
        </AnimatePresence>
      </span>
      <span
        aria-hidden="true"
        className="block h-full w-full"
        style={{
          backgroundImage: `url(${spriteSheet})`,
          backgroundRepeat: 'no-repeat',
          backgroundSize: '800% 900%',
          backgroundPosition: `${(column / 7) * 100}% ${(row / 8) * 100}%`,
        }}
      />
    </button>
  );
};
