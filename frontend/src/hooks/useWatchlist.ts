import { useState, useCallback, useEffect, useRef } from "react";

function getDeviceId(): string {
  let id = localStorage.getItem("cf_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cf_device_id", id);
  }
  return id;
}

function storageKey(base: string, userId: number): string {
  return userId === 0
    ? `${base}_anon_${getDeviceId()}`
    : `${base}_u${userId}`;
}

function load(k: string): Set<number> {
  try {
    const raw = localStorage.getItem(k);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function save(k: string, ids: Set<number>) {
  localStorage.setItem(k, JSON.stringify([...ids]));
}

export function useWatchlist(userId: number) {
  const bKey = storageKey("cf_bookmarked", userId);
  const hKey = storageKey("cf_hidden",     userId);

  const [bookmarked, setBookmarked] = useState<Set<number>>(() => load(bKey));
  const [hidden,     setHidden]     = useState<Set<number>>(() => load(hKey));

  const prevUserIdRef = useRef(userId);

  // When userId changes (login / logout), reload from the new key.
  // On login (0 → real ID), merge any anonymous bookmarks in first.
  useEffect(() => {
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = userId;
    if (prevId === userId) return;

    const userBookmarks = load(bKey);
    const userHidden    = load(hKey);

    if (prevId === 0 && userId !== 0) {
      // Merge anonymous slot into user slot then clear it
      const anonBKey = storageKey("cf_bookmarked", 0);
      const anonHKey = storageKey("cf_hidden",     0);
      const anonB = load(anonBKey);
      const anonH = load(anonHKey);

      const mergedB = new Set([...userBookmarks, ...anonB]);
      const mergedH = new Set([...userHidden,    ...anonH]);

      save(bKey, mergedB);
      save(hKey, mergedH);
      if (anonB.size > 0) localStorage.removeItem(anonBKey);
      if (anonH.size > 0) localStorage.removeItem(anonHKey);

      setBookmarked(mergedB);
      setHidden(mergedH);
    } else {
      setBookmarked(userBookmarks);
      setHidden(userHidden);
    }
  }, [userId, bKey, hKey]);

  const toggleBookmark = useCallback((id: number) => {
    setBookmarked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      save(bKey, next);
      return next;
    });
  }, [bKey]);

  const removeBookmark = useCallback((id: number) => {
    setBookmarked((prev) => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      save(bKey, next);
      return next;
    });
  }, [bKey]);

  const toggleHide = useCallback((id: number) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      save(hKey, next);
      return next;
    });
  }, [hKey]);

  const addHidden = useCallback((id: number) => {
    setHidden((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      save(hKey, next);
      return next;
    });
  }, [hKey]);

  return { bookmarked, hidden, toggleBookmark, removeBookmark, toggleHide, addHidden };
}
