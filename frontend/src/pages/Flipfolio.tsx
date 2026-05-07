import { useState, useMemo } from "react";
import type { FlipEntry, FlipIn } from "../api/client";
import FlipModal from "../components/FlipModal";
import FlipfolioAnalytics from "../components/FlipfolioAnalytics";
import ListingAssistant from "../components/ListingAssistant";
import { fmt } from "../utils/formatters";
import { useFlipfolio } from "../hooks/useFlipfolio";

type SortKey = "profit" | "date_sold";
type SortDir = "asc" | "desc";

function fmtProfit(n: number | null | undefined): React.ReactElement {
  if (n == null) return <span className="text-text-faint">—</span>;
  const cls = n > 0 ? "text-success-text font-semibold" : n < 0 ? "text-danger-text font-semibold" : "text-text-muted";
  return <span className={cls}>{n > 0 ? "+" : ""}{fmt.gbp(n)}</span>;
}

const SOURCE_LABELS: Record<string, string> = {
  autotrader: "AutoTrader", gumtree: "Gumtree", facebook: "Facebook", other: "Other",
};
function sourceLabel(s: string | null) { return s ? (SOURCE_LABELS[s] ?? s) : "—"; }

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FlipfolioPage() {
  const { entries, isLoading, create, update, remove } = useFlipfolio();

  const [modal, setModal] = useState<"add" | FlipEntry | null>(null);
  const [listingEntry, setListingEntry] = useState<FlipEntry | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date_sold");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "sold">("all");

  async function handleSave(data: FlipIn) {
    if (modal === "add") {
      await create(data);
    } else if (modal && typeof modal === "object") {
      await update(modal.id, data);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this flip entry?")) return;
    await remove(id);
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sources = useMemo(() => {
    const set = new Set(entries.map(e => e.source).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    let list = [...entries];
    if (statusFilter === "active") list = list.filter(e => !e.date_sold);
    else if (statusFilter === "sold") list = list.filter(e => !!e.date_sold);
    if (sourceFilter) list = list.filter(e => e.source === sourceFilter);
    list.sort((a, b) => {
      let av: number, bv: number;
      if (sortKey === "profit") { av = a.profit ?? -Infinity; bv = b.profit ?? -Infinity; }
      else { av = a.date_sold ? new Date(a.date_sold).getTime() : 0; bv = b.date_sold ? new Date(b.date_sold).getTime() : 0; }
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return list;
  }, [entries, statusFilter, sourceFilter, sortKey, sortDir]);

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sortKey === k;
    return (
      <button onClick={() => toggleSort(k)}
        className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
          active ? "border-text-primary bg-surface-subtle text-text-primary font-medium"
                 : "border-border-default text-text-muted hover:text-text-primary"
        }`}>
        {label} {active ? (sortDir === "asc" ? "↑" : "↓") : ""}
      </button>
    );
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Flipfolio</h1>
          <p className="text-sm text-text-muted mt-0.5">Track your completed car flips</p>
        </div>
        <button onClick={() => setModal("add")} className="btn btn-primary">+ Log a flip</button>
      </div>

      {isLoading ? (
        <p className="text-sm text-text-muted">Loading…</p>
      ) : entries.length === 0 ? (
        <div className="card text-center py-16">
          <p className="text-text-muted mb-1">No flips logged yet</p>
          <p className="text-sm text-text-faint">Click "Log a flip" to record your first deal.</p>
        </div>
      ) : (
        <>
          <FlipfolioAnalytics entries={entries} />
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex rounded-lg border border-border-default overflow-hidden text-xs">
              {(["all", "active", "sold"] as const).map((v) => (
                <button key={v} onClick={() => setStatusFilter(v)}
                  className={`px-3 py-1.5 font-medium transition-colors ${
                    statusFilter === v
                      ? "bg-text-primary text-brand-fg"
                      : "bg-surface text-text-secondary hover:bg-surface-subtle"
                  }`}>
                  {v === "all" ? "All" : v === "active" ? "In progress" : "Sold"}
                </button>
              ))}
            </div>
            <span className="text-xs text-text-muted ml-2">Sort:</span>
            <SortBtn k="date_sold" label="Date sold" />
            <SortBtn k="profit" label="Profit" />
            {sources.length > 0 && (
              <>
                <span className="text-xs text-text-muted ml-2">Source:</span>
                <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}
                  className="input !py-1 !text-xs !h-auto w-auto">
                  <option value="">All</option>
                  {sources.map(s => <option key={s} value={s}>{sourceLabel(s)}</option>)}
                </select>
              </>
            )}
          </div>
          <div className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-default text-left text-xs text-text-muted">
                  <th className="px-4 py-3 font-medium">Car</th>
                  <th className="px-4 py-3 font-medium">Bought</th>
                  <th className="px-4 py-3 font-medium">Sold</th>
                  <th className="px-4 py-3 font-medium">Extra</th>
                  <th className="px-4 py-3 font-medium">Profit</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Date sold</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filtered.map(e => (
                  <tr key={e.id} className="border-b border-border-default last:border-0 hover:bg-surface-subtle transition-colors">
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {[e.year, e.make, e.model].filter(Boolean).join(" ")}
                      {e.mileage ? <span className="text-xs text-text-faint ml-1">({e.mileage.toLocaleString()}mi)</span> : null}
                    </td>
                    <td className="px-4 py-3 text-text-secondary">{fmt.gbp(e.purchase_price)}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.sale_price != null ? fmt.gbp(e.sale_price) : <span className="text-text-faint">—</span>}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.additional_costs > 0 ? fmt.gbp(e.additional_costs) : <span className="text-text-faint">—</span>}</td>
                    <td className="px-4 py-3">{fmtProfit(e.profit)}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.days_to_sell ?? <span className="text-text-faint">—</span>}</td>
                    <td className="px-4 py-3 text-text-secondary">{sourceLabel(e.source)}</td>
                    <td className="px-4 py-3 text-text-secondary">{e.date_sold ?? <span className="text-text-faint">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <button onClick={() => setListingEntry(e)} className="text-xs text-text-muted hover:text-text-primary transition-colors">Listing assistant</button>
                        <button onClick={() => setModal(e)} className="text-xs text-text-muted hover:text-text-primary transition-colors">Edit</button>
                        <button onClick={() => handleDelete(e.id)} className="text-xs text-danger-text hover:opacity-70 transition-opacity">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {listingEntry && (
        <ListingAssistant
          entry={listingEntry}
          onClose={() => setListingEntry(null)}
        />
      )}

      {modal !== null && (
        <FlipModal
          initial={modal === "add" ? null : {
            make: modal.make, model: modal.model, year: modal.year, mileage: modal.mileage,
            purchase_price: modal.purchase_price, sale_price: modal.sale_price,
            additional_costs: modal.additional_costs, date_bought: modal.date_bought,
            date_sold: modal.date_sold, source: modal.source, notes: modal.notes,
            colour: modal.colour, fuel: modal.fuel, transmission: modal.transmission,
            features: modal.features, mot_advisories: modal.mot_advisories,
          }}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
