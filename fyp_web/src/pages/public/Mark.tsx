import sasLogo from '../../assets/emblem.webp';
import { LOGO } from './sceneConfig';

/** The logo at its own proportions: `height` is the emblem's height, the empty margin is cropped away and both axes scale together (never squeezed). */
export function Mark({ height, className = '' }: { height: number; className?: string }) {
  const scale = height / (LOGO.box.y1 - LOGO.box.y0);
  return (
    <span className={`relative inline-block shrink-0 overflow-hidden ${className}`} style={{ width: (LOGO.box.x1 - LOGO.box.x0) * scale, height }}>
      <img src={sasLogo} alt="" draggable={false} className="absolute max-w-none" style={{ width: LOGO.w * scale, height: LOGO.h * scale, left: -LOGO.box.x0 * scale, top: -LOGO.box.y0 * scale }} />
    </span>
  );
}
