import { useLayoutEffect, useRef } from 'react';

/** The words the second line turns through, each vaporising into the next. */
const PHRASES = ['made smart.', 'made simple.', 'made secure.'];
const HOLD = 6000;   // ms each phrase stays
const STEP = 1.75;   // CSS px between particles
const LEVELS = 8;    // opacity steps the particles are drawn in
const TINT = '#a5b4fc';
/** Must match .ps-gradient-text in public.css. */
const GRADIENT = ['#60a5fa', '#a5b4fc', '#7dd3fc', '#93c5fd', '#60a5fa'];

type Burst = {
  mode: 'in' | 'out'; count: number; end: number; fill: string | CanvasGradient; done: () => void;
  hx: Float32Array; hy: Float32Array; cov: Float32Array; seed: Float32Array; t0: Float32Array; life: Float32Array; vx: Float32Array; vy: Float32Array;
  px: Float32Array; py: Float32Array; al: Float32Array; tn: Float32Array; level: Uint8Array;
};

/**
 * The intro headline as vapor type: both lines condense out of drifting particles as the page opens, then every few seconds the second line
 * dissolves from left to right into vapor that drifts up and turns periwinkle, while the next phrase condenses in its place. Between changes the
 * words are ordinary text (sharp, selectable). The heading's accessible name stays the same. With reduced motion it is plain, still text.
 */
export function VaporHeadline({ still, className }: { still: boolean; className: string }) {
  const box = useRef<HTMLHeadingElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineA = useRef<HTMLSpanElement>(null), lineB = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const a = lineA.current, b = lineB.current, h2 = box.current, canvas = canvasRef.current, ctx = canvas?.getContext('2d');
    if (still || !a || !b || !h2 || !canvas || !ctx) return;
    let alive = true, frame = 0, timer = 0, index = 0, dpr = 1, onScreen = true;
    const bursts: Burst[] = [];
    const show = (span: HTMLSpanElement) => { span.style.opacity = '1'; };
    a.style.opacity = '0'; b.style.opacity = '0';
    const fallback = window.setTimeout(() => { show(a); show(b); }, 4000);   // whatever happens, the words are never left hidden

    const fit = () => {
      const r = canvas.getBoundingClientRect();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(1, Math.round(r.width * dpr)); canvas.height = Math.max(1, Math.round(r.height * dpr));
    };
    fit();
    const resize = new ResizeObserver(fit); resize.observe(canvas);
    const seen = new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }); seen.observe(h2);

    /** The span's words as particles: one per 1.75 px of ink, in the canvas's own coordinates, timed to sweep from left to right. */
    const make = (span: HTMLSpanElement, gradient: boolean, mode: 'in' | 'out', start: number): Omit<Burst, 'done'> | null => {
      const host = canvas.getBoundingClientRect(), r = span.getBoundingClientRect(), style = getComputedStyle(span);
      if (r.width < 1 || r.height < 1) return null;
      const size = parseFloat(style.fontSize), lineHeight = parseFloat(style.lineHeight) || size * 0.95;
      const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize} ${style.fontFamily}`, spacing = style.letterSpacing === 'normal' ? '0px' : style.letterSpacing;
      const off = document.createElement('canvas'), o = off.getContext('2d', { willReadFrequently: true });
      if (!o) return null;
      const setup = () => { o.font = font; o.letterSpacing = spacing; o.textBaseline = 'alphabetic'; };
      setup();
      const text = span.textContent ?? '', m = o.measureText(text);
      const ascent = m.fontBoundingBoxAscent || size * 0.8, descent = m.fontBoundingBoxDescent || size * 0.2;
      const baseline = (lineHeight - ascent - descent) / 2 + ascent;   // where CSS puts the baseline in a line box
      const w = Math.ceil(Math.max(r.width, m.width) + 8), h = Math.ceil(Math.max(lineHeight, baseline + descent) + 8);
      off.width = Math.ceil(w * dpr); off.height = Math.ceil(h * dpr);
      o.scale(dpr, dpr); setup();
      // The flowing gradient (.ps-gradient-text) where it is right now: 3 times the line's width, slid by the animated background position.
      const slide = (parseFloat(style.backgroundPositionX) || 0) / 100;
      const paint = (target: CanvasRenderingContext2D, left: number) => {
        if (!gradient) return '#ffffff';
        const start = left - 2 * r.width * slide, g = target.createLinearGradient(start, 0, start + 3 * r.width, 0);
        GRADIENT.forEach((color, i) => g.addColorStop(i / (GRADIENT.length - 1), color));
        return g;
      };
      o.fillStyle = paint(o, 0);
      o.fillText(text, 0, baseline);
      const data = o.getImageData(0, 0, off.width, off.height).data;
      const left = r.left - host.left, top = r.top - host.top;
      const hx: number[] = [], hy: number[] = [], cov: number[] = [];
      for (let y = 0; y < h; y += STEP) for (let x = 0; x < w; x += STEP) {
        const ix = Math.min(off.width - 1, Math.round(x * dpr)), iy = Math.min(off.height - 1, Math.round(y * dpr));
        const alpha = data[(iy * off.width + ix) * 4 + 3] / 255;
        if (alpha < 0.08) continue;
        hx.push(left + x); hy.push(top + y); cov.push(alpha);
      }
      const count = hx.length, f = () => new Float32Array(count);
      const burst = { mode, count, end: start, fill: paint(ctx, left), hx: Float32Array.from(hx), hy: Float32Array.from(hy), cov: Float32Array.from(cov),
        seed: f(), t0: f(), life: f(), vx: f(), vy: f(), px: f(), py: f(), al: f(), tn: f(), level: new Uint8Array(count) };
      for (let i = 0; i < count; i += 1) {
        const across = (hx[i] - left) / Math.max(1, m.width), random = Math.random();
        burst.seed[i] = Math.random();
        burst.vx[i] = -(50 + 110 * Math.random()); burst.vy[i] = -(20 + 70 * Math.random());
        if (mode === 'out') { burst.t0[i] = start + across * 700 + random * 260; burst.life[i] = 900 + Math.random() * 700; burst.end = Math.max(burst.end, burst.t0[i] + burst.life[i]); }
        else { burst.t0[i] = start + 250 + across * 600 + random * 260; burst.life[i] = 700 + Math.random() * 500; burst.end = Math.max(burst.end, burst.t0[i]); }
      }
      return burst;
    };

    const drawBurst = (burst: Burst, now: number) => {
      const { count, hx, hy, cov, seed, t0, life, vx, vy, px, py, al, tn } = burst;
      for (let i = 0; i < count; i += 1) {
        const age = burst.mode === 'out' ? (now - t0[i]) / life[i] : (t0[i] - now) / life[i];
        if (age >= 1) { al[i] = 0; continue; }
        if (age <= 0) { px[i] = hx[i]; py[i] = hy[i]; al[i] = cov[i]; tn[i] = 0; continue; }
        const s = (age * life[i]) / 1000;   // seconds in the air (condensing runs the same path backwards)
        px[i] = hx[i] + vx[i] * s + Math.sin(seed[i] * 40 + age * 5) * 10 * age;
        py[i] = hy[i] + vy[i] * s - 30 * s * s + Math.cos(seed[i] * 30 + age * 4) * 8 * age;
        al[i] = cov[i] * (1 - age) ** 1.5; tn[i] = Math.min(1, age * 1.6);
      }
      // Each colour is filled in 8 steps of opacity, one path per step: a few fills a frame instead of one per particle.
      const { level } = burst;
      for (const [fill, part] of [[burst.fill, 0], [TINT, 1]] as const) {
        for (let i = 0; i < count; i += 1) level[i] = Math.min(LEVELS, Math.round((part ? al[i] * tn[i] * 0.9 : al[i] * (1 - tn[i])) * LEVELS));
        ctx.fillStyle = fill;
        for (let q = 1; q <= LEVELS; q += 1) {
          ctx.beginPath();
          let any = false;
          for (let i = 0; i < count; i += 1) {
            if (level[i] !== q) continue;
            const dot = 1.8 + 1.6 * tn[i];
            ctx.rect(px[i] - dot / 2, py[i] - dot / 2, dot, dot); any = true;
          }
          if (any) { ctx.globalAlpha = q / LEVELS; ctx.fill(); }
        }
      }
      ctx.globalAlpha = 1;
    };

    const loop = (now: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // A finished burst is dropped before this frame is drawn; its words (shown by the awaiting code before the paint) take over seamlessly.
      for (let k = bursts.length - 1; k >= 0; k -= 1) if (now >= bursts[k].end) bursts.splice(k, 1)[0].done();
      for (const burst of bursts) drawBurst(burst, now);
      frame = bursts.length ? requestAnimationFrame(loop) : 0;
    };
    const play = (span: HTMLSpanElement, gradient: boolean, mode: 'in' | 'out', delay = 0) => new Promise<void>(resolve => {
      let burst: Omit<Burst, 'done'> | null;
      try { burst = make(span, gradient, mode, performance.now() + delay); } catch { burst = null; }
      if (!burst) { resolve(); return; }
      bursts.push({ ...burst, done: resolve });
      if (!frame) frame = requestAnimationFrame(loop);
    });
    const condense = async (span: HTMLSpanElement, gradient: boolean, delay = 0) => { await play(span, gradient, 'in', delay); if (alive) show(span); };
    const vaporise = (span: HTMLSpanElement) => { const done = play(span, true, 'out'); span.style.opacity = '0'; return done; };
    const wait = (ms: number) => new Promise(resolve => { timer = window.setTimeout(resolve, ms); });

    const cycle = () => {
      timer = window.setTimeout(async () => {
        if (!alive) return;
        if (document.visibilityState !== 'visible' || !onScreen) { cycle(); return; }   // nobody is looking: no change and no drawing
        const gone = vaporise(b);
        await wait(950);
        if (!alive) return;
        index = (index + 1) % PHRASES.length;
        b.textContent = PHRASES[index];
        await condense(b, true);
        await gone;
        if (alive) cycle();
      }, HOLD);
    };
    document.fonts.ready.then(async () => {
      if (!alive) return;
      await Promise.all([condense(a, false, 200), condense(b, true, 420)]);
      window.clearTimeout(fallback);
      if (alive) cycle();
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame); window.clearTimeout(timer); window.clearTimeout(fallback);
      resize.disconnect(); seen.disconnect();
      b.textContent = PHRASES[0]; show(a); show(b);
    };
  }, [still]);

  return (
    <h2 ref={box} id="intro-title" aria-label={`Attendance, ${PHRASES[0]}`} className={`relative ${className}`}>
      <span ref={lineA} aria-hidden="true" className="block">Attendance,</span>
      <span ref={lineB} aria-hidden="true" data-vapor-line className="ps-gradient-text block w-fit bg-clip-text pb-1 text-transparent">{PHRASES[0]}</span>
      {!still && <canvas ref={canvasRef} aria-hidden="true" data-vapor className="pointer-events-none absolute" style={{ left: -112, top: -96, width: 'calc(100% + 224px)', height: 'calc(100% + 192px)' }} />}
    </h2>
  );
}
