/** Sizes (CSS px) of the public story's objects, shared by the scenes and the page that places them. */
export const BOOK = { w: 250, h: 340, t: 34 };
/** Phone: the screen is exactly the captured app screen's shape (1080 x 2270 after the system bars are cropped), so the picture is never stretched or cropped. */
export const PHONE = { w: 230, h: 496, screen: { x: 8, y: 28, w: 214, h: 450 } };
/** Monitor head: the screen is exactly the captured web screen's shape (16:10); the stand sits below. */
export const MONITOR = { w: 764, h: 504, screen: { x: 14, y: 14, w: 736, h: 460 }, stand: 150 };

/** One screen of a device demo: a real UI capture with sample data, shown fully between `from` and `to` (story progress 0-1). */
export type DemoScreen = { src: string; alt: string; from: number; to: number };
