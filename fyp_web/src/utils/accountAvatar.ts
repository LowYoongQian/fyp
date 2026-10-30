import { useEffect, useSyncExternalStore } from 'react';
import { apiService } from '../services/api';

// Account-scoped avatar URLs: keyed by user id, so another account can never see this one's picture,
// and shared, so the sidebar and every chat message read one value instead of requesting it again.
const avatars = new Map<string, string | null>();
const listeners = new Set<() => void>();
const requested = new Set<string>();
const emit = () => listeners.forEach(listener => listener());

export function setAccountAvatar(userId: string | number | undefined | null, url: string | null | undefined) {
  if (userId == null) return;
  const key = String(userId), next = url || null;
  if (avatars.get(key) === next && avatars.has(key)) return;
  avatars.set(key, next); emit();
}

/** Called on logout and account switch: nothing about the previous account may linger. */
export function clearAccountAvatars() {
  avatars.clear(); requested.clear(); emit();
}

export function useAccountAvatar(userId: string | number | undefined | null) {
  const key = userId == null ? null : String(userId);
  const url = useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => (key !== null ? avatars.get(key) ?? null : null),
  );
  useEffect(() => {
    if (key === null || avatars.has(key) || requested.has(key)) return;
    requested.add(key);
    // The profile request is cached by the API layer, so this costs one request per account, not one per message.
    apiService.getUserProfile().then(profile => {
      if (String(profile.user_id) === key) setAccountAvatar(key, profile.avatar_url);
    }).catch(() => { requested.delete(key); });
  }, [key]);
  return url;
}
