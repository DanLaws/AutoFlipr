import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import DealsGrid from "../components/DealsGrid";
import { useWatchlistContext } from "../contexts/WatchlistContext";

export default function WatchlistPage() {
  const { bookmarked, hidden, toggleBookmark: onBookmark, toggleHide: onHide } = useWatchlistContext();

  const bookmarkedIds = useMemo(() => Array.from(bookmarked), [bookmarked]);

  const { data: allDeals = [], isLoading } = useQuery({
    queryKey: ["deals-watchlist", bookmarkedIds],
    queryFn: () => bookmarkedIds.length > 0 ? api.dealsByIds(bookmarkedIds) : Promise.resolve([]),
    staleTime: 5 * 60_000,
    enabled: bookmarkedIds.length > 0,
  });

  const data = useMemo(
    () => allDeals.filter((d) => !hidden.has(d.id)),
    [allDeals, hidden]
  );

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Watchlist</h1>
        <p className="text-xs text-text-muted mt-0.5">
          {bookmarked.size} saved · {data.length} shown
        </p>
      </div>

      {bookmarked.size === 0 ? (
        <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
          <svg className="w-10 h-10 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>
          <p className="text-sm font-semibold text-text-primary">No saved deals yet</p>
          <p className="text-xs text-text-muted max-w-xs">
            Bookmark listings from the Deals or Scan page to save them here.
          </p>
        </div>
      ) : (
        <DealsGrid
          data={data}
          isLoading={isLoading}
          bookmarked={bookmarked}
          hidden={hidden}
          onBookmark={onBookmark}
          onHide={onHide}
        />
      )}
    </div>
  );
}
