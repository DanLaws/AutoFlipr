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
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-80 bg-white border-l border-gray-200 z-50 flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">View options</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-7">

          {/* Sort by */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sort by</p>
            <div className="space-y-1">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => onChange({ sort_by: opt.value })}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors ${
                    (draft.sort_by ?? "score") === opt.value
                      ? "bg-gray-900 text-white font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profitable only */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Quick filters</p>
            <label className="flex items-center justify-between cursor-pointer">
              <div>
                <p className="text-sm font-medium text-gray-700">Profitable only</p>
                <p className="text-xs text-gray-400 mt-0.5">Est. margin &gt; £0</p>
              </div>
              <div
                onClick={() => onChange({ profitable_only: !draft.profitable_only })}
                className={`relative w-10 h-6 rounded-full transition-colors ${
                  draft.profitable_only ? "bg-gray-900" : "bg-gray-200"
                }`}
              >
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  draft.profitable_only ? "translate-x-5" : "translate-x-1"
                }`} />
              </div>
            </label>
          </div>

          {/* Sources */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sources</p>
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
                    className="w-4 h-4 rounded border-gray-300 accent-gray-900"
                  />
                  <span className="text-sm text-gray-700">{src.label}</span>
                  {src.disabled && (
                    <span className="text-xs text-gray-400 ml-auto">Soon</span>
                  )}
                </label>
              ))}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => { onApply(); onClose(); }}
            className="w-full bg-gray-900 hover:bg-gray-700 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors"
          >
            Apply
          </button>
        </div>
      </div>
    </>
  );
}
