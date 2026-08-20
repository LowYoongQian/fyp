import React from 'react';
import { motion } from 'motion/react';

interface TerminalProps {
  text: string;
  reduceMotion?: boolean;
  className?: string;
}

export const Terminal: React.FC<TerminalProps> = ({ text, reduceMotion = false, className = '' }) => (
  <motion.span
    role="status"
    aria-label={text}
    initial={reduceMotion ? false : { opacity: 0, x: -12, clipPath: 'inset(0 100% 0 0)' }}
    animate={{ opacity: 1, x: 0, clipPath: 'inset(0 0% 0 0)' }}
    exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 10, clipPath: 'inset(0 0 0 100%)' }}
    transition={{ duration: reduceMotion ? 0 : 0.65, ease: [0.22, 1, 0.36, 1], delay: reduceMotion ? 0 : 0.18 }}
    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-300 bg-white/95 px-3 py-2 font-mono text-xs font-bold text-slate-800 shadow-lg backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/95 dark:text-white ${className}`}
  >
    <span className="text-blue-600 dark:text-emerald-400">&gt;</span>
    <span>{text}</span>
    <motion.span
      aria-hidden="true"
      animate={reduceMotion ? { opacity: 1 } : { opacity: [1, 1, 0, 0, 1] }}
      transition={reduceMotion ? { duration: 0 } : { duration: 1, repeat: Infinity, times: [0, 0.45, 0.5, 0.95, 1] }}
      className="h-3.5 w-1.5 bg-slate-800 dark:bg-white"
    />
  </motion.span>
);
