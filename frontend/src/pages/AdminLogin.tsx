import { useState, FormEvent } from "react";

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

const ADMIN_KEY = "cf_admin_token";

export function getAdminBasic(): string | null {
  try {
    const stored = sessionStorage.getItem(ADMIN_KEY);
    if (stored) return "Bearer " + stored;
  } catch {}
  return null;
}

export function clearAdminCreds() {
  sessionStorage.removeItem(ADMIN_KEY);
}

export default function AdminLoginPage({ onSuccess, onBack }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const encoded = btoa(`${username}:${password}`);
      const res = await fetch("/api/admin/token", {
        method: "POST",
        headers: { Authorization: `Basic ${encoded}` },
      });
      if (res.status === 401) throw new Error("Invalid admin credentials");
      if (!res.ok) throw new Error("Server error");
      const { access_token } = await res.json();
      sessionStorage.setItem(ADMIN_KEY, access_token);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "var(--color-page)" }}>
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <p className="text-lg font-bold text-text-primary tracking-tight">AutoFlipr</p>
          <div className="mt-1.5 flex items-center justify-center">
            <span className="badge badge-admin">Admin</span>
          </div>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="label-caps block mb-1.5">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="input w-full"
                placeholder="admin"
              />
            </div>
            <div>
              <label className="label-caps block mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="input w-full"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger-strong">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn w-full py-2.5 text-sm bg-warning-strong text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading ? "Signing in…" : "Sign in to admin"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button onClick={onBack} className="text-sm text-text-muted hover:text-text-primary transition-colors">
              ← Back to app
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
