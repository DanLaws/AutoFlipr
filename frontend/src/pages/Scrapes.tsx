import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, ListingSummary } from "../api/client";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border border-amber-200",
  valid: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  invalid: "bg-red-50 text-red-600 border border-red-200",
};

function fmt(n: number | null | undefined, suffix = "") {
  if (n == null) return "—";
  return n.toLocaleString() + suffix;
}

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

  return (
    <div className="space-y-6 max-w-screen-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900">Scrapes</h1>

      {/* Pipeline stats */}
      {!statsLoading && stats && (
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: "Total", value: stats.total, cls: "text-gray-900" },
            { label: "Pending LLM", value: stats.pending, cls: "text-amber-600" },
            { label: "Extracted", value: stats.valid, cls: "text-emerald-600" },
            { label: "Failed", value: stats.invalid, cls: "text-red-500" },
          ].map(({ label, value, cls }) => (
            <div key={label} className="border border-gray-200 rounded-xl p-4 bg-white">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
              <p className={`text-3xl font-bold ${cls}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex gap-2 items-center">
        <span className="text-sm font-medium text-gray-500 mr-1">Filter:</span>
        {["", "pending", "valid", "invalid"].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              statusFilter === s
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-900"
            }`}
          >
            {s === "" ? "All" : s}
          </button>
        ))}
        <span className="ml-auto text-sm text-gray-400">{listings.length} listings</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Status", "Source", "Photo", "Vehicle", "Year", "Price", "Mileage", "Colour", "Reg", "Scraped", ""].map((h) => (
                <th key={h} className="px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-100">
            {isLoading && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && listings.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-10 text-center text-gray-400 text-sm">
                  No listings found. Run a scrape first.
                </td>
              </tr>
            )}
            {listings.map((l: ListingSummary) => {
              const thumb = l.image_urls?.[0]?.replace('/w1400/', '/w200/');
              return (
                <tr key={l.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_STYLES[l.llm_status] ?? "bg-gray-100 text-gray-500"}`}>
                      {l.llm_status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      l.source === "gumtree"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : "bg-blue-50 text-blue-700 border border-blue-200"
                    }`}>
                      {l.source === "gumtree" ? "Gumtree" : "AutoTrader"}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt=""
                        className="w-20 h-14 object-cover rounded-lg border border-gray-100"
                      />
                    ) : (
                      <div className="w-20 h-14 bg-gray-100 rounded-lg border border-gray-200 flex items-center justify-center">
                        <span className="text-gray-400 text-[10px]">No photo</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">
                    {l.make && l.model
                      ? <div>
                          <div>{l.make} {l.model}{l.variant ? ` ${l.variant}` : ""}</div>
                          {l.body_type && <div className="text-xs text-gray-400 font-normal mt-0.5">{l.body_type}</div>}
                        </div>
                      : <span className="text-gray-400 font-normal italic text-xs">Not extracted</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{fmt(l.year)}</td>
                  <td className="px-4 py-3 text-gray-700 font-medium">{l.price_gbp ? `£${fmt(l.price_gbp)}` : "—"}</td>
                  <td className="px-4 py-3 text-gray-600">{l.mileage ? `${fmt(l.mileage)} mi` : "—"}</td>
                  <td className="px-4 py-3 text-gray-500">{l.colour ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono text-xs">{l.registration ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-400 text-xs">
                    {l.first_seen_at ? new Date(l.first_seen_at).toLocaleDateString("en-GB") : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-gray-500 hover:text-gray-900 text-xs font-medium transition-colors"
                    >
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
