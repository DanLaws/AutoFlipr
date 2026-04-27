import { useState, useEffect } from "react";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import LandingPage from "./pages/Landing";
import DealsPage from "./pages/Deals";
import ScrapesPage from "./pages/Scrapes";
import WatchlistPage from "./pages/Watchlist";
import SettingsPage from "./pages/Settings";
import LoginPage from "./pages/Login";
import RegisterPage from "./pages/Register";
import PricingPage from "./pages/Pricing";
import AdminLoginPage, { clearAdminCreds, getAdminBasic } from "./pages/AdminLogin";
import AdminUsersPage from "./pages/AdminUsers";
import ScanPage from "./pages/Scan";
import { useWatchlist } from "./hooks/useWatchlist";

// ── Types ─────────────────────────────────────────────────────────────────────

type AuthView = "login" | "register" | "admin-login" | null;
type AppPage = "deals" | "scan" | "watchlist" | "scrapes" | "settings" | "pricing" | "admin-users";

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan, isAdmin }: { plan: string; isAdmin: boolean }) {
  if (isAdmin) return (
    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
      Admin
    </span>
  );
  if (plan === "pro") return (
    <span className="text-[10px] font-semibold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
      Pro
    </span>
  );
  if (plan === "basic") return (
    <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded uppercase tracking-wide">
      Basic
    </span>
  );
  return (
    <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded uppercase tracking-wide">
      Free
    </span>
  );
}

// ── Upgrade prompt ────────────────────────────────────────────────────────────

function UpgradePrompt({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-gray-900">Pro plan required</h2>
      <p className="mt-2 text-sm text-gray-500 max-w-xs">
        The automated discovery dashboard is included in the Pro plan. Upgrade to access unlimited deals, auto-discovery, and full history.
      </p>
      <button
        onClick={onUpgrade}
        className="mt-6 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-700 transition-colors"
      >
        View plans
      </button>
    </div>
  );
}

// ── Main inner app (inside AuthProvider) ──────────────────────────────────────

function AppInner() {
  const { user, isLoggedIn, isPro, isAdmin, logout } = useAuth();
  const [page, setPage] = useState<AppPage>(() => {
    if (getAdminBasic()) return "deals";
    try {
      const stored = JSON.parse(localStorage.getItem("cf_user") ?? "{}");
      if (stored.plan === "pro" || stored.is_admin) return "deals";
    } catch {}
    return "scan";
  });
  const [authView, setAuthView] = useState<AuthView>(null);
  const [adminAuthed, setAdminAuthed] = useState(() => !!getAdminBasic());
  const { bookmarked, hidden, toggleBookmark, toggleHide } = useWatchlist();

  // Listen for custom nav events
  useEffect(() => {
    function onShowRegister() { setAuthView("register"); }
    function onShowPricing() { setPage("pricing"); }
    window.addEventListener("cf:show-register", onShowRegister);
    window.addEventListener("cf:show-pricing", onShowPricing);
    return () => {
      window.removeEventListener("cf:show-register", onShowRegister);
      window.removeEventListener("cf:show-pricing", onShowPricing);
    };
  }, []);

  // After successful upgrade redirect, refresh user
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("upgraded") === "1") {
      window.history.replaceState({}, "", "/");
      setPage("pricing");
    }
  }, []);

  // ── Auth views ──────────────────────────────────────────────────────────────

  if (authView === "login") {
    return (
      <LoginPage
        onShowRegister={() => setAuthView("register")}
        onSuccess={() => setAuthView(null)}
      />
    );
  }

  if (authView === "register") {
    return (
      <RegisterPage
        onShowLogin={() => setAuthView("login")}
        onSuccess={() => setAuthView(null)}
      />
    );
  }

  if (authView === "admin-login") {
    return (
      <AdminLoginPage
        onSuccess={() => { setAdminAuthed(true); setAuthView(null); setPage("scrapes"); }}
        onBack={() => setAuthView(null)}
      />
    );
  }

  // ── Not logged in → show landing with auth options ──────────────────────────

  if (!isLoggedIn) {
    return (
      <LandingPage
        onLaunch={() => setAuthView("login")}
        onRegister={() => setAuthView("register")}
      />
    );
  }

  // ── Determine which nav items to show ───────────────────────────────────────
  const canAccessDashboard = isPro || adminAuthed;

  const NAV: { id: AppPage; label: string; adminOnly?: boolean; proOnly?: boolean }[] = [
    { id: "deals", label: "Deals", proOnly: true },
    { id: "scan", label: "Scan" },
    { id: "watchlist", label: "Watchlist" },
    { id: "scrapes", label: "Scrapes", adminOnly: true },
    { id: "admin-users", label: "Users", adminOnly: true },
    { id: "settings", label: "Settings", adminOnly: true },
    { id: "pricing", label: "Plans" },
  ];

  function handleNavClick(id: AppPage, adminOnly?: boolean, proOnly?: boolean) {
    if (adminOnly && !adminAuthed) {
      setAuthView("admin-login");
      return;
    }
    if (proOnly && !canAccessDashboard) {
      setPage("pricing");
      return;
    }
    setPage(id);
  }

  return (
    <div className="min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="border-b border-gray-200 px-6 py-3 flex items-center gap-6 bg-white sticky top-0 z-10">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setPage("deals")}
            className="text-lg font-bold tracking-tight text-gray-900 hover:text-gray-600 transition-colors"
          >
            AutoFlipr
          </button>
          <PlanBadge plan={user?.plan ?? "free"} isAdmin={adminAuthed} />
        </div>

        <nav className="flex gap-1 flex-1">
          {NAV.map(({ id, label, adminOnly, proOnly }) => {
            // Hide admin-only pages from non-admins unless it's the admin-login trigger
            if (adminOnly && !adminAuthed) return null;
            return (
              <button
                key={id}
                onClick={() => handleNavClick(id, adminOnly, proOnly)}
                className={`relative px-3.5 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  page === id
                    ? "bg-gray-900 text-white"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                }`}
              >
                {label}
                {id === "watchlist" && bookmarked.size > 0 && (
                  <span className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center ${
                    page === "watchlist" ? "bg-white text-gray-900" : "bg-gray-900 text-white"
                  }`}>
                    {bookmarked.size}
                  </span>
                )}
                {proOnly && !canAccessDashboard && (
                  <span className="ml-1 text-[9px] font-bold text-indigo-400">PRO</span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right side: user info + logout + admin link */}
        <div className="flex items-center gap-3 ml-auto">
          {!adminAuthed && (
            <button
              onClick={() => setAuthView("admin-login")}
              className="text-xs text-gray-400 hover:text-amber-600 transition-colors"
            >
              Admin
            </button>
          )}
          {adminAuthed && (
            <button
              onClick={() => { clearAdminCreds(); setAdminAuthed(false); }}
              className="text-xs text-amber-600 hover:text-amber-800 transition-colors"
            >
              Exit admin
            </button>
          )}
          <span className="text-xs text-gray-400 hidden sm:block">{user?.email}</span>
          <button
            onClick={logout}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="px-6 py-8">
        {page === "deals" && (
          canAccessDashboard ? (
            <DealsPage
              bookmarked={bookmarked}
              hidden={hidden}
              onBookmark={toggleBookmark}
              onHide={toggleHide}
            />
          ) : (
            <UpgradePrompt onUpgrade={() => setPage("pricing")} />
          )
        )}

        {page === "watchlist" && (
          <WatchlistPage
            bookmarked={bookmarked}
            hidden={hidden}
            onBookmark={toggleBookmark}
            onHide={toggleHide}
          />
        )}

        {page === "scan" && <ScanPage />}
        {page === "scrapes" && <ScrapesPage />}
        {page === "admin-users" && <AdminUsersPage />}
        {page === "settings" && <SettingsPage />}
        {page === "pricing" && <PricingPage onClose={() => setPage("deals")} />}
      </main>
    </div>
  );
}

// ── Root export (wraps with AuthProvider) ─────────────────────────────────────

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}
