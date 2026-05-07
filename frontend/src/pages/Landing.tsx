import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import SEO from "../components/SEO";

interface Props {
  onLaunch:    () => void;
  onRegister?: () => void;
}

interface PreviewDeal {
  id: number;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  price_gbp: number | null;
  score: number;
  estimated_margin_gbp: number | null;
  source: string;
  image_url: string | null;
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <svg width="26" height="26" viewBox="0 0 32 32" fill="none">
        <rect x="0.5" y="0.5" width="31" height="31" rx="7.5"
          fill="var(--color-text-primary)" stroke="var(--color-text-primary)" />
        <path d="M7 22 L11.5 9 H13.5 L18 22"
          stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M9 18 H16"
          stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M19 13 H25 M22 10 L25 13 L22 16"
          stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M25 19 H19 M22 22 L19 19 L22 16"
          stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
      </svg>
      <span className="font-extrabold text-[17px] tracking-tight text-text-primary">AutoFlipr</span>
    </div>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label="Toggle theme"
      className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors"
    >
      {theme === "dark" ? (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="15" height="15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ── Live deals mini-card ──────────────────────────────────────────────────────

function MiniDealCard({ deal, i, onRegister }: { deal: PreviewDeal; i: number; onRegister: () => void }) {
  const score = deal.score;
  const ring  = score >= 70 ? "var(--color-score-good)" : score >= 50 ? "var(--color-score-fair)" : "var(--color-score-poor)";
  const bg    = score >= 70 ? "var(--color-text-primary)" : score >= 50 ? "var(--color-score-fair)" : "var(--color-surface-subtle)";
  const fg    = score >= 70 ? "var(--color-brand-fg)" : "#fff";
  const size  = 36;
  const r     = (size - 4) / 2;
  const circ  = 2 * Math.PI * r;
  const dash  = (score / 100) * circ;

  return (
    <div
      onClick={onRegister}
      className="card-hover overflow-hidden cursor-pointer"
    >
      <div className="relative" style={{ aspectRatio: "16 / 10", background: "var(--color-surface-subtle)" }}>
        {deal.image_url ? (
          <img
            src={deal.image_url}
            alt={[deal.year, deal.make, deal.model].filter(Boolean).join(" ") || "Used car listing"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-text-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0zM13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10l2 2h10l2-2z" />
            </svg>
          </div>
        )}
        {/* Score ring */}
        <div className="absolute top-2 left-2">
          <div style={{ width: size, height: size, position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
            <svg width={size} height={size} style={{ position: "absolute", inset: 0, transform: "rotate(-90deg)" }}>
              <circle cx={size/2} cy={size/2} r={r} stroke="var(--color-border)" strokeWidth="2" fill="none" />
              <circle cx={size/2} cy={size/2} r={r} stroke={ring} strokeWidth="2" fill="none" strokeDasharray={`${dash} ${circ}`} strokeLinecap="round" />
            </svg>
            <div style={{ width: size - 10, height: size - 10, background: bg, color: fg, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, fontSize: 11 }}>
              {Math.round(score)}
            </div>
          </div>
        </div>
      </div>
      <div className="p-3">
        <div className="text-sm font-semibold text-text-primary truncate leading-tight">
          {[deal.year, deal.make, deal.model].filter(Boolean).join(" ")}
        </div>
        <div className="flex items-baseline justify-between mt-1.5">
          <span className="font-mono text-base font-bold text-text-primary">
            {deal.price_gbp != null ? `£${deal.price_gbp.toLocaleString("en-GB")}` : "—"}
          </span>
          {deal.estimated_margin_gbp != null && deal.estimated_margin_gbp > 0 && (
            <span className="font-mono text-xs font-bold text-success-strong">
              +£{deal.estimated_margin_gbp.toLocaleString("en-GB")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({ kicker, bigStat, title, desc }: { kicker: string; bigStat?: string; title: string; desc: string }) {
  return (
    <div className="card p-6">
      <div className="label-caps mb-3">{kicker}</div>
      {bigStat && (
        <div className="font-mono text-4xl font-bold tracking-tight text-text-primary mb-2" style={{ letterSpacing: "-0.03em" }}>
          {bigStat}
        </div>
      )}
      <div className="text-base font-semibold text-text-primary mb-2">{title}</div>
      <div className="text-sm text-text-muted leading-relaxed">{desc}</div>
    </div>
  );
}

// ── How step ──────────────────────────────────────────────────────────────────

function HowStep({ n, title, desc }: { n: number; title: string; desc: string }) {
  return (
    <div className="flex-1 min-w-[200px]">
      <div className="font-mono text-sm font-bold text-text-faint tracking-wider mb-3">
        0{n} ——
      </div>
      <div className="text-base font-semibold text-text-primary mb-2">{title}</div>
      <div className="text-sm text-text-muted leading-relaxed">{desc}</div>
    </div>
  );
}

// ── LiveDeals section ─────────────────────────────────────────────────────────

function LiveDeals({ onRegister }: { onRegister: () => void }) {
  const [deals, setDeals]   = useState<PreviewDeal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deals/preview")
      .then((r) => r.json())
      .then((data) => { setDeals(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="skeleton rounded-xl" style={{ aspectRatio: "4/5" }} />
        ))}
      </div>
    );
  }

  if (!deals.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {deals.map((deal, i) => (
        <MiniDealCard key={deal.id} deal={deal} i={i} onRegister={onRegister} />
      ))}
    </div>
  );
}

// ── Main Landing page ─────────────────────────────────────────────────────────

export default function LandingPage({ onLaunch, onRegister }: Props) {
  const handleRegister = onRegister ?? onLaunch;

  const FEATURES = [
    { kicker: "Scoring engine", bigStat: "0–100",  title: "Z-score against real comparables",    desc: "Every listing scored against same-spec cars sold in the last 90 days. No guesswork — statistical underpricing only." },
    { kicker: "Negotiation",    bigStat: "−14%",    title: "\"Don't exceed\" + opener cap",         desc: "Each deal includes an opening offer and a hard ceiling, calibrated to seller type and market deviation." },
    { kicker: "On-demand",      bigStat: "< 30s",   title: "Paste any URL, instant analysis",    desc: "Scan tool accepts any AutoTrader, Gumtree or Facebook URL. Score, AI red flags, and margin estimate in under a minute." },
    { kicker: "Coverage",       bigStat: "3 / 3",   title: "The platforms that actually matter", desc: "AutoTrader for inventory depth. Gumtree for private sellers. Facebook for the unicorns. All in one feed." },
    { kicker: "AI analysis",                         title: "Red flags, condition, risk",         desc: "Gemini reads each ad, flags spares-or-repairs, missing MOT, suspicious mileage, and surfaces real concerns before you drive there." },
    { kicker: "Watchlist",                           title: "Track price drops over time",        desc: "Bookmark a listing, watch the price fall. Price history tracked automatically — spot motivated sellers early." },
  ];

  const TIERS = [
    { name: "Free",  price: "£0",     period: "",     desc: "Browse the feed. Limited scans.",       cta: "Get started free", highlight: false },
    { name: "Basic", price: "£4.99",  period: "/mo",  desc: "50 scans / month. Full analysis.",      cta: "Start Basic",      highlight: false },
    { name: "Pro",   price: "£10.99", period: "/mo",  desc: "Unlimited scans + auto-discovery.",     cta: "Start Pro",        highlight: true  },
  ];

  const SITE_URL = import.meta.env.VITE_SITE_URL ?? "https://autoflipr.com";

  const landingSchema = [
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: "AutoFlipr",
      url: SITE_URL,
      description:
        "AutoFlipr scores every used car listing on AutoTrader, Gumtree and Facebook Marketplace against real market data to surface underpriced UK vehicles.",
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/?q={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      name: "AutoFlipr",
      url: SITE_URL,
      logo: `${SITE_URL}/favicon.svg`,
      description:
        "UK-based platform for finding and scoring underpriced used cars across AutoTrader, Gumtree and Facebook Marketplace.",
      areaServed: "GB",
    },
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "AutoFlipr",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: SITE_URL,
      description:
        "AI-powered used car deal finder for the UK. Scores every listing with a Z-score pricing engine and surfaces underpriced vehicles worth buying or flipping.",
      offers: [
        {
          "@type": "Offer",
          name: "Free Plan",
          description: "Browse the deal feed with up to 5 scans per month.",
          price: "0",
          priceCurrency: "GBP",
        },
        {
          "@type": "Offer",
          name: "Basic Plan",
          description: "50 scans per month with full AI analysis and negotiation tips.",
          price: "4.99",
          priceCurrency: "GBP",
        },
        {
          "@type": "Offer",
          name: "Pro Plan",
          description: "Unlimited scans plus automated discovery of underpriced deals.",
          price: "10.99",
          priceCurrency: "GBP",
        },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: [
        {
          "@type": "Question",
          name: "How does AutoFlipr find underpriced used cars?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutoFlipr scrapes AutoTrader, Gumtree and Facebook Marketplace daily, then scores every listing against same-spec cars sold in the last 90 days using a statistical Z-score engine. Listings scoring above 70 are flagged as significantly underpriced.",
          },
        },
        {
          "@type": "Question",
          name: "Which platforms does AutoFlipr monitor?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutoFlipr monitors AutoTrader for depth of inventory, Gumtree for private sellers, and Facebook Marketplace for rare finds, giving complete coverage of the UK used car market.",
          },
        },
        {
          "@type": "Question",
          name: "What is a good AutoFlipr score?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Scores above 70 indicate a significantly underpriced vehicle worth investigating. Scores between 50 and 70 represent fair market value. Anything below 50 is overpriced relative to comparable sold listings.",
          },
        },
        {
          "@type": "Question",
          name: "Can I scan any car listing URL?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "Yes. The AutoFlipr scan tool accepts any AutoTrader, Gumtree or Facebook Marketplace listing URL and returns a Z-score, AI-generated risk flags, estimated margin, and negotiation cap within 30 seconds.",
          },
        },
        {
          "@type": "Question",
          name: "How much does AutoFlipr cost?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "AutoFlipr offers a free tier with 5 scans per month. The Basic plan is £4.99/month for 50 scans with full analysis. The Pro plan is £10.99/month for unlimited scans and automated deal discovery.",
          },
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-page text-text-primary">
      <SEO
        canonical="/"
        description="AutoFlipr scores every used car on AutoTrader, Gumtree and Facebook Marketplace against real market data. Find underpriced UK cars worth buying or flipping — free to start."
        schema={landingSchema}
      />

      {/* ── Navbar ── */}
      <header
        className="sticky top-0 z-20 border-b border-border-default"
        style={{
          background: "color-mix(in oklab, var(--color-page) 90%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button onClick={onLaunch} className="btn btn-ghost btn-sm">Sign in</button>
            <button onClick={handleRegister} className="btn btn-primary btn-sm">Get started</button>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative overflow-hidden">
        {/* Grid texture with radial fade */}
        <div
          className="grid-bg absolute inset-0 pointer-events-none"
          style={{
            maskImage: "radial-gradient(ellipse 70% 70% at 50% 30%, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 70% at 50% 30%, black 30%, transparent 75%)",
          }}
        />

        <div className="relative max-w-6xl mx-auto px-6 pt-20 pb-14">
          {/* Live pulse badge */}
          <div className="label-caps inline-flex items-center gap-2 mb-6">
            <span className="w-2 h-2 rounded-full bg-score-good" style={{ boxShadow: "0 0 0 4px color-mix(in oklab, var(--color-score-good) 22%, transparent)" }} />
            LIVE · 2,847 deals scored today
          </div>

          <h1
            className="font-extrabold text-text-primary mb-6"
            style={{ fontSize: "clamp(44px, 7vw, 72px)", lineHeight: 1.02, letterSpacing: "-0.03em", maxWidth: 800 }}
          >
            The market<br />
            for{" "}
            <span className="font-mono" style={{ fontWeight: 700, fontSize: "0.92em" }}>
              underpriced
            </span>
            <br />
            used cars.
          </h1>

          <p className="text-lg text-text-secondary max-w-xl mb-8 leading-relaxed">
            AutoFlipr scrapes AutoTrader, Gumtree and Facebook Marketplace, scores every listing with a Z-score pricing engine, and surfaces the deals worth buying. Built for UK flippers.
          </p>

          <div className="flex gap-3 flex-wrap">
            <button onClick={handleRegister} className="btn btn-primary btn-lg">
              Get started — free
            </button>
            <button
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
              className="btn btn-secondary btn-lg"
            >
              See pricing
            </button>
          </div>

          {/* Stat strip */}
          <div
            className="mt-14 grid"
            style={{
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: 16,
              paddingTop: 24,
              paddingBottom: 24,
              borderTop: "1px solid var(--color-border-default)",
              borderBottom: "1px solid var(--color-border-default)",
            }}
          >
            {[
              ["SOURCES",       "03",    "AutoTrader · Gumtree · FB"],
              ["SCANNED / DAY", "14k+",  "Listings ingested"],
              ["AVG MARGIN",    "£1.4k", "On Pro-tier deals"],
              ["MEDIAN SCORE",  "62",    "Across all sources"],
            ].map(([k, v, sub]) => (
              <div key={k as string}>
                <div className="label-caps mb-2">{k}</div>
                <div className="font-mono text-3xl font-bold tracking-tight text-text-primary" style={{ letterSpacing: "-0.02em" }}>{v}</div>
                <div className="text-xs text-text-faint mt-1">{sub}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Live deals preview ── */}
      <section className="max-w-6xl mx-auto px-6 pt-16 pb-4">
        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <div className="label-caps mb-2">Live feed · updated 2 min ago</div>
            <h2 className="text-2xl font-bold text-text-primary tracking-tight">Today's underpriced finds</h2>
          </div>
          <button onClick={handleRegister} className="btn btn-secondary btn-sm">
            Open deals feed →
          </button>
        </div>
        <LiveDeals onRegister={handleRegister} />
        <p className="mt-4 text-center text-xs text-text-faint">
          Sign up to see full analysis, risk flags, MOT history and negotiation tips →
        </p>
      </section>

      {/* ── Features ── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="mb-8 max-w-xl">
          <div className="label-caps mb-2">Why AutoFlipr</div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Stop wasting evenings refreshing AutoTrader.</h2>
        </div>
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      {/* ── How it works ── */}
      <section className="max-w-6xl mx-auto px-6 pb-20">
        <div className="mb-10 max-w-xl">
          <div className="label-caps mb-2">How it works</div>
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">Three steps. No spreadsheets.</h2>
        </div>
        <div className="card p-8">
          <div className="flex gap-10 flex-wrap">
            <HowStep n={1} title="We scrape every listing" desc="14k+ listings/day across three platforms, normalised into a single schema. Continuous, never cached." />
            <HowStep n={2} title="We score against the market" desc="Each listing is compared to same-spec sold cars. Anything <50 is filed; anything >70 is surfaced." />
            <HowStep n={3} title="You buy. Flip. Repeat."   desc="Open the deal, run the AI analysis, use the negotiation cap, drive there. Sell two weeks later." />
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="border-t border-border-default bg-surface-subtle py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-end justify-between mb-8 flex-wrap gap-4">
            <div>
              <div className="label-caps mb-2">Pricing</div>
              <h2 className="text-2xl font-bold text-text-primary tracking-tight">Pay for results, not access.</h2>
            </div>
            <button onClick={handleRegister} className="btn btn-secondary btn-sm text-xs">Compare plans →</button>
          </div>

          <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {TIERS.map((tier) => (
              <div
                key={tier.name}
                className="card p-7 flex flex-col relative"
                style={tier.highlight ? { borderColor: "var(--color-text-primary)", borderWidth: 2 } : {}}
              >
                {tier.highlight && (
                  <div
                    className="absolute -top-3 left-6 bg-brand text-brand-fg text-[10px] font-bold px-3 py-1 rounded"
                    style={{ letterSpacing: "0.08em", textTransform: "uppercase" }}
                  >
                    Recommended
                  </div>
                )}
                <div className="label-caps mb-3">{tier.name}</div>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="font-mono text-4xl font-bold text-text-primary" style={{ letterSpacing: "-0.03em" }}>
                    {tier.price}
                  </span>
                  {tier.period && <span className="text-sm text-text-muted">{tier.period}</span>}
                </div>
                <div className="text-sm text-text-muted mb-6 flex-1">{tier.desc}</div>
                <button
                  onClick={handleRegister}
                  className={tier.highlight ? "btn btn-primary w-full" : "btn btn-secondary w-full"}
                >
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-text-faint">
            Prices in GBP · Cancel anytime · Stripe handles all payments securely
          </p>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border-default bg-surface py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-start justify-between gap-8 flex-wrap">
          <div>
            <Logo />
            <p className="text-sm text-text-muted mt-3 max-w-xs leading-relaxed">
              Continuous market scoring across AutoTrader, Gumtree and Facebook Marketplace.
            </p>
          </div>
          <div className="flex gap-12 flex-wrap">
            <div>
              <div className="label-caps mb-3">Product</div>
              <div className="flex flex-col gap-2 text-sm text-text-muted">
                <button onClick={handleRegister} className="text-left hover:text-text-primary transition-colors">Deals</button>
                <button onClick={handleRegister} className="text-left hover:text-text-primary transition-colors">Scan</button>
                <button onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })} className="text-left hover:text-text-primary transition-colors">Pricing</button>
              </div>
            </div>
            <div>
              <div className="label-caps mb-3">Account</div>
              <div className="flex flex-col gap-2 text-sm text-text-muted">
                <button onClick={onLaunch}        className="text-left hover:text-text-primary transition-colors">Sign in</button>
                <button onClick={handleRegister}  className="text-left hover:text-text-primary transition-colors">Register</button>
              </div>
            </div>
          </div>
        </div>
        <div className="max-w-6xl mx-auto mt-8 pt-5 border-t border-border-faint flex flex-col sm:flex-row justify-between gap-3 text-xs text-text-faint">
          <span>© {new Date().getFullYear()} AutoFlipr — UK</span>
          <span>Pricing intelligence powered by Gemini · Not affiliated with listing platforms</span>
        </div>
      </footer>

    </div>
  );
}
