import { useState, FormEvent } from "react";

interface Props {
  onSuccess: () => void;
  onBack: () => void;
}

const ADMIN_KEY = "cf_admin_creds";

export function getAdminBasic(): string | null {
  try {
    const stored = sessionStorage.getItem(ADMIN_KEY);
    if (stored) return "Basic " + stored;
  } catch {}
  return null;
}

export function clearAdminCreds() {
  sessionStorage.removeItem(ADMIN_KEY);
}

export default function AdminLoginPage({ onSuccess, onBack }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      // Verify credentials against the health/listings endpoint with Basic auth
      const encoded = btoa(`${username}:${password}`);
      const res = await fetch("/api/listings/pipeline/stats", {
        headers: { Authorization: `Basic ${encoded}` },
      });
      if (res.status === 401) throw new Error("Invalid admin credentials");
      if (!res.ok) throw new Error("Server error");

      // Store encoded creds in sessionStorage (not localStorage — cleared on tab close)
      sessionStorage.setItem(ADMIN_KEY, encoded);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <span className="text-2xl font-bold tracking-tight text-gray-900">AutoFlipr</span>
          <div className="mt-1 flex items-center justify-center gap-1.5">
            <span className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
              Admin
            </span>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Username</label>
              <input
                type="text"
                required
                value={username}
                onChange={e => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="admin"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-lg bg-amber-500 text-white text-sm font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
            >
              {loading ? "Signing in…" : "Sign in to admin"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={onBack}
              className="text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              ← Back to app
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
