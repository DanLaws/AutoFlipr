import { useState } from "react";
import type { Deal } from "../api/client";
import DealModal from "./DealModal";
import ScoreBadge from "./ScoreBadge";
import ReportButton from "./ReportButton";

const fmt = {
  gbp:   (v: number | null) => v != null ? `£${v.toLocaleString("en-GB")}` : "—",
  miles: (v: number | null) => v != null ? `${v.toLocaleString("en-GB")} mi` : "—",
};

// ── CardProps ─────────────────────────────────────────────────────────────────

interface CardProps {
  deal: Deal;
  isBookmarked: boolean;
  isHidden: boolean;
  isComparing: boolean;
  compareDisabled: boolean;
  onBookmark: (id: number) => void;
  onHide: (id: number) => void;
  onCompare: (id: number) => void;
  onClick: () => void;
}

// ── DealCard ──────────────────────────────────────────────────────────────────

function DealCard({
  deal, isBookmarked, isHidden, isComparing, compareDisabled,
  onBookmark, onHide, onCompare, onClick,
}: CardProps) {
  const thumb = deal.image_urls?.[0]?.replace("/w1400/", "/w384/") ?? null;
  const title = [deal.make, deal.model].filter(Boolean).join(" ") || "Unknown";
  const marginPos = (deal.estimated_margin_gbp ?? 0) > 0;

  return (
    <article
      onClick={onClick}
      className={`group card-hover overflow-hidden ${isComparing ? "ring-2 ring-info-text ring-offset-1" : ""}`}
    >
      {/* ── Thumbnail ── */}
      <div className="relative overflow-hidden" style={{ aspectRatio: "16 / 10" }}>
        {thumb ? (
          <img
            src={thumb} alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="w-full h-full bg-surface-subtle flex items-center justify-center">
            <svg className="w-10 h-10 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Score badge — top left */}
        <div className="absolute top-2.5 left-2.5">
          <ScoreBadge score={deal.score} confidence={deal.confidence} size={42} />
        </div>

        {/* Action buttons — top right, revealed on hover */}
        <div
          className={`absolute top-2 right-2 flex gap-1 transition-opacity duration-150 ${
            isBookmarked || isComparing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Bookmark */}
          <button
            onClick={() => onBookmark(deal.id)}
            title={isBookmarked ? "Remove from watchlist" : "Add to watchlist"}
            className={`w-7 h-7 flex items-center justify-center rounded-lg shadow-md transition-colors ${
              isBookmarked
                ? "bg-warning-strong text-white"
                : "bg-white/90 dark:bg-gray-800/90 text-text-secondary hover:text-warning-strong"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
            </svg>
          </button>

          {/* Hide */}
          <button
            onClick={() => onHide(deal.id)}
            title="Hide from feed"
            className="w-7 h-7 flex items-center justify-center rounded-lg shadow-md bg-white/90 dark:bg-gray-800/90 text-text-secondary hover:text-text-primary transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Compare */}
          <button
            onClick={() => onCompare(deal.id)}
            title={isComparing ? "Remove from comparison" : compareDisabled ? "Already comparing 2 deals" : "Compare"}
            disabled={compareDisabled && !isComparing}
            className={`w-7 h-7 flex items-center justify-center rounded-lg shadow-md transition-colors ${
              isComparing
                ? "bg-info-text text-white"
                : compareDisabled
                ? "bg-white/90 dark:bg-gray-800/90 text-text-faint cursor-not-allowed"
                : "bg-white/90 dark:bg-gray-800/90 text-text-secondary hover:text-info-text"
            }`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>

        {/* Seller pill — bottom right */}
        {deal.seller_type && (
          <div className="absolute bottom-2 right-2">
            <span className={`badge ${deal.seller_type === "private" ? "badge-private" : "badge-trade"}`}>
              {deal.seller_type}
            </span>
          </div>
        )}

        {/* Source — bottom left, mono caps */}
        {deal.source && (
          <div className="absolute bottom-2 left-2">
            <span
              className="font-mono text-[9px] font-semibold uppercase tracking-widest text-white/90 px-2 py-1 rounded"
              style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
            >
              {deal.source}
            </span>
          </div>
        )}
      </div>

      {/* ── Card body ── */}
      <div className="p-3.5 space-y-2">
        {/* Year + title */}
        <div>
          <div className="flex items-baseline gap-1.5">
            {deal.year && (
              <span className="font-mono text-[11px] font-semibold text-text-muted">{deal.year}</span>
            )}
            <h3 className="text-sm font-semibold text-text-primary truncate leading-tight">{title}</h3>
          </div>
          {deal.variant && (
            <p className="text-xs text-text-muted truncate mt-0.5">{deal.variant}</p>
          )}
        </div>

        {/* Price + margin */}
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-mono text-lg font-bold tracking-tight text-text-primary leading-none">
            {fmt.gbp(deal.price_gbp)}
          </span>
          {deal.estimated_margin_gbp != null && (
            <span className={`font-mono text-xs font-bold ${marginPos ? "text-success-strong" : "text-danger-strong"}`}>
              {marginPos ? "+" : "−"}£{Math.abs(deal.estimated_margin_gbp).toLocaleString("en-GB")}
            </span>
          )}
        </div>

        {/* Mileage + colour */}
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span className="font-mono">{fmt.miles(deal.mileage)}</span>
          {deal.colour && (
            <>
              <span className="text-text-faint">·</span>
              <span className="truncate">{deal.colour}</span>
            </>
          )}
        </div>

        {/* Location */}
        {(deal.location || deal.distance_miles != null) && (
          <div className="text-xs text-text-muted truncate">
            {deal.location}
            {deal.distance_miles != null && (
              <span className="font-mono text-text-faint ml-1">({deal.distance_miles} mi)</span>
            )}
          </div>
        )}

        {/* Report button */}
        <div className="flex justify-end pt-0.5" onClick={(e) => e.stopPropagation()}>
          <ReportButton listingId={deal.id} onHide={onHide} />
        </div>
      </div>
    </article>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  data: Deal[];
  isLoading: boolean;
  bookmarked?: Set<number>;
  hidden?: Set<number>;
  comparing?: Set<number>;
  onBookmark?: (id: number) => void;
  onHide?: (id: number) => void;
  onCompare?: (id: number) => void;
  sortBy?: string;
  onSortChange?: (s: string) => void;
  homePostcode?: string;
}

const SORT_OPTIONS = [
  { value: "score",      label: "Score",          requiresPostcode: false },
  { value: "price_asc",  label: "Price ↑",        requiresPostcode: false },
  { value: "price_desc", label: "Price ↓",        requiresPostcode: false },
  { value: "margin",     label: "Margin",         requiresPostcode: false },
  { value: "mileage",    label: "Mileage",        requiresPostcode: false },
  { value: "year",       label: "Newest",         requiresPostcode: false },
  { value: "distance",   label: "Nearest first",  requiresPostcode: true },
];

// ── DealsGrid ─────────────────────────────────────────────────────────────────

export default function DealsGrid({
  data,
  isLoading,
  bookmarked  = new Set(),
  hidden      = new Set(),
  comparing   = new Set(),
  onBookmark  = () => {},
  onHide      = () => {},
  onCompare   = () => {},
  sortBy      = "score",
  onSortChange,
  homePostcode,
}: Props) {
  const [selected, setSelected] = useState<Deal | null>(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ aspectRatio: "4/5" }} />
        ))}
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="card flex flex-col items-center justify-center py-20 text-center gap-3">
        <svg className="w-12 h-12 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 7h18M6 12h12M10 18h4" />
        </svg>
        <p className="text-sm font-semibold text-text-primary">No deals match your filters</p>
        <p className="text-xs text-text-muted max-w-xs">Try widening your price range or removing source restrictions.</p>
      </div>
    );
  }

  return (
    <>
      {/* Sort bar */}
      {onSortChange && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="label-caps mr-1">Sort</span>
          {SORT_OPTIONS.map((opt) => {
            const disabled = opt.requiresPostcode && !homePostcode;
            const active   = sortBy === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => !disabled && onSortChange(opt.value)}
                disabled={disabled}
                title={disabled ? "Set a home postcode in Settings to sort by distance" : undefined}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  disabled
                    ? "border-border-default text-text-faint bg-surface cursor-not-allowed opacity-40"
                    : active
                    ? "border-text-primary bg-text-primary text-brand-fg"
                    : "border-border-default bg-surface text-text-secondary hover:border-border-strong hover:text-text-primary"
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
        {data.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            isBookmarked={bookmarked.has(deal.id)}
            isHidden={hidden.has(deal.id)}
            isComparing={comparing.has(deal.id)}
            compareDisabled={comparing.size >= 2 && !comparing.has(deal.id)}
            onBookmark={onBookmark}
            onHide={onHide}
            onCompare={onCompare}
            onClick={() => setSelected(deal)}
          />
        ))}
      </div>

      {selected && <DealModal deal={selected} onClose={() => setSelected(null)} onHide={onHide} />}
    </>
  );
}
