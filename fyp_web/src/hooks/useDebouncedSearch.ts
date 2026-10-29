import { useEffect, useState } from 'react';

export function useDebouncedSearch(value: string) {
  const [search, setSearch] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(value), 250);
    return () => window.clearTimeout(timer);
  }, [value]);
  return search;
}
