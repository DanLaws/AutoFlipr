import { useState, useCallback } from "react";

function load(key: string): Set<number> {
  try {
    const raw = localStorage.getItem(key);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function save(key: string, ids: Set<number>) {
  localStorage.setItem(key, JSON.stringify([...ids]));
}

export function useWatchlist() {
  const [bookmarked, setBookmarked] = useState<Set<number>>(() => load("cf_bookmarked"));
  const [hidden, setHidden] = useState<Set<number>>(() => load("cf_hidden"));

  const toggleBookmark = useCallback((id: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save("cf_bookmarked", next);
      return next;
    });
  }, []);

  const toggleHide = useCallback((id: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      save("cf_hidden", next);
      return next;
    });
  }, []);

  return { bookmarked, hidden, toggleBookmark, toggleHide };
}
