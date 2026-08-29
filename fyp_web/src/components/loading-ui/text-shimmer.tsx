import React from 'react';
import { motion } from 'motion/react';

interface TextShimmerProps {
  children: string;
  className?: string;
  duration?: number;
}

export const TextShimmer: React.FC<TextShimmerProps> = ({
  children,
  className = '',
  duration = 1.6,
}) => (
  <motion.span
    role="status"
    aria-label={children}
    className={`inline-block bg-clip-text text-transparent ${className}`}
    style={{
      backgroundImage:
        'linear-gradient(90deg, var(--theme-text-primary) 0%, var(--theme-text-primary) 35%, #2563eb 50%, var(--theme-text-primary) 65%, var(--theme-text-primary) 100%)',
      backgroundSize: '240% 100%',
      WebkitBackgroundClip: 'text',
    }}
    animate={{ backgroundPosition: ['120% 0%', '-120% 0%'] }}
    transition={{ duration, ease: 'linear', repeat: Infinity }}
  >
    {children}
  </motion.span>
);
