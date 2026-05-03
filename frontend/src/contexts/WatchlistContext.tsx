/**
 * WatchlistContext — lifts bookmarked/hidden state out of App so that
 * DealsPage and WatchlistPage can consume it directly without prop drilling
 * through the React Router layout.
 */
import { createContext, useContext, ReactNode } from "react";
import { useAuth } from "./AuthContext";
import { useWatchlist } from "../hooks/useWatchlist";

export interface WatchlistContextValue {
  bookmarked: Set<number>;
  hidden: Set<number>;
  toggleBookmark: (id: number) => void;
  removeBookmark: (id: number) => void;
  toggleHide: (id: number) => void;
  addHidden: (id: number) => void;
}

const WatchlistContext = createContext<WatchlistContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const value = useWatchlist(user?.id ?? 0);
  return (
    <WatchlistContext.Provider value={value}>
      {children}
    </WatchlistContext.Provider>
  );
}

export function useWatchlistContext(): WatchlistContextValue {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error("useWatchlistContext must be used inside WatchlistProvider");
  return ctx;
}
