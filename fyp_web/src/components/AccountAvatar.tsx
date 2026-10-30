import { useState, type ReactNode } from 'react';
import { useAccountAvatar } from '../utils/accountAvatar';

/** The signed-in account's uploaded profile image, or the given fallback when there is none or it fails to load. */
export function AccountAvatar({ userId, size, className = '', fallback, label }: {
  userId: string | number | undefined | null; size: number; className?: string; fallback: ReactNode; label?: string;
}) {
  const url = useAccountAvatar(userId);
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url) return <>{fallback}</>;
  return <img src={url} alt={label || ''} aria-hidden={label ? undefined : true} width={size} height={size} referrerPolicy="no-referrer"
    onError={() => setFailed(url)} style={{ width: size, height: size }} className={`shrink-0 object-cover ${className}`} data-account-avatar />;
}
