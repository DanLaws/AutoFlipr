import { useState, FormEvent } from "react";
import SEO from "../components/SEO";

export default function ForgotPasswordPage() {
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Something went wrong" }));
        throw new Error(err.detail ?? "Something went wrong");
      }
      setSent(true);
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
        title="Reset Password"
        description="Reset your AutoFlipr account password."
        canonical="/forgot-password"
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
            <p className="text-sm text-text-muted mt-0.5">Reset your password</p>
          </div>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-success-bg flex items-center justify-center mx-auto">
                <svg className="w-6 h-6 text-success-strong" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-text-primary">Check your email</p>
                <p className="text-sm text-text-muted mt-1">
                  If an account exists for <strong>{email}</strong>, we've sent a reset link. Check your spam folder too.
                </p>
              </div>
              <a href="/login" className="block text-sm font-semibold text-text-primary hover:underline">
                Back to sign in
              </a>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <p className="text-sm text-text-muted">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              <div>
                <label className="label-caps block mb-1.5">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-border-default bg-surface text-text-primary text-sm placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-offset-0 focus:border-transparent transition-shadow"
                  style={{ "--tw-ring-color": "var(--color-text-primary)" } as React.CSSProperties}
                  placeholder="you@example.com"
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
                {loading ? "Sending…" : "Send reset link"}
              </button>

              <div className="text-center">
                <a href="/login" className="text-sm text-text-muted hover:text-text-primary transition-colors">
                  Back to sign in
                </a>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
