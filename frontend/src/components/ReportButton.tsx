import { useState, useRef, useEffect } from "react";
import { api } from "../api/client";

interface ReportButtonProps {
  listingId: number;
  className?: string;
}

type ReportType = "scam" | "spam" | "duplicate" | "other";

const REPORT_OPTIONS: { value: ReportType; label: string; icon: string }[] = [
  { value: "scam", label: "Scam / fraudulent listing", icon: "🚨" },
  { value: "spam", label: "Spam or duplicate", icon: "📋" },
  { value: "duplicate", label: "Same car, different ad", icon: "🔁" },
  { value: "other", label: "Other issue", icon: "⚠️" },
];

export default function ReportButton({ listingId, className = "" }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedType, setSelectedType] = useState<ReportType>("scam");
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function handleSubmit() {
    setLoading(true);
    try {
      await api.reportListing(listingId, selectedType, notes || undefined);
      setSubmitted(true);
      setOpen(false);
    } catch {
      // silently fail — not critical
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-gray-400 ${className}`}>
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Reported
      </span>
    );
  }

  return (
    <div className={`relative ${className}`} ref={menuRef}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title="Report this listing"
        className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21" />
        </svg>
        Report
      </button>

      {open && (
        <div
          className="absolute z-[200] bottom-full mb-1 left-0 w-72 bg-white border border-gray-200 rounded-xl shadow-xl p-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="text-xs font-semibold text-gray-700 mb-2">Report this listing</p>

          <div className="space-y-1">
            {REPORT_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors ${
                  selectedType === opt.value
                    ? "bg-red-50 text-red-700"
                    : "hover:bg-gray-50 text-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name={`report-${listingId}`}
                  value={opt.value}
                  checked={selectedType === opt.value}
                  onChange={() => setSelectedType(opt.value)}
                  className="accent-red-500"
                />
                <span>{opt.icon}</span>
                <span>{opt.label}</span>
              </label>
            ))}
          </div>

          {selectedType === "scam" && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: what made you suspicious? (helps the AI learn)"
              className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-red-300"
            />
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 bg-red-500 hover:bg-red-600 text-white text-xs font-medium py-1.5 rounded-lg transition-colors disabled:opacity-50"
            >
              {loading ? "Submitting…" : "Submit report"}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="px-3 text-xs text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>

          <p className="text-[10px] text-gray-400 leading-tight">
            Reports help the AI recognise scam patterns in future listings.
          </p>
        </div>
      )}
    </div>
  );
}
