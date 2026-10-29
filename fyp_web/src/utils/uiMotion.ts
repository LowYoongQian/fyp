import { animate } from 'motion/mini';

/** Visual feedback only: never wait for this before changing state or saving data. */
export function animateUiEntrance(element: HTMLElement | null, fromOpacity = 0.88) {
  if (!element) return;
  const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches) return;
  const duration = parseFloat(getComputedStyle(element).getPropertyValue('--ui-duration-enter')) || 160;
  // Opacity leaves viewport placement and fixed/portaled descendants untouched.
  const animation = animate(element, { opacity: [fromOpacity, 1] }, {
    duration: duration / 1000, ease: [0.16, 1, 0.3, 1],
  });
  const reduce = () => { if (preference.matches) animation.cancel(); };
  preference.addEventListener('change', reduce);
  return () => { animation.cancel(); preference.removeEventListener('change', reduce); };
}
