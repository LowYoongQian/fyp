import { motion } from 'motion/react';

function InfinityLoop(props: React.ComponentProps<'svg'>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="status"
      aria-label="Loading"
      {...props}
    >
      <path
        d="M12 12c2-3.5 7-3.5 7 0s-5 3.5-7 0-7-3.5-7 0 5 3.5 7 0Z"
        className="opacity-20"
      />
      <motion.path
        d="M12 12c2-3.5 7-3.5 7 0s-5 3.5-7 0-7-3.5-7 0 5 3.5 7 0Z"
        pathLength={1}
        strokeDasharray="0.2 0.8"
        animate={{ strokeDashoffset: [0, -1] }}
        transition={{ duration: 1.35, ease: 'linear', repeat: Infinity }}
      />
    </svg>
  );
}

export { InfinityLoop };
