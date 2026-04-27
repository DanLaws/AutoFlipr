import { useState } from "react";
import type { Deal } from "../api/client";
import DealModal from "./DealModal";
import ReportButton from "./ReportButton";
import { scoreColourBadge } from "../utils/score";

const fmt = {
  gbp: (v: number | null) => (v != null ? `£${v.toLocaleString()}` : "—"),
  miles: (v: number | null) => (v != null ? `${v.toLocaleString()} mi` : "—"),
};

interface CardProps {
  deal: Deal;
  isBookmarked: boolean;
  isHidden: boolean;
  onBookmark: (id: number) => void;
  onHide: (id: number) => void;
  onClick: () => void;
}

function DealCard({ deal, isBookmarked, isHidden, onBookmark, onHide, onClick }: CardProps) {
  const thumb = deal.image_urls?.[0]?.replace("/w1400/", "/w384/") ?? null;
  const title = [deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "Unknown";
  const hasMargin = deal.estimated_margin_gbp != null;
  const marginPos = hasMargin && deal.estimated_margin_gbp! > 0;

  return (
    <div
      className="group bg-white rounded-xl border border-gray-200 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div className="relative aspect-[16/10] bg-gray-100 overflow-hidden rounded-t-xl">
        {thumb ? (
          <img
            src={thumb}
            alt={title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Score badge */}
        <div className="absolute top-2.5 left-2.5">
          {deal.score != null ? (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-sm font-bold font-mono shadow ${scoreColourBadge(deal.score)}`}>
              {deal.score.toFixed(0)}
              {deal.confidence === "low" && (
                <span className="relative group/tip opacity-70 text-xs cursor-default">
                  ?
                  <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-max max-w-[160px] rounded-md bg-gray-900 px-2.5 py-1.5 text-xs font-normal text-white shadow-lg opacity-0 group-hover/tip:opacity-100 transition-opacity whitespace-normal text-center leading-snug z-50">
                    Low confidence — few comparables
                  </span>
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-gray-800/60 text-gray-300 shadow">
              unscored
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div
          className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => onBookmark(deal.id)}
            title={isBookmarked ? "Remove from watchlist" : "Add to watchlist"}
            className={`w-7 h-7 flex items-center justify-center rounded-lg shadow transition-colors ${
              isBookmarked ? "bg-amber-400 text-white" : "bg-white/90 text-gray-500 hover:text-amber-500"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
            </svg>
          </button>
          <button
            onClick={() => onHide(deal.id)}
            title="Hide from feed"
            className="w-7 h-7 flex items-center justify-center rounded-lg shadow bg-white/90 text-gray-400 hover:text-gray-700 transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
            </svg>
          </button>
        </div>

        {/* Seller type pill */}
        {deal.seller_type && (
          <div className="absolute bottom-2 right-2">
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
              deal.seller_type === "private" ? "bg-blue-500 text-white" : "bg-gray-700 text-gray-200"
            }`}>
              {deal.seller_type}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <div>
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{title}</p>
          {deal.variant && <p className="text-xs text-gray-500 truncate">{deal.variant}</p>}
        </div>

        <div className="flex items-baseline justify-between gap-2">
          <span className="text-lg font-bold text-gray-900">{fmt.gbp(deal.price_gbp)}</span>
          {hasMargin && (
            <span className={`text-sm font-semibold ${marginPos ? "text-emerald-600" : "text-red-500"}`}>
              {marginPos ? "+" : ""}{fmt.gbp(deal.estimated_margin_gbp)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>{fmt.miles(deal.mileage)}</span>
          {deal.distance_miles != null && (
            <span>{deal.distance_miles} mi away</span>
          )}
          {deal.colour && <span className="truncate">{deal.colour}</span>}
        </div>

        <div className="flex justify-end pt-0.5" onClick={(e) => e.stopPropagation()}>
          <ReportButton listingId={deal.id} />
        </div>
      </div>
    </div>
  );
}

interface Props {
  data: Deal[];
  isLoading: boolean;
  bookmarked?: Set<number>;
  hidden?: Set<number>;
  onBookmark?: (id: number) => void;
  onHide?: (id: number) => void;
  sortBy?: string;
  onSortChange?: (s: string) => void;
}

const SORT_OPTIONS = [
  { value: "score", label: "Score" },
  { value: "price_asc", label: "Price: low → high" },
  { value: "price_desc", label: "Price: high → low" },
  { value: "margin", label: "Margin" },
  { value: "mileage", label: "Mileage" },
  { value: "year", label: "Newest first" },
];

export default function DealsGrid({
  data,
  isLoading,
  bookmarked = new Set(),
  hidden = new Set(),
  onBookmark = () => {},
  onHide = () => {},
  sortBy = "score",
  onSortChange,
}: Props) {
  const [selected, setSelected] = useState<Deal | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="bg-gray-100 rounded-xl aspect-[4/5] animate-pulse" />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="text-center py-20 text-gray-400 text-sm">
        No deals found. Try adjusting your filters or wait for the next scrape.
      </div>
    );
  }

  return (
    <>
      {/* Sort bar */}
      {onSortChange && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Sort by</span>
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onSortChange(opt.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                sortBy === opt.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            isBookmarked={bookmarked.has(deal.id)}
            isHidden={hidden.has(deal.id)}
            onBookmark={onBookmark}
            onHide={onHide}
            onClick={() => setSelected(deal)}
          />
        ))}
      </div>

      {selected && <DealModal deal={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
