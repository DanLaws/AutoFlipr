import { Fragment, useEffect, useState, useRef } from "react";
import type { Deal } from "../api/client";
import { decodeEntities } from "../utils/decodeEntities";
import { apiPost } from "../api/client";
import ScoreBadge from "./ScoreBadge";
import ReportButton from "./ReportButton";
import FlipModal from "./FlipModal";
import { useSettings } from "../hooks/useSettings";
import { calcCostBreakdown } from "../utils/costBreakdown";
import { useWatchlistContext } from "../contexts/WatchlistContext";
import { fmt } from "../utils/formatters";

interface Props {
  deal: Deal;
  onClose: () => void;
  onHide?: (id: number) => void;
}

function useCostBreakdown(deal: Deal) {
  const { settings: s } = useSettings();
  if (deal.price_gbp == null) return null;
  return calcCostBreakdown(
    {
      priceGbp: deal.price_gbp,
      estimatedValueGbp: deal.estimated_value_gbp ?? null,
      roadTaxAnnual: s.roadTaxAnnual,
      motFee: s.motFee,
      repairBufferMode: s.repairBufferMode,
      repairBufferValue: s.repairBufferValue,
      sellingPlatformFeePct: s.sellingPlatformFeePct,
      mpg: s.mpg,
      fuelPricePerLitre: s.fuelPricePerLitre,
    },
    deal.estimated_margin_gbp ?? 0,
  );
}

// ── Photo carousel ───────────────────────────────────────────────────────────

function PhotoCarousel({ thumbs, title, onClose }: { thumbs: string[]; title: string; onClose: () => void }) {
  const [active, setActive] = useState(0);
  const stripRef = useRef<HTMLDivElement>(null);

  // Keyboard left/right
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft")  setActive(i => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setActive(i => Math.min(thumbs.length - 1, i + 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [thumbs.length]);

  // Scroll active thumbnail into view
  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const thumb = strip.children[active] as HTMLElement | undefined;
    thumb?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [active]);

  const prev = () => setActive(i => Math.max(0, i - 1));
  const next = () => setActive(i => Math.min(thumbs.length - 1, i + 1));

  return (
    <>
      {/* Main image */}
      <div className="relative bg-surface-subtle" style={{ aspectRatio: "16 / 9" }}>
        {thumbs.length > 0 ? (
          <img
            key={active}
            src={thumbs[active].replace("/w1400/", "/w880/")}
            alt={title}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-16 h-16 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Prev arrow */}
        {thumbs.length > 1 && active > 0 && (
          <button
            onClick={prev}
            aria-label="Previous image"
            className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-opacity hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        )}

        {/* Next arrow */}
        {thumbs.length > 1 && active < thumbs.length - 1 && (
          <button
            onClick={next}
            aria-label="Next image"
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-opacity hover:opacity-80"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        )}

        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-xl text-white transition-opacity hover:opacity-80"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)" }}
        >
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Counter pill — bottom left */}
        {thumbs.length > 1 && (
          <div
            className="absolute bottom-3 left-3 font-mono text-[11px] font-semibold text-white px-2 py-1 rounded-lg"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
          >
            {active + 1} / {thumbs.length}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {thumbs.length > 1 && (
        <div
          ref={stripRef}
          className="flex gap-2 overflow-x-auto px-4 py-2.5 bg-surface border-b border-border-default"
          style={{ scrollbarWidth: "none" }}
        >
          {thumbs.map((url, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
              style={{
                width: 72, height: 48,
                outline: i === active ? "2px solid var(--color-text-primary)" : "2px solid transparent",
                outlineOffset: 2,
                opacity: i === active ? 1 : 0.55,
              }}
            >
              <img
                src={url.replace("/w1400/", "/w200/")}
                alt={`${title} — photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </>
  );
}

// ── Deal modal ────────────────────────────────────────────────────────────────

export default function DealModal({ deal, onClose, onHide }: Props) {
  const [logFlip, setLogFlip] = useState(false);
  const [flipLogged, setFlipLogged] = useState(false);
  const { removeBookmark, addHidden } = useWatchlistContext();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const title    = [deal.year, deal.make, deal.model, deal.variant].filter(Boolean).join(" ") || "Unknown";
  const subtitle = [deal.colour, deal.body_type].filter(Boolean).join(" · ");
  const thumbs   = (deal.image_urls ?? []).slice(0, 8);
  const marginPos = (deal.estimated_margin_gbp ?? 0) > 0;
  const priceHistory = deal.price_history ?? [];
  const hasPriceHistory = priceHistory.length > 1;
  const marketDev = deal.price_deviation_pct;
  const costs = useCostBreakdown(deal);

  const dontExceed = deal.estimated_value_gbp != null && deal.price_gbp != null
    ? Math.min(deal.estimated_value_gbp, deal.price_gbp)
    : deal.estimated_value_gbp;
  const openWith = deal.price_gbp != null ? Math.round(deal.price_gbp * 0.88) : null;

  return (
    <Fragment>
      {/* Backdrop — starts below the sticky nav (top-[60px]) so it never covers it */}
      <div
        className="fixed inset-x-0 bottom-0 top-[60px] z-30 bg-black/50"
        style={{ backdropFilter: "blur(4px)" }}
        onClick={onClose}
      />

      {/* Modal scroll container — same offset, z just above backdrop */}
      <div
        className="fixed inset-x-0 bottom-0 top-[60px] z-35 flex items-start justify-center overflow-y-auto py-10 px-4"
        onClick={onClose}
      >
        <div
          className="relative w-full bg-surface-raised rounded-2xl overflow-hidden"
          style={{ maxWidth: 880, boxShadow: "var(--shadow-lg)" }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Photo carousel ── */}
          <PhotoCarousel thumbs={thumbs} title={title} onClose={onClose} />

          {/* ── Body ── */}
          <div className="p-8 space-y-6">

            {/* Header row */}
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="label-caps font-mono mb-1.5">
                  {deal.source} {deal.registration ? `· ${deal.registration}` : ""}
                </div>
                <h2 className="text-2xl font-bold text-text-primary tracking-tight leading-tight">{title}</h2>
                {subtitle && <p className="text-sm text-text-muted mt-1">{subtitle}</p>}
              </div>
              <div className="flex items-center gap-5 shrink-0">
                <ScoreBadge score={deal.score} confidence={deal.confidence} size={64} />
                <div>
                  <div className="label-caps mb-1">Est. margin</div>
                  <div className={`font-mono text-2xl font-bold tracking-tight ${marginPos ? "text-success-strong" : "text-danger-strong"}`}>
                    {deal.estimated_margin_gbp != null ? fmt.signed(deal.estimated_margin_gbp) : "—"}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Pricing 3-column grid ── */}
            <div
              className="rounded-xl overflow-hidden border border-border-default"
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--color-border)" }}
            >
              {[
                { label: "Asking",       value: fmt.gbp(deal.price_gbp),            tone: null },
                { label: "Market value", value: fmt.gbp(deal.estimated_value_gbp),  tone: null },
                {
                  label: "vs Market",
                  value: marketDev != null ? `${marketDev > 0 ? "+" : ""}${marketDev.toFixed(1)}%` : "—",
                  tone: marketDev != null ? (marketDev < 0 ? "success" : "danger") : null,
                },
              ].map(({ label, value, tone }) => (
                <div key={label} className="bg-surface px-4 py-4">
                  <div className="label-caps mb-1.5">{label}</div>
                  <div className={`font-mono text-[22px] font-bold tracking-tight leading-none ${
                    tone === "success" ? "text-success-strong"
                    : tone === "danger" ? "text-danger-strong"
                    : "text-text-primary"
                  }`}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* ── Negotiation assistant — info blue panel ── */}
            {(dontExceed != null || openWith != null) && (
              <div className="rounded-xl border border-info-border bg-info-bg p-5">
                <div className="label-caps text-info-text mb-3">Negotiation assistant</div>
                <div className="grid grid-cols-2 gap-5">
                  <div>
                    <div className="text-sm text-info-text/80 mb-1">Open with</div>
                    <div className="font-mono text-2xl font-bold text-info-text">
                      {openWith != null ? fmt.gbp(openWith) : "—"}
                    </div>
                    <div className="text-xs text-info-text/60 mt-1">~12% below asking</div>
                  </div>
                  <div>
                    <div className="text-sm text-info-text/80 mb-1">Don't exceed</div>
                    <div className="font-mono text-2xl font-bold text-info-text">
                      {dontExceed != null ? fmt.gbp(dontExceed) : "—"}
                    </div>
                    <div className="text-xs text-info-text/60 mt-1">Pay more and margin disappears</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── Cost breakdown — dashed rows ── */}
            {costs && (
              <div className="card p-5">
                <div className="label-caps mb-4">Cost breakdown</div>
                <div className="space-y-0">
                  {costs.lines.map((line) => (
                    <div
                      key={line.label}
                      className="flex items-center justify-between py-2.5"
                      style={{ borderBottom: "1px dashed var(--color-border-faint)" }}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-secondary">{line.label}</span>
                        {line.note && <span className="text-xs text-text-faint">({line.note})</span>}
                      </div>
                      <span className="font-mono text-sm font-semibold text-danger-strong">
                        −£{line.value.toLocaleString("en-GB")}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2.5 border-b border-border-default">
                    <span className="text-sm text-text-muted font-medium">Total costs</span>
                    <span className="font-mono text-sm font-semibold text-danger-strong">
                      −£{Math.round(costs.totalCosts).toLocaleString("en-GB")}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-3.5">
                    <span className="text-sm font-semibold text-text-primary">Net profit</span>
                    <span className={`font-mono text-lg font-bold ${costs.netProfit > 0 ? "text-success-strong" : "text-danger-strong"}`}>
                      {fmt.signed(costs.netProfit)}
                    </span>
                  </div>
                </div>
                {costs.lines.length === 2 && (
                  <p className="text-xs text-text-faint mt-3">
                    Set repair buffer and selling fee in <span className="font-medium text-text-muted">Settings → Cost Assumptions</span> for a fuller estimate.
                  </p>
                )}
              </div>
            )}

            {/* ── Price history ── */}
            {hasPriceHistory && (
              <div className="card p-5">
                <div className="label-caps mb-3">Price history</div>
                <div className="space-y-2">
                  {priceHistory.map((entry, i) => {
                    const prev  = priceHistory[i - 1];
                    const delta = prev ? entry.price_gbp - prev.price_gbp : null;
                    const isCurrent = i === priceHistory.length - 1;
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="font-mono text-xs text-text-faint">
                          {new Date(entry.recorded_at).toLocaleDateString("en-GB")}
                        </span>
                        <div className="flex items-center gap-2">
                          {delta != null && (
                            <span className={`text-xs font-semibold font-mono ${delta < 0 ? "text-success-strong" : "text-danger-strong"}`}>
                              {delta < 0 ? "▼" : "▲"} £{Math.abs(delta).toLocaleString("en-GB")}
                            </span>
                          )}
                          <span className={`font-mono font-semibold ${isCurrent ? "text-text-primary" : "text-text-faint line-through"}`}>
                            {fmt.gbp(entry.price_gbp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── MOT summary ── */}
            {deal.mot_narrative && (
              <div className="card p-5">
                <div className="label-caps mb-2">MOT summary</div>
                <p className="text-sm text-text-secondary leading-relaxed">{decodeEntities(deal.mot_narrative)}</p>
              </div>
            )}

            {/* ── AI Analysis ── */}
            {deal.analysis_narrative && (
              <div className="card p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="label-caps">AI analysis · risk</div>
                  {deal.risk_score != null && (
                    <span className={`font-mono text-xs font-semibold ${
                      deal.risk_score <= 33 ? "text-success-strong"
                      : deal.risk_score <= 66 ? "text-warning-strong"
                      : "text-danger-strong"
                    }`}>
                      {deal.risk_score <= 33 ? "LOW" : deal.risk_score <= 66 ? "MEDIUM" : "HIGH"} · {deal.risk_score}/100
                    </span>
                  )}
                </div>

                {deal.risk_score != null && (
                  <div className="h-2 bg-surface-subtle rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        deal.risk_score <= 33 ? "bg-success-strong"
                        : deal.risk_score <= 66 ? "bg-warning-strong"
                        : "bg-danger-strong"
                      }`}
                      style={{ width: `${deal.risk_score}%` }}
                    />
                  </div>
                )}

                <p className="text-sm text-text-secondary leading-relaxed">{decodeEntities(deal.analysis_narrative)}</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Positives */}
                  {deal.positives && deal.positives.length > 0 && (
                    <div>
                      <div className="label-caps text-success-strong mb-2">Positives</div>
                      <ul className="space-y-1.5">
                        {deal.positives.map((p, i) => (
                          <li key={i} className="flex gap-2 text-sm text-text-secondary">
                            <svg className="w-3.5 h-3.5 text-success-strong mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
                            </svg>
                            {decodeEntities(p)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Red flags */}
                  {deal.red_flags && deal.red_flags.length > 0 && (
                    <div>
                      <div className="label-caps text-warning-strong mb-2">Watch for</div>
                      <ul className="space-y-1.5">
                        {deal.red_flags.map((f, i) => (
                          <li key={i} className="flex gap-2 text-sm text-text-secondary">
                            <span className="text-warning-strong mt-0.5 shrink-0 text-xs">⚠</span>
                            {decodeEntities(f)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Condition notes */}
                {deal.condition_notes && deal.condition_notes.length > 0 && (
                  <div>
                    <div className="label-caps mb-2">Condition notes</div>
                    <ul className="space-y-1">
                      {deal.condition_notes.map((n, i) => (
                        <li key={i} className="text-sm text-text-secondary flex gap-2">
                          <span className="text-text-faint mt-0.5">·</span>{decodeEntities(n)}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Urgency tags ── */}
            {deal.urgency_tags && deal.urgency_tags.length > 0 && (
              <div className="rounded-xl border border-warning-border bg-warning-bg p-4">
                <div className="label-caps text-warning-strong mb-2">Flags</div>
                <div className="flex flex-wrap gap-2">
                  {deal.urgency_tags.map((tag) => (
                    <span key={tag} className="text-xs font-medium bg-warning-border/40 text-warning-text px-2.5 py-1 rounded-full">
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* ── Vehicle details — 2-col grid ── */}
            <div className="card overflow-hidden">
              <div
                style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}
              >
                {[
                  deal.registration ? ["Registration", <span className="font-mono">{deal.registration}</span>] : null,
                  deal.mileage != null ? ["Mileage", <span className="font-mono">{fmt.miles(deal.mileage)}</span>] : null,
                  deal.colour ? ["Colour", deal.colour] : null,
                  deal.body_type ? ["Body type", deal.body_type] : null,
                  deal.seller_type ? ["Seller type", <span className="capitalize">{deal.seller_type}</span>] : null,
                  deal.seller_name ? ["Seller", deal.seller_name] : null,
                  deal.location ? ["Location", deal.distance_miles != null ? `${deal.location} · ${deal.distance_miles} mi away` : deal.location] : null,
                  deal.source ? ["Source", deal.source] : null,
                ]
                  .filter(Boolean)
                  .map((row, i, arr) => {
                    const [k, v] = row as [string, React.ReactNode];
                    return (
                    <div
                      key={String(k)}
                      className="flex items-center justify-between px-4 py-3"
                      style={{
                        borderBottom: i < arr.length - 2 ? "1px solid var(--color-border-faint)" : "none",
                        borderRight: i % 2 === 0 ? "1px solid var(--color-border-faint)" : "none",
                      }}
                    >
                      <span className="text-sm text-text-muted">{k}</span>
                      <span className="text-sm font-semibold text-text-primary">{v}</span>
                    </div>
                  );
                  })}
              </div>
            </div>

          </div>

          {/* ── Footer CTAs ── */}
          <div className="px-8 pb-8 flex gap-3 items-center flex-wrap">
            <a
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-primary btn-lg flex-1"
              style={{ minWidth: 200 }}
            >
              View on {deal.source === "autotrader" ? "AutoTrader" : deal.source}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 17L17 7M7 7h10v10" />
              </svg>
            </a>
            <button
              onClick={() => setLogFlip(true)}
              className="btn btn-ghost btn-lg"
              title="Log this car as a flip in Flipfolio"
            >
              {flipLogged ? "✓ Logged" : "Log flip"}
            </button>
            <ReportButton listingId={deal.id} onHide={(id) => { onHide?.(id); onClose(); }} />
          </div>

        </div>
      </div>

      {logFlip && (
        <FlipModal
          initial={{
            make: deal.make ?? "",
            model: deal.model ?? "",
            year: deal.year ?? null,
            mileage: deal.mileage ?? null,
            purchase_price: deal.price_gbp ?? 0,
            sale_price: null,
            additional_costs: 0,
            date_bought: new Date().toISOString().slice(0, 10),
            date_sold: null,
            source: deal.source ?? null,
            notes: null,
          }}
          onClose={() => setLogFlip(false)}
          onSave={async (data) => {
            await apiPost("/api/flipfolio", data);
            setFlipLogged(true);
            removeBookmark(deal.id);
            addHidden(deal.id);
          }}
        />
      )}
    </Fragment>
  );
}
