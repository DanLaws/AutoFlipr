import { useState } from "react";
import type { FlipIn } from "../api/client";

export { type FlipIn };

export const EMPTY_FORM: FlipIn = {
  make: "", model: "", year: null, mileage: null,
  purchase_price: 0, sale_price: null, additional_costs: 0,
  date_bought: new Date().toISOString().slice(0, 10),
  date_sold: null, source: null, notes: null,
};

export function parseNum(s: string): number | null {
  const n = parseFloat(s);
  return isNaN(n) ? null : Math.round(n);
}

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  return `£${n.toLocaleString("en-GB")}`;
}

function fmtProfit(n: number | null | undefined): React.ReactElement {
  if (n == null) return <span className="text-text-faint">—</span>;
  const cls = n > 0
    ? "text-success-text font-semibold"
    : n < 0
    ? "text-danger-text font-semibold"
    : "text-text-muted";
  return <span className={cls}>{n > 0 ? "+" : ""}{fmt(n)}</span>;
}

interface FlipModalProps {
  initial: FlipIn | null;
  onClose: () => void;
  onSave: (data: FlipIn) => Promise<void>;
}

export default function FlipModal({ initial, onClose, onSave }: FlipModalProps) {
  const [form, setForm] = useState<FlipIn>(initial ?? { ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function set<K extends keyof FlipIn>(k: K, v: FlipIn[K]) {
    setForm(f => ({ ...f, [k]: v }));
  }

  const totalCost = form.purchase_price + (form.additional_costs ?? 0);
  const profit = form.sale_price != null ? form.sale_price - totalCost : null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.make.trim() || !form.model.trim()) { setErr("Make and model are required"); return; }
    if (!form.purchase_price) { setErr("Purchase price is required"); return; }
    setSaving(true);
    setErr(null);
    try {
      await onSave(form);
      onClose();
    } catch {
      setErr("Failed to save — please try again");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.65)" }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-text-primary">
            {initial ? "Edit flip" : "Log a flip"}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary transition-colors">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Make <span className="text-danger-text">*</span></span>
              <input className="input mt-1" value={form.make}
                onChange={e => set("make", e.target.value)} placeholder="Ford" />
            </label>
            <label className="block">
              <span className="field-label">Model <span className="text-danger-text">*</span></span>
              <input className="input mt-1" value={form.model}
                onChange={e => set("model", e.target.value)} placeholder="Focus" />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Year</span>
              <input className="input mt-1" type="number" min="1990" max="2030"
                value={form.year ?? ""}
                onChange={e => set("year", parseNum(e.target.value))} />
            </label>
            <label className="block">
              <span className="field-label">Mileage</span>
              <input className="input mt-1" type="number" min="0"
                value={form.mileage ?? ""}
                onChange={e => set("mileage", parseNum(e.target.value))} />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <label className="block">
              <span className="field-label">Bought (£) <span className="text-danger-text">*</span></span>
              <input className="input mt-1" type="number" min="0"
                value={form.purchase_price || ""}
                onChange={e => set("purchase_price", parseNum(e.target.value) ?? 0)} />
            </label>
            <label className="block">
              <span className="field-label">Sold (£)</span>
              <input className="input mt-1" type="number" min="0"
                value={form.sale_price ?? ""}
                onChange={e => set("sale_price", parseNum(e.target.value))} />
            </label>
            <label className="block">
              <span className="field-label">Extra costs (£)</span>
              <input className="input mt-1" type="number" min="0"
                value={form.additional_costs || ""}
                onChange={e => set("additional_costs", parseNum(e.target.value) ?? 0)} />
            </label>
          </div>

          <div className="flex gap-4 px-3 py-2.5 rounded-lg bg-surface-subtle border border-border-default text-sm">
            <span className="text-text-muted">Total cost: <strong className="text-text-primary">{fmt(totalCost)}</strong></span>
            <span className="text-text-muted">Profit: <strong>{fmtProfit(profit)}</strong></span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="field-label">Date bought <span className="text-danger-text">*</span></span>
              <input className="input mt-1" type="date" value={form.date_bought}
                onChange={e => set("date_bought", e.target.value)} />
            </label>
            <label className="block">
              <span className="field-label">Date sold</span>
              <input className="input mt-1" type="date" value={form.date_sold ?? ""}
                onChange={e => set("date_sold", e.target.value || null)} />
            </label>
          </div>

          <label className="block">
            <span className="field-label">Source</span>
            <select className="input mt-1" value={form.source ?? ""}
              onChange={e => set("source", e.target.value || null)}>
              <option value="">— Select —</option>
              <option value="autotrader">AutoTrader</option>
              <option value="gumtree">Gumtree</option>
              <option value="facebook">Facebook</option>
              <option value="other">Other</option>
            </select>
          </label>

          <label className="block">
            <span className="field-label">Notes</span>
            <textarea className="input mt-1 resize-none" rows={2}
              value={form.notes ?? ""}
              onChange={e => set("notes", e.target.value || null)} />
          </label>

          {err && <p className="text-sm text-danger-text">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button type="submit" disabled={saving} className="btn btn-primary">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
