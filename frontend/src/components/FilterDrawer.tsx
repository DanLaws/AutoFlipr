import { useEffect } from "react";
import type { DealsFilter } from "../api/client";

const SORT_OPTIONS = [
  { value: "score",      label: "Best deal score" },
  { value: "margin",     label: "Highest margin" },
  { value: "price_asc",  label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "mileage",    label: "Lowest mileage" },
  { value: "year",       label: "Newest first" },
];

const SOURCES = [
  { value: "autotrader", label: "AutoTrader" },
  { value: "gumtree",    label: "Gumtree" },
  { value: "fb",         label: "Facebook Marketplace", disabled: true },
];

interface Props {
  draft: DealsFilter;
  onChange: (patch: Partial<DealsFilter>) => void;
  onApply: () => void;
  onClose: () => void;
}

export default function FilterDrawer({ draft, onChange, onApply, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const activeSources = (draft.source ?? "autotrader").split(",").filter(Boolean);

  function toggleSource(value: string) {
    const next = activeSources.includes(value)
      ? activeSources.filter((s) => s !== value)
      : [...activeSources, value];
    onChange({ source: next.length ? next.join(",") : "autotrader" });
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm" onClick={onClose} />

      <div
        className="fixed right-0 top-0 h-full w-80 z-50 flex flex-col border-l border-border-default"
        style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-lg)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
          <h2 className="text-sm font-semibold text-text-primary">View options</h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

          {/* Sort by */}
          <div>
            <p className="label-caps mb-3">Sort by</p>
            <div className="space-y-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onChange({ sort_by: opt.value })}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    (draft.sort_by ?? "score") === opt.value
                      ? "bg-text-primary text-brand-fg font-medium"
                      : "text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick filters */}
          <div>
            <p className="label-caps mb-3">Quick filters</p>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-text-primary">Profitable only</p>
                <p className="text-xs text-text-muted mt-0.5">Est. margin &gt; £0</p>
              </div>
              <div
                onClick={() => onChange({ profitable_only: !draft.profitable_only })}
                className={`relative w-10 h-6 rounded-full transition-colors cursor-pointer ${
                  draft.profitable_only ? "bg-text-primary" : "bg-border-strong"
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-brand-fg rounded-full shadow transition-transform ${
                  draft.profitable_only ? "translate-x-5" : "translate-x-1"
                }`} />
              </div>
            </label>
          </div>

          {/* Seller type */}
          <div>
            <p className="label-caps mb-3">Seller type</p>
            <div className="flex rounded-lg border border-border-default overflow-hidden text-xs">
              {([["", "All"], ["private", "Private"], ["trade", "Trade"]] as const).map(([val, label]) => (
                <button
                  key={val}
                  onClick={() => onChange({ seller_type: val || undefined })}
                  className={`flex-1 px-3 py-2 font-medium transition-colors ${
                    (draft.seller_type ?? "") === val
                      ? "bg-text-primary text-brand-fg"
                      : "bg-surface text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Sources */}
          <div>
            <p className="label-caps mb-3">Sources</p>
            <div className="space-y-2">
              {SOURCES.map((src) => (
                <label
                  key={src.value}
                  className={`flex items-center gap-3 ${src.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={activeSources.includes(src.value)}
                    disabled={src.disabled}
                    onChange={() => !src.disabled && toggleSource(src.value)}
                    className="w-4 h-4 rounded border-border-strong accent-[var(--color-brand)]"
                  />
                  <span className="text-sm text-text-secondary">{src.label}</span>
                  {src.disabled && <span className="text-xs text-text-faint ml-auto">Soon</span>}
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border-default">
          <button
            onClick={() => { onApply(); onClose(); }}
            className="btn btn-primary w-full py-2.5"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
