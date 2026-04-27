import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";

interface Props {
  onClose?: () => void;
}

type Interval = "monthly" | "annual";

const TIERS = [
  {
    id: "free",
    name: "Free",
    monthly: 0,
    annual: 0,
    scans: "5 URL scans per month",
    features: [
      "Full UK cost breakdown per scan",
      "Road tax, MOT, repair buffer & fuel costs",
      "Net profit calculation",
    ],
    cta: "Get started for free",
    highlight: false,
  },
  {
    id: "basic",
    name: "Basic",
    monthly: 4.99,
    annual: 49.99,
    scans: "50 URL scans per month",
    features: [
      "Full UK cost breakdown per scan",
      "Scan history & saved analyses",
      "Everything in Free",
    ],
    cta: "Subscribe",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 14.99,
    annual: 149.99,
    scans: "Unlimited URL scans",
    features: [
      "Automated discovery engine (every 6 hrs)",
      "Full discovery dashboard & history",
      "Scan history & saved analyses",
      "Everything in Basic",
    ],
    cta: "Subscribe",
    highlight: true,
  },
] as const;

export default function PricingPage({ onClose }: Props) {
  const { user, token, isLoggedIn } = useAuth();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (planId === "free") return; // nothing to do
    if (!isLoggedIn) {
      // Trigger register flow — handled by App
      window.dispatchEvent(new CustomEvent("cf:show-register"));
      return;
    }

    setLoading(planId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan: planId,
          interval,
          success_url: `${window.location.origin}/?upgraded=1`,
          cancel_url: `${window.location.origin}/pricing`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Checkout failed" }));
        throw new Error(err.detail ?? "Checkout failed");
      }
      const data = await res.json();
      window.location.href = data.url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-white px-4 py-16">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          {onClose && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-sm"
            >
              ← Back
            </button>
          )}
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Simple pricing</h1>
          <p className="mt-2 text-gray-500 text-sm">
            Find underpriced cars before anyone else. Cancel anytime.
          </p>

          {/* Monthly / Annual toggle */}
          <div className="mt-6 inline-flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                interval === "monthly" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                interval === "annual" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"
              }`}
            >
              Annual
              <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                Save ~17%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TIERS.map(tier => {
            const price = interval === "monthly" ? tier.monthly : tier.annual;
            const period = interval === "monthly" ? "/mo" : "/yr";
            const isCurrent = user?.plan === tier.id;
            const isLoadingThis = loading === tier.id;

            return (
              <div
                key={tier.id}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  tier.highlight
                    ? "border-gray-900 shadow-lg"
                    : "border-gray-200"
                }`}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-gray-900 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-base font-semibold text-gray-900">{tier.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    {price === 0 ? (
                      <span className="text-3xl font-bold text-gray-900">Free</span>
                    ) : (
                      <>
                        <span className="text-3xl font-bold text-gray-900">£{price}</span>
                        <span className="text-sm text-gray-500">{period}</span>
                      </>
                    )}
                  </div>
                  {tier.id !== "free" && interval === "annual" && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Switch to annual · £{tier.annual}/yr
                    </p>
                  )}
                  {tier.id !== "free" && interval === "monthly" && (
                    <p className="mt-0.5 text-xs text-gray-400">
                      Switch to annual · £{tier.annual}/yr
                    </p>
                  )}
                </div>

                <p className="text-sm font-medium text-gray-900 mb-3">{tier.scans}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 text-center rounded-lg border border-gray-300 text-sm font-medium text-gray-500">
                    Current plan
                  </div>
                ) : tier.id === "free" ? (
                  <button
                    onClick={onClose}
                    className="w-full py-2.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    {isLoggedIn ? "Continue with Free" : tier.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier.id)}
                    disabled={!!loading}
                    className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                      tier.highlight
                        ? "bg-gray-900 text-white hover:bg-gray-700"
                        : "border border-gray-300 text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    {isLoadingThis ? "Redirecting…" : tier.cta}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-gray-400">
          Prices in GBP. Cancel anytime. Stripe handles all payments securely.
        </p>
      </div>
    </div>
  );
}
