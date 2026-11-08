import React from 'react';
import { TextShimmer } from './text-shimmer';

/** Shown only while a real question is waiting for its answer (adapted from prompt-kit's ThinkingBar, MIT). No invented steps: it says only "Thinking". */
export const ThinkingBar: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div role="status" aria-label="Thinking" data-thinking-bar className={`flex items-center gap-2.5 ${className}`}>
    <span aria-hidden="true" className="thinking-bar-track"><span /></span>
    <TextShimmer className="text-xs font-semibold">Thinking</TextShimmer>
  </div>
);
