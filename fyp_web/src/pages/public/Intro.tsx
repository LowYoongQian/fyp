import { useEffect, useRef, type RefObject } from 'react';
import { motion, useScroll, useTransform } from 'motion/react';
import { ArrowRight, BarChart3, CalendarDays, ChevronDown, ScanFace, Wifi } from 'lucide-react';
import sasLogo from '../../assets/emblem.webp';
import { goTo } from '../../utils/publicRoute';
import { advance, createFluid, smoke, stir, type Fluid } from './fieldMotion';
import { LOGO } from './sceneConfig';
import { useRange, useViewport } from './range';
import { VaporHeadline } from './VaporHeadline';
import SideRays from './reactbits/SideRays';

/** Words left and emblem right when the screen is wide enough (also a phone held sideways); otherwise the emblem above the words. */
const sideBySide = (w: number, h: number) => w >= 1024 || (w >= 640 && w / h > 1.4);

type Crest = { left: number; top: number; step: number; cols: number; rows: number; value: Float32Array; color: string[]; sx: Float32Array; sy: Float32Array };

/**
 * The intro's living field (one 2D canvas, no WebGL): rows of small blue slats that grow with their light, three currents of light flowing across
 * them in sky, blue and indigo, and the USAS emblem rebuilt from finer slats in its own colours. The pointer carries a soft halo that stays exactly
 * on it (the emblem parts around it) and fades out where it was when the pointer leaves the page; moving it stirs a liquid whose glow keeps the
 * stroke's momentum and trails behind as soft smoke (fieldMotion.ts). A click or tap sends a ring out; a scan line passes down the emblem, as at a
 * face check-in. Nothing moves by itself toward or away from the pointer. It only draws while it is on screen and the tab is shown; with reduced
 * motion it is drawn once, still.
 */
function useEmblemField(canvasRef: RefObject<HTMLCanvasElement | null>, still: boolean) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    let w = 0, h = 0, cell = 12, cols = 0, rows = 0, crest: Crest | null = null, fluid: Fluid = createFluid(1, 1);
    // Per slat for this frame: its size and light, and how much of each current is in it (drawn in one pass per colour, not a colour per slat).
    let size = new Float32Array(0), base = new Float32Array(0), ring = new Float32Array(0), streams = [new Float32Array(0), new Float32Array(0), new Float32Array(0)];
    // The trail's smoke: the liquid's glow as a tiny picture (one pixel per cell), stretched smoothly over the field.
    let smokeImage: ImageData | null = null;
    const smokeCanvas = document.createElement('canvas'), smokeCtx = smokeCanvas.getContext('2d');
    let frame = 0, running = false, visible = true, alive = true, born = 0, last = 0;   // born: when the emblem first assembled (a resize does not replay it)
    const start = performance.now();
    // here: the pointer is over the page; presence eases to 1 while it is and back to 0 (where it last was) when it leaves.
    const pointer = { x: -1e4, y: -1e4, tx: -1e4, ty: -1e4, here: false, presence: 0, lastX: Number.NaN, lastY: Number.NaN };
    // A click's ring: it runs out to the farthest corner (`reach`), bright near the click and dimmer the farther it has gone.
    let ripples: { x: number; y: number; at: number; reach: number }[] = [];
    const RING_SPEED = 760, RING_WIDTH = 34;   // px/s, px
    const logo = new Image();

    const sample = () => {
      crest = null;
      if (!logo.naturalWidth || !w) return;
      const { x0, y0, x1, y1 } = LOGO.box, ratio = (x1 - x0) / (y1 - y0);
      const side = sideBySide(w, h);
      const tall = side ? Math.min(h * 0.6, (w * 0.36) / ratio) : Math.min(h * 0.34, (w * 0.78) / ratio);
      const step = cell * 0.62;   // a finer grid than the field's, so the emblem's book, flame, lettering and wreath can be read
      const crestRows = Math.max(16, Math.round(tall / step)), crestCols = Math.max(16, Math.round(crestRows * ratio));
      const off = document.createElement('canvas');
      off.width = crestCols; off.height = crestRows;
      const octx = off.getContext('2d', { willReadFrequently: true });
      if (!octx) return;
      octx.drawImage(logo, x0, y0, x1 - x0, y1 - y0, 0, 0, crestCols, crestRows);   // one pixel per slat
      const data = octx.getImageData(0, 0, crestCols, crestRows).data;
      const count = crestCols * crestRows, value = new Float32Array(count), color: string[] = new Array(count), sx = new Float32Array(count), sy = new Float32Array(count);
      let seed = 11;
      const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
      for (let i = 0; i < count; i += 1) {
        const r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2], a = data[i * 4 + 3] / 255;
        // The emblem is mostly a dark blue disc: its bright parts (book, flame, lettering, circuits, wreath) carry it, the disc stays a soft shape.
        value[i] = a * (0.14 + 0.86 * ((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255) ** 0.85);
        const lift = (channel: number) => Math.min(255, Math.round((channel + (255 - channel) * 0.12) / 16) * 16);   // shared shades: fewer colour changes per frame
        color[i] = `rgb(${lift(r)},${lift(g)},${lift(b)})`;
        sx[i] = (random() - 0.5) * w * 0.8; sy[i] = (random() - 0.5) * h * 0.8;       // where each slat flies in from
      }
      const cx = side ? w * 0.73 : w * 0.5, cy = side ? h * 0.55 : 64 + (h * 0.42 - 64) / 2 + h * 0.06;
      crest = { left: cx - (crestCols * step) / 2, top: cy - (crestRows * step) / 2, step, cols: crestCols, rows: crestRows, value, color, sx, sy };
      if (!born) born = performance.now();
    };

    const draw = (now: number) => {
      const t = still ? 6 : (now - start) / 1000;
      const dt = last ? Math.min(3, Math.max(0.25, (now - last) / (1000 / 60))) : 1;   // in 60 Hz frames, so a 144 Hz screen moves at the same speed
      last = now;
      pointer.x += (pointer.tx - pointer.x) * Math.min(1, 0.45 * dt); pointer.y += (pointer.ty - pointer.y) * Math.min(1, 0.45 * dt);
      pointer.presence += ((pointer.here ? 1 : 0) - pointer.presence) * Math.min(1, 0.12 * dt);
      const presence = still ? 0 : pointer.presence;
      if (!still) advance(fluid, dt);
      ripples = ripples.filter(ripple => ((now - ripple.at) / 1000) * RING_SPEED < ripple.reach + RING_WIDTH * 3);

      ctx.clearRect(0, 0, w, h);
      const reach = Math.max(70, Math.min(w, h) * 0.1), reach2 = reach * reach;   // about 90 px at 1440 x 900
      const energy = (x: number, y: number) => {
        const dx = x - pointer.x, dy = y - pointer.y;
        return Math.min(1.4, presence * Math.exp(-(dx * dx + dy * dy) / reach2));
      };
      // The click rings at a point: a bright crest with a soft glow left behind it, both fading with the distance from the click.
      const bands = ripples.map(ripple => {   // each ring's band this frame, squared, so most dots are passed over without a square root
        const radius = ((now - ripple.at) / 1000) * RING_SPEED, inner = Math.max(0, radius - 180), outer = radius + RING_WIDTH * 3;
        return { ...ripple, radius, inner2: inner * inner, outer2: outer * outer };
      });
      const ringAt = (x: number, y: number) => {
        let e = 0;
        for (const ripple of bands) {
          const dx = x - ripple.x, dy = y - ripple.y, d2 = dx * dx + dy * dy;
          if (d2 > ripple.outer2 || d2 < ripple.inner2) continue;
          const d = Math.sqrt(d2), gap = d - ripple.radius;
          const fade = Math.max(0, 1 - d / ripple.reach) ** 1.1;
          e += fade * (1.6 * Math.exp(-((gap / RING_WIDTH) ** 2)) + (gap < 0 ? 0.16 * Math.exp(-((gap / 70) ** 2)) : 0));
        }
        return Math.min(1.6, e);
      };
      const crestHas = (x: number, y: number) => {   // the field leaves the emblem's own outline to the emblem
        if (!crest) return false;
        const cc = Math.floor((x - crest.left) / crest.step), rr = Math.floor((y - crest.top) / crest.step);
        return cc >= 0 && rr >= 0 && cc < crest.cols && rr < crest.rows && crest.value[rr * crest.cols + cc] > 0.08;
      };
      const arrive = still ? 1 : Math.min(1, t / 1.5);

      const glowAt = (x: number, y: number) => {
        const c = Math.min(cols - 1, Math.max(0, Math.floor(x / cell))), r = Math.min(rows - 1, Math.max(0, Math.floor(y / cell)));
        return Math.min(1, fluid.dye[r * cols + c]);
      };
      // Three currents flow across the field (sky high, blue in the middle, indigo low): each a band whose middle and width ripple along x and
      // over time, brighter where a pulse runs along it.
      const STREAMS = [
        { y: 0.24, amp: 0.085, color: '#38bdf8', phase: 0 },
        { y: 0.52, amp: 0.1, color: '#60a5fa', phase: 2.1 },
        { y: 0.8, amp: 0.075, color: '#818cf8', phase: 4.2 },
      ];
      const slat = Math.max(2, cell * 0.34);
      let n = 0;
      for (let c = 0; c < cols; c += 1) {
        const x = c * cell + cell / 2;
        const bands = STREAMS.map((band, k) => ({
          middle: h * (band.y + band.amp * Math.sin(x * 0.0042 + t * 0.32 + band.phase) + 0.03 * Math.sin(x * 0.011 - t * 0.47 + k)),
          width: h * (0.075 + 0.025 * Math.sin(x * 0.003 + t * 0.28 + k * 1.3)),
          pulse: 0.55 + 0.45 * Math.sin(x * 0.006 - t * 0.9 + band.phase * 1.7),
        }));
        for (let r = 0; r < rows; r += 1, n += 1) {
          const y = r * cell + cell / 2;
          const sweep = Math.min(1, Math.max(0, arrive * 2.4 - (x / w) * 0.9 - (y / h) * 0.5));   // the field lights up from the top left
          if (sweep <= 0 || crestHas(x, y)) { size[n] = 0; continue; }
          const puff = smoke(x / 260, y / 260, t);
          let flow = 0;
          for (let k = 0; k < 3; k += 1) { const d = (y - bands[k].middle) / bands[k].width, v = Math.exp(-d * d) * bands[k].pulse; streams[k][n] = v * sweep; flow += v; }
          const wave = ripples.length ? ringAt(x, y) : 0;
          ring[n] = wave * sweep;
          const light = 0.05 + 0.09 * puff + 0.78 * Math.min(1, flow) + 0.8 * glowAt(x, y) + 0.6 * energy(x, y) + 0.7 * wave;
          size[n] = cell * (0.24 + 0.5 * Math.min(1, light));
          base[n] = Math.min(1, 0.07 + 0.6 * light) * sweep;
        }
      }
      // The slats, dim blue, then each current's colour over the slats it runs through.
      const pass = (color: string, alphaOf: (i: number) => number) => {
        ctx.fillStyle = color;
        let i = 0;
        for (let c = 0; c < cols; c += 1) {
          const x = c * cell + cell / 2 - slat / 2;
          for (let r = 0; r < rows; r += 1, i += 1) {
            if (!size[i]) continue;
            const a = alphaOf(i);
            if (a < 0.02) continue;
            ctx.globalAlpha = Math.min(1, a);
            ctx.fillRect(x, r * cell + cell / 2 - size[i] / 2, slat, size[i]);
          }
        }
      };
      pass('#3b82f6', i => base[i]);
      STREAMS.forEach((band, k) => pass(band.color, i => streams[k][i] * 1.15));
      if (ripples.length) pass('#e0f2fe', i => ring[i] * 0.95);   // the click ring, near white where it is strongest
      // The halo: a soft glow on the pointer, and the trail's glow as smoke behind it.
      ctx.globalCompositeOperation = 'lighter';
      if (smokeImage && smokeCtx) {
        const px = smokeImage.data;
        let any = false;
        for (let i = 0; i < fluid.dye.length; i += 1) { const v = Math.min(1, fluid.dye[i]); px[i * 4 + 3] = v * 120; if (v > 0.01) any = true; }
        if (any) {
          smokeCtx.putImageData(smokeImage, 0, 0);
          ctx.globalAlpha = 1; ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(smokeCanvas, -cell / 2, -cell / 2, cols * cell + cell, rows * cell + cell);
        }
      }
      if (presence > 0.01) {
        const halo = ctx.createRadialGradient(pointer.x, pointer.y, 0, pointer.x, pointer.y, reach * 1.2);
        halo.addColorStop(0, `rgba(191,219,254,${0.32 * presence})`);
        halo.addColorStop(0.35, `rgba(165,180,252,${0.16 * presence})`);
        halo.addColorStop(1, 'rgba(165,180,252,0)');
        ctx.globalAlpha = 1; ctx.fillStyle = halo;
        ctx.fillRect(pointer.x - reach * 1.2, pointer.y - reach * 1.2, reach * 2.4, reach * 2.4);
      }
      ctx.globalCompositeOperation = 'source-over';
      // The emblem.
      if (crest) {
        const gather = still ? 1 : Math.min(1, Math.max(0, (now - born) / 1000 - 0.15) / 1.5);
        const fly = 1 - (1 - gather) ** 3;
        const { step } = crest, thin = Math.max(1.6, step * 0.5);
        const scan = ((t % 4.6) / 4.6) * (crest.rows * 1.3) - crest.rows * 0.15;
        let shade = '';
        for (let rr = 0; rr < crest.rows; rr += 1) {
          const beam = still ? 0 : Math.exp(-(((rr - scan) / (crest.rows * 0.035)) ** 2));
          for (let cc = 0; cc < crest.cols; cc += 1) {
            const i = rr * crest.cols + cc, v = crest.value[i];
            if (v <= 0.08) continue;
            const hx = crest.left + cc * step + step / 2, hy = crest.top + rr * step + step / 2;
            const dx = hx - pointer.x, dy = hy - pointer.y, d = Math.hypot(dx, dy) || 1;
            const near = presence * Math.exp(-(d * d) / reach2), push = near * cell * 1.4;
            const x = hx + (dx / d) * push + crest.sx[i] * (1 - fly), y = hy + (dy / d) * push + crest.sy[i] * (1 - fly);
            const breathe = 0.9 + 0.1 * Math.sin(t * 1.4 + cc * 0.13 + rr * 0.08);
            ctx.globalAlpha = Math.min(1, (v * breathe + beam * 0.5 + near * 0.3 + glowAt(hx, hy) * 0.3 + (ripples.length ? ringAt(hx, hy) * 0.5 : 0)) * (0.15 + 0.85 * fly));
            const wanted = beam > 0.35 ? '#dbeafe' : crest.color[i];
            if (wanted !== shade) { ctx.fillStyle = wanted; shade = wanted; }
            const tall = step * (0.45 + 0.5 * v + 0.3 * beam + 0.35 * near);
            ctx.fillRect(x - thin / 2, y - tall / 2, thin, tall);
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => { draw(now); frame = requestAnimationFrame(loop); };
    const sync = () => {
      const on = alive && !still && visible && document.visibilityState === 'visible';
      if (on === running) return;
      running = on;
      if (on) frame = requestAnimationFrame(loop); else cancelAnimationFrame(frame);
    };
    const layout = () => {
      const box = canvas.getBoundingClientRect();
      w = box.width; h = box.height;
      if (w < 1 || h < 1) { smokeImage = null; crest = null; cols = rows = 0; return; }   // not laid out (hidden, or the page is leaving): nothing to draw
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = Math.max(11, Math.sqrt((w * h) / 11000));   // about 11 000 slats at most, whatever the screen
      cols = Math.ceil(w / cell); rows = Math.ceil(h / cell);
      size = new Float32Array(cols * rows); base = new Float32Array(cols * rows); ring = new Float32Array(cols * rows); streams = streams.map(() => new Float32Array(cols * rows));
      // The smoke picture is stored row by row like the liquid; its colour is a pale periwinkle, its strength set per frame.
      smokeCanvas.width = cols; smokeCanvas.height = rows;
      smokeImage = smokeCtx ? smokeCtx.createImageData(cols, rows) : null;
      if (smokeImage) for (let i = 0; i < cols * rows; i += 1) { smokeImage.data[i * 4] = 170; smokeImage.data[i * 4 + 1] = 196; smokeImage.data[i * 4 + 2] = 255; }
      fluid = createFluid(cols, rows);
      sample();
      if (!running) draw(performance.now());
    };
    logo.onload = () => { if (alive) { sample(); if (!running) draw(performance.now()); } };
    logo.src = sasLogo;

    const onMove = (event: PointerEvent) => {
      const box = canvas.getBoundingClientRect(), x = event.clientX - box.left, y = event.clientY - box.top;
      if (!pointer.here) { pointer.x = x; pointer.y = y; }   // the light appears where the pointer is, never slides in from elsewhere
      pointer.tx = x; pointer.ty = y; pointer.here = true;
      if (!still && Number.isFinite(pointer.lastX)) stir(fluid, pointer.lastX / cell, pointer.lastY / cell, x / cell, y / cell, 3.4);   // a soft trail
      pointer.lastX = x; pointer.lastY = y;
    };
    const onLeave = () => { pointer.here = false; pointer.lastX = Number.NaN; pointer.lastY = Number.NaN; };
    const onOut = (event: PointerEvent) => { if (!event.relatedTarget) onLeave(); };   // left the window
    const onUp = (event: PointerEvent) => { if (event.pointerType !== 'mouse') onLeave(); };   // a finger lifted: nothing is hovering any more
    const onDown = (event: PointerEvent) => {
      onMove(event);
      const box = canvas.getBoundingClientRect();
      if (still || event.clientY < box.top || event.clientY > box.bottom) return;
      const x = event.clientX - box.left, y = event.clientY - box.top;
      ripples.push({ x, y, at: performance.now(), reach: Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) });
      // shortcut: past 32 rings at once the oldest goes (it is near the edges and dim by then); a bound so frantic clicking cannot slow the page
      if (ripples.length > 32) ripples.shift();
    };
    const resize = new ResizeObserver(layout);
    resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); });
    seen.observe(canvas);
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp, { passive: true });
    window.addEventListener('pointercancel', onLeave, { passive: true });
    window.addEventListener('pointerout', onOut, { passive: true });
    window.addEventListener('blur', onLeave);
    document.addEventListener('visibilitychange', sync);
    layout();
    sync();
    return () => {
      alive = false; sync();
      resize.disconnect(); seen.disconnect();
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onLeave);
      window.removeEventListener('pointerout', onOut);
      window.removeEventListener('blur', onLeave);
      document.removeEventListener('visibilitychange', sync);
      logo.onload = null;
    };
  }, [canvasRef, still]);
}

const FEATURES = [
  { icon: ScanFace, label: 'Face check-in' },
  { icon: Wifi, label: 'Campus Wi-Fi' },
  { icon: CalendarDays, label: 'Timetables' },
  { icon: BarChart3, label: 'Attendance insights' },
];

/**
 * The first screen: what USAS is, the way in, and the living emblem to play with. Scrolling on, it settles back into a rounded card while the 3D
 * story slides up over it.
 */
export function Intro({ still }: { still: boolean }) {
  const section = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const { w, h } = useViewport();
  const side = sideBySide(w, h);
  useEmblemField(canvas, still);
  // Where the emblem is drawn (as in useEmblemField's sample()) and how far it reaches, so the rays can leave it alone.
  const ratio = (LOGO.box.x1 - LOGO.box.x0) / (LOGO.box.y1 - LOGO.box.y0);
  const crestTall = side ? Math.min(h * 0.6, (w * 0.36) / ratio) : Math.min(h * 0.34, (w * 0.78) / ratio);
  const crestX = side ? w * 0.73 : w * 0.5, crestY = side ? h * 0.55 : 64 + (h * 0.42 - 64) / 2 + h * 0.06;
  const crestR = (Math.max(crestTall, crestTall * ratio) / 2) * 1.06;
  const raysMask = `radial-gradient(circle at ${crestX}px ${crestY}px, transparent ${Math.round(crestR)}px, #000 ${Math.round(crestR * 1.32)}px)`;
  const { scrollYProgress: q } = useScroll({ target: section, offset: ['start start', 'end start'] });
  const y = useTransform(q, value => `${value * 45}%`);
  const scale = useRange(q, [0, 1], [1, 0.88]);
  const radius = useRange(q, [0, 0.3], [0, 36]);
  const shade = useRange(q, [0, 1], [0, 0.65]);
  const enter = (index: number) => (still ? {} : {
    initial: { opacity: 0, y: 28, filter: 'blur(12px)' }, animate: { opacity: 1, y: 0, filter: 'blur(0px)' },
    transition: { delay: 0.2 + index * 0.12, duration: 0.85, ease: [0.16, 1, 0.3, 1] as const },
  });
  const tour = () => document.getElementById('tour')?.scrollIntoView({ behavior: still ? 'auto' : 'smooth' });
  return (
    <section ref={section} aria-labelledby="intro-title" data-intro className="relative h-screen">
      <motion.div className="absolute inset-0 overflow-hidden ring-1 ring-white/10" style={{ y, scale, borderRadius: radius, transformOrigin: '50% 0%', background: 'radial-gradient(120% 90% at 75% 45%, #0d2463 0%, #071338 48%, #040a1c 100%)' }}>
        {/* Side Rays from the top right corner, behind the dots; a soft round hole keeps every ray off the emblem */}
        <div aria-hidden="true" data-side-rays className="pointer-events-none absolute inset-0" style={{ WebkitMaskImage: raysMask, maskImage: raysMask }}>
          <SideRays rayColor1="#ffffff" rayColor2="#007aff" origin="top-right" speed={still ? 0 : 6} intensity={2.05} spread={4} density={20} followMouse={!still}
            blend={1} sharpness={0} tilt={20} falloff={2.05} glow={1.95} dust={0.64} />
        </div>
        <canvas ref={canvas} aria-hidden="true" data-intro-field className="absolute inset-0 h-full w-full" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{ background: side ? 'linear-gradient(90deg, rgba(4,10,28,0.55) 0%, rgba(4,10,28,0.22) 40%, transparent 58%)' : 'linear-gradient(0deg, rgba(4,10,28,0.92) 0%, rgba(4,10,28,0.6) 42%, transparent 62%)' }} />
        <div className={`relative mx-auto flex h-full max-w-6xl flex-col px-5 sm:px-6 ${side ? 'justify-center pt-16' : 'justify-end pb-10 pt-16'}`}>
          <div className={side ? 'max-w-[min(36rem,52vw)]' : 'max-w-xl'}>
            <motion.p {...enter(0)} className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1.5 text-[11px] font-semibold text-blue-100 backdrop-blur">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:animate-none" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
              USAS · University Smart Attendance System
            </motion.p>
            <VaporHeadline still={still} className="mt-5 font-display font-extrabold leading-[0.95] tracking-tight text-white text-[clamp(2.4rem,min(6.2vw,11vh),5.6rem)]" />
            <motion.p {...enter(3)} className="mt-5 max-w-md text-base font-medium leading-relaxed text-blue-100/85 sm:text-lg [@media(max-height:480px)]:hidden">
              Check in with your face on campus Wi-Fi, follow your timetable and see your attendance, on your phone and on the web.
            </motion.p>
            <motion.div {...enter(4)} className="mt-7 flex flex-wrap gap-3">
              <button type="button" onClick={() => goTo('/portal')} className="ps-star group inline-flex h-12 items-center gap-2 rounded-xl bg-brand-blue px-6 text-sm font-bold text-white shadow-[0_8px_30px_rgba(37,99,235,0.45)] transition hover:bg-blue-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                Open Portal<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              <button type="button" onClick={tour} className="ps-star inline-flex h-12 items-center gap-2 rounded-xl border border-white/25 bg-white/[0.07] px-6 text-sm font-bold text-white backdrop-blur transition hover:bg-white/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                Take the tour<ChevronDown className="h-4 w-4" />
              </button>
            </motion.div>
            <motion.ul {...enter(5)} aria-label="Inside USAS" className="mt-10 hidden flex-wrap gap-x-6 gap-y-3 text-[13px] font-semibold text-blue-100/75 sm:flex [@media(max-height:560px)]:hidden">
              {FEATURES.map(({ icon: Icon, label }) => <li key={label} className="inline-flex items-center gap-2"><Icon aria-hidden="true" className="h-4 w-4 text-blue-300" />{label}</li>)}
            </motion.ul>
          </div>
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-6 right-5 hidden flex-col items-center gap-2 text-[10px] font-bold uppercase tracking-[0.25em] text-blue-200/80 sm:right-10 sm:flex [@media(max-height:560px)]:!hidden">
          <span className="flex h-8 w-5 justify-center rounded-full border border-blue-200/50 pt-1.5"><span className="ps-wheel h-1.5 w-1 rounded-full bg-blue-200" /></span>
          Scroll to explore
        </div>
        <motion.div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[#020617]" style={{ opacity: shade }} />
      </motion.div>
    </section>
  );
}
