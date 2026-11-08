import React from 'react';

interface TextShimmerProps {
  children: string;
  className?: string;
  duration?: number;
  spread?: number;
}

/**
 * Text with a soft light passing across it (adapted from prompt-kit's TextShimmer, MIT: a muted-to-strong-to-muted gradient clipped to the text).
 * Decorative only: the caller announces what it means. Reduced motion shows the text still.
 */
export const TextShimmer: React.FC<TextShimmerProps> = ({ children, className = '', duration = 2.4, spread = 22 }) => {
  const edge = Math.min(Math.max(spread, 5), 45);
  return (
    <span
      className={`text-shimmer ${className}`}
      style={{
        backgroundImage: `linear-gradient(to right, var(--theme-text-secondary) ${50 - edge}%, var(--theme-text-primary) 50%, var(--theme-text-secondary) ${50 + edge}%)`,
        animationDuration: `${duration}s`,
      }}
    >
      {children}
    </span>
  );
};
