import { useSyncExternalStore } from 'react';

/** Whether a CSS media query currently matches, kept current as the window changes (a phone turning sideways, a window resized). */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    notify => { const list = window.matchMedia(query); list.addEventListener('change', notify); return () => list.removeEventListener('change', notify); },
    () => window.matchMedia(query).matches,
    () => false,
  );
}
