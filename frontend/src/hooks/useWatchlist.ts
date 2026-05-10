import { useState, useCallback, useEffect, useRef } from "react";
import { apiFetch, apiPost, apiDelete } from "../api/client";

// ---------------------------------------------------------------------------
// localStorage helpers (anonymous / offline fallback)
// ---------------------------------------------------------------------------

function getDeviceId(): string {
  let id = localStorage.getItem("cf_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("cf_device_id", id);
  }
  return id;
}

function anonKey(base: string) {
  return `${base}_anon_${getDeviceId()}`;
}

function localLoad(k: string): Set<number> {
  try {
    const raw = localStorage.getItem(k);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

function localSave(k: string, ids: Set<number>) {
  localStorage.setItem(k, JSON.stringify([...ids]));
}

// ---------------------------------------------------------------------------
// Server API helpers
// ---------------------------------------------------------------------------

async function serverFetch(): Promise<Set<number>> {
  try {
    const data = await apiFetch<{ ids: number[] }>("/api/watchlist");
    return new Set(data.ids);
  } catch {
    return new Set();
  }
}

async function serverAdd(id: number): Promise<void> {
  await apiPost(`/api/watchlist/${id}`, {});
}

async function serverRemove(id: number): Promise<void> {
  await apiDelete(`/api/watchlist/${id}`);
}

async function serverSync(ids: Set<number>): Promise<void> {
  await apiPost("/api/watchlist/sync", { ids: [...ids] });
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useWatchlist(userId: number) {
  const isLoggedIn = userId !== 0;
  const hiddenKey = isLoggedIn ? `cf_hidden_u${userId}` : anonKey("cf_hidden");

  // Bookmarks start empty for logged-in users (populated async from server)
  const [bookmarked, setBookmarked] = useState<Set<number>>(
    () => (isLoggedIn ? new Set() : localLoad(anonKey("cf_bookmarked")))
  );
  // Hidden is always localStorage-only — it's a UI preference, not persistent data
  const [hidden, setHidden] = useState<Set<number>>(() => localLoad(hiddenKey));

  const prevUserIdRef = useRef(userId);

  useEffect(() => {
    const prevId = prevUserIdRef.current;
    prevUserIdRef.current = userId;

    if (isLoggedIn) {
      const anonBKey = anonKey("cf_bookmarked");
      const anonBookmarks = localLoad(anonBKey);

      serverFetch().then((serverIds) => {
        if (prevId === 0 && anonBookmarks.size > 0) {
          // Login: merge any anon bookmarks into server, then clear local
          const merged = new Set([...serverIds, ...anonBookmarks]);
          setBookmarked(merged);
          serverSync(merged).then(() => localStorage.removeItem(anonBKey));
        } else {
          setBookmarked(serverIds);
        }
      });

      // Hidden reloads from user-specific key on login
      if (prevId === 0) {
        const anonHKey = anonKey("cf_hidden");
        const anonH = localLoad(anonHKey);
        const userH = localLoad(`cf_hidden_u${userId}`);
        const merged = new Set([...userH, ...anonH]);
        localSave(`cf_hidden_u${userId}`, merged);
        if (anonH.size > 0) localStorage.removeItem(anonHKey);
        setHidden(merged);
      } else {
        setHidden(localLoad(`cf_hidden_u${userId}`));
      }
    } else {
      // Logged out — fall back to localStorage
      setBookmarked(localLoad(anonKey("cf_bookmarked")));
      setHidden(localLoad(anonKey("cf_hidden")));
    }
  }, [userId, isLoggedIn]);

  const toggleBookmark = useCallback(
    (id: number) => {
      setBookmarked((prev) => {
        const next = new Set(prev);
        const adding = !next.has(id);
        if (adding) next.add(id); else next.delete(id);

        if (isLoggedIn) {
          if (adding) serverAdd(id).catch(() => {});
          else serverRemove(id).catch(() => {});
        } else {
          localSave(anonKey("cf_bookmarked"), next);
        }
        return next;
      });
    },
    [isLoggedIn]
  );

  const removeBookmark = useCallback(
    (id: number) => {
      setBookmarked((prev) => {
        if (!prev.has(id)) return prev;
        const next = new Set(prev);
        next.delete(id);
        if (isLoggedIn) serverRemove(id).catch(() => {});
        else localSave(anonKey("cf_bookmarked"), next);
        return next;
      });
    },
    [isLoggedIn]
  );

  const toggleHide = useCallback(
    (id: number) => {
      setHidden((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        localSave(hiddenKey, next);
        return next;
      });
    },
    [hiddenKey]
  );

  const addHidden = useCallback(
    (id: number) => {
      setHidden((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        localSave(hiddenKey, next);
        return next;
      });
    },
    [hiddenKey]
  );

  return { bookmarked, hidden, toggleBookmark, removeBookmark, toggleHide, addHidden };
}
