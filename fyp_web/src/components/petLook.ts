// Cursor-gaze frames. Both OpenPets packs carry sixteen look cells (sheet rows 9 and 10, columns 0-7), numbered clockwise from straight
// up in 22.5 degree sectors. The numbering is only a promise: not every cell shows the pose its number says. This file is the result of
// looking at labelled contact sheets of the two actual sheets, cell by cell (see assets/pets/ATTRIBUTION.txt for their source).

export type LookPet = 'luna-techbot' | 'hoodie-cat';
export type LookFrame = { col: number; row: number; flip: boolean };

/** Which way each cell's own artwork faces, as seen on the sheet: -1 our left, 0 straight on (or up or down), 1 our right. */
export const CELL_FACING: Record<LookPet, readonly number[]> = {
  'luna-techbot': [0, 1, 1, 1, 1, 1, 1, 1, 0, -1, -1, -1, -1, 0, 1, 1],
  'hoodie-cat': [0, 1, 1, 1, 1, 1, 1, 1, 0, -1, -1, -1, -1, -1, 1, 1],
};

/**
 * The up-left cells (13-15) of these packs were drawn facing right or forward, so a cursor to the upper left made the pet look to the
 * upper right. Those sectors use the matching up-right cell (3, 2, 1) mirrored, in the sprite layer only. Hoodie Cat's cell 13 really
 * does face up-left, so it is kept. Mirroring about the cell centre costs about two pixels of sideways drift (ink centres measured
 * at 91-102 of 192), which is below what is visible at this size.
 */
const MIRRORED: Record<LookPet, Record<number, number>> = {
  'luna-techbot': { 13: 3, 14: 2, 15: 1 },
  'hoodie-cat': { 14: 2, 15: 1 },
};

/** Direction from the pet to the cursor as one of sixteen sectors: 0 is straight up, counting clockwise. */
export const lookSector = (dx: number, dy: number): number => Math.round(((Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360) / 22.5) % 16;

/** The sheet cell to draw for a sector, and whether to mirror it. */
export const lookFrame = (pet: LookPet, sector: number): LookFrame => {
  const mirrored = MIRRORED[pet][sector];
  const cell = mirrored ?? sector;
  return { col: cell % 8, row: 9 + Math.floor(cell / 8), flip: mirrored !== undefined };
};

/** The side the drawn pet actually faces for a sector (-1 left, 0 straight on, 1 right). */
export const facingFor = (pet: LookPet, sector: number): number => {
  const frame = lookFrame(pet, sector);
  const own = CELL_FACING[pet][(frame.row - 9) * 8 + frame.col];
  return frame.flip ? -own : own;
};

/** The side the cursor is on for a sector: sectors 1-7 are to the right, 9-15 to the left, 0 and 8 straight up and down. */
export const cursorSide = (sector: number): number => (sector === 0 || sector === 8 ? 0 : sector < 8 ? 1 : -1);
