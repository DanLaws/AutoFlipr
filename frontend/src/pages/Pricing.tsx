import { useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import SEO from "../components/SEO";

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
    trial: null,
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
    trial: null,
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    monthly: 10.99,
    annual: 109.99,
    scans: "Unlimited URL scans",
    features: [
      "Automated discovery engine (every 6 hrs)",
      "Full discovery dashboard & history",
      "Scan history & saved analyses",
      "Everything in Basic",
    ],
    cta: "Start free trial",
    trial: "1-day free trial — cancel anytime",
    highlight: true,
  },
] as const;

export default function PricingPage({ onClose }: Props) {
  const { user, token, isLoggedIn } = useAuth();
  const [interval, setInterval] = useState<Interval>("monthly");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe(planId: string) {
    if (planId === "free") return;
    if (!isLoggedIn) {
      window.dispatchEvent(new CustomEvent("cf:show-register"));
      return;
    }
    setLoading(planId);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          plan: planId,
          interval,
          success_url: `${window.location.origin}/?upgraded=1`,
          cancel_url:  `${window.location.origin}/pricing`,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Checkout failed" }));
        throw new Error(err.detail ?? "Checkout failed");
      }
      window.location.href = (await res.json()).url;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(null);
    }
  }

  const pricingSchema = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: "AutoFlipr",
      description:
        "AI-powered used car deal finder for UK buyers and flippers. Scores every listing across AutoTrader, Gumtree and Facebook Marketplace.",
      offers: [
        {
          "@type": "Offer",
          name: "Free Plan",
          description: "Browse the deal feed with up to 5 scans per month.",
          price: "0",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Basic Plan",
          description: "50 scans per month with full AI analysis, scan history, and cost breakdown.",
          price: "4.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
        {
          "@type": "Offer",
          name: "Pro Plan",
          description: "Unlimited scans plus automated discovery of underpriced deals every 6 hours.",
          price: "10.99",
          priceCurrency: "GBP",
          availability: "https://schema.org/InStock",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "Can I cancel my AutoFlipr subscription at any time?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. AutoFlipr subscriptions can be cancelled at any time with no cancellation fees. Your access continues until the end of the billing period.",
          },
        },
        {
          "@type": "Question",
          name: "Is there a free version of AutoFlipr?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The Free plan includes up to 5 URL scans per month, full UK cost breakdown, road tax and MOT estimates, and net profit calculation — no credit card required.",
          },
        },
        {
          "@type": "Question",
          name: "What is the difference between Basic and Pro?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Basic gives you 50 scans per month with full analysis and scan history. Pro adds unlimited scans and an automated discovery engine that finds new underpriced deals every 6 hours, including access to the full discovery dashboard.",
          },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen px-4 py-16" style={{ background: "var(--color-page)" }}>
      <SEO
        title="Pricing — Find Underpriced Used Cars from £0/mo"
        description="AutoFlipr plans start free. Basic from £4.99/mo, Pro from £10.99/mo with unlimited scans and auto-discovery across AutoTrader, Gumtree and Facebook Marketplace."
        canonical="/pricing"
        schema={pricingSchema}
      />
      <div className="max-w-4xl mx-auto relative">
        {/* Header */}
        <div className="text-center mb-10">
          {onClose && (
            <button onClick={onClose} className="absolute top-0 left-0 text-text-muted hover:text-text-primary text-sm transition-colors">
              ← Back
            </button>
          )}
          <h1 className="text-3xl font-bold text-text-primary tracking-tight">Simple pricing</h1>
          <p className="mt-2 text-text-muted text-sm">Find underpriced cars before anyone else. Cancel anytime.</p>

          {/* Interval toggle */}
          <div className="mt-6 inline-flex items-center gap-1 bg-surface-subtle rounded-lg p-1 border border-border-default">
            <button
              onClick={() => setInterval("monthly")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                interval === "monthly"
                  ? "bg-surface shadow-sm text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setInterval("annual")}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                interval === "annual"
                  ? "bg-surface shadow-sm text-text-primary"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              Annual
              <span className="ml-1.5 text-[10px] font-semibold text-success-strong bg-success-bg px-1.5 py-0.5 rounded">
                Save ~17%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-6 rounded-lg bg-danger-bg border border-danger-border px-4 py-3 text-sm text-danger-strong text-center">
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
                className="card relative p-6 flex flex-col"
                style={tier.highlight ? { borderColor: "var(--color-text-primary)", borderWidth: 2 } : {}}
              >
                {tier.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-brand text-brand-fg text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide">
                      Recommended
                    </span>
                  </div>
                )}

                <div className="mb-4">
                  <h2 className="text-base font-semibold text-text-primary">{tier.name}</h2>
                  <div className="mt-2 flex items-baseline gap-1">
                    {price === 0 ? (
                      <span className="font-mono text-3xl font-bold text-text-primary">Free</span>
                    ) : (
                      <>
                        <span className="font-mono text-3xl font-bold text-text-primary">£{price}</span>
                        <span className="text-sm text-text-muted">{period}</span>
                      </>
                    )}
                  </div>
                  {tier.id !== "free" && (
                    <p className="mt-0.5 text-xs text-text-faint">
                      Annual billing · £{tier.annual}/yr
                    </p>
                  )}
                </div>

                <p className="text-sm font-medium text-text-primary mb-3">{tier.scans}</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-text-secondary">
                      <svg className="w-4 h-4 text-success-strong mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {f}
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <div className="w-full py-2.5 text-center rounded-lg border border-border-strong text-sm font-medium text-text-muted">
                    Current plan
                  </div>
                ) : tier.id === "free" ? (
                  <button
                    onClick={onClose}
                    className="btn btn-secondary w-full py-2.5 text-sm"
                  >
                    {isLoggedIn ? "Continue with Free" : tier.cta}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => handleSubscribe(tier.id)}
                      disabled={!!loading}
                      className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 ${
                        tier.highlight ? "btn btn-primary" : "btn btn-secondary"
                      }`}
                    >
                      {isLoadingThis ? "Redirecting…" : tier.cta}
                    </button>
                    {tier.trial && (
                      <p className="text-center text-xs text-text-faint">{tier.trial}</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-text-faint">
          Prices in GBP. Cancel anytime. Stripe handles all payments securely.
        </p>
      </div>
    </div>
  );
}
