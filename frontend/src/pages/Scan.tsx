import { useState, useEffect, useRef, FormEvent } from "react";
import { useAuth, scanLimit } from "../contexts/AuthContext";
import { useWatchlistContext } from "../contexts/WatchlistContext";
import { apiFetch, apiPost } from "../api/client";
import ReportButton from "../components/ReportButton";
import ScoreBadge from "../components/ScoreBadge";

interface ScanResult {
  id: number;
  url: string;
  status: "pending" | "processing" | "done" | "error";
  error_message: string | null;
  scanned_at: string;
  completed_at: string | null;
  listing_id: number | null;
  source: string | null;
  make: string | null;
  model: string | null;
  variant: string | null;
  year: number | null;
  mileage: number | null;
  price_gbp: number | null;
  image_urls: string[] | null;
  location: string | null;
  seller_type: string | null;
  seller_name: string | null;
  body_type: string | null;
  colour: string | null;
  score: number | null;
  estimated_value_gbp: number | null;
  estimated_margin_gbp: number | null;
  price_deviation_pct: number | null;
  comparable_count: number | null;
  confidence: string | null;
  risk_score: number | null;
  narrative: string | null;
  red_flags: string[] | null;
  positives: string[] | null;
  condition_notes: string[] | null;
}

const fmt = {
  gbp:   (v: number | null) => v != null ? `£${v.toLocaleString("en-GB")}` : "—",
  miles: (v: number | null) => v != null ? `${v.toLocaleString("en-GB")} mi` : "—",
  pct:   (v: number | null) => v != null ? `${v > 0 ? "+" : ""}${v.toFixed(1)}%` : "—",
  signed:(v: number | null) => v != null ? `${v > 0 ? "+" : "−"}£${Math.abs(v).toLocaleString("en-GB")}` : "—",
  rel:   (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  },
};

// ── Processing checklist ──────────────────────────────────────────────────────

const STEPS = [
  { key: "queued",     label: "Listing queued",          detail: "Request received" },
  { key: "fetching",   label: "Fetching listing page",   detail: "Loading page content" },
  { key: "extracting", label: "Extracting data with AI", detail: "Reading vehicle details" },
  { key: "scoring",    label: "Scoring against market",  detail: "Comparing to similar cars" },
];

// SVG ring constants
const RING_R    = 30;
const RING_CIRC = 2 * Math.PI * RING_R;

function ProcessingChecklist({ status }: { status: ScanResult["status"] }) {
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const [visualStep, setVisualStep] = useState<number>(() => {
    if (status === "done")       return 4;
    if (status === "processing") return 2;
    return 0;
  });

  // Clear all timers on unmount
  useEffect(() => () => { timersRef.current.forEach(clearTimeout); }, []);

  // Advance visual step based on backend status
  useEffect(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    if (status === "done")  { setVisualStep(4); return; }
    if (status === "error") { return; }

    if (status === "pending") {
      setVisualStep(0);
      timersRef.current.push(setTimeout(() => setVisualStep(1), 1800));
    }
    if (status === "processing") {
      setVisualStep(vs => Math.max(vs, 2));
      timersRef.current.push(setTimeout(() => setVisualStep(3), 7000));
    }
  }, [status]);

  const isDone     = status === "done";
  const progress   = Math.min(1, visualStep / STEPS.length);
  const dashOffset = RING_CIRC * (1 - progress);
  const activeIdx  = Math.min(visualStep, STEPS.length - 1);

  return (
    <div className="card p-6">
      <div className="flex items-center gap-5">

        {/* ── Animated ring ── */}
        <div className="relative flex-shrink-0" style={{ width: 80, height: 80 }}>
          <svg width="80" height="80" viewBox="0 0 80 80" style={isDone ? { animation: "ring-pop 0.4s ease-out" } : {}}>
            {/* Track */}
            <circle
              cx="40" cy="40" r={RING_R}
              fill="none"
              stroke="var(--color-border-default)"
              strokeWidth="4"
            />
            {/* Progress arc */}
            <circle
              cx="40" cy="40" r={RING_R}
              fill="none"
              stroke={isDone ? "var(--color-success-strong)" : "var(--color-info-text)"}
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={RING_CIRC}
              strokeDashoffset={dashOffset}
              style={{
                transform: "rotate(-90deg)",
                transformOrigin: "50% 50%",
                transition: "stroke-dashoffset 0.9s cubic-bezier(0.4, 0, 0.2, 1), stroke 0.4s ease",
              }}
            />
          </svg>

          {/* Centre icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            {isDone ? (
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                style={{ color: "var(--color-success-strong)" }}>
                <path
                  d="M5 13l4 4L19 7"
                  stroke="currentColor" strokeWidth="2.5"
                  strokeLinecap="round" strokeLinejoin="round"
                  strokeDasharray="22"
                  style={{ animation: "check-draw 0.35s ease-out 0.15s both" }}
                />
              </svg>
            ) : (
              <div
                className="rounded-full border-2"
                style={{
                  width: 20, height: 20,
                  borderColor: "var(--color-info-text)",
                  borderTopColor: "transparent",
                  animation: "spin 0.9s linear infinite",
                }}
              />
            )}
          </div>
        </div>

        {/* ── Step list ── */}
        <div className="flex-1 min-w-0 space-y-2">
          {/* Current stage label */}
          <p
            className="text-sm font-semibold text-text-primary truncate"
            style={{ minHeight: "1.25rem" }}
          >
            {isDone ? "Analysis complete" : `${STEPS[activeIdx].label}…`}
          </p>

          <div className="space-y-1.5">
            {STEPS.map((step, i) => {
              const done   = i < visualStep;
              const active = i === visualStep && !isDone;
              const future = i > visualStep;

              return (
                <div
                  key={step.key}
                  className="flex items-center gap-2.5"
                  style={{
                    opacity: future ? 0.3 : 1,
                    transition: "opacity 0.4s ease",
                    animation: active ? "step-enter 0.25s ease-out" : undefined,
                  }}
                >
                  {/* Step indicator */}
                  <div
                    className="flex-shrink-0 flex items-center justify-center rounded-full"
                    style={{
                      width: 18, height: 18,
                      background: done   ? "var(--color-success-strong)" : "transparent",
                      border:     done   ? "none"
                                : active ? "2px solid var(--color-info-text)"
                                :          "2px solid var(--color-border-strong)",
                      transition: "background 0.3s, border-color 0.3s",
                    }}
                  >
                    {done && (
                      <svg width="10" height="10" viewBox="0 0 14 14" fill="none">
                        <path d="M2 7l4 4 6-6" stroke="white" strokeWidth="2.2"
                          strokeLinecap="round" strokeLinejoin="round"
                          strokeDasharray="18"
                          style={{ animation: "check-draw 0.25s ease-out both" }}
                        />
                      </svg>
                    )}
                    {active && (
                      <span
                        className="rounded-full"
                        style={{
                          width: 6, height: 6,
                          background: "var(--color-info-text)",
                          animation: "pulse 1s ease-in-out infinite",
                        }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <span
                    className="text-xs truncate"
                    style={{
                      color:      done   ? "var(--color-text-faint)"
                                : active ? "var(--color-text-primary)"
                                :          "var(--color-text-faint)",
                      fontWeight: active ? 500 : 400,
                      textDecoration: done ? "line-through" : "none",
                    }}
                  >
                    {step.label}
                  </span>

                  {/* Active shimmer badge */}
                  {active && (
                    <span
                      className="ml-auto flex-shrink-0 text-[10px] font-mono rounded px-1.5 py-0.5"
                      style={{
                        background: "linear-gradient(90deg, var(--color-info-bg) 0%, color-mix(in oklab, var(--color-info-text) 20%, var(--color-info-bg)) 50%, var(--color-info-bg) 100%)",
                        backgroundSize: "300% 100%",
                        color: "var(--color-info-text)",
                        animation: "scan-shimmer 2s linear infinite",
                      }}
                    >
                      running
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ETA hint */}
      {!isDone && (
        <p className="text-[11px] text-text-faint mt-4 text-center tracking-wide">
          Usually takes 15 – 30 seconds
        </p>
      )}
    </div>
  );
}

// ── Result card ──────────────────────────────────────────────────────────────

function BookmarkButton({ active, onClick }: { active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={active ? "Remove from watchlist" : "Save to watchlist"}
      className={`flex items-center gap-1.5 text-sm transition-colors ${
        active ? "text-text-primary" : "text-text-muted hover:text-text-primary"
      }`}
    >
      <svg width="17" height="17" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"}
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
      {active ? "Saved" : "Save"}
    </button>
  );
}

function ResultCard({ scan, bookmarked, onBookmark }: {
  scan: ScanResult;
  bookmarked: Set<number>;
  onBookmark: (id: number) => void;
}) {
  const img    = scan.image_urls?.[0];
  const margin = scan.estimated_margin_gbp ?? 0;
  const marginPos = margin > 0;
  const title  = [scan.year, scan.make, scan.model, scan.variant].filter(Boolean).join(" ") || "Unknown vehicle";

  if (scan.status === "error") {
    return (
      <div className="rounded-xl border border-danger-border bg-danger-bg p-5 text-sm text-danger-strong">
        <p className="font-semibold mb-1">Scan failed</p>
        <p className="text-text-muted">{scan.error_message ?? "Unknown error"}</p>
        <a href={scan.url} target="_blank" rel="noreferrer"
          className="mt-2 inline-block text-xs text-danger-strong underline break-all">{scan.url}</a>
      </div>
    );
  }

  if (scan.status !== "done") {
    return <ProcessingChecklist status={scan.status} />;
  }

  return (
    <div className="card overflow-hidden">
      {/* Photo strip — 21:9 */}
      {img ? (
        <div className="relative overflow-hidden" style={{ aspectRatio: "21 / 9" }}>
          <img src={img} alt={title} className="w-full h-full object-cover" />
          {/* Source pill */}
          {scan.source && (
            <div className="absolute bottom-2 left-2">
              <span className="font-mono text-[9px] font-semibold uppercase tracking-widest text-white/90 px-2 py-1 rounded"
                style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
                {scan.source}
              </span>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-surface-subtle flex items-center justify-center" style={{ aspectRatio: "21 / 9" }}>
          <svg className="w-12 h-12 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      )}

      <div className="p-5 space-y-5">
        {/* Header row */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {scan.source && (
                <span className="label-caps text-text-faint">{scan.source}</span>
              )}
              {scan.seller_type && (
                <span className={`badge ${scan.seller_type === "private" ? "badge-private" : "badge-trade"}`}>
                  {scan.seller_type}
                </span>
              )}
            </div>
            <h3 className="text-base font-semibold text-text-primary leading-snug">{title}</h3>
            {(scan.body_type || scan.colour) && (
              <p className="text-xs text-text-muted mt-0.5">
                {[scan.body_type, scan.colour].filter(Boolean).join(" · ")}
              </p>
            )}
          </div>
          <div className="flex flex-col items-end gap-1 flex-shrink-0">
            <ScoreBadge score={scan.score} confidence={scan.confidence} size={56} />
          </div>
        </div>

        {/* 3-col pricing grid */}
        <div
          className="rounded-lg overflow-hidden"
          style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--color-border-default)" }}
        >
          {[
            { label: "Asking",  value: fmt.gbp(scan.price_gbp) },
            { label: "Market",  value: fmt.gbp(scan.estimated_value_gbp) },
            { label: "Margin",  value: fmt.signed(scan.estimated_margin_gbp), accent: marginPos ? "text-success-strong" : "text-danger-strong" },
          ].map(({ label, value, accent }) => (
            <div key={label} className="bg-surface px-3 py-3">
              <p className="label-caps text-text-faint mb-1">{label}</p>
              <p className={`font-mono font-bold text-[22px] leading-none tracking-tight ${accent ?? "text-text-primary"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>

        {/* Info panel — negotiation */}
        {(scan.price_gbp != null && scan.estimated_value_gbp != null) && (
          <div
            className="rounded-lg p-4 space-y-3"
            style={{ background: "var(--color-info-bg)", border: "1px solid var(--color-info-border)" }}
          >
            <p className="label-caps" style={{ color: "var(--color-info-text)" }}>Negotiation guide</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <p className="text-xs text-text-muted mb-0.5">Open with</p>
                <p className="font-mono text-base font-bold text-text-primary">
                  {scan.estimated_value_gbp != null ? fmt.gbp(Math.round(scan.estimated_value_gbp * 0.94)) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs text-text-muted mb-0.5">Don't exceed</p>
                <p className="font-mono text-base font-bold text-text-primary">
                  {fmt.gbp(scan.estimated_value_gbp)}
                </p>
              </div>
            </div>
            {scan.price_deviation_pct != null && (
              <p className="text-xs text-text-muted">
                Listed at{" "}
                <span className={`font-mono font-semibold ${scan.price_deviation_pct < 0 ? "text-success-strong" : "text-danger-strong"}`}>
                  {fmt.pct(scan.price_deviation_pct)}
                </span>
                {" "}vs market average
              </p>
            )}
          </div>
        )}

        {/* Stats row */}
        <div className="flex gap-4 flex-wrap">
          {[
            { label: "Mileage",      value: fmt.miles(scan.mileage) },
            { label: "Comparables",  value: scan.comparable_count != null ? `${scan.comparable_count}` : "—" },
            { label: "Confidence",   value: scan.confidence ?? "—" },
            { label: "Location",     value: scan.location ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="min-w-0">
              <p className="label-caps text-text-faint">{label}</p>
              <p className="font-mono text-sm font-semibold text-text-primary">{value}</p>
            </div>
          ))}
        </div>

        {/* AI analysis */}
        {(scan.positives?.length || scan.red_flags?.length || scan.narrative) && (
          <div className="border-t border-border-default pt-4 space-y-3">
            {scan.narrative && (
              <p className="text-xs text-text-secondary leading-relaxed">{scan.narrative}</p>
            )}
            {(scan.positives?.length || scan.red_flags?.length) && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                {scan.positives?.length ? (
                  <div>
                    <p className="label-caps text-success-strong mb-2">Positives</p>
                    <ul className="space-y-1">
                      {scan.positives.map((p, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                          <svg className="w-3.5 h-3.5 text-success-strong mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <div />}
                {scan.red_flags?.length ? (
                  <div>
                    <p className="label-caps text-danger-strong mb-2">Watch out</p>
                    <ul className="space-y-1">
                      {scan.red_flags.map((f, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-xs text-text-secondary">
                          <svg className="w-3.5 h-3.5 text-warning-strong mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                          </svg>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : <div />}
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-3">
            {scan.listing_id && (
              <BookmarkButton
                active={bookmarked.has(scan.listing_id)}
                onClick={() => onBookmark(scan.listing_id!)}
              />
            )}
            {scan.listing_id && <ReportButton listingId={scan.listing_id} />}
          </div>
          <a
            href={scan.url}
            target="_blank"
            rel="noreferrer"
            className="btn btn-primary text-sm"
          >
            View listing →
          </a>
        </div>
      </div>
    </div>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ scan, onSelect, bookmarked }: {
  scan: ScanResult;
  onSelect: (s: ScanResult) => void;
  bookmarked: Set<number>;
}) {
  const title = [scan.make, scan.model].filter(Boolean).join(" ") ||
    (() => { try { return new URL(scan.url.startsWith("http") ? scan.url : "https://" + scan.url).hostname; } catch { return scan.url; } })();
  const thumb = scan.image_urls?.[0] ?? null;

  return (
    <button
      onClick={() => onSelect(scan)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition-colors text-left group"
    >
      {/* Thumbnail */}
      <div className="flex-shrink-0 w-16 h-11 rounded-lg overflow-hidden bg-surface-subtle border border-border-default">
        {thumb ? (
          <img src={thumb} alt={title} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-5 h-5 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{title}</p>
        <p className="font-mono text-xs text-text-faint truncate">{scan.url}</p>
      </div>

      {/* Score + time */}
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        {scan.status === "done" && scan.score !== null ? (
          <ScoreBadge score={scan.score} confidence={scan.confidence} size={36} />
        ) : (
          <div className="w-9 h-9 rounded-full border-2 border-border-default flex items-center justify-center">
            {scan.status === "processing" ? (
              <div className="w-4 h-4 border-2 border-info-text border-t-transparent rounded-full animate-spin" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-border-strong" />
            )}
          </div>
        )}
        <p className="font-mono text-[10px] text-text-faint">{fmt.rel(scan.scanned_at)}</p>
        {scan.listing_id && bookmarked.has(scan.listing_id) && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"
            className="text-text-muted" aria-label="Saved">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </div>
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const { user } = useAuth();
  const { bookmarked, toggleBookmark } = useWatchlistContext();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeScan, setActiveScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const limit      = scanLimit(user?.plan ?? "free");
  const scansUsed  = user?.scan_count ?? 0;
  const scansLeft  = limit != null ? Math.max(0, limit - scansUsed) : null;
  const atLimit    = scansLeft === 0;

  useEffect(() => {
    loadHistory();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await apiFetch<ScanResult[]>("/api/scan/history");
      setHistory(data);
    } catch {}
    finally { setHistoryLoading(false); }
  }

  function startPolling(scanId: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await apiFetch<ScanResult>(`/api/scan/${scanId}`);
        setActiveScan(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setHistory(prev => {
            const exists = prev.find(s => s.id === data.id);
            if (exists) return prev.map(s => s.id === data.id ? data : s);
            return [data, ...prev];
          });
        }
      } catch {}
    }, 3000);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setError(null);
    setSubmitting(true);
    setActiveScan(null);
    try {
      const scan = await apiPost<ScanResult>("/api/scan", { url: url.trim() });
      setActiveScan(scan);
      setUrl("");
      setHistory(prev => [scan, ...prev.filter(s => s.id !== scan.id)]);
      if (scan.status !== "done" && scan.status !== "error") {
        startPolling(scan.id);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Scan failed");
    } finally {
      setSubmitting(false);
    }
  }

  function selectHistory(scan: ScanResult) {
    setActiveScan(scan);
    if (scan.status === "pending" || scan.status === "processing") {
      startPolling(scan.id);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Scan a listing</h1>
        <p className="text-sm text-text-muted mt-0.5">
          Paste an AutoTrader, Gumtree, or Facebook Marketplace URL — we'll score it against the market instantly.
        </p>
      </div>

      {/* Scan limit banner */}
      {scansLeft !== null && (
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-lg border text-sm ${
          atLimit
            ? "bg-danger-bg border-danger-border text-danger-strong"
            : "bg-surface border-border-default text-text-secondary"
        }`}>
          <div className="flex items-center gap-2">
            <span className={`font-mono text-xs font-bold px-1.5 py-0.5 rounded ${atLimit ? "bg-danger-strong text-white" : "bg-surface-subtle text-text-muted"}`}>
              {limit === null ? "∞" : `${scansUsed}/${limit}`}
            </span>
            <span>
              {atLimit
                ? "Monthly scan limit reached — upgrade to continue"
                : limit === null
                ? "Unlimited scans on your plan"
                : `${scansLeft} scan${scansLeft === 1 ? "" : "s"} remaining this month`}
            </span>
          </div>
          {atLimit && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("cf:show-pricing"))}
              className="text-xs font-semibold text-danger-strong hover:underline"
            >
              Upgrade →
            </button>
          )}
        </div>
      )}

      {/* URL input */}
      <form onSubmit={handleSubmit} className="space-y-1.5">
        <label className="label-caps">Listing URL</label>
        <div className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={e => setUrl(e.target.value)}
            placeholder="autotrader.co.uk/car-details/… or gumtree.com/p/… or facebook.com/marketplace/item/…"
            className="flex-1 font-mono text-sm px-4 py-2.5 rounded-lg border border-border-default bg-surface text-text-primary placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-shadow"
            style={{ "--tw-ring-color": "var(--color-text-primary)" } as React.CSSProperties}
            disabled={submitting || atLimit}
          />
          <button
            type="submit"
            disabled={submitting || !url.trim() || atLimit}
            className="btn btn-primary px-5 py-2.5 text-sm whitespace-nowrap"
          >
            {submitting ? "Scanning…" : "Scan"}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-lg bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger-strong">
          {error}
        </div>
      )}

      {/* Active result */}
      {activeScan && (
        <ResultCard scan={activeScan} bookmarked={bookmarked} onBookmark={toggleBookmark} />
      )}

      {/* History */}
      <div className="space-y-2">
        <h2 className="label-caps">Previous scans</h2>
        {historyLoading ? (
          <div className="card py-8 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-border-strong border-t-text-primary rounded-full animate-spin" />
          </div>
        ) : history.length === 0 ? (
          <div className="card border-dashed py-10 text-center text-sm text-text-faint">
            No scans yet — paste a URL above to get started.
          </div>
        ) : (
          <div className="card overflow-hidden divide-y divide-border-default p-0">
            {history.map(scan => (
              <HistoryRow key={scan.id} scan={scan} onSelect={selectHistory} bookmarked={bookmarked} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
