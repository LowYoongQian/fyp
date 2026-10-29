import { apiService } from '../services/api';

type Preference = { dismissed: boolean; pending: boolean };
const memory = new Map<string, Preference>();
const writes = new Map<string, Promise<boolean>>();
const key = (id: string | number) => `recovery_reminder_${id}`;

export function recoveryReminderPreference(id: string | number): Preference {
  const cached = memory.get(key(id));
  if (cached) return cached;
  try {
    const value = JSON.parse(localStorage.getItem(key(id)) || 'null');
    if (typeof value?.dismissed === 'boolean' && typeof value?.pending === 'boolean') memory.set(key(id), value);
  } catch { /* Restricted storage still has a per-account in-memory fallback. */ }
  return memory.get(key(id)) || { dismissed: false, pending: false };
}

export function cacheRecoveryReminder(id: string | number, dismissed: boolean, pending = false) {
  const value = { dismissed, pending };
  memory.set(key(id), value);
  try { localStorage.setItem(key(id), JSON.stringify(value)); } catch { /* Server persistence remains available. */ }
}

export function recoveryReminderStoredLocally(id: string | number) {
  try {
    const stored = JSON.parse(localStorage.getItem(key(id)) || 'null');
    const cached = memory.get(key(id));
    return !!cached && stored?.dismissed === cached.dismissed && stored?.pending === cached.pending;
  } catch { return false; }
}

export function saveRecoveryReminder(id: string | number, dismissed: boolean): Promise<boolean> {
  cacheRecoveryReminder(id, dismissed, true);
  const token = sessionStorage.getItem('auth_token');
  const write = (writes.get(key(id)) || Promise.resolve(true)).then(async () => {
    try {
      const user = JSON.parse(sessionStorage.getItem('auth_user') || 'null');
      if (!token || sessionStorage.getItem('auth_token') !== token || String(user?.user_id) !== String(id)) return false;
      await apiService.updateUserSettings({ recovery_prompt_dismissed: dismissed }, { timeout: 15000 });
      const latest = recoveryReminderPreference(id);
      if (writes.get(key(id)) === write && latest.dismissed === dismissed) cacheRecoveryReminder(id, dismissed);
      return true;
    } catch { return false; } // Keep the local choice and retry at the next authenticated sync.
  });
  writes.set(key(id), write);
  void write.then(() => { if (writes.get(key(id)) === write) writes.delete(key(id)); });
  return write;
}

export function syncRecoveryReminder(id: string | number, serverValue: unknown) {
  const local = recoveryReminderPreference(id);
  if (local.pending) {
    if (!writes.has(key(id))) void saveRecoveryReminder(id, local.dismissed);
  } else if (typeof serverValue === 'boolean') {
    cacheRecoveryReminder(id, serverValue);
  }
  return recoveryReminderPreference(id).dismissed;
}
