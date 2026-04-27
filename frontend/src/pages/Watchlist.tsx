import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import DealsTable from "../components/DealsTable";

interface Props {
  bookmarked: Set<number>;
  hidden: Set<number>;
  onBookmark: (id: number) => void;
  onHide: (id: number) => void;
}

export default function WatchlistPage({ bookmarked, hidden, onBookmark, onHide }: Props) {
  const { data: allDeals = [], isLoading } = useQuery({
    queryKey: ["deals-watchlist"],
    queryFn: () => api.deals({ min_score: 0, limit: 200, offset: 0 }),
    staleTime: 5 * 60_000,
  });

  const data = useMemo(
    () => allDeals.filter((d) => bookmarked.has(d.id) && !hidden.has(d.id)),
    [allDeals, bookmarked, hidden]
  );

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Watchlist</h1>
        <p className="text-xs text-gray-400 mt-0.5">
          {bookmarked.size} saved · {data.length} shown
        </p>
      </div>

      {bookmarked.size === 0 ? (
        <div className="text-center py-20 text-gray-400 text-sm">
          No saved deals yet. Bookmark listings from the Deals page using the{" "}
          <svg className="w-4 h-4 inline-block mb-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
          </svg>{" "}
          icon.
        </div>
      ) : (
        <DealsTable
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
