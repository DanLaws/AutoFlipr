import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, DealsFilter } from "../api/client";
import DealsGrid from "../components/DealsGrid";
import FilterDrawer from "../components/FilterDrawer";
import { useSettings } from "../hooks/useSettings";

interface WatchlistProps {
  bookmarked: Set<number>;
  hidden: Set<number>;
  onBookmark: (id: number) => void;
  onHide: (id: number) => void;
}

const PAGE_SIZE = 25;

export default function DealsPage({ bookmarked, hidden, onBookmark, onHide }: WatchlistProps) {
  const { settings } = useSettings();

  const [filters, setFilters] = useState<DealsFilter>({
    limit: PAGE_SIZE,
    offset: 0,
  });
  const [draft, setDraft] = useState(filters);
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Pre-populate home postcode from settings if user hasn't set it in draft
  useEffect(() => {
    if (settings.homePostcode && !draft.home_postcode) {
      setDraft((d) => ({ ...d, home_postcode: settings.homePostcode }));
    }
  }, [settings.homePostcode]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: rawData = [], isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["deals", filters],
    queryFn: () => api.deals(filters),
    refetchInterval: 60_000,
  });

  const data = useMemo(() => rawData.filter((d) => !hidden.has(d.id)), [rawData, hidden]);

  function apply() {
    setPage(0);
    setFilters({ ...draft, limit: PAGE_SIZE, offset: 0 });
  }

  function goToPage(p: number) {
    setPage(p);
    setFilters((f) => ({ ...f, offset: p * PAGE_SIZE }));
  }

  const hasNext = data.length === PAGE_SIZE;
  const hasPrev = page > 0;

  const inputCls = "bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent";

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Deals</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-gray-400 mt-0.5">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M9 17h6" />
          </svg>
          Filters
          {draft.profitable_only ? <span className="w-2 h-2 rounded-full bg-gray-900" /> : null}
        </button>
      </div>

      {drawerOpen && (
        <FilterDrawer
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onApply={() => { setPage(0); setFilters({ ...draft, limit: PAGE_SIZE, offset: 0 }); }}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Filters */}
      <div className="border border-gray-200 rounded-xl p-4 flex flex-wrap gap-4 items-end bg-gray-50">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Max price (£)</span>
          <input type="number" value={draft.max_price ?? ""} onChange={(e) => setDraft((d) => ({ ...d, max_price: e.target.value ? Number(e.target.value) : undefined }))} placeholder="any" className={`w-28 ${inputCls}`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Max mileage</span>
          <input type="number" value={draft.max_mileage ?? ""} onChange={(e) => setDraft((d) => ({ ...d, max_mileage: e.target.value ? Number(e.target.value) : undefined }))} placeholder="any" className={`w-28 ${inputCls}`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Min margin (£)</span>
          <input type="number" value={draft.min_margin ?? ""} onChange={(e) => setDraft((d) => ({ ...d, min_margin: e.target.value ? Number(e.target.value) : undefined }))} placeholder="any" className={`w-28 ${inputCls}`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Make</span>
          <input type="text" value={draft.make ?? ""} onChange={(e) => setDraft((d) => ({ ...d, make: e.target.value || undefined }))} placeholder="any" className={`w-28 ${inputCls}`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Seller type</span>
          <select value={draft.seller_type ?? ""} onChange={(e) => setDraft((d) => ({ ...d, seller_type: e.target.value || undefined }))} className={`w-28 ${inputCls}`}>
            <option value="">any</option>
            <option value="private">Private</option>
            <option value="trade">Trade</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Year from</span>
          <input type="number" value={draft.year_from ?? ""} onChange={(e) => setDraft((d) => ({ ...d, year_from: e.target.value ? Number(e.target.value) : undefined }))} placeholder="any" className={`w-24 ${inputCls}`} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">Year to</span>
          <input type="number" value={draft.year_to ?? ""} onChange={(e) => setDraft((d) => ({ ...d, year_to: e.target.value ? Number(e.target.value) : undefined }))} placeholder="any" className={`w-24 ${inputCls}`} />
        </label>

        {/* Distance filter — only shown if home postcode is set */}
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-gray-600">
            Max distance
            {!draft.home_postcode && (
              <span className="ml-1 text-gray-400 font-normal">(set postcode in Settings)</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={1}
              value={draft.max_distance_miles ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, max_distance_miles: e.target.value ? Number(e.target.value) : undefined }))}
              placeholder="any"
              disabled={!draft.home_postcode}
              className={`w-20 ${inputCls} disabled:opacity-40 disabled:cursor-not-allowed`}
            />
            <span className="text-sm text-gray-500">mi</span>
            {draft.home_postcode && (
              <span className="text-xs text-gray-400">from {draft.home_postcode}</span>
            )}
          </div>
        </label>

        <button onClick={apply} className="bg-gray-900 hover:bg-gray-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors">
          Apply
        </button>
      </div>

      {isError && (
        <div className="border border-red-200 bg-red-50 text-red-600 rounded-xl px-4 py-3 text-sm">
          Failed to load deals. Is the API running?
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-400">
          {data.length} deal{data.length !== 1 ? "s" : ""} shown (page {page + 1})
        </p>
        <div className="flex gap-2">
          <button onClick={() => goToPage(page - 1)} disabled={!hasPrev} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Previous
          </button>
          <button onClick={() => goToPage(page + 1)} disabled={!hasNext} className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
            Next
          </button>
        </div>
      </div>

      <DealsGrid
        data={data}
        isLoading={isLoading}
        bookmarked={bookmarked}
        hidden={hidden}
        onBookmark={onBookmark}
        onHide={onHide}
        sortBy={filters.sort_by ?? "score"}
        onSortChange={(s) => {
          setDraft((d) => ({ ...d, sort_by: s }));
          setFilters((f) => ({ ...f, sort_by: s, offset: 0 }));
          setPage(0);
        }}
      />
    </div>
  );
}
