import { createContext, useContext } from 'react';
import type { NotificationTarget } from '../utils/notificationTarget';

export type TargetStatus = 'opened' | 'missing' | 'unsupported' | 'legacy' | 'error' | 'blocked';
export type PendingTarget = { tab: string; target: NotificationTarget; nonce: number };
/** `detail` is a ready-to-show sentence for the outcome (used by 'blocked': the item exists but its page may not be opened). */
export type TargetContextValue = { pending: PendingTarget | null; resolve: (nonce: number, status: TargetStatus, detail?: string) => void };

export const NotificationTargetContext = createContext<TargetContextValue | null>(null);

/** A destination page asks for the pending notice target addressed to its own tab; `null` when there is none. */
export function useNotificationTarget(tab: string) {
  const context = useContext(NotificationTargetContext);
  const pending = context?.pending?.tab === tab ? context.pending : null;
  return { pending, resolve: context?.resolve };
}
