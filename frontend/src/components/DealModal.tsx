import { Fragment, useEffect } from "react";
import type { Deal } from "../api/client";
import ScoreBadge from "./ScoreBadge";
import { useSettings } from "../hooks/useSettings";

interface Props {
  deal: Deal;
  onClose: () => void;
}

const fmt = {
  gbp: (v: number | null) => (v != null ? `£${v.toLocaleString()}` : "—"),
  miles: (v: number | null) => (v != null ? `${v.toLocaleString()} mi` : "—"),
};

function Row({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2.5 border-b border-gray-100 last:border-0 ${highlight ? "font-semibold" : ""}`}>
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm ${highlight ? "text-gray-900 font-semibold" : "text-gray-700"}`}>{value}</span>
    </div>
  );
}

const ROAD_TAX_ANNUAL = 195;
const MOT_FEE = 54.85;
const INSPECTION_MILES = 50;
const LITRES_PER_GALLON = 4.546;

function useCostBreakdown(deal: Deal) {
  const { settings: s } = useSettings();
  if (deal.price_gbp == null) return null;

  const repairBuffer =
    s.repairBufferValue !== ""
      ? s.repairBufferMode === "percent"
        ? Math.round((deal.price_gbp * Number(s.repairBufferValue)) / 100)
        : Number(s.repairBufferValue)
      : null;

  const sellingFee =
    s.sellingPlatformFeePct !== "" && deal.estimated_value_gbp != null
      ? Math.round((deal.estimated_value_gbp * Number(s.sellingPlatformFeePct)) / 100)
      : null;

  const inspectionFuel =
    s.mpg !== "" && s.fuelPricePerLitre !== ""
      ? Math.round(
          ((INSPECTION_MILES / Number(s.mpg)) * LITRES_PER_GALLON * Number(s.fuelPricePerLitre)) *
            100
        ) / 100
      : null;

  const lines: { label: string; value: number; note?: string }[] = [
    { label: "Road tax (annual est.)", value: ROAD_TAX_ANNUAL, note: "Standard VED rate" },
    { label: "MOT", value: MOT_FEE, note: "Max DVSA fee" },
  ];
  if (repairBuffer != null) lines.push({ label: "Repair buffer", value: repairBuffer, note: s.repairBufferMode === "percent" ? `${s.repairBufferValue}% of price` : "Fixed" });
  if (inspectionFuel != null) lines.push({ label: "Inspection fuel", value: inspectionFuel, note: `${INSPECTION_MILES} mi @ ${s.mpg} mpg` });
  if (sellingFee != null) lines.push({ label: "Selling platform fee", value: sellingFee, note: `${s.sellingPlatformFeePct}% of est. value` });

  const totalCosts = lines.reduce((sum, l) => sum + l.value, 0);
  const grossMargin = deal.estimated_margin_gbp ?? 0;
  const netProfit = grossMargin - totalCosts;

  return { lines, totalCosts, grossMargin, netProfit };
}

export default function DealModal({ deal, onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const title = [deal.year, deal.make, deal.model, deal.variant].filter(Boolean).join(" ") || "Unknown";
  const subtitle = [deal.mileage != null ? fmt.miles(deal.mileage) : null, deal.colour, deal.body_type].filter(Boolean).join(" · ");

  const marginPositive = (deal.estimated_margin_gbp ?? 0) > 0;
  const thumbs = (deal.image_urls ?? []).slice(0, 10);
  const priceHistory = deal.price_history ?? [];
  const hasPriceMovement = priceHistory.length > 1;
  const costs = useCostBreakdown(deal);

  return (
    <Fragment>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div className="bg-white border border-gray-200 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto">

          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-gray-100">
            <div>
              <h2 className="text-lg font-bold text-gray-900">{title}</h2>
              {subtitle && <p className="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-700 hover:bg-gray-100 ml-4 w-8 h-8 flex items-center justify-center rounded-lg transition-colors text-lg leading-none"
            >
              ×
            </button>
          </div>

          <div className="p-6 space-y-5">

            {/* Photo strip */}
            {thumbs.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
                {thumbs.map((url, idx) => (
                  <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex-shrink-0">
                    <img
                      src={url.replace("/w1400/", "/w340/")}
                      alt={`Photo ${idx + 1}`}
                      className="h-36 w-auto rounded-xl border border-gray-100 hover:border-gray-400 transition-colors object-cover"
                    />
                  </a>
                ))}
                {(deal.image_urls?.length ?? 0) > 10 && (
                  <a
                    href={deal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-shrink-0 h-36 w-24 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-center text-xs text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-colors"
                  >
                    +{(deal.image_urls?.length ?? 0) - 10} more
                  </a>
                )}
              </div>
            )}

            {/* Price history */}
            {hasPriceMovement && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Price History</p>
                <div className="space-y-2">
                  {priceHistory.map((entry, i) => {
                    const prev = priceHistory[i - 1];
                    const delta = prev ? entry.price_gbp - prev.price_gbp : null;
                    return (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="text-gray-400 text-xs">
                          {new Date(entry.recorded_at).toLocaleDateString("en-GB")}
                        </span>
                        <div className="flex items-center gap-2">
                          {delta != null && (
                            <span className={`text-xs font-medium ${delta < 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {delta < 0 ? "▼" : "▲"} £{Math.abs(delta).toLocaleString()}
                            </span>
                          )}
                          <span className={`font-semibold ${i === priceHistory.length - 1 ? "text-gray-900" : "text-gray-400 line-through"}`}>
                            {fmt.gbp(entry.price_gbp)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Score + margin highlight */}
            <div className="border border-gray-100 bg-gray-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Deal Score</p>
                <ScoreBadge score={deal.score} confidence={deal.confidence} />
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Est. Margin</p>
                <p className={`text-2xl font-bold ${marginPositive ? "text-emerald-600" : "text-red-500"}`}>
                  {marginPositive ? "+" : ""}{fmt.gbp(deal.estimated_margin_gbp)}
                </p>
              </div>
            </div>

            {/* Pricing breakdown */}
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pricing</p>
              <Row label="Asking price" value={fmt.gbp(deal.price_gbp)} highlight />
              <Row label="Est. market value" value={fmt.gbp(deal.estimated_value_gbp)} />
              {deal.price_deviation_pct != null && (
                <Row
                  label="vs Market"
                  value={
                    <span className={deal.price_deviation_pct < 0 ? "text-emerald-600 font-semibold" : "text-red-500 font-semibold"}>
                      {deal.price_deviation_pct > 0 ? "+" : ""}{deal.price_deviation_pct.toFixed(1)}%
                    </span>
                  }
                />
              )}
              {deal.comparable_count != null && (
                <Row label="Comparables used" value={deal.comparable_count} />
              )}
            </div>

            {/* Negotiation assistant */}
            {deal.estimated_value_gbp != null && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Negotiation</p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">Don't exceed</p>
                    <p className="text-lg font-bold text-gray-900">{fmt.gbp(deal.estimated_value_gbp)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Pay more and margin disappears</p>
                  </div>
                  <div className="bg-gray-50 border border-gray-100 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">Open with</p>
                    <p className="text-lg font-bold text-gray-900">
                      {deal.price_gbp != null
                        ? fmt.gbp(Math.round(deal.price_gbp * 0.88))
                        : "—"}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">~12% below asking</p>
                  </div>
                </div>
              </div>
            )}

            {/* Cost breakdown */}
            {costs && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Cost Breakdown</p>
                <div className="space-y-0">
                  {costs.lines.map((line) => (
                    <div key={line.label} className="flex items-center justify-between py-2 border-b border-gray-50">
                      <div>
                        <span className="text-sm text-gray-600">{line.label}</span>
                        {line.note && <span className="text-xs text-gray-400 ml-1.5">({line.note})</span>}
                      </div>
                      <span className="text-sm text-red-500 font-medium">−£{line.value.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-sm text-gray-500 font-medium">Total est. costs</span>
                    <span className="text-sm text-red-600 font-semibold">−£{Math.round(costs.totalCosts).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between pt-3">
                    <span className="text-sm font-semibold text-gray-900">Net profit</span>
                    <span className={`text-base font-bold ${costs.netProfit > 0 ? "text-emerald-600" : "text-red-600"}`}>
                      {costs.netProfit > 0 ? "+" : ""}£{Math.round(costs.netProfit).toLocaleString()}
                    </span>
                  </div>
                </div>
                {(costs.lines.length === 2) && (
                  <p className="text-[11px] text-gray-400 mt-3">
                    Set repair buffer and selling fee in{" "}
                    <span className="font-medium text-gray-500">Settings → Cost Assumptions</span> for a fuller estimate.
                  </p>
                )}
              </div>
            )}

            {/* MOT narrative */}
            {deal.mot_narrative && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">MOT Summary</p>
                <p className="text-sm text-gray-700 leading-relaxed">{deal.mot_narrative}</p>
              </div>
            )}

            {/* AI Analysis block */}
            {deal.analysis_narrative != null && (
              <div className="border border-gray-100 rounded-xl p-4 space-y-4">
                {/* Header row: title + confidence */}
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Analysis</p>
                  {deal.analysis_confidence_pct != null && (
                    <span className="text-xs text-gray-400 font-medium">
                      {deal.analysis_confidence_pct}% confidence
                    </span>
                  )}
                </div>

                {/* Risk score bar */}
                {deal.risk_score != null && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-gray-500 font-medium">Listing risk</span>
                      <span className={`font-semibold ${
                        deal.risk_score <= 33 ? "text-emerald-600"
                        : deal.risk_score <= 66 ? "text-amber-600"
                        : "text-red-600"
                      }`}>
                        {deal.risk_score <= 33 ? "Low" : deal.risk_score <= 66 ? "Medium" : "High"} ({deal.risk_score}/100)
                      </span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          deal.risk_score <= 33 ? "bg-emerald-500"
                          : deal.risk_score <= 66 ? "bg-amber-400"
                          : "bg-red-500"
                        }`}
                        style={{ width: `${deal.risk_score}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Narrative */}
                <p className="text-sm text-gray-700 leading-relaxed">{deal.analysis_narrative}</p>

                {/* Red flags */}
                {deal.red_flags && deal.red_flags.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2">Red Flags</p>
                    <ul className="space-y-1">
                      {deal.red_flags.map((flag, i) => (
                        <li key={i} className="text-sm text-red-700 flex gap-2">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{flag}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Positives */}
                {deal.positives && deal.positives.length > 0 && (
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2">Why it could be a good buy</p>
                    <ul className="space-y-1">
                      {deal.positives.map((pos, i) => (
                        <li key={i} className="text-sm text-emerald-800 flex gap-2">
                          <span className="mt-0.5 shrink-0">•</span>
                          <span>{pos}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Condition notes */}
                {deal.condition_notes && deal.condition_notes.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Condition Notes</p>
                    <ul className="space-y-1">
                      {deal.condition_notes.map((note, i) => (
                        <li key={i} className="text-sm text-gray-600 flex gap-2">
                          <span className="mt-0.5 shrink-0 text-gray-400">•</span>
                          <span>{note}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Urgency tags */}
            {deal.urgency_tags && deal.urgency_tags.length > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2">Flags</p>
                <div className="flex flex-wrap gap-2">
                  {deal.urgency_tags.map((tag) => (
                    <span key={tag} className="bg-amber-100 text-amber-700 text-xs px-2.5 py-1 rounded-full font-medium">
                      {tag.replace(/_/g, " ")}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Vehicle details */}
            <div className="border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Vehicle Details</p>
              {deal.registration && <Row label="Registration" value={<span className="font-mono text-gray-900">{deal.registration}</span>} />}
              {deal.mileage != null && <Row label="Mileage" value={fmt.miles(deal.mileage)} />}
              {deal.location && (
                <Row
                  label="Location"
                  value={
                    deal.distance_miles != null
                      ? `${deal.location} · ${deal.distance_miles} mi away`
                      : deal.location
                  }
                />
              )}
              {deal.seller_name && (
                <Row
                  label="Seller"
                  value={`${deal.seller_name}${deal.seller_type ? ` (${deal.seller_type})` : ""}`}
                />
              )}
              {!deal.seller_name && deal.seller_type && <Row label="Seller type" value={deal.seller_type} />}
              {deal.source && <Row label="Source" value={deal.source} />}
            </div>

          </div>

          {/* Footer */}
          <div className="px-6 pb-6">
            <a
              href={deal.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center bg-gray-900 hover:bg-gray-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
            >
              View on {deal.source === "autotrader" ? "AutoTrader" : deal.source} →
            </a>
          </div>

        </div>
      </div>
    </Fragment>
  );
}
