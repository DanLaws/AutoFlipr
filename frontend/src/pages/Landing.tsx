interface Props {
  onLaunch: () => void;
  onRegister?: () => void;
}

const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: "AI deal scoring",
    desc: "Every listing gets a 0–100 score based on price vs market comparables, mileage, age, and seller type.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
    title: "Price history tracking",
    desc: "See how the asking price has changed over time. Spot motivated sellers before other buyers do.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: "Risk analysis",
    desc: "Gemini AI flags red flags, condition concerns, and reasons a deal could be a hidden gem — not just a number.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
      </svg>
    ),
    title: "Watchlist",
    desc: "Bookmark deals you like and hide ones you've already ruled out. Your shortlist, always one click away.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
      </svg>
    ),
    title: "Smart filters",
    desc: "Filter by make, year range, mileage, seller type, margin, and more. Sort by score, price, or margin.",
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
    title: "Auto-refresh",
    desc: "Listings are scraped and re-scored on a weekly schedule. Fresh deals surface automatically — no manual work.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Scrape AutoTrader",
    desc: "A Playwright scraper discovers used car listings matching your search criteria and stores the raw data.",
  },
  {
    n: "02",
    title: "Extract & analyse",
    desc: "Gemini AI reads each listing, extracts structured data, flags risk factors, and writes a plain-English summary.",
  },
  {
    n: "03",
    title: "Score & rank",
    desc: "A Z-score pricing engine compares each car against real market comparables and assigns a deal score.",
  },
];

const PLANS = [
  {
    name: "Self-hosted",
    price: "Free",
    sub: "forever",
    highlight: true,
    features: [
      "Unlimited listings",
      "Full AI analysis pipeline",
      "AutoTrader scraper",
      "Deal scoring engine",
      "Price history tracking",
      "Watchlist & hide",
      "Docker Compose deploy",
    ],
    cta: "Launch app",
  },
  {
    name: "Pro",
    price: "Coming soon",
    sub: "",
    highlight: false,
    features: [
      "Everything in Self-hosted",
      "Hosted — no server needed",
      "Gumtree + Facebook scrapers",
      "Email & push alerts",
      "Distance filtering",
      "Full cost breakdown",
      "Priority support",
    ],
    cta: "Join waitlist",
  },
];

export default function LandingPage({ onLaunch, onRegister }: Props) {
  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      {/* Nav */}
      <header className="sticky top-0 z-20 border-b border-gray-100 bg-white/90 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-bold text-lg tracking-tight">AutoFlipr</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onLaunch}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors"
            >
              Sign in
            </button>
            <button
              onClick={onRegister ?? onLaunch}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Get started free
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-8">
          <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
          Scanning AutoTrader for underpriced cars
        </div>
        <h1 className="text-5xl sm:text-6xl font-extrabold tracking-tight text-gray-900 mb-6 leading-tight">
          Find underpriced cars
          <br />
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-500">
            before anyone else does
          </span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto mb-10">
          AutoFlipr scrapes AutoTrader, runs every listing through AI analysis and a pricing
          engine, then surfaces the deals worth your time — ranked by margin, not just price.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRegister ?? onLaunch}
            className="px-7 py-3.5 bg-gray-900 hover:bg-gray-700 text-white font-semibold rounded-xl text-base transition-colors"
          >
            Get started free
          </button>
          <button
            onClick={onLaunch}
            className="px-7 py-3.5 border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl text-base transition-colors"
          >
            Sign in
          </button>
        </div>
        <div className="mt-14 grid grid-cols-3 divide-x divide-gray-100 max-w-lg mx-auto">
          {[
            ["100%", "Open source"],
            ["AI-powered", "Risk analysis"],
            ["Self-hosted", "Your data"],
          ].map(([val, label]) => (
            <div key={label} className="px-6 py-2">
              <p className="text-2xl font-bold text-gray-900">{val}</p>
              <p className="text-xs text-gray-400 mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-2">Everything you need to flip cars profitably</h2>
          <p className="text-gray-400 text-center mb-12">No spreadsheets. No manual searching. No guessing.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div key={f.title} className="bg-white border border-gray-200 rounded-xl p-5">
                <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700 mb-4">
                  {f.icon}
                </div>
                <h3 className="font-semibold text-gray-900 mb-1.5">{f.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 max-w-6xl mx-auto px-6">
        <h2 className="text-3xl font-bold text-center mb-2">How it works</h2>
        <p className="text-gray-400 text-center mb-14">Three automated steps from listing to ranked deal</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="relative">
              {i < STEPS.length - 1 && (
                <div className="hidden md:block absolute top-6 left-[calc(100%-0px)] w-full h-px border-t border-dashed border-gray-200 z-0" />
              )}
              <div className="relative z-10">
                <span className="text-5xl font-black text-gray-100 leading-none">{s.n}</span>
                <h3 className="font-semibold text-gray-900 mt-1 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 border-y border-gray-100 py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl font-bold text-center mb-2">Pricing</h2>
          <p className="text-gray-400 text-center mb-12">Start free. Scale when you need to.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-2xl border p-8 flex flex-col ${
                  plan.highlight
                    ? "bg-gray-900 border-gray-900 text-white"
                    : "bg-white border-gray-200 text-gray-900"
                }`}
              >
                <div className="mb-6">
                  <p className={`text-xs font-semibold uppercase tracking-widest mb-3 ${plan.highlight ? "text-gray-400" : "text-gray-400"}`}>
                    {plan.name}
                  </p>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    {plan.sub && (
                      <span className={`text-sm ${plan.highlight ? "text-gray-400" : "text-gray-400"}`}>
                        {plan.sub}
                      </span>
                    )}
                  </div>
                </div>
                <ul className="space-y-2.5 flex-1 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm">
                      <svg
                        className={`w-4 h-4 mt-0.5 flex-shrink-0 ${plan.highlight ? "text-emerald-400" : "text-emerald-500"}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      <span className={plan.highlight ? "text-gray-300" : "text-gray-600"}>{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={plan.highlight ? onLaunch : undefined}
                  disabled={!plan.highlight}
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? "bg-white text-gray-900 hover:bg-gray-100"
                      : "bg-gray-100 text-gray-400 cursor-not-allowed"
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-gray-900">AutoFlipr</span>
            <span className="text-gray-400 text-sm">— self-hosted car deal finder</span>
          </div>
          <p className="text-xs text-gray-400">
            Built with FastAPI · Celery · Gemini · React · Tailwind
          </p>
          <p className="text-xs text-gray-400">© {new Date().getFullYear()}</p>
        </div>
      </footer>
    </div>
  );
}
