import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ListingSummary, ScrapeRunSummary } from "../api/client";
import { fmt } from "../utils/formatters";

const STATUS_CLS: Record<string, string> = {
  pending: "bg-warning-bg text-warning-text border border-warning-border",
  valid:   "bg-success-bg text-success-text border border-success-border",
  invalid: "bg-danger-bg text-danger-strong border border-danger-border",
};

const RUN_STATUS_CLS: Record<string, string> = {
  ok:             "bg-success-bg text-success-text border border-success-border",
  partial:        "bg-warning-bg text-warning-text border border-warning-border",
  failed:         "bg-danger-bg text-danger-strong border border-danger-border",
  cookie_expired: "bg-danger-bg text-danger-strong border border-danger-border",
  running:        "bg-info-bg text-info-text border border-info-border",
};


export default function ScrapesPage() {
  const [statusFilter, setStatusFilter] = useState<string>("");

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["pipeline-stats"],
    queryFn: () => api.pipelineStats(),
    refetchInterval: 15_000,
  });

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["listings", statusFilter],
    queryFn: () => api.listings({ llm_status: statusFilter || undefined, limit: 200 }),
    refetchInterval: 15_000,
  });

  const { data: runs = [] } = useQuery({
    queryKey: ["scrape-runs"],
    queryFn: () => api.scrapeRuns(20),
    refetchInterval: 15_000,
  });

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <h1 className="text-2xl font-bold text-text-primary">Scrapes</h1>

      {/* Pipeline stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total",       value: stats.total,   cls: "text-text-primary" },
            { label: "Pending LLM", value: stats.pending, cls: "text-warning-strong" },
            { label: "Extracted",   value: stats.valid,   cls: "text-success-strong" },
            { label: "Failed",      value: stats.invalid, cls: "text-danger-strong" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="card p-4">
              <p className="label-caps mb-2">{label}</p>
              <p className={`font-mono text-3xl font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Recent scrape runs */}
      {runs.length > 0 && (
        <div>
          <p className="label-caps mb-2">Recent scrape runs</p>
          {runs.some((r) => r.status === "cookie_expired") && (
            <div className="mb-3 rounded-xl p-3 bg-danger-bg border border-danger-border text-danger-strong text-sm font-medium">
              ⚠ Facebook cookies have expired — update <code>FB_COOKIES_PATH</code> to resume Facebook scraping.
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-border-default">
            <table className="w-full text-sm text-left">
              <thead className="bg-surface-subtle border-b border-border-default">
                <tr>
                  {["Status", "Source", "Started", "Found", "New"].map((h) => (
                    <th key={h} className="px-4 py-3 label-caps">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-surface divide-y divide-border-default">
                {runs.map((r: ScrapeRunSummary) => (
                  <tr key={r.id} className="hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${RUN_STATUS_CLS[r.status ?? ""] ?? "bg-surface-subtle text-text-muted"}`}>
                        {r.status ?? "—"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">{r.source ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-text-faint">
                      {r.started_at ? new Date(r.started_at).toLocaleString("en-GB") : "—"}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-text-secondary">{r.listings_found ?? "—"}</td>
                    <td className="px-4 py-2.5 font-mono text-text-secondary">{r.listings_new ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 items-center">
        <span className="label-caps mr-1">Filter</span>
        {["", "pending", "valid", "invalid"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-text-primary text-brand-fg"
                : "bg-surface-subtle text-text-secondary hover:bg-surface border border-border-default"
            }`}
          >
            {s === "" ? "All" : s}
          </button>
        ))}
        <span className="ml-auto font-mono text-sm text-text-faint">{listings.length} listings</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="w-full text-sm text-left">
          <thead className="bg-surface-subtle border-b border-border-default">
            <tr>
              {["Status", "Source", "Photo", "Vehicle", "Year", "Price", "Mileage", "Colour", "Reg", "Scraped", ""].map((h) => (
                <th key={h} className="px-4 py-3 label-caps">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-surface divide-y divide-border-default">
            {isLoading && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-text-muted text-sm">Loading…</td>
              </tr>
            )}
            {!isLoading && listings.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-text-muted text-sm">
                  No listings found. Run a scrape first.
                </td>
              </tr>
            )}
            {listings.map((l: ListingSummary) => {
              const thumb = l.image_urls?.[0]?.replace("/w1400/", "/w200/");
              return (
                <tr key={l.id} className="hover:bg-surface-subtle transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_CLS[l.llm_status] ?? "bg-surface-subtle text-text-muted"}`}>
                      {l.llm_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`badge ${l.source === "gumtree" ? "badge-private" : "badge-basic"}`}>
                      {l.source === "gumtree" ? "Gumtree" : "AutoTrader"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {thumb ? (
                      <img src={thumb} alt="" className="w-20 h-14 object-cover rounded-lg border border-border-default" />
                    ) : (
                      <div className="w-20 h-14 bg-surface-subtle rounded-lg border border-border-default flex items-center justify-center">
                        <span className="text-text-faint text-[10px]">No photo</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-text-primary">
                    {l.make && l.model
                      ? <div>
                          <div>{l.make} {l.model}{l.variant ? ` ${l.variant}` : ""}</div>
                          {l.body_type && <div className="text-xs text-text-faint font-normal mt-0.5">{l.body_type}</div>}
                        </div>
                      : <span className="text-text-faint font-normal italic text-xs">Not extracted</span>
                    }
                  </td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{l.year ?? "—"}</td>
                  <td className="px-4 py-3 font-mono font-medium text-text-primary">{fmt.gbp(l.price_gbp)}</td>
                  <td className="px-4 py-3 font-mono text-text-secondary">{fmt.miles(l.mileage)}</td>
                  <td className="px-4 py-3 text-text-muted">{l.colour ?? "—"}</td>
                  <td className="px-4 py-3 font-mono text-xs text-text-muted">{l.registration ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-text-faint">
                    {l.first_seen_at ? new Date(l.first_seen_at).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a href={l.url} target="_blank" rel="noopener noreferrer"
                      className="text-text-muted hover:text-text-primary text-xs font-medium transition-colors">
                      View ↗
                    </a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
