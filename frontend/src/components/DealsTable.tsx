import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  SortingState,
} from "@tanstack/react-table";
import { useMemo, useState } from "react";
import type { Deal } from "../api/client";
import ScoreBadge from "./ScoreBadge";
import DealModal from "./DealModal";
import { fmt } from "../utils/formatters";

const col = createColumnHelper<Deal>();

// Deviation cell renders colored JSX — kept local since it returns ReactElement
const fmtPct = (v: number | null) =>
  v != null ? (
    <span className={`font-mono font-medium ${v < 0 ? "text-success-strong" : "text-danger-strong"}`}>
      {v > 0 ? "+" : ""}{v.toFixed(1)}%
    </span>
  ) : "—";

const staticColumns = [
  col.accessor("score", {
    header: "Score",
    cell: (i) => <ScoreBadge score={i.getValue()} confidence={i.row.original.confidence} size={40} />,
  }),
  col.accessor("image_urls", {
    header: "",
    enableSorting: false,
    cell: (i) => {
      const thumb = i.getValue()?.[0]?.replace("/w1400/", "/w200/");
      return thumb ? (
        <img src={thumb} alt="" className="w-20 h-14 object-cover rounded-lg border border-border-default" />
      ) : (
        <div className="w-20 h-14 bg-surface-subtle rounded-lg border border-border-default flex items-center justify-center">
          <span className="text-text-faint text-[10px]">No photo</span>
        </div>
      );
    },
  }),
  col.accessor((r) => `${r.year ?? ""} ${r.make ?? ""} ${r.model ?? ""}`.trim(), {
    id: "vehicle",
    header: "Vehicle",
    cell: (i) => {
      const d = i.row.original;
      return (
        <div>
          <span className="font-semibold text-text-primary">{i.getValue() || "Unknown"}</span>
          {d.variant && <div className="text-xs text-text-muted mt-0.5">{d.variant}</div>}
          {(d.body_type || d.colour) && (
            <div className="text-xs text-text-muted mt-0.5">
              {[d.colour, d.body_type].filter(Boolean).join(" · ")}
            </div>
          )}
          {(d.location || d.distance_miles != null) && (
            <div className="text-xs text-text-faint mt-0.5">
              {d.distance_miles != null ? `${d.distance_miles} mi away` : d.location}
            </div>
          )}
        </div>
      );
    },
  }),
  col.accessor("price_gbp", {
    header: "Price",
    cell: (i) => <span className="font-mono font-medium text-text-primary">{fmt.gbp(i.getValue())}</span>,
  }),
  col.accessor("estimated_margin_gbp", {
    header: "Margin",
    cell: (i) => {
      const v = i.getValue();
      if (v == null) return <span className="text-text-faint">—</span>;
      return (
        <span className={`font-mono font-semibold ${v > 0 ? "text-success-strong" : "text-danger-strong"}`}>
          {v > 0 ? "+" : "−"}£{Math.abs(Math.round(v)).toLocaleString("en-GB")}
        </span>
      );
    },
  }),
  col.accessor("price_deviation_pct", {
    header: "vs Market",
    cell: (i) => fmtPct(i.getValue()),
  }),
  col.accessor("mileage", {
    header: "Mileage",
    cell: (i) => <span className="font-mono text-text-secondary">{fmt.miles(i.getValue())}</span>,
  }),
  col.accessor("seller_type", {
    header: "Seller",
    cell: (i) => {
      const v = i.getValue();
      if (!v) return <span className="text-text-faint">—</span>;
      return (
        <span className={`badge ${v === "private" ? "badge-private" : "badge-trade"}`}>
          {v}
        </span>
      );
    },
  }),
  col.accessor("source", {
    header: "Source",
    cell: (i) => <span className="font-mono text-xs text-text-faint">{i.getValue()}</span>,
  }),
];

interface Props {
  data: Deal[];
  isLoading: boolean;
  bookmarked?: Set<number>;
  hidden?: Set<number>;
  onBookmark?: (id: number) => void;
  onHide?: (id: number) => void;
}

export default function DealsTable({ data, isLoading, bookmarked, hidden, onBookmark, onHide }: Props) {
  const [sorting, setSorting] = useState<SortingState>([{ id: "score", desc: true }]);
  const [selected, setSelected] = useState<Deal | null>(null);

  const columns = useMemo(() => {
    if (!onBookmark && !onHide) return staticColumns;
    return [
      ...staticColumns,
      col.display({
        id: "actions",
        header: "",
        cell: (i) => {
          const id = i.row.original.id;
          const isBookmarked = bookmarked?.has(id) ?? false;
          const isHidden     = hidden?.has(id)     ?? false;
          return (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              {onBookmark && (
                <button
                  onClick={() => onBookmark(id)}
                  title={isBookmarked ? "Remove from watchlist" : "Add to watchlist"}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                    isBookmarked
                      ? "text-warning-strong bg-warning-bg"
                      : "text-text-faint hover:text-warning-strong hover:bg-warning-bg"
                  }`}
                >
                  <svg className="w-4 h-4" fill={isBookmarked ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                </button>
              )}
              {onHide && (
                <button
                  onClick={() => onHide(id)}
                  title={isHidden ? "Unhide" : "Hide from feed"}
                  className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
                    isHidden
                      ? "text-text-secondary bg-surface-subtle"
                      : "text-text-faint hover:text-text-secondary hover:bg-surface-subtle"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 4.411m0 0L21 21" />
                  </svg>
                </button>
              )}
            </div>
          );
        },
      }),
    ];
  }, [bookmarked, hidden, onBookmark, onHide]);

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  if (isLoading) {
    return (
      <div className="text-center py-20 text-text-muted text-sm animate-pulse">
        Loading deals…
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="text-center py-20 text-text-muted text-sm">
        No deals found. Try adjusting your filters or wait for the next scrape.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="w-full text-sm">
          <thead className="bg-surface-subtle border-b border-border-default">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider whitespace-nowrap cursor-pointer select-none hover:text-text-primary transition-colors"
                    onClick={h.column.getToggleSortingHandler()}
                  >
                    {flexRender(h.column.columnDef.header, h.getContext())}
                    {h.column.getIsSorted() === "asc" ? " ↑" : h.column.getIsSorted() === "desc" ? " ↓" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-surface divide-y divide-border-default">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className="hover:bg-surface-subtle cursor-pointer transition-colors"
                onClick={() => setSelected(row.original)}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && <DealModal deal={selected} onClose={() => setSelected(null)} onHide={onHide} />}
    </>
  );
}
