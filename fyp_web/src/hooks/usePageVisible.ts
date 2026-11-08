import { useSyncExternalStore } from 'react';

const subscribe = (onChange: () => void) => {
  document.addEventListener('visibilitychange', onChange);
  return () => document.removeEventListener('visibilitychange', onChange);
};

/** False while the tab is hidden, so decorative motion can pause. */
export const usePageVisible = () => useSyncExternalStore(subscribe, () => !document.hidden, () => true);
