import type { CSSProperties, ReactNode } from 'react';

type Faces = Partial<Record<'front' | 'back' | 'left' | 'right' | 'top' | 'bottom', ReactNode>>;

/**
 * A solid box made of six CSS faces (no WebGL). `shade` paints each side face a little darker than the front so the box reads as lit from the
 * upper left. Children of a face are laid out on that face.
 */
export function Box3D({ w, h, d, color, faces = {}, className = '', style, faceClass = '' }: {
  w: number; h: number; d: number; color: string; faces?: Faces; className?: string; style?: CSSProperties; faceClass?: string;
}) {
  const face = (extra: CSSProperties, shade: number, key: keyof Faces) => (
    <div key={key} className={`absolute ${faceClass}`} style={{ backfaceVisibility: 'hidden', background: color, boxShadow: `inset 0 0 0 999px rgba(15,23,42,${shade})`, ...extra }}>{faces[key]}</div>
  );
  return (
    <div className={`relative ${className}`} style={{ width: w, height: h, transformStyle: 'preserve-3d', ...style }}>
      {face({ inset: 0, transform: `translateZ(${d / 2}px)`, boxShadow: 'none' }, 0, 'front')}
      {face({ inset: 0, transform: `rotateY(180deg) translateZ(${d / 2}px)` }, 0.25, 'back')}
      {face({ top: 0, left: (w - d) / 2, width: d, height: h, transform: `rotateY(90deg) translateZ(${w / 2}px)` }, 0.32, 'right')}
      {face({ top: 0, left: (w - d) / 2, width: d, height: h, transform: `rotateY(-90deg) translateZ(${w / 2}px)` }, 0.12, 'left')}
      {face({ left: 0, top: (h - d) / 2, width: w, height: d, transform: `rotateX(90deg) translateZ(${h / 2}px)` }, 0.04, 'top')}
      {face({ left: 0, top: (h - d) / 2, width: w, height: d, transform: `rotateX(-90deg) translateZ(${h / 2}px)` }, 0.4, 'bottom')}
    </div>
  );
}
