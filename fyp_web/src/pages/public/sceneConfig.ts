/** Sizes (CSS px) of the public story's objects, shared by the scenes and the page that places them. */
/** The project emblem file (src/assets/emblem.webp) is 820 x 754, cropped to the emblem itself; `box` is the emblem's own outline. */
export const LOGO = { w: 820, h: 754, box: { x0: 0, y0: 0, x1: 820, y1: 754 } };
export const BOOK = { w: 250, h: 340, t: 34 };
/** Book progress (0-1 for the open story; it runs on past 1 while the book is put away) over which the book shuts from the back after its last spread. */
export const BOOK_CLOSE: [number, number] = [0.975, 1.055];
/** Book progress over which the shut book (back cover up) turns round to its front cover, before it is lifted away. */
export const BOOK_FLIP: [number, number] = [1.055, 1.0941];
/**
 * Phone: the screen is exactly the captured app screen's shape (1080 x 2270 after the system bars are cropped), so the picture is never stretched or
 * cropped. The bezel is the same thin 8 px on every side, like a current Android phone, and the screen's corners follow the body's (radius - bezel).
 */
export const PHONE = { w: 230, h: 466, radius: 40, screen: { x: 8, y: 8, w: 214, h: 450, radius: 32 } };
/** Monitor head: the screen is exactly the captured web screen's shape (16:10); the stand sits below. */
export const MONITOR = { w: 764, h: 504, screen: { x: 14, y: 14, w: 736, h: 460 }, stand: 150 };

/** One screen of a device demo: a real UI capture with sample data, shown fully between `from` and `to` (story progress 0-1). */
export type DemoScreen = { src: string; alt: string; from: number; to: number };
