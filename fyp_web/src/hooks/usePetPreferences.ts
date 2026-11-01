import { useSyncExternalStore } from 'react';
import { petPreferenceState, savePetPreferences, subscribePetPreferences, type PetPreferences } from '../utils/petPreference';

/** The signed-in account's pet choices, shared live by every pet and the chat settings. Not ready until the account's answer arrives. */
export function usePetPreferences(userId: string | number | undefined) {
  const state = useSyncExternalStore(subscribePetPreferences, petPreferenceState);
  const ready = userId !== undefined && state.userId === String(userId) && state.prefs !== null;
  return {
    ready,
    visible: ready && state.prefs!.visible,
    pet: ready ? state.prefs!.pet : null,
    position: ready ? state.prefs!.position : null,
    save: (patch: Partial<PetPreferences>) => userId === undefined ? Promise.resolve(false) : savePetPreferences(userId, patch),
  };
}
