/** Notify same-origin windows without sharing credentials or conversation content. */
export function broadcastAccountLogout() {
  try {
    const user = JSON.parse(sessionStorage.getItem('auth_user') || 'null');
    if (user?.user_id == null) return;
    const channel = new BroadcastChannel('sas-account-logout');
    channel.postMessage({ userId: String(user.user_id) });
    channel.close();
  } catch { /* Unsupported channels or restricted storage do not block local logout. */ }
}
