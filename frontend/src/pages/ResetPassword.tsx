import { useState, FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";

export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [password, setPassword]   = useState("");
  const [confirm, setConfirm]     = useState("");
  const [loading, setLoading]     = useState(false);
  const [done, setDone]           = useState(false);
  const [error, setError]         = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Something went wrong" }));
        throw new Error(err.detail ?? "Something went wrong");
      }
      setDone(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: "var(--color-page)" }}
    >
      <SEO
        title="Set New Password"
        description="Set a new password for your AutoFlipr account."
        canonical="/reset-password"
        noindex
      />

      <div
        className="pointer-events-none fixed inset-0"
        style={{
          backgroundImage: `
            linear-gradient(var(--grid-line) 1px, transparent 1px),
            linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)
          `,
          backgroundSize: "40px 40px",
          WebkitMaskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 80%)",
          maskImage: "radial-gradient(ellipse 60% 60% at 50% 50%, black 20%, transparent 80%)",
        }}
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="text-center">
            <p className="font-semibold text-text-primary tracking-tight">AutoFlipr</p>
            <p className="text-sm text-text-muted mt-0.5">Set a new password</p>
          </div>
        </div>

        <div className="card p-8">
          {!token ? (
            <div className="text-center space-y-4">
              <p className="text-sm text-text-muted">This reset link is invalid or has already been used.</p>
              <a href="/forgot-password" className="block text-sm font-semibold text-text-primary hover:underline">
                Request a new link
              </a>
            </div>
          ) : done ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-success-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-text-primary">Password updated</p>
                <p className="text-sm text-text-muted mt-1">You can now sign in with your new password.</p>
              </div>
              <a href="/login" className="block text-sm font-semibold text-text-primary hover:underline">
                Sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label-caps block mb-1.5">New password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border-default bg-surface text-text-primary text-sm placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-shadow"
                  style={{ "--tw-ring-color": "var(--color-text-primary)" } as React.CSSProperties}
                  placeholder="Min. 8 characters"
                />
              </div>

              <div>
                <label className="label-caps block mb-1.5">Confirm new password</label>
                <input
                  type="password"
                  required
                  value={confirm}
                  onChange={e => setConfirm(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border-default bg-surface text-text-primary text-sm placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-shadow"
                  style={{ "--tw-ring-color": "var(--color-text-primary)" } as React.CSSProperties}
                  placeholder="Repeat your password"
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
                className="btn btn-primary w-full py-2.5 text-sm"
              >
                {loading ? "Saving…" : "Set new password"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
