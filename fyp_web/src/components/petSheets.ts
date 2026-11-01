import lunaSheet from '../assets/pets/luna-techbot/spritesheet.webp';
import hoodieSheet from '../assets/pets/hoodie-cat/spritesheet.webp';
import type { PetId } from '../utils/petPreference';

// OpenPets sprite version 2: 8 columns x 11 rows of 192 x 208 cells, measured in both packs (see assets/pets/ATTRIBUTION.txt).
export const PET_SHEETS: Record<PetId, { name: string; sheet: string }> = {
  'luna-techbot': { name: 'Luna TechBot', sheet: lunaSheet },
  'hoodie-cat': { name: 'Hoodie Cat', sheet: hoodieSheet },
};
