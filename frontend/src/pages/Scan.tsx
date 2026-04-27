import { useState, useEffect, useRef, FormEvent } from "react";
import { useAuth, scanLimit } from "../contexts/AuthContext";
import ReportButton from "../components/ReportButton";
import { scoreColourBorder } from "../utils/score";

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

function fmt(n: number | null | undefined, prefix = "") {
  if (n == null) return "—";
  return prefix + n.toLocaleString("en-GB");
}

// ── Status pill ──────────────────────────────────────────────────────────────

function StatusPill({ status }: { status: ScanResult["status"] }) {
  const styles = {
    pending:    "bg-gray-100 text-gray-500",
    processing: "bg-blue-50 text-blue-600 animate-pulse",
    done:       "bg-emerald-50 text-emerald-700",
    error:      "bg-red-50 text-red-600",
  };
  const labels = { pending: "Queued", processing: "Scanning…", done: "Done", error: "Error" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${styles[status]}`}>
      {status === "processing" && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
      {labels[status]}
    </span>
  );
}

// ── Result card ──────────────────────────────────────────────────────────────

function ResultCard({ scan }: { scan: ScanResult }) {
  const img = scan.image_urls?.[0];
  const margin = scan.estimated_margin_gbp ?? 0;
  const marginPositive = margin > 0;

  if (scan.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
        <p className="font-semibold mb-1">Scan failed</p>
        <p>{scan.error_message ?? "Unknown error"}</p>
        <a href={scan.url} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs text-red-500 underline break-all">{scan.url}</a>
      </div>
    );
  }

  if (scan.status !== "done") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full border-2 border-gray-200 border-t-gray-900 animate-spin flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-gray-700">
            {scan.status === "pending" ? "Queued — will start shortly…" : "Fetching listing and running AI analysis…"}
          </p>
          <p className="text-xs text-gray-400 mt-0.5 break-all">{scan.url}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <div className="flex flex-col sm:flex-row">
        {/* Image */}
        {img ? (
          <div className="sm:w-52 h-40 sm:h-auto flex-shrink-0 bg-gray-100">
            <img src={img} alt="" className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="sm:w-52 h-40 sm:h-auto flex-shrink-0 bg-gray-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Details */}
        <div className="flex-1 p-5 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-gray-900 text-base leading-snug">
                {[scan.year, scan.make, scan.model, scan.variant].filter(Boolean).join(" ") || "Unknown vehicle"}
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                {[scan.body_type, scan.colour, scan.seller_type].filter(Boolean).join(" · ")}
              </p>
            </div>
            {scan.score !== null && (
              <div className={`flex-shrink-0 w-14 h-14 rounded-xl border flex flex-col items-center justify-center ${scoreColourBorder(scan.score)}`}>
                <span className="text-lg font-bold leading-none">{Math.round(scan.score)}</span>
                <span className="text-[9px] font-semibold uppercase tracking-wide mt-0.5">Score</span>
              </div>
            )}
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Asking price", value: fmt(scan.price_gbp, "£") },
              { label: "Est. value", value: fmt(scan.estimated_value_gbp, "£") },
              { label: "Margin", value: scan.estimated_margin_gbp != null ? (marginPositive ? "+" : "") + fmt(scan.estimated_margin_gbp, "£") : "—" },
              { label: "Mileage", value: scan.mileage ? fmt(scan.mileage) + " mi" : "—" },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">{label}</p>
                <p className={`text-sm font-semibold mt-0.5 ${label === "Margin" ? (marginPositive ? "text-emerald-600" : "text-red-500") : "text-gray-900"}`}>
                  {value}
                </p>
              </div>
            ))}
          </div>

          {/* AI Analysis */}
          {scan.narrative && (
            <div className="border-t border-gray-100 pt-3 space-y-2">
              <p className="text-xs text-gray-600 leading-relaxed">{scan.narrative}</p>
              <div className="flex flex-wrap gap-1.5">
                {scan.positives?.map((p, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 rounded-full">
                    <span>✓</span> {p}
                  </span>
                ))}
                {scan.red_flags?.map((f, i) => (
                  <span key={i} className="inline-flex items-center gap-1 text-[11px] bg-red-50 text-red-600 border border-red-100 px-2 py-0.5 rounded-full">
                    <span>⚠</span> {f}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              {scan.location && <>{scan.location} · </>}
              {scan.comparable_count != null && <>{scan.comparable_count} comparables · </>}
              {scan.confidence && <span className={scan.confidence === "low" ? "text-amber-500" : ""}>{scan.confidence} confidence</span>}
            </span>
            <div className="flex items-center gap-3">
              {scan.listing_id && (
                <ReportButton listingId={scan.listing_id} />
              )}
              <a
                href={scan.url}
                target="_blank"
                rel="noreferrer"
                className="text-gray-900 font-medium hover:underline"
              >
                View listing →
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History row ──────────────────────────────────────────────────────────────

function HistoryRow({ scan, onSelect }: { scan: ScanResult; onSelect: (s: ScanResult) => void }) {
  const title = [scan.year, scan.make, scan.model].filter(Boolean).join(" ") || new URL(scan.url.startsWith("http") ? scan.url : "https://" + scan.url).hostname;
  const date = new Date(scan.scanned_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <button
      onClick={() => onSelect(scan)}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left group"
    >
      {/* Thumbnail */}
      <div className="w-12 h-9 rounded-md bg-gray-100 overflow-hidden flex-shrink-0">
        {scan.image_urls?.[0] ? (
          <img src={scan.image_urls[0]} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" /></svg>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-gray-700">{title}</p>
        <p className="text-xs text-gray-400 truncate">{scan.url}</p>
      </div>

      <div className="flex-shrink-0 text-right">
        {scan.status === "done" && scan.score !== null ? (
          <p className={`text-sm font-bold ${scan.score >= 75 ? "text-emerald-600" : scan.score >= 50 ? "text-amber-600" : "text-red-500"}`}>
            {Math.round(scan.score)}
          </p>
        ) : (
          <StatusPill status={scan.status} />
        )}
        <p className="text-[10px] text-gray-400 mt-0.5">{date}</p>
      </div>
    </button>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function ScanPage() {
  const { user, token } = useAuth();
  const [url, setUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeScan, setActiveScan] = useState<ScanResult | null>(null);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const limit = scanLimit(user?.plan ?? "free");
  const scansLeft = limit != null ? Math.max(0, limit - (user?.scan_count ?? 0)) : null;

  // Load history on mount
  useEffect(() => {
    loadHistory();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  async function authFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(path, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options?.headers ?? {}),
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(err.detail ?? "Request failed");
    }
    return res.json();
  }

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await authFetch<ScanResult[]>("/api/scan/history");
      setHistory(data);
    } catch {}
    finally { setHistoryLoading(false); }
  }

  function startPolling(scanId: number) {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const data = await authFetch<ScanResult>(`/api/scan/${scanId}`);
        setActiveScan(data);
        if (data.status === "done" || data.status === "error") {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          // Refresh history
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
      const scan = await authFetch<ScanResult>("/api/scan", {
        method: "POST",
        body: JSON.stringify({ url: url.trim() }),
      });
      setActiveScan(scan);
      setUrl("");
      // Add to history top
      setHistory(prev => [scan, ...prev.filter(s => s.id !== scan.id)]);
      // Start polling
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
    <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Scan a listing</h1>
        <p className="text-sm text-gray-400 mt-0.5">
          Paste an AutoTrader, Gumtree, or Facebook Marketplace URL — we'll score it against the market instantly.
        </p>
      </div>

      {/* Scan limit banner */}
      {scansLeft !== null && (
        <div className={`mb-4 flex items-center justify-between px-4 py-2.5 rounded-lg text-sm ${
          scansLeft === 0 ? "bg-red-50 border border-red-200" : "bg-gray-50 border border-gray-200"
        }`}>
          <span className={scansLeft === 0 ? "text-red-600" : "text-gray-600"}>
            {scansLeft === 0
              ? "Monthly scan limit reached — upgrade to continue"
              : <>{scansLeft} of {limit} scans remaining this month</>}
          </span>
          {scansLeft === 0 && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("cf:show-pricing"))}
              className="text-xs font-semibold text-red-600 hover:underline"
            >
              Upgrade →
            </button>
          )}
        </div>
      )}

      {/* URL input */}
      <form onSubmit={handleSubmit} className="flex gap-2 mb-6">
        <input
          type="url"
          value={url}
          onChange={e => setUrl(e.target.value)}
          placeholder="autotrader.co.uk/car-details/… or gumtree.com/p/… or facebook.com/marketplace/item/…"
          className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
          disabled={submitting || scansLeft === 0}
        />
        <button
          type="submit"
          disabled={submitting || !url.trim() || scansLeft === 0}
          className="px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 disabled:opacity-40 transition-colors whitespace-nowrap"
        >
          {submitting ? "Scanning…" : "Scan"}
        </button>
      </form>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Active result */}
      {activeScan && (
        <div className="mb-8">
          <ResultCard scan={activeScan} />
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Previous scans</h2>
        {historyLoading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : history.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">
            No scans yet — paste a URL above to get started.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
            {history.map(scan => (
              <HistoryRow key={scan.id} scan={scan} onSelect={selectHistory} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
