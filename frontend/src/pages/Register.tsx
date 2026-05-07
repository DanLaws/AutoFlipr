import { useState, FormEvent } from "react";
import { useAuth } from "../contexts/AuthContext";
import SEO from "../components/SEO";

interface Props {
  onShowLogin: () => void;
  onSuccess: () => void;
}

function Logo() {
  return (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="var(--color-text-primary)" stroke="var(--color-text-primary)" />
      <path d="M7 22 L11.5 9 H13.5 L18 22" stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 18 H16" stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M19 13 H25 M22 10 L25 13 L22 16" stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M25 19 H19 M22 22 L19 19 L22 16" stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
    </svg>
  );
}

export default function RegisterPage({ onShowLogin, onSuccess }: Props) {
  const { register } = useAuth();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm]   = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

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
      await register(email, password);
      onSuccess();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed");
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
        title="Create Free Account"
        description="Create your free AutoFlipr account and start finding underpriced used cars across AutoTrader, Gumtree and Facebook Marketplace."
        canonical="/register"
        noindex
      />
      {/* Grid texture — centered radial mask */}
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
        {/* Logo + tagline */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <Logo />
          <div className="text-center">
            <p className="font-semibold text-text-primary tracking-tight">AutoFlipr</p>
            <p className="text-sm text-text-muted mt-0.5">Create your free account</p>
          </div>
        </div>

        {/* Card */}
        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
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

            <div>
              <label className="label-caps block mb-1.5">Password</label>
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
              <label className="label-caps block mb-1.5">Confirm password</label>
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
              {loading ? "Creating account…" : "Create free account"}
            </button>
          </form>

          <p className="mt-4 text-center text-xs text-text-faint">
            By signing up you agree to our{" "}
            <a href="/terms" className="underline hover:text-text-primary transition-colors">
              terms of service
            </a>
            {" "}and{" "}
            <a href="/privacy" className="underline hover:text-text-primary transition-colors">
              privacy policy
            </a>
            .
          </p>

          <div className="mt-4 text-center text-sm text-text-muted">
            Already have an account?{" "}
            <button
              onClick={onShowLogin}
              className="font-semibold text-text-primary hover:underline"
            >
              Sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
