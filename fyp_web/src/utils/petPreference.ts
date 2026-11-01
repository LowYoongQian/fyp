import { apiService } from '../services/api';

// Show pet and the chosen pet belong to the signed-in account on the server. This browser only keeps a cache, used when the
// server cannot be reached and to keep other open tabs in step. Until the account's answer arrives no pet is drawn.
export const PET_IDS = ['luna-techbot', 'hoodie-cat'] as const;
export type PetId = typeof PET_IDS[number];
export const DEFAULT_PET: PetId = 'luna-techbot';
/** Where the pet was last dropped: the distance from the top-left of the space it may use. Saved with the account, so it is the same in every browser. */
export type PetOffset = { dx: number; dy: number };
export type PetPreferences = { visible: boolean; pet: PetId; position: PetOffset | null };
export type PetState = { userId: string | null; prefs: PetPreferences | null };

export const isPetId = (value: unknown): value is PetId => PET_IDS.includes(value as PetId);
const asOffset = (value: unknown): PetOffset | null => {
  const v = value as PetOffset | null;
  return v && Number.isFinite(v.dx) && Number.isFinite(v.dy) && v.dx >= 0 && v.dy >= 0 ? { dx: Math.round(v.dx), dy: Math.round(v.dy) } : null;
};
const cacheKey = (userId: string) => `pet_preferences_${userId}`;
const legacyKey = (userId: string) => `show_pet_${userId}`;   // the old browser-only switch

const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string | null) => {
  try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch { /* The account copy still holds. */ }
};
const parse = (raw: string | null): PetPreferences | null => {
  try {
    const value = JSON.parse(raw || 'null');
    return typeof value?.visible === 'boolean' && isPetId(value?.pet) ? { visible: value.visible, pet: value.pet, position: asOffset(value.position) } : null;
  } catch { return null; }
};

let state: PetState = { userId: null, prefs: null };
// Bumped by every local change and account switch: an account answer requested before it is older than what the user sees.
let version = 0;
let saves: Promise<unknown> = Promise.resolve();
const listeners = new Set<() => void>();
const set = (next: PetState) => { state = next; listeners.forEach(listener => listener()); };

const onStorage = (event: StorageEvent) => {
  if (!state.userId || event.key !== cacheKey(state.userId)) return;
  const prefs = parse(event.newValue);
  if (prefs) set({ ...state, prefs });
};

export function subscribePetPreferences(listener: () => void) {
  if (!listeners.size) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => { listeners.delete(listener); if (!listeners.size) window.removeEventListener('storage', onStorage); };
}
export const petPreferenceState = () => state;

/** Call before asking the server; pass the result to hydrate/fail so a reply for another account or an older moment is ignored. */
export function beginPetHydration(userId: string | number) {
  const id = String(userId);
  if (state.userId !== id) { version += 1; set({ userId: id, prefs: null }); }
  return version;
}

export function hydratePetPreferences(userId: string | number, token: number, profile: { pet_visible?: boolean | null; pet_choice?: string | null; pet_position?: PetOffset | null }) {
  const id = String(userId);
  if (state.userId !== id || token !== version) return;
  // An account that never chose keeps an explicit OFF made earlier in this browser for this same account.
  const legacyOff = profile.pet_visible == null && read(legacyKey(id)) === 'false';
  const prefs: PetPreferences = { visible: legacyOff ? false : profile.pet_visible ?? true, pet: isPetId(profile.pet_choice) ? profile.pet_choice : DEFAULT_PET, position: asOffset(profile.pet_position) };
  write(cacheKey(id), JSON.stringify(prefs));
  set({ userId: id, prefs });
  if (legacyOff) void apiService.updateUserSettings({ pet_visible: false }, { timeout: 15000 }).then(() => write(legacyKey(id), null), () => undefined);
  else if (profile.pet_visible != null) write(legacyKey(id), null);
}

/** The server could not answer: use this account's last known choice on this browser, otherwise keep the pet hidden. */
export function failPetHydration(userId: string | number, token: number) {
  const id = String(userId);
  if (state.userId !== id || token !== version || state.prefs) return;
  const cached = parse(read(cacheKey(id)));
  if (cached) set({ userId: id, prefs: cached });
}

/** Shows the change at once and saves it for the account; resolves false (and undoes it) if the save fails. Saves go out in order. */
export function savePetPreferences(userId: string | number, patch: Partial<PetPreferences>): Promise<boolean> {
  const id = String(userId);
  if (state.userId !== id || !state.prefs) return Promise.resolve(false);
  const previous = state.prefs;
  const next = { ...previous, ...patch };
  version += 1;
  write(cacheKey(id), JSON.stringify(next));
  set({ userId: id, prefs: next });
  const body = { ...(patch.visible !== undefined ? { pet_visible: patch.visible } : {}), ...(patch.pet !== undefined ? { pet_choice: patch.pet } : {}), ...(patch.position ? { pet_position: patch.position } : {}) };
  const request = saves.then(() => apiService.updateUserSettings(body, { timeout: 15000 }));
  saves = request.catch(() => undefined);
  return request.then(() => true, () => {
    // Undo only what this save changed and nothing newer replaced; another account's view is never touched.
    if (state.userId === id && state.prefs) {
      const restored = { ...state.prefs };
      if (patch.visible !== undefined && restored.visible === patch.visible) restored.visible = previous.visible;
      if (patch.pet !== undefined && restored.pet === patch.pet) restored.pet = previous.pet;
      if (patch.position !== undefined && restored.position === patch.position) restored.position = previous.position;
      write(cacheKey(id), JSON.stringify(restored));
      set({ userId: id, prefs: restored });
    }
    return false;
  });
}

export function resetPetPreferences() {
  version += 1;
  set({ userId: null, prefs: null });
}
