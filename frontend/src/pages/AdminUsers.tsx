import { useState, useEffect, useCallback } from "react";
import { apiFetch, apiPatch, apiDelete } from "../api/client";

interface UserRow {
  id: number;
  email: string;
  plan: "free" | "basic" | "pro";
  scan_count: number;
  scan_month: string | null;
  is_admin: boolean;
  is_active: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
}

const PLAN_OPTIONS = ["free", "basic", "pro"] as const;


function PlanSelect({ userId, current, onChange }: {
  userId: number;
  current: string;
  onChange: (id: number, plan: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function select(plan: string) {
    if (plan === current) { setOpen(false); return; }
    setSaving(true);
    try {
      await apiPatch(`/api/admin/users/${userId}`, { plan });
      onChange(userId, plan);
    } finally { setSaving(false); setOpen(false); }
  }

  const badgeCls =
    current === "pro"   ? "badge badge-pro" :
    current === "basic" ? "badge badge-basic" :
                          "badge badge-free";

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={`${badgeCls} cursor-pointer hover:opacity-80 transition-opacity capitalize`}
      >
        {saving ? "…" : current}
        <span className="ml-1 opacity-40">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 py-1 rounded-lg border border-border-default min-w-[90px]"
          style={{ background: "var(--color-surface)", boxShadow: "var(--shadow-md)" }}>
          {PLAN_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => select(p)}
              className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-surface-subtle transition-colors ${
                p === current ? "font-semibold text-text-primary" : "text-text-secondary"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ userId, field, value, onChange }: {
  userId: number;
  field: "is_admin" | "is_active";
  value: boolean;
  onChange: (id: number, field: string, val: boolean) => void;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle() {
    setSaving(true);
    try {
      await apiPatch(`/api/admin/users/${userId}`, { [field]: !value });
      onChange(userId, field, !value);
    } finally { setSaving(false); }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        value ? "bg-text-primary" : "bg-border-strong"
      } ${saving ? "opacity-50" : ""}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-brand-fg shadow transition-transform ${
        value ? "translate-x-4" : "translate-x-1"
      }`} />
    </button>
  );
}

function DeleteButton({ userId, email, onDelete }: {
  userId: number; email: string; onDelete: (id: number) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function del() {
    setSaving(true);
    try {
      await apiDelete(`/api/admin/users/${userId}`);
      onDelete(userId);
    } finally { setSaving(false); setConfirm(false); }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-danger-strong">Delete {email.split("@")[0]}?</span>
        <button onClick={del} disabled={saving} className="text-xs text-danger-strong font-semibold hover:underline">
          {saving ? "…" : "Yes"}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-text-faint hover:underline">No</button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirm(true)} className="text-text-faint hover:text-danger-strong transition-colors" title="Delete user">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      setUsers(await apiFetch<UserRow[]>("/api/admin/users"));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u => u.email.toLowerCase().includes(search.toLowerCase()));
  const stats = {
    total:    users.length,
    free:     users.filter(u => u.plan === "free").length,
    basic:    users.filter(u => u.plan === "basic").length,
    pro:      users.filter(u => u.plan === "pro").length,
    inactive: users.filter(u => !u.is_active).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">User Management</h1>
          <p className="text-sm text-text-muted mt-0.5">Manage plans, permissions and accounts</p>
        </div>
        <button onClick={load} className="btn btn-secondary btn-sm gap-1.5">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total",     value: stats.total,    cls: "text-text-primary" },
          { label: "Free",      value: stats.free,     cls: "text-text-muted" },
          { label: "Basic",     value: stats.basic,    cls: "text-info-text" },
          { label: "Pro",       value: stats.pro,      cls: "text-warning-strong" },
          { label: "Suspended", value: stats.inactive, cls: "text-danger-strong" },
        ].map(s => (
          <div key={s.label} className="card px-4 py-3">
            <p className={`font-mono text-2xl font-bold ${s.cls}`}>{s.value}</p>
            <p className="label-caps mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="w-full pl-9 input"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-sm text-text-muted">Loading users…</div>
      ) : error ? (
        <div className="rounded-lg bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger-strong">{error}</div>
      ) : (
        <div className="card overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default bg-surface-subtle">
                {["User", "Plan", "Scans", "Admin", "Active", "Stripe", "Joined", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 label-caps">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border-faint">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm text-text-muted">
                    {search ? "No users match your search" : "No users yet"}
                  </td>
                </tr>
              ) : filtered.map(user => (
                <tr key={user.id} className={`hover:bg-surface-subtle transition-colors ${!user.is_active ? "opacity-50" : ""}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-surface-subtle border border-border-default flex items-center justify-center text-xs font-semibold text-text-secondary flex-shrink-0">
                        {user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-text-primary leading-none">{user.email}</p>
                        <p className="text-[11px] text-text-faint mt-0.5">ID #{user.id}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <PlanSelect userId={user.id} current={user.plan} onChange={(id, p) => setUsers(u => u.map(r => r.id === id ? { ...r, plan: p as UserRow["plan"] } : r))} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-text-primary">{user.scan_count}</span>
                    {user.scan_month && <span className="text-text-faint text-xs ml-1">/ {user.scan_month}</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Toggle userId={user.id} field="is_admin" value={user.is_admin} onChange={(id, f, v) => setUsers(u => u.map(r => r.id === id ? { ...r, [f]: v } : r))} />
                  </td>
                  <td className="px-4 py-3">
                    <Toggle userId={user.id} field="is_active" value={user.is_active} onChange={(id, f, v) => setUsers(u => u.map(r => r.id === id ? { ...r, [f]: v } : r))} />
                  </td>
                  <td className="px-4 py-3">
                    {user.stripe_customer_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-success-strong font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-success-strong" />Connected
                      </span>
                    ) : (
                      <span className="text-xs text-text-faint">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-text-faint whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-4 py-3">
                    <DeleteButton userId={user.id} email={user.email} onDelete={(id) => setUsers(u => u.filter(r => r.id !== id))} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
