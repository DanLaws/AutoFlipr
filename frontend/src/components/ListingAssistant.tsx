import { useState } from "react";
import { apiPost, type FlipEntry, type ListingOut, type PricingStrategy } from "../api/client";

// ── Feature categories ─────────────────────────────────────────────────────────

const FEATURE_GROUPS: { label: string; features: string[] }[] = [
  {
    label: "Comfort",
    features: [
      "Leather seats",
      "Part-leather seats",
      "Heated seats",
      "Heated steering wheel",
      "Electric seats",
      "Massage seats",
      "Sunroof",
      "Panoramic roof",
      "Climate control",
      "Dual-zone climate",
      "Rear air conditioning",
    ],
  },
  {
    label: "Infotainment",
    features: [
      "Bluetooth",
      "Apple CarPlay",
      "Android Auto",
      "Sat Nav",
      "DAB Radio",
      "USB ports",
      "Wireless charging",
      "Premium sound system",
      "Rear entertainment",
    ],
  },
  {
    label: "Safety & Driver Assist",
    features: [
      "Front parking sensors",
      "Rear parking sensors",
      "Reversing camera",
      "360° camera",
      "Cruise control",
      "Adaptive cruise control",
      "Lane assist",
      "Blind spot monitoring",
      "Autonomous emergency braking",
      "Speed limiter",
    ],
  },
  {
    label: "Exterior & Convenience",
    features: [
      "Alloy wheels",
      "LED headlights",
      "Tinted windows",
      "Privacy glass",
      "Keyless entry",
      "Keyless start",
      "Tow bar",
      "Roof rails",
      "Electric tailgate",
      "Folding mirrors",
    ],
  },
  {
    label: "History & Condition",
    features: [
      "Full service history",
      "Part service history",
      "New MOT (12 months)",
      "MOT valid",
      "Recently serviced",
      "New tyres",
      "One owner",
      "Two owners",
      "HPI clear",
    ],
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function PricingCard({
  tier,
  label,
  colour,
  data,
}: {
  tier: "quick_sale" | "balanced" | "premium";
  label: string;
  colour: string;
  data: PricingStrategy;
}) {
  const badgeClass =
    tier === "quick_sale"
      ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      : tier === "balanced"
      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300"
      : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300";

  return (
    <div className={`rounded-xl border ${colour} p-4 flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${badgeClass}`}>
          {label}
        </span>
        <span className="text-xs text-text-muted">{data.estimated_days}</span>
      </div>
      <div className="flex items-baseline gap-3">
        <div>
          <p className="text-xs text-text-muted">List at</p>
          <p className="text-2xl font-bold text-text-primary">
            £{data.listed_price.toLocaleString("en-GB")}
          </p>
        </div>
        <div className="border-l border-border-default pl-3">
          <p className="text-xs text-text-muted">Accept</p>
          <p className="text-lg font-semibold text-text-secondary">
            £{data.target_price.toLocaleString("en-GB")}
          </p>
        </div>
      </div>
      <p className="text-xs text-text-muted leading-relaxed">{data.rationale}</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={copy}
      className="text-xs text-text-muted hover:text-text-primary transition-colors flex items-center gap-1"
    >
      {copied ? (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

interface Props {
  entry: FlipEntry;
  onClose: () => void;
}

export default function ListingAssistant({ entry, onClose }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(entry.features ?? [])
  );
  const [motAdvisories, setMotAdvisories] = useState(entry.mot_advisories ?? "");
  const [result, setResult] = useState<ListingOut | null>(entry.listing_output ?? null);
  const [generating, setGenerating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleFeature(f: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(f)) next.delete(f);
      else next.add(f);
      return next;
    });
  }

  async function generate() {
    setGenerating(true);
    setErr(null);
    setResult(null);
    try {
      const data = await apiPost<ListingOut>(
        `/api/flipfolio/${entry.id}/generate-listing`,
        {
          features: Array.from(selected),
          mot_advisories: motAdvisories.trim() || null,
        }
      );
      setResult(data);
    } catch {
      setErr("Generation failed — please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }

  const carLabel = [entry.year, entry.make, entry.model].filter(Boolean).join(" ");

  return (
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card w-full max-w-3xl my-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h2 className="text-base font-semibold text-text-primary">
              Listing Assistant
            </h2>
            <p className="text-sm text-text-muted mt-0.5">{carLabel}</p>
          </div>
          <button
            onClick={onClose}
            className="text-text-muted hover:text-text-primary transition-colors shrink-0"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Features */}
        <div className="mb-5">
          <p className="field-label mb-2">Features</p>
          <div className="space-y-3">
            {FEATURE_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-xs font-medium text-text-muted mb-1.5">{group.label}</p>
                <div className="flex flex-wrap gap-2">
                  {group.features.map((f) => {
                    const on = selected.has(f);
                    return (
                      <button
                        key={f}
                        onClick={() => toggleFeature(f)}
                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                          on
                            ? "bg-text-primary text-brand-fg border-text-primary"
                            : "border-border-default text-text-secondary hover:border-text-muted"
                        }`}
                      >
                        {on && (
                          <span className="mr-1">✓</span>
                        )}
                        {f}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* MOT advisories */}
        <div className="mb-5">
          <label className="block">
            <span className="field-label">MOT advisories</span>
            <p className="text-xs text-text-faint mt-0.5 mb-1">
              Paste the latest advisory notes from the MOT certificate. The assistant will mention them honestly in the advert.
            </p>
            <textarea
              className="input mt-1 resize-none"
              rows={3}
              placeholder="e.g. Nearside front tyre worn close to limit (2.1mm), slight corrosion to rear silencer..."
              value={motAdvisories}
              onChange={(e) => setMotAdvisories(e.target.value)}
            />
          </label>
        </div>

        {/* Generate button */}
        <div className="flex justify-end mb-6">
          <button
            onClick={generate}
            disabled={generating}
            className="btn btn-primary"
          >
            {generating ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Generating…
              </span>
            ) : result ? (
              "Regenerate"
            ) : (
              "Generate listing"
            )}
          </button>
        </div>

        {err && (
          <p className="text-sm text-danger-text mb-4">{err}</p>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-5 border-t border-border-default pt-5">
            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="field-label">Advert title</p>
                <CopyButton text={result.title} />
              </div>
              <div className="rounded-lg bg-surface-subtle border border-border-default px-3 py-2.5 text-sm font-medium text-text-primary">
                {result.title}
              </div>
            </div>

            {/* Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <p className="field-label">Description</p>
                <CopyButton text={result.description} />
              </div>
              <div className="rounded-lg bg-surface-subtle border border-border-default px-3 py-3 text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {result.description}
              </div>
            </div>

            {/* Pricing strategies */}
            <div>
              <p className="field-label mb-3">Pricing strategies</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PricingCard
                  tier="quick_sale"
                  label="Quick sale"
                  colour="border-amber-200 bg-amber-50/50 dark:border-amber-800/40 dark:bg-amber-950/20"
                  data={result.quick_sale}
                />
                <PricingCard
                  tier="balanced"
                  label="Balanced"
                  colour="border-blue-200 bg-blue-50/50 dark:border-blue-800/40 dark:bg-blue-950/20"
                  data={result.balanced}
                />
                <PricingCard
                  tier="premium"
                  label="Premium"
                  colour="border-emerald-200 bg-emerald-50/50 dark:border-emerald-800/40 dark:bg-emerald-950/20"
                  data={result.premium}
                />
              </div>
              <p className="text-xs text-text-faint mt-2">
                Listed price includes negotiation headroom. Accept price is your minimum target.
              </p>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
