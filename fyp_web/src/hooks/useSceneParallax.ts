import { useEffect, type RefObject } from 'react';

/**
 * Gentle depth for a layered scene. Every `[data-depth="k"]` inside `root` shifts by up to k px against the mouse and a little with page scroll, so
 * near layers move more than far ones. The motion is eased, runs only while something is moving, ignores touch drags, and is off with reduced motion.
 */
export function useSceneParallax(root: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const scene = root.current;
    if (!scene || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const goal = { x: 0, y: 0 }, now = { x: 0, y: 0 };
    let frame = 0;
    const draw = () => {
      frame = 0;
      now.x += (goal.x - now.x) * 0.09; now.y += (goal.y - now.y) * 0.09;
      const scrolled = Math.min(window.scrollY, 400)   // with the deepest layer at 14: 22px up, inside the 32px the land layers extend below the screen;
      for (const layer of scene.querySelectorAll<HTMLElement>('[data-depth]')) {
        const depth = Number(layer.dataset.depth);
        layer.style.transform = `translate3d(${(-now.x * depth).toFixed(2)}px, ${(-now.y * depth * 0.6 - scrolled * depth * 0.004).toFixed(2)}px, 0)`;
      }
      if (Math.abs(goal.x - now.x) > 0.002 || Math.abs(goal.y - now.y) > 0.002) frame = requestAnimationFrame(draw);
    };
    const wake = () => { if (!frame) frame = requestAnimationFrame(draw); };
    const onPointer = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      goal.x = event.clientX / window.innerWidth * 2 - 1;
      goal.y = event.clientY / window.innerHeight * 2 - 1;
      wake();
    };
    const onLeave = () => { goal.x = 0; goal.y = 0; wake(); };
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('scroll', wake, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onPointer);
      window.removeEventListener('scroll', wake);
      document.documentElement.removeEventListener('pointerleave', onLeave);
    };
  }, [root]);
}
