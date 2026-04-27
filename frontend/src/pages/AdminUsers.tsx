import { useState, useEffect, useCallback } from "react";
import { getAdminBasic } from "./AdminLogin";

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

const PLAN_STYLES: Record<string, string> = {
  free:  "bg-gray-100 text-gray-600",
  basic: "bg-blue-50 text-blue-700 border border-blue-200",
  pro:   "bg-indigo-50 text-indigo-700 border border-indigo-200",
};

const PLAN_OPTIONS = ["free", "basic", "pro"] as const;

function adminFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const auth = getAdminBasic() ?? "";
  return fetch(path, {
    ...options,
    headers: {
      Authorization: auth,
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  }).then(async res => {
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: "Request failed" }));
      throw new Error(err.detail ?? "Request failed");
    }
    if (res.status === 204) return undefined as T;
    return res.json();
  });
}

// ── Inline editable plan badge ─────────────────────────────────────────────

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
      await adminFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ plan }),
      });
      onChange(userId, plan);
    } finally {
      setSaving(false);
      setOpen(false);
    }
  }

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(o => !o)}
        disabled={saving}
        className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize cursor-pointer hover:opacity-80 transition-opacity ${PLAN_STYLES[current]}`}
      >
        {saving ? "…" : current}
        <span className="ml-1 opacity-40">▾</span>
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1 min-w-[90px]">
          {PLAN_OPTIONS.map(p => (
            <button
              key={p}
              onClick={() => select(p)}
              className={`w-full text-left px-3 py-1.5 text-xs capitalize hover:bg-gray-50 transition-colors ${p === current ? "font-semibold" : "text-gray-700"}`}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Toggle (admin / active) ─────────────────────────────────────────────────

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
      await adminFetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: !value }),
      });
      onChange(userId, field, !value);
    } finally {
      setSaving(false);
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${
        value ? "bg-gray-900" : "bg-gray-200"
      } ${saving ? "opacity-50" : ""}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          value ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

// ── Delete button ───────────────────────────────────────────────────────────

function DeleteButton({ userId, email, onDelete }: {
  userId: number;
  email: string;
  onDelete: (id: number) => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  async function del() {
    setSaving(true);
    try {
      await adminFetch(`/api/admin/users/${userId}`, { method: "DELETE" });
      onDelete(userId);
    } finally {
      setSaving(false);
      setConfirm(false);
    }
  }

  if (confirm) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-red-600">Delete {email.split("@")[0]}?</span>
        <button onClick={del} disabled={saving} className="text-xs text-red-600 font-semibold hover:underline">
          {saving ? "…" : "Yes"}
        </button>
        <button onClick={() => setConfirm(false)} className="text-xs text-gray-400 hover:underline">
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirm(true)}
      className="text-gray-300 hover:text-red-500 transition-colors"
      title="Delete user"
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
    </button>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminFetch<UserRow[]>("/api/admin/users");
      setUsers(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handlePlanChange(id: number, plan: string) {
    setUsers(u => u.map(r => r.id === id ? { ...r, plan: plan as UserRow["plan"] } : r));
  }

  function handleToggle(id: number, field: string, val: boolean) {
    setUsers(u => u.map(r => r.id === id ? { ...r, [field]: val } : r));
  }

  function handleDelete(id: number) {
    setUsers(u => u.filter(r => r.id !== id));
  }

  const filtered = users.filter(u =>
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  const stats = {
    total: users.length,
    free: users.filter(u => u.plan === "free").length,
    basic: users.filter(u => u.plan === "basic").length,
    pro: users.filter(u => u.plan === "pro").length,
    inactive: users.filter(u => !u.is_active).length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-400 mt-0.5">Manage plans, permissions and accounts</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: "Total", value: stats.total, color: "text-gray-900" },
          { label: "Free", value: stats.free, color: "text-gray-500" },
          { label: "Basic", value: stats.basic, color: "text-blue-600" },
          { label: "Pro", value: stats.pro, color: "text-indigo-600" },
          { label: "Suspended", value: stats.inactive, color: "text-red-500" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-16 text-sm text-gray-400">Loading users…</div>
      ) : error ? (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-visible">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Plan</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Scans</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Active</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Stripe</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-sm text-gray-400">
                    {search ? "No users match your search" : "No users yet"}
                  </td>
                </tr>
              ) : filtered.map(user => (
                <tr
                  key={user.id}
                  className={`hover:bg-gray-50 transition-colors ${!user.is_active ? "opacity-50" : ""}`}
                >
                  {/* Email */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                        {user.email[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 leading-none">{user.email}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">ID #{user.id}</p>
                      </div>
                    </div>
                  </td>

                  {/* Plan */}
                  <td className="px-4 py-3">
                    <PlanSelect userId={user.id} current={user.plan} onChange={handlePlanChange} />
                  </td>

                  {/* Scan count */}
                  <td className="px-4 py-3">
                    <span className="text-gray-700">{user.scan_count}</span>
                    {user.scan_month && (
                      <span className="text-gray-400 text-xs ml-1">/ {user.scan_month}</span>
                    )}
                  </td>

                  {/* Admin toggle */}
                  <td className="px-4 py-3">
                    <Toggle userId={user.id} field="is_admin" value={user.is_admin} onChange={handleToggle} />
                  </td>

                  {/* Active toggle */}
                  <td className="px-4 py-3">
                    <Toggle userId={user.id} field="is_active" value={user.is_active} onChange={handleToggle} />
                  </td>

                  {/* Stripe */}
                  <td className="px-4 py-3">
                    {user.stripe_customer_id ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        Connected
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>

                  {/* Joined */}
                  <td className="px-4 py-3 text-xs text-gray-400 whitespace-nowrap">
                    {new Date(user.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </td>

                  {/* Delete */}
                  <td className="px-4 py-3">
                    <DeleteButton userId={user.id} email={user.email} onDelete={handleDelete} />
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
