import { Fragment, useEffect } from "react";
import type { Deal } from "../api/client";
import { decodeEntities } from "../utils/decodeEntities";
import { fmt } from "../utils/formatters";

interface Props {
  deals: [Deal, Deal];
  onClose: () => void;
}

type Winner = 0 | 1 | 2;

function winner(a: number | null, b: number | null, higherIsBetter: boolean): Winner {
  if (a == null || b == null) return 0;
  if (a === b) return 0;
  return higherIsBetter ? (a > b ? 1 : 2) : (a < b ? 1 : 2);
}

function scoreColor(score: number | null): string {
  if (score == null) return "text-text-faint";
  if (score >= 70) return "text-success-strong";
  if (score >= 50) return "text-warning-strong";
  return "text-danger-strong";
}

function riskColor(risk: number | null): string {
  if (risk == null) return "text-text-faint";
  if (risk <= 33) return "text-success-strong";
  if (risk <= 66) return "text-warning-strong";
  return "text-danger-strong";
}

function riskLabel(risk: number | null): string {
  if (risk == null) return "—";
  if (risk <= 33) return `Low (${risk})`;
  if (risk <= 66) return `Medium (${risk})`;
  return `High (${risk})`;
}

function StatRow({ label, leftValue, rightValue, leftIsWinner, rightIsWinner }: {
  label: string;
  leftValue: React.ReactNode;
  rightValue: React.ReactNode;
  leftIsWinner?: boolean;
  rightIsWinner?: boolean;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-2.5 border-b border-border-faint last:border-0">
      <div className={`text-sm font-semibold text-right pr-2 ${leftIsWinner ? "text-success-strong" : "text-text-primary"}`}>
        {leftIsWinner && <span className="text-success-strong mr-1 text-xs">✓</span>}
        {leftValue}
      </div>
      <div className="label-caps text-center whitespace-nowrap px-2 min-w-[100px]">{label}</div>
      <div className={`text-sm font-semibold pl-2 ${rightIsWinner ? "text-success-strong" : "text-text-primary"}`}>
        {rightValue}
        {rightIsWinner && <span className="text-success-strong ml-1 text-xs">✓</span>}
      </div>
    </div>
  );
}

function TagList({ items, variant }: { items: string[] | null; variant: "danger" | "success" | "muted" }) {
  if (!items || items.length === 0) return <span className="text-xs text-text-faint">None</span>;
  const cls =
    variant === "danger"  ? "bg-danger-bg text-danger-strong border border-danger-border" :
    variant === "success" ? "bg-success-bg text-success-text border border-success-border" :
                            "bg-surface-subtle text-text-secondary";
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className={`text-xs px-2 py-1 rounded-md ${cls}`}>{decodeEntities(item)}</li>
      ))}
    </ul>
  );
}

export default function CompareModal({ deals, onClose }: Props) {
  const [a, b] = deals;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const titleA = [a.year, a.make, a.model, a.variant].filter(Boolean).join(" ") || "Unknown";
  const titleB = [b.year, b.make, b.model, b.variant].filter(Boolean).join(" ") || "Unknown";
  const thumbA = a.image_urls?.[0]?.replace("/w1400/", "/w384/") ?? null;
  const thumbB = b.image_urls?.[0]?.replace("/w1400/", "/w384/") ?? null;

  const w = {
    score:    winner(a.score,                b.score,                true),
    price:    winner(a.price_gbp,            b.price_gbp,            false),
    margin:   winner(a.estimated_margin_gbp, b.estimated_margin_gbp, true),
    dev:      winner(a.price_deviation_pct,  b.price_deviation_pct,  false),
    mileage:  winner(a.mileage,              b.mileage,              false),
    year:     winner(a.year,                 b.year,                 true),
    risk:     winner(a.risk_score,           b.risk_score,           false),
    distance: winner(a.distance_miles,       b.distance_miles,       false),
  };

  const winsA = Object.values(w).filter((v) => v === 1).length;
  const winsB = Object.values(w).filter((v) => v === 2).length;

  return (
    <Fragment>
      <div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pointer-events-none">
        <div className="card w-full max-w-4xl pointer-events-auto my-6 overflow-hidden">

          {/* Header */}
          <div
            className="flex items-center justify-between px-6 py-4 border-b border-border-default sticky top-0 z-10 rounded-t-xl"
            style={{ background: "var(--color-surface)" }}
          >
            <h2 className="text-base font-bold text-text-primary">Compare deals</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6">

            {/* Car header cards */}
            <div className="grid grid-cols-2 gap-4">
              {([
                { deal: a, thumb: thumbA, title: titleA, wins: winsA, other: winsB },
                { deal: b, thumb: thumbB, title: titleB, wins: winsB, other: winsA },
              ] as const).map(({ deal, thumb, title, wins, other }) => (
                <div
                  key={deal.id}
                  className="rounded-xl border overflow-hidden"
                  style={{
                    borderColor: wins > other ? "var(--color-success-strong)" : "var(--color-border-default)",
                    boxShadow: wins > other ? "0 0 0 1px var(--color-success-border)" : undefined,
                  }}
                >
                  {thumb ? (
                    <img src={thumb} alt={title} className="w-full h-36 object-cover" />
                  ) : (
                    <div className="w-full h-36 bg-surface-subtle flex items-center justify-center">
                      <svg className="w-10 h-10 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  <div className="p-3">
                    <p className="text-sm font-bold text-text-primary leading-tight truncate">{title}</p>
                    {deal.variant && <p className="text-xs text-text-muted truncate mt-0.5">{deal.variant}</p>}
                    <div className="flex items-center justify-between mt-2">
                      <span className="font-mono text-base font-bold text-text-primary">{fmt.gbp(deal.price_gbp)}</span>
                      {wins > other && (
                        <span className="badge badge-score-high">Better deal</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Stats table */}
            <div className="card p-4">
              <p className="label-caps mb-3">Key Stats</p>

              <StatRow label="Deal Score"
                leftValue={<span className={scoreColor(a.score)}>{a.score != null ? Math.round(a.score) : "—"}</span>}
                rightValue={<span className={scoreColor(b.score)}>{b.score != null ? Math.round(b.score) : "—"}</span>}
                leftIsWinner={w.score === 1} rightIsWinner={w.score === 2} />

              <StatRow label="Asking Price"
                leftValue={<span className="font-mono">{fmt.gbp(a.price_gbp)}</span>}
                rightValue={<span className="font-mono">{fmt.gbp(b.price_gbp)}</span>}
                leftIsWinner={w.price === 1} rightIsWinner={w.price === 2} />

              <StatRow label="Est. Market Value"
                leftValue={<span className="font-mono">{fmt.gbp(a.estimated_value_gbp)}</span>}
                rightValue={<span className="font-mono">{fmt.gbp(b.estimated_value_gbp)}</span>} />

              <StatRow label="Est. Margin"
                leftValue={<span className={`font-mono ${(a.estimated_margin_gbp ?? 0) >= 0 ? "text-success-strong" : "text-danger-strong"}`}>
                  {a.estimated_margin_gbp != null ? `${a.estimated_margin_gbp > 0 ? "+" : ""}${fmt.gbp(a.estimated_margin_gbp)}` : "—"}
                </span>}
                rightValue={<span className={`font-mono ${(b.estimated_margin_gbp ?? 0) >= 0 ? "text-success-strong" : "text-danger-strong"}`}>
                  {b.estimated_margin_gbp != null ? `${b.estimated_margin_gbp > 0 ? "+" : ""}${fmt.gbp(b.estimated_margin_gbp)}` : "—"}
                </span>}
                leftIsWinner={w.margin === 1} rightIsWinner={w.margin === 2} />

              <StatRow label="vs Market"
                leftValue={<span className={`font-mono ${a.price_deviation_pct == null ? "text-text-faint" : a.price_deviation_pct < 0 ? "text-success-strong" : "text-danger-strong"}`}>{fmt.pct(a.price_deviation_pct)}</span>}
                rightValue={<span className={`font-mono ${b.price_deviation_pct == null ? "text-text-faint" : b.price_deviation_pct < 0 ? "text-success-strong" : "text-danger-strong"}`}>{fmt.pct(b.price_deviation_pct)}</span>}
                leftIsWinner={w.dev === 1} rightIsWinner={w.dev === 2} />

              <StatRow label="Mileage"
                leftValue={<span className="font-mono">{fmt.miles(a.mileage)}</span>}
                rightValue={<span className="font-mono">{fmt.miles(b.mileage)}</span>}
                leftIsWinner={w.mileage === 1} rightIsWinner={w.mileage === 2} />

              <StatRow label="Year"
                leftValue={<span className="font-mono">{a.year ?? "—"}</span>}
                rightValue={<span className="font-mono">{b.year ?? "—"}</span>}
                leftIsWinner={w.year === 1} rightIsWinner={w.year === 2} />

              <StatRow label="Listing Risk"
                leftValue={<span className={riskColor(a.risk_score)}>{riskLabel(a.risk_score)}</span>}
                rightValue={<span className={riskColor(b.risk_score)}>{riskLabel(b.risk_score)}</span>}
                leftIsWinner={w.risk === 1} rightIsWinner={w.risk === 2} />

              <StatRow label="Comparables"
                leftValue={<span className="font-mono">{a.comparable_count ?? "—"}</span>}
                rightValue={<span className="font-mono">{b.comparable_count ?? "—"}</span>} />

              {(a.distance_miles != null || b.distance_miles != null) && (
                <StatRow label="Distance"
                  leftValue={<span className="font-mono">{a.distance_miles != null ? `${a.distance_miles} mi` : "—"}</span>}
                  rightValue={<span className="font-mono">{b.distance_miles != null ? `${b.distance_miles} mi` : "—"}</span>}
                  leftIsWinner={w.distance === 1} rightIsWinner={w.distance === 2} />
              )}

              <StatRow label="Seller type"
                leftValue={<span className={`capitalize ${a.seller_type === "private" ? "text-info-text" : "text-text-primary"}`}>{a.seller_type ?? "—"}</span>}
                rightValue={<span className={`capitalize ${b.seller_type === "private" ? "text-info-text" : "text-text-primary"}`}>{b.seller_type ?? "—"}</span>} />
            </div>

            {/* Red flags + positives */}
            <div className="grid grid-cols-2 gap-4">
              <div className="card p-4 space-y-3">
                <p className="label-caps text-danger-strong">Red Flags</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-text-faint mb-1 font-medium truncate">{titleA.split(" ").slice(0, 3).join(" ")}</p>
                    <TagList items={a.red_flags} variant="danger" />
                  </div>
                  <div>
                    <p className="text-[10px] text-text-faint mb-1 font-medium truncate">{titleB.split(" ").slice(0, 3).join(" ")}</p>
                    <TagList items={b.red_flags} variant="danger" />
                  </div>
                </div>
              </div>
              <div className="card p-4 space-y-3">
                <p className="label-caps text-success-strong">Positives</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] text-text-faint mb-1 font-medium truncate">{titleA.split(" ").slice(0, 3).join(" ")}</p>
                    <TagList items={a.positives} variant="success" />
                  </div>
                  <div>
                    <p className="text-[10px] text-text-faint mb-1 font-medium truncate">{titleB.split(" ").slice(0, 3).join(" ")}</p>
                    <TagList items={b.positives} variant="success" />
                  </div>
                </div>
              </div>
            </div>

            {/* Verdict */}
            <div className={`rounded-xl p-4 border text-sm font-medium text-center ${
              winsA !== winsB
                ? "bg-success-bg border-success-border text-success-text"
                : "bg-surface-subtle border-border-default text-text-muted"
            }`}>
              {winsA === winsB ? (
                "These deals are evenly matched — it comes down to preference."
              ) : winsA > winsB ? (
                <><span className="font-bold">{titleA}</span> wins on {winsA} of {winsA + winsB} comparable stats.</>
              ) : (
                <><span className="font-bold">{titleB}</span> wins on {winsB} of {winsA + winsB} comparable stats.</>
              )}
            </div>

            {/* View links */}
            <div className="grid grid-cols-2 gap-3">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg text-center">
                View {titleA.split(" ").slice(0, 2).join(" ")} →
              </a>
              <a href={b.url} target="_blank" rel="noopener noreferrer" className="btn btn-primary btn-lg text-center">
                View {titleB.split(" ").slice(0, 2).join(" ")} →
              </a>
            </div>

          </div>
        </div>
      </div>
    </Fragment>
  );
}
