import sasLogo from '../../assets/saslogo.webp';

/** The project logo file is 768 x 570 with transparent margins; `box` is the emblem's own outline. */
const LOGO = { w: 768, h: 570, box: { x0: 74, y0: 17, x1: 697, y1: 540 } };

/** The logo at its own proportions: `height` is the emblem's height, the empty margin is cropped away and both axes scale together (never squeezed). */
export function Mark({ height, className = '' }: { height: number; className?: string }) {
  const scale = height / (LOGO.box.y1 - LOGO.box.y0);
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden ${className}`} style={{ width: (LOGO.box.x1 - LOGO.box.x0) * scale, height }}>
      <img src={sasLogo} alt="" draggable={false} className="absolute max-w-none" style={{ width: LOGO.w * scale, height: LOGO.h * scale, left: -LOGO.box.x0 * scale, top: -LOGO.box.y0 * scale }} />
    </span>
  );
}
