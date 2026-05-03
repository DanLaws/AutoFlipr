import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client";

interface ReportButtonProps {
  listingId: number;
  onHide?: (listingId: number) => void;
  className?: string;
}

type ReportType = "scam" | "finance" | "duplicate" | "other";

const REPORT_OPTIONS: { value: ReportType; label: string; desc: string }[] = [
  { value: "scam",      label: "Scam / fake listing", desc: "Photos stolen, car doesn't exist, or seller is fraudulent" },
  { value: "finance",   label: "Finance deal",        desc: "Listed as a finance/PCP offer, not a straight cash sale" },
  { value: "duplicate", label: "Duplicate listing",   desc: "Same car listed multiple times or cross-posted" },
  { value: "other",     label: "Other issue",         desc: "Something else is wrong with this listing" },
];

const PANEL_W = 304;

export default function ReportButton({ listingId, onHide, className = "" }: ReportButtonProps) {
  const [open, setOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [selectedType, setSelectedType] = useState<ReportType>("scam");
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  const btnRef  = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // While the panel is open, poll the button's viewport position every animation
  // frame. This works regardless of what scroll container the button lives inside
  // (including position:fixed overflow containers like the deal modal).
  useEffect(() => {
    if (!open) return;

    let rafId: number;
    let prevTop = -1;
    let prevLeft = -1;

    const tick = () => {
      if (btnRef.current) {
        const r      = btnRef.current.getBoundingClientRect();
        const vw     = window.innerWidth;
        const vh     = window.innerHeight;
        const gap    = 8;
        const panelH = panelRef.current?.offsetHeight ?? 320;

        let left = r.left;
        if (left + PANEL_W > vw - gap) left = Math.max(gap, r.right - PANEL_W);
        left = Math.max(gap, left);

        let top: number;
        if (r.top - panelH - gap >= gap) {
          top = r.top - panelH - gap;
        } else {
          top = Math.min(r.bottom + gap, vh - panelH - gap);
        }
        top = Math.max(gap, top);

        if (top !== prevTop || left !== prevLeft) {
          prevTop = top;
          prevLeft = left;
          setPos({ top, left });
        }
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [open]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current   && !btnRef.current.contains(e.target as Node)
      ) setOpen(false);
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
      setTimeout(() => onHide?.(listingId), 1200);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <span className={`inline-flex items-center gap-1.5 text-xs text-text-muted ${className}`}>
        <svg className="w-3.5 h-3.5 text-success-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Reported — thanks
      </span>
    );
  }

  const panel = open && pos ? createPortal(
    <div
      ref={panelRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "fixed",
        top: pos.top,
        left: pos.left,
        width: Math.min(PANEL_W, window.innerWidth - 16),
        zIndex: 9999,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border-default)",
        boxShadow: "var(--shadow-lg)",
        borderRadius: "0.75rem",
        padding: "1rem",
      }}
    >
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-text-primary">Report listing</p>
        <button
          onClick={() => setOpen(false)}
          className="text-text-muted hover:text-text-primary transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-1.5 mb-3">
        {REPORT_OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex items-start gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors border ${
              selectedType === opt.value
                ? "bg-danger-bg border-danger-border"
                : "border-transparent hover:bg-surface-subtle"
            }`}
          >
            <input
              type="radio"
              name={`report-${listingId}`}
              value={opt.value}
              checked={selectedType === opt.value}
              onChange={() => setSelectedType(opt.value)}
              className="mt-0.5 shrink-0 accent-[var(--color-danger-strong)]"
            />
            <div>
              <p className={`text-sm font-medium ${selectedType === opt.value ? "text-danger-strong" : "text-text-primary"}`}>
                {opt.label}
              </p>
              <p className="text-xs text-text-muted leading-tight">{opt.desc}</p>
            </div>
          </label>
        ))}
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Additional details (optional)"
        className="w-full text-xs border border-border-default bg-surface text-text-primary rounded-lg px-3 py-2 resize-none h-16 focus:outline-none focus:ring-1 focus:ring-danger-border placeholder:text-text-faint mb-3"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="flex-1 btn btn-danger text-sm py-2"
        >
          {loading ? "Submitting…" : "Submit report"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  ) : null;

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="inline-flex items-center gap-1.5 text-xs text-text-faint hover:text-danger-strong transition-colors"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
        </svg>
        Report listing
      </button>
      {panel}
    </div>
  );
}
