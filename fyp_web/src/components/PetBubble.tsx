import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';

const TYPING_MS = 32;
const TAIL_EDGE = 20;   // the tail stays this far from the bubble's rounded ends

/**
 * The pet's speech bubble: a rounded pill with a small tail toward the pet, typed out letter by letter. One soft shadow is cast by the whole
 * shape, tail included (a drop-shadow, which follows the outline), and nothing clips it. It sits centred over the pet but is nudged sideways to
 * stay between `minX` and `maxX` (viewport coordinates), with the tail still pointing at the pet (`anchorX`). Render it inside AnimatePresence.
 */
export const PetBubble: React.FC<{ text: string; reduceMotion: boolean; anchorX: number; minX: number; maxX: number }> = ({ text, reduceMotion, anchorX, minX, maxX }) => {
  const frame = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const tail = useRef<SVGSVGElement>(null);
  const [typed, setTyped] = useState(reduceMotion ? text.length : 0);
  const room = Math.max(120, maxX - minX);

  // Measured and placed before paint, so the bubble never shows in the wrong place for a frame. The DOM is written directly: this is a measurement, not state.
  useLayoutEffect(() => {
    if (!frame.current || !body.current || !tail.current) return;
    const width = frame.current.offsetWidth;
    const natural = anchorX - width / 2;
    const shift = Math.min(Math.max(natural, minX), maxX - width) - natural;
    const tailX = Math.min(Math.max(width / 2 - shift, TAIL_EDGE), Math.max(TAIL_EDGE, width - TAIL_EDGE));
    frame.current.style.transform = `translateX(calc(-50% + ${shift}px))`;
    body.current.style.transformOrigin = `${tailX}px 100%`;
    tail.current.style.left = `${tailX - 7}px`;
  }, [anchorX, minX, maxX, text]);

  useEffect(() => {
    if (reduceMotion) return;
    const timer = window.setInterval(() => setTyped(count => { if (count >= text.length) { window.clearInterval(timer); return count; } return count + 1; }), TYPING_MS);
    return () => window.clearInterval(timer);
  }, [text, reduceMotion]);

  return (
    <div ref={frame} className="absolute bottom-[calc(100%+8px)] left-1/2 w-max -translate-x-1/2" style={{ maxWidth: room }}>
      <motion.div
        ref={body}
        role="status"
        aria-label={text}
        data-pet-bubble
        initial={reduceMotion ? false : { opacity: 0, y: 8, scale: 0.8 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, y: 4, scale: 0.9, transition: { duration: 0.18 } }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 26 }}
        className="relative [filter:drop-shadow(0_1px_1px_rgb(15_23_42/0.10))_drop-shadow(0_8px_14px_rgb(15_23_42/0.16))] dark:[filter:drop-shadow(0_0_1px_rgb(255_255_255/0.3))_drop-shadow(0_1px_1px_rgb(0_0_0/0.4))_drop-shadow(0_8px_14px_rgb(0_0_0/0.45))]"
      >
        <div className="truncate rounded-full bg-white px-4 py-2 text-xs font-medium leading-4 text-slate-700 dark:bg-slate-800 dark:text-slate-100">
          <span aria-hidden="true">{text.slice(0, typed)}</span>
          {/* A thin blinking caret while the line is typed (zero width, so the bubble never changes size); gone once it is complete. */}
          {typed < text.length && <span aria-hidden="true" data-pet-cursor className="pet-bubble-cursor" />}
          <span aria-hidden="true" className="invisible">{text.slice(typed)}</span>
        </div>
        <svg ref={tail} aria-hidden="true" viewBox="0 0 14 6" className="absolute top-full h-1.5 w-3.5 fill-white dark:fill-slate-800" style={{ left: 'calc(50% - 7px)' }}>
          <path d="M0 0H14C10.5 0 8.6 2.4 7 6C5.4 2.4 3.5 0 0 0Z" />
        </svg>
      </motion.div>
    </div>
  );
};
