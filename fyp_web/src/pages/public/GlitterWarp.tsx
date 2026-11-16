import { useEffect, useRef } from 'react';

/**
 * A glittering starfield warp: points of light stream out of the middle of the view toward the reader, leaving short trails and twinkling as
 * they pass. Our own implementation; the settings follow React Bits' Glitter Warp (color, brightness, speed, density, starSize, focalDepth).
 * One 2D canvas, transparent so whatever is behind shows through; it draws only while on screen and the tab is shown, and once, still, with
 * reduced motion.
 */
export function GlitterWarp({ color = '#ffffff', brightness = 1, speed = 1, density = 15, starSize = 0.1, focalDepth = 0.05 }: {
  color?: string; brightness?: number; speed?: number; density?: number; starSize?: number; focalDepth?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let w = 0, h = 0, frame = 0, running = false, visible = true, last = 0;
    // Each star: a direction on the screen plane (x, y in -1..1) and a depth z (1 far, 0 at the reader). Fewer stars for a higher density, as in the original.
    const count = Math.round(Math.max(120, Math.min(900, 9000 / Math.max(4, density))));
    let seed = 41;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const stars = Array.from({ length: count }, () => ({ x: random() * 2 - 1, y: random() * 2 - 1, z: random(), phase: random() * Math.PI * 2 }));
    const focal = 0.35 + focalDepth * 4;   // a lower focal depth spreads the stars wider: a stronger 3D effect
    const project = (s: { x: number; y: number }, z: number) => {
      const k = focal / Math.max(0.02, z);
      return [w / 2 + s.x * k * w * 0.5, h / 2 + s.y * k * h * 0.5] as const;
    };
    const draw = (now: number) => {
      const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
      last = now;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const star of stars) {
        const before = star.z;
        if (!still) star.z -= dt * 0.22 * speed;
        if (star.z <= 0.02) { star.x = random() * 2 - 1; star.y = random() * 2 - 1; star.z = 1; star.phase = random() * Math.PI * 2; continue; }
        const [x1, y1] = project(star, star.z), [x0, y0] = project(star, Math.min(1, star.z + 0.035 + (before - star.z) * 3));
        if (x1 < -20 || y1 < -20 || x1 > w + 20 || y1 > h + 20) { star.z = 0; continue; }
        const near = 1 - star.z, twinkle = 0.55 + 0.45 * Math.sin(now / 1000 * 6 + star.phase);
        ctx.globalAlpha = Math.min(1, near * near * 1.3 * twinkle * brightness);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(0.6, near * near * starSize * 30);
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        if (twinkle > 0.93 && near > 0.45) {   // the glitter: a brief white spark at the head of a near star
          ctx.globalAlpha = Math.min(1, (twinkle - 0.93) * 12 * brightness * near);
          ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x1, y1, ctx.lineWidth * 0.9, 0, Math.PI * 2); ctx.fill();
        }
      }
      ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    };
    const loop = (now: number) => { draw(now); frame = requestAnimationFrame(loop); };
    const sync = () => {
      const on = !still && visible && document.visibilityState === 'visible' && w > 0;
      if (on === running) return;
      running = on; last = 0;
      if (on) frame = requestAnimationFrame(loop); else cancelAnimationFrame(frame);
    };
    const layout = () => {
      const box = canvas.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = box.width; h = box.height;
      if (w < 1 || h < 1) { w = 0; sync(); return; }
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!running) draw(performance.now());
      sync();
    };
    const resize = new ResizeObserver(layout); resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }); seen.observe(canvas);
    document.addEventListener('visibilitychange', sync);
    layout();
    return () => { running = false; cancelAnimationFrame(frame); resize.disconnect(); seen.disconnect(); document.removeEventListener('visibilitychange', sync); };
  }, [color, brightness, speed, density, starSize, focalDepth]);
  return <canvas ref={canvasRef} aria-hidden="true" data-glitter-warp className="pointer-events-none absolute inset-0 h-full w-full" />;
}
