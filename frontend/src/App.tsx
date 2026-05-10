import { useEffect, ReactNode } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
  Outlet,
} from "react-router-dom";
import { Helmet } from "react-helmet-async";

import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { WatchlistProvider, useWatchlistContext } from "./contexts/WatchlistContext";
import { useTheme } from "./hooks/useTheme";

import LandingPage       from "./pages/Landing";
import LoginPage         from "./pages/Login";
import RegisterPage      from "./pages/Register";
import PrivacyPolicyPage from "./pages/PrivacyPolicy";
import TermsPage         from "./pages/Terms";
import DealsPage      from "./pages/Deals";
import WatchlistPage  from "./pages/Watchlist";
import ScanPage       from "./pages/Scan";
import ScrapesPage    from "./pages/Scrapes";
import SettingsPage   from "./pages/Settings";
import PricingPage    from "./pages/Pricing";
import AdminUsersPage   from "./pages/AdminUsers";
import AdminReportsPage from "./pages/AdminReports";
import FlipfolioPage    from "./pages/Flipfolio";
import NotFoundPage     from "./pages/NotFound";

// ── Route guards ──────────────────────────────────────────────────────────────

function RequireAuth({ children }: { children: ReactNode }) {
  const { isLoggedIn } = useAuth();
  const location = useLocation();
  if (!isLoggedIn) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function RequirePro({ children }: { children: ReactNode }) {
  const { isPro } = useAuth();
  if (!isPro) return <Navigate to="/pricing" replace />;
  return <>{children}</>;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/scan" replace />;
  return <>{children}</>;
}

// ── Logo ──────────────────────────────────────────────────────────────────────

function Logo() {
  return (
    <div className="inline-flex items-center gap-2.5">
      <svg width="28" height="28" viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect x="0.5" y="0.5" width="31" height="31" rx="7.5"
          fill="var(--color-text-primary)" stroke="var(--color-text-primary)" />
        <path d="M7 22 L11.5 9 H13.5 L18 22"
          stroke="var(--color-brand-fg)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M9 18 H16"
          stroke="var(--color-brand-fg)" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M19 13 H25 M22 10 L25 13 L22 16"
          stroke="var(--color-brand-fg)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" fill="none" />
        <path d="M25 19 H19 M22 22 L19 19 L22 16"
          stroke="var(--color-brand-fg)" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.55" />
      </svg>
      <span className="font-extrabold text-[17px] tracking-tight text-text-primary leading-none">
        AutoFlipr
      </span>
    </div>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────────

function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggle}
      title={`Switch to ${isDark ? "light" : "dark"} mode`}
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      className="w-8 h-8 flex items-center justify-center rounded-lg text-text-muted hover:text-text-primary hover:bg-surface-subtle transition-colors"
    >
      {isDark ? (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      )}
    </button>
  );
}

// ── Plan badge ────────────────────────────────────────────────────────────────

function PlanBadge({ plan, isAdmin }: { plan: string; isAdmin: boolean }) {
  if (isAdmin)          return <span className="badge badge-admin">Admin</span>;
  if (plan === "pro")   return <span className="badge badge-pro">Pro</span>;
  if (plan === "basic") return <span className="badge badge-basic">Basic</span>;
  return <span className="badge badge-free">Free</span>;
}

// ── AppShell — shared layout for all authenticated pages ──────────────────────

type NavItem = { path: string; label: string; adminOnly?: boolean; proOnly?: boolean };

const NAV: NavItem[] = [
  { path: "/deals",          label: "Deals",   proOnly:  true },
  { path: "/scan",           label: "Scan" },
  { path: "/watchlist",      label: "Watchlist" },
  { path: "/flipfolio",      label: "Flipfolio" },
  { path: "/scrapes",        label: "Scrapes",  adminOnly: true },
  { path: "/admin/users",    label: "Users",    adminOnly: true },
  { path: "/admin/reports",  label: "Reports",  adminOnly: true },
  { path: "/settings",       label: "Settings", adminOnly: true },
  { path: "/pricing-app",    label: "Plans" },
];

function AppShell() {
  const { user, isLoggedIn, isPro, isAdmin, logout, refreshMe } = useAuth();
  const { bookmarked } = useWatchlistContext();
  const navigate = useNavigate();
  const location = useLocation();
  useTheme();

  // Handle ?upgraded=1 redirect from Stripe — refresh the JWT so the new plan is reflected immediately
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get("upgraded") === "1") {
      refreshMe().finally(() => navigate("/pricing-app", { replace: true }));
    }
  }, [location.search, navigate, refreshMe]);

  // Global events fired by child pages
  useEffect(() => {
    function onShowRegister() { navigate("/register"); }
    function onShowPricing()  { navigate("/pricing"); }
    window.addEventListener("cf:show-register", onShowRegister);
    window.addEventListener("cf:show-pricing",  onShowPricing);
    return () => {
      window.removeEventListener("cf:show-register", onShowRegister);
      window.removeEventListener("cf:show-pricing",  onShowPricing);
    };
  }, [navigate]);

  if (!isLoggedIn) return <Navigate to="/login" replace />;

  const canAccessDashboard = isPro || isAdmin;

  return (
    <div className="min-h-screen bg-page">
      {/* Prevent authenticated pages from being indexed */}
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* ── Header ── */}
      <header
        className="sticky top-0 z-40 border-b border-border-default"
        style={{
          background: "color-mix(in oklab, var(--color-page) 88%, transparent)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 h-[60px] flex items-center gap-4">
          {/* Logo */}
          <button
            onClick={() => navigate(canAccessDashboard ? "/deals" : "/scan")}
            className="shrink-0 hover:opacity-80 transition-opacity"
          >
            <Logo />
          </button>

          {/* Nav */}
          <nav className="flex gap-0.5 flex-1">
            {NAV.map(({ path, label, adminOnly, proOnly }) => {
              if (adminOnly && !isAdmin) return null;
              const active = location.pathname === path;
              return (
                <button
                  key={path}
                  onClick={() => {
                    if (proOnly && !canAccessDashboard) { navigate("/pricing"); return; }
                    navigate(path);
                  }}
                  className={`relative px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? "bg-surface-subtle text-text-primary font-semibold"
                      : "text-text-muted hover:text-text-primary hover:bg-surface-subtle"
                  }`}
                >
                  {label}
                  {path === "/watchlist" && bookmarked.size > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold rounded-full flex items-center justify-center bg-text-primary text-brand-fg">
                      {bookmarked.size}
                    </span>
                  )}
                  {proOnly && !canAccessDashboard && (
                    <span className="ml-1 text-[9px] font-bold text-info-text">PRO</span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: plan + theme + user */}
          <div className="flex items-center gap-2 ml-auto shrink-0">
            <PlanBadge plan={user?.plan ?? "free"} isAdmin={isAdmin} />
            <ThemeToggle />
            <span className="text-xs text-text-faint hidden sm:block border-l border-border-default pl-2">
              {user?.email}
            </span>
            <button
              onClick={logout}
              className="text-xs text-text-faint hover:text-text-primary transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* ── Page content ── */}
      <main className="px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

// ── Upgrade prompt (shown when pro route visited without pro plan) ─────────────

function UpgradePrompt() {
  const navigate = useNavigate();
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="w-14 h-14 rounded-2xl bg-surface-subtle border border-border-default flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-text-primary">Pro plan required</h2>
      <p className="mt-2 text-sm text-text-muted max-w-xs">
        The automated discovery dashboard is included in the Pro plan. Upgrade to access unlimited deals, auto-discovery, and full history.
      </p>
      <button onClick={() => navigate("/pricing")} className="btn btn-primary mt-6">
        View plans
      </button>
    </div>
  );
}

// ── Route adapter components ──────────────────────────────────────────────────

function LandingRoute() {
  const { isLoggedIn, isPro, isAdmin } = useAuth();
  const navigate = useNavigate();
  if (isLoggedIn) return <Navigate to={isPro || isAdmin ? "/deals" : "/scan"} replace />;
  return (
    <LandingPage
      onLaunch={() => navigate("/login")}
      onRegister={() => navigate("/register")}
    />
  );
}

function LoginRoute() {
  const { isLoggedIn, isPro, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  if (isLoggedIn) {
    const from = (location.state as { from?: Location })?.from?.pathname ?? (isPro || isAdmin ? "/deals" : "/scan");
    return <Navigate to={from} replace />;
  }
  return (
    <LoginPage
      onShowRegister={() => navigate("/register")}
      onSuccess={() => navigate(isPro || isAdmin ? "/deals" : "/scan")}
    />
  );
}

function RegisterRoute() {
  const { isLoggedIn, isPro, isAdmin } = useAuth();
  const navigate = useNavigate();
  if (isLoggedIn) return <Navigate to={isPro || isAdmin ? "/deals" : "/scan"} replace />;
  return (
    <RegisterPage
      onShowLogin={() => navigate("/login")}
      onSuccess={() => navigate("/scan")}
    />
  );
}

function PricingRoute() {
  const { isLoggedIn } = useAuth();
  const navigate = useNavigate();

  // Let the AppShell handle pricing for logged-in users (preserves nav bar)
  if (isLoggedIn) return <Navigate to="/pricing-app" replace />;

  // Public (unauthenticated) pricing page — listen for register intent from the page
  useEffect(() => {
    function onRegister() { navigate("/register"); }
    window.addEventListener("cf:show-register", onRegister);
    return () => window.removeEventListener("cf:show-register", onRegister);
  }, [navigate]);

  return <PricingPage onClose={() => navigate("/")} />;
}

// ── Route tree ────────────────────────────────────────────────────────────────

function AppRoutes() {
  return (
    <Routes>
      {/* Public / redirecting */}
      <Route path="/"         element={<LandingRoute />} />
      <Route path="/login"    element={<LoginRoute />} />
      <Route path="/register" element={<RegisterRoute />} />
      <Route path="/pricing"  element={<PricingRoute />} />
      <Route path="/privacy"  element={<PrivacyPolicyPage />} />
      <Route path="/terms"    element={<TermsPage />} />

      {/* Authenticated — inside the shared AppShell layout */}
      <Route element={<AppShell />}>
        {/* Any logged-in user */}
        <Route path="/scan"         element={<RequireAuth><ScanPage /></RequireAuth>} />
        <Route path="/watchlist"    element={<RequireAuth><WatchlistPage /></RequireAuth>} />
        <Route path="/flipfolio"    element={<RequireAuth><FlipfolioPage /></RequireAuth>} />
        <Route path="/pricing-app"  element={<RequireAuth><PricingPage onClose={() => history.back()} /></RequireAuth>} />

        {/* Pro / admin only */}
        <Route path="/deals" element={
          <RequireAuth>
            <RequirePro>
              <DealsPage />
            </RequirePro>
          </RequireAuth>
        } />

        {/* Admin only */}
        <Route path="/scrapes"       element={<RequireAdmin><ScrapesPage /></RequireAdmin>} />
        <Route path="/settings"      element={<RequireAdmin><SettingsPage /></RequireAdmin>} />
        <Route path="/admin/users"   element={<RequireAdmin><AdminUsersPage /></RequireAdmin>} />
        <Route path="/admin/reports" element={<RequireAdmin><AdminReportsPage /></RequireAdmin>} />
      </Route>

      {/* Catch-all — proper 404 instead of silent redirect */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <WatchlistProvider>
          <AppRoutes />
        </WatchlistProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
