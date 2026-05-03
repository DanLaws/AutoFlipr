import { useState, useEffect, useCallback } from "react";
import { apiFetch, apiPatch } from "../api/client";

interface ReportRow {
  id: number;
  listing_id: number;
  user_id: number | null;
  user_email: string | null;
  report_type: string;
  notes: string | null;
  reported_at: string;
  review_status: "pending" | "confirmed" | "denied";
  reviewed_at: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  price_gbp: number | null;
  source: string;
  url: string;
  globally_hidden: boolean;
}


const STATUS_FILTER_OPTIONS = [
  { value: "pending",   label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "denied",    label: "Denied" },
  { value: "all",       label: "All" },
] as const;

const TYPE_LABELS: Record<string, string> = {
  fake:    "Fake listing",
  finance: "Finance deal",
  scam:    "Scam",
  spam:    "Spam",
  duplicate: "Duplicate",
  other:   "Other",
};

const SOURCE_LABELS: Record<string, string> = {
  autotrader: "AutoTrader",
  gumtree: "Gumtree",
  fb: "Facebook",
};

function StatusBadge({ status }: { status: ReportRow["review_status"] }) {
  const cls =
    status === "confirmed" ? "badge badge-danger" :
    status === "denied"    ? "badge badge-free" :
                             "badge badge-warning";
  return <span className={cls}>{status}</span>;
}

function ReviewActions({ report, onUpdate }: {
  report: ReportRow;
  onUpdate: (updated: ReportRow) => void;
}) {
  const [saving, setSaving] = useState<"confirm" | "deny" | null>(null);

  if (report.review_status !== "pending") {
    return (
      <span className="text-xs text-text-faint italic">
        {report.review_status === "confirmed" ? "Hidden globally" : "Kept visible"}
      </span>
    );
  }

  async function act(action: "confirm" | "deny") {
    setSaving(action);
    try {
      const updated = await apiPatch<ReportRow>(`/api/admin/reports/${report.id}`, { action });
      onUpdate(updated);
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => act("confirm")}
        disabled={!!saving}
        className="btn btn-danger btn-sm text-xs px-3 py-1.5"
        title="Confirm report — hide listing from all users"
      >
        {saving === "confirm" ? "…" : "Confirm"}
      </button>
      <button
        onClick={() => act("deny")}
        disabled={!!saving}
        className="btn btn-secondary btn-sm text-xs px-3 py-1.5"
        title="Deny report — false alarm, keep listing visible"
      >
        {saving === "deny" ? "…" : "Deny"}
      </button>
    </div>
  );
}

export default function AdminReportsPage() {
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"pending" | "confirmed" | "denied" | "all">("pending");
  const [expanded, setExpanded] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = statusFilter !== "all" ? `?review_status=${statusFilter}` : `?review_status=all`;
      setReports(await apiFetch<ReportRow[]>(`/api/admin/reports${params}`));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load reports");
    } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { load(); }, [load]);

  function handleUpdate(updated: ReportRow) {
    setReports(rs => rs.map(r => r.id === updated.id ? updated : r));
  }

  const stats = {
    pending:   reports.filter(r => r.review_status === "pending").length,
    confirmed: reports.filter(r => r.review_status === "confirmed").length,
    denied:    reports.filter(r => r.review_status === "denied").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Listing Reports</h1>
          <p className="text-sm text-text-muted mt-0.5">Review user-submitted flags and take action</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Pending",   value: stats.pending,   cls: "text-warning-strong" },
          { label: "Confirmed", value: stats.confirmed, cls: "text-danger-strong" },
          { label: "Denied",    value: stats.denied,    cls: "text-text-muted" },
        ].map(s => (
          <div key={s.label} className="card px-4 py-3">
            <p className={`font-mono text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="label-caps mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-subtle border border-border-default w-fit">
        {STATUS_FILTER_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => setStatusFilter(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === opt.value
                ? "bg-surface text-text-primary shadow-sm border border-border-default"
                : "text-text-muted hover:text-text-primary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="text-center py-16 text-sm text-text-muted">Loading reports…</div>
      ) : error ? (
        <div className="rounded-lg bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger-strong">{error}</div>
      ) : reports.length === 0 ? (
        <div className="card py-16 text-center">
          <svg className="w-10 h-10 text-text-faint mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-text-muted">No {statusFilter !== "all" ? statusFilter : ""} reports</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map(report => (
            <div
              key={report.id}
              className={`card overflow-hidden transition-all ${
                report.review_status === "confirmed" ? "border-danger-border/50" :
                report.review_status === "denied"    ? "opacity-60" : ""
              }`}
            >
              {/* Summary row */}
              <div className="px-5 py-4 flex items-start gap-4">
                {/* Source icon */}
                <div className="w-9 h-9 rounded-lg bg-surface-subtle border border-border-default flex items-center justify-center flex-shrink-0 text-[10px] font-bold text-text-muted uppercase">
                  {(SOURCE_LABELS[report.source] ?? report.source).slice(0, 2)}
                </div>

                {/* Car info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-semibold text-text-primary text-sm">
                      {[report.year, report.make, report.model].filter(Boolean).join(" ") || "Unknown vehicle"}
                    </span>
                    {report.price_gbp && (
                      <span className="text-sm font-mono text-text-secondary">
                        £{report.price_gbp.toLocaleString()}
                      </span>
                    )}
                    <StatusBadge status={report.review_status} />
                    {report.globally_hidden && (
                      <span className="badge badge-danger text-[10px]">Hidden</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-text-muted">
                    <span>
                      <span className="text-text-faint">Type: </span>
                      <span className="font-medium text-danger-strong">
                        {TYPE_LABELS[report.report_type] ?? report.report_type}
                      </span>
                    </span>
                    {report.user_email && (
                      <span>
                        <span className="text-text-faint">Reporter: </span>
                        {report.user_email}
                      </span>
                    )}
                    <span>
                      <span className="text-text-faint">Reported: </span>
                      {new Date(report.reported_at).toLocaleDateString("en-GB", {
                        day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </span>
                    {report.reviewed_at && (
                      <span>
                        <span className="text-text-faint">Reviewed: </span>
                        {new Date(report.reviewed_at).toLocaleDateString("en-GB", {
                          day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <ReviewActions report={report} onUpdate={handleUpdate} />
                  <button
                    onClick={() => setExpanded(expanded === report.id ? null : report.id)}
                    className="text-text-faint hover:text-text-primary transition-colors p-1"
                    title={expanded === report.id ? "Collapse" : "Expand details"}
                  >
                    <svg
                      className={`w-4 h-4 transition-transform ${expanded === report.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Expanded details */}
              {expanded === report.id && (
                <div className="border-t border-border-faint bg-surface-subtle px-5 py-4 space-y-3">
                  {report.notes && (
                    <div>
                      <p className="label-caps mb-1">Reporter notes</p>
                      <p className="text-sm text-text-secondary bg-surface border border-border-default rounded-lg px-3 py-2 leading-relaxed">
                        {report.notes}
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <div>
                      <p className="label-caps mb-1">Listing URL</p>
                      <a
                        href={report.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-info-text hover:underline break-all"
                      >
                        {report.url}
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs">
                    <div>
                      <span className="label-caps">Listing ID</span>
                      <p className="font-mono text-text-secondary mt-0.5">#{report.listing_id}</p>
                    </div>
                    <div>
                      <span className="label-caps">Report ID</span>
                      <p className="font-mono text-text-secondary mt-0.5">#{report.id}</p>
                    </div>
                    <div>
                      <span className="label-caps">Source</span>
                      <p className="text-text-secondary mt-0.5">{SOURCE_LABELS[report.source] ?? report.source}</p>
                    </div>
                    {report.user_id && (
                      <div>
                        <span className="label-caps">User ID</span>
                        <p className="font-mono text-text-secondary mt-0.5">#{report.user_id}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
