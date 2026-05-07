import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type DealsFilter, type Deal } from "../api/client";
import { useWatchlistContext } from "../contexts/WatchlistContext";
import { useSettings } from "./useSettings";

const PAGE_SIZES = [25, 50] as const;
export type PageSize = typeof PAGE_SIZES[number];
export { PAGE_SIZES };

export function useDeals() {
  const { hidden } = useWatchlistContext();
  const { settings } = useSettings();

  const [pageSize, setPageSize] = useState<PageSize>(25);
  const [filters, setFilters] = useState<DealsFilter>({ limit: 25, offset: 0 });
  const [draft, setDraft] = useState<DealsFilter>({ limit: 25, offset: 0 });
  const [page, setPage] = useState(0);

  // Seed postcode from settings once available
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

  // Filter out hidden deals for display, but keep rawData for pagination logic
  const data = useMemo<Deal[]>(
    () => rawData.filter((d) => !hidden.has(d.id)),
    [rawData, hidden],
  );

  // Use rawData length so hiding deals on the current page doesn't disable Next
  const hasNext = rawData.length === pageSize;
  const hasPrev = page > 0;

  function apply() {
    setPage(0);
    setFilters({ ...draft, limit: pageSize, offset: 0 });
  }

  function goToPage(p: number) {
    setPage(p);
    setFilters((f) => ({ ...f, offset: p * pageSize }));
  }

  function changePageSize(size: PageSize) {
    setPageSize(size);
    setPage(0);
    setFilters((f) => ({ ...f, limit: size, offset: 0 }));
  }

  function setSortBy(s: string) {
    setDraft((d) => ({ ...d, sort_by: s }));
    setFilters((f) => ({ ...f, sort_by: s, offset: 0 }));
    setPage(0);
  }

  return {
    // Data
    data,
    rawData,
    isLoading,
    isError,
    dataUpdatedAt,
    // Pagination
    page,
    pageSize,
    hasNext,
    hasPrev,
    goToPage,
    changePageSize,
    // Filters
    filters,
    draft,
    setDraft,
    apply,
    setSortBy,
  };
}
