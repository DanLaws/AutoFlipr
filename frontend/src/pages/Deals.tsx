import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, DealsFilter, Deal } from "../api/client";
import DealsGrid from "../components/DealsGrid";
import FilterDrawer from "../components/FilterDrawer";
import CompareModal from "../components/CompareModal";
import { useSettings } from "../hooks/useSettings";
import { useWatchlistContext } from "../contexts/WatchlistContext";

const PAGE_SIZES = [25, 50] as const;

export default function DealsPage() {
  const { bookmarked, hidden, toggleBookmark: onBookmark, toggleHide: onHide } = useWatchlistContext();
  const { settings } = useSettings();

  const [pageSize, setPageSize] = useState<25 | 50>(25);
  const [filters, setFilters] = useState<DealsFilter>({ limit: 25, offset: 0 });
  const [draft, setDraft] = useState<DealsFilter>({ limit: 25, offset: 0 });
  const [page, setPage] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comparingIds, setComparingIds] = useState<Set<number>>(new Set());
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    if (settings.homePostcode && !draft.home_postcode) {
      setDraft((d) => ({ ...d, home_postcode: settings.homePostcode }));
    }
  }, [settings.homePostcode]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: rawData = [], isLoading, isError, dataUpdatedAt } = useQuery({
    queryKey: ["deals", filters],
    queryFn: () => api.deals(filters),
    staleTime: 5 * 60_000,
    refetchInterval: 5 * 60_000,
  });

  const data = useMemo(() => rawData.filter((d) => !hidden.has(d.id)), [rawData, hidden]);

  const compareDeals = useMemo(() => {
    const ids = [...comparingIds];
    if (ids.length < 2) return null;
    const a = rawData.find((d) => d.id === ids[0]);
    const b = rawData.find((d) => d.id === ids[1]);
    if (!a || !b) return null;
    return [a, b] as [Deal, Deal];
  }, [comparingIds, rawData]);

  function handleCompare(id: number) {
    setComparingIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setCompareOpen(false);
      } else if (next.size < 2) {
        next.add(id);
        if (next.size === 2) setCompareOpen(true);
      }
      return next;
    });
  }

  function clearCompare() {
    setComparingIds(new Set());
    setCompareOpen(false);
  }

  function apply() {
    setPage(0);
    setFilters({ ...draft, limit: pageSize, offset: 0 });
  }

  function goToPage(p: number) {
    setPage(p);
    setFilters((f) => ({ ...f, offset: p * pageSize }));
  }

  function changePageSize(size: 25 | 50) {
    setPageSize(size);
    setPage(0);
    setFilters((f) => ({ ...f, limit: size, offset: 0 }));
  }

  // Use rawData (before hidden-filter) so that hiding cards on the current page
  // doesn't incorrectly disable the Next button.
  const hasNext = rawData.length === pageSize;
  const hasPrev = page > 0;

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Deals</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-text-muted mt-0.5">
              Updated {new Date(dataUpdatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button onClick={() => setDrawerOpen(true)} className="btn btn-secondary">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M9 17h6" />
          </svg>
          Filters
          {draft.profitable_only && <span className="w-2 h-2 rounded-full bg-text-primary" />}
        </button>
      </div>

      {drawerOpen && (
        <FilterDrawer
          draft={draft}
          onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
          onApply={() => { setPage(0); setFilters({ ...draft, limit: pageSize, offset: 0 }); }}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* Inline filters */}
      <div className="border border-border-default rounded-xl p-4 flex flex-wrap gap-4 items-end bg-surface">
        {/* Max price dropdown — £500 increments */}
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Max price (£)</span>
          <select
            value={draft.max_price ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, max_price: e.target.value ? Number(e.target.value) : undefined }))}
            className="w-28 input"
          >
            <option value="">any</option>
            {Array.from({ length: 200 }, (_, i) => (i + 1) * 500).map((p) => (
              <option key={p} value={p}>£{p.toLocaleString()}</option>
            ))}
          </select>
        </label>

        {/* Max mileage dropdown — 5,000 increments */}
        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Max mileage</span>
          <select
            value={draft.max_mileage ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, max_mileage: e.target.value ? Number(e.target.value) : undefined }))}
            className="w-32 input"
          >
            <option value="">any</option>
            {Array.from({ length: 40 }, (_, i) => (i + 1) * 5000).map((m) => (
              <option key={m} value={m}>{m.toLocaleString()} mi</option>
            ))}
          </select>
        </label>

        {[
          { label: "Min margin (£)",key: "min_margin", w: "w-28", type: "number" },
          { label: "Make",          key: "make", w: "w-28", type: "text" },
          { label: "Model",         key: "model", w: "w-28", type: "text" },
        ].map(({ label, key, w, type }) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="label-caps">{label}</span>
            <input
              type={type}
              value={(draft as Record<string, unknown>)[key] as string ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value ? (type === "number" ? Number(e.target.value) : e.target.value) : undefined }))}
              placeholder="any"
              className={`${w} input`}
            />
          </label>
        ))}

        {(["year_from", "year_to"] as const).map((key) => (
          <label key={key} className="flex flex-col gap-1.5">
            <span className="label-caps">{key === "year_from" ? "Year from" : "Year to"}</span>
            <select
              value={(draft as Record<string, unknown>)[key] as number ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value ? Number(e.target.value) : undefined }))}
              className="w-24 input"
            >
              <option value="">any</option>
              {Array.from({ length: new Date().getFullYear() - 1930 + 1 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
        ))}

        <label className="flex flex-col gap-1.5">
          <span className="label-caps">Seller type</span>
          <select
            value={draft.seller_type ?? ""}
            onChange={(e) => setDraft((d) => ({ ...d, seller_type: e.target.value || undefined }))}
            className="w-28 input"
          >
            <option value="">any</option>
            <option value="private">Private</option>
            <option value="trade">Trade</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="label-caps">
            Max distance
            {!draft.home_postcode && (
              <span className="ml-1 text-text-faint font-normal normal-case">(set postcode in Settings)</span>
            )}
          </span>
          <div className="flex items-center gap-1.5">
            <select
              value={draft.max_distance_miles ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, max_distance_miles: e.target.value ? Number(e.target.value) : undefined }))}
              disabled={!draft.home_postcode}
              className="w-28 input disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {[1, 2, 3, 5, 10, 15, 20, 25, 30, 40, 50, 75, 100, 150, 200, 300].map((d) => (
                <option key={d} value={d}>Within {d} mi</option>
              ))}
              <option value="">Nationwide</option>
            </select>
            {draft.home_postcode && (
              <span className="text-xs text-text-faint">from {draft.home_postcode}</span>
            )}
          </div>
        </label>

        <button onClick={apply} className="btn btn-primary px-5">Apply</button>
      </div>

      {isError && (
        <div className="border border-danger-border bg-danger-bg text-danger-strong rounded-xl px-4 py-3 text-sm">
          Failed to load deals. Is the API running?
        </div>
      )}

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <p className="text-sm text-text-muted">
          {isLoading
            ? <span className="text-text-faint">Loading…</span>
            : <>{data.length} deal{data.length !== 1 ? "s" : ""} on page {page + 1}{hasNext && <span className="text-text-faint"> — more on next page</span>}</>
          }
        </p>
        <div className="flex items-center gap-3">
          {/* Per-page selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-text-faint">Per page</span>
            <div className="flex rounded-lg border border-border-default overflow-hidden text-xs">
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => changePageSize(size)}
                  className={`px-2.5 py-1.5 font-medium transition-colors ${
                    pageSize === size
                      ? "bg-text-primary text-brand-fg"
                      : "bg-surface text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <button onClick={() => goToPage(page - 1)} disabled={!hasPrev} className="btn btn-secondary btn-sm">← Prev</button>
          <button onClick={() => goToPage(page + 1)} disabled={!hasNext} className="btn btn-secondary btn-sm">Next →</button>
        </div>
      </div>

      <DealsGrid
        data={data}
        isLoading={isLoading}
        bookmarked={bookmarked}
        hidden={hidden}
        comparing={comparingIds}
        onBookmark={onBookmark}
        onHide={onHide}
        onCompare={handleCompare}
        sortBy={filters.sort_by ?? "score"}
        homePostcode={draft.home_postcode}
        onSortChange={(s) => {
          setDraft((d) => ({ ...d, sort_by: s }));
          setFilters((f) => ({ ...f, sort_by: s, offset: 0 }));
          setPage(0);
        }}
      />

      {/* Floating compare bar */}
      {comparingIds.size > 0 && (
        <div
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 px-5 py-3 rounded-2xl border"
          style={{
            background: "var(--color-text-primary)",
            borderColor: "var(--color-border-strong)",
            boxShadow: "var(--shadow-lg)",
          }}
        >
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1">
              {[...comparingIds].map((id) => {
                const deal = rawData.find((d) => d.id === id);
                const thumb = deal?.image_urls?.[0]?.replace("/w1400/", "/w384/");
                return thumb ? (
                  <img key={id} src={thumb} className="w-8 h-8 rounded-full object-cover border-2 border-border-strong" alt="" />
                ) : (
                  <div key={id} className="w-8 h-8 rounded-full bg-surface-subtle border-2 border-border-strong flex items-center justify-center">
                    <svg className="w-4 h-4 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                );
              })}
            </div>
            <span className="text-sm font-medium text-brand-fg">
              {comparingIds.size === 1 ? "1 selected — pick one more to compare" : "2 deals selected"}
            </span>
          </div>

          {comparingIds.size === 2 && (
            <button
              onClick={() => setCompareOpen(true)}
              className="bg-brand-fg text-brand text-sm font-semibold px-4 py-1.5 rounded-xl hover:opacity-90 transition-opacity"
            >
              Compare →
            </button>
          )}

          <button onClick={clearCompare} className="text-brand-fg/50 hover:text-brand-fg transition-colors ml-1" title="Clear selection">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {compareOpen && compareDeals && (
        <CompareModal deals={compareDeals} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  );
}
