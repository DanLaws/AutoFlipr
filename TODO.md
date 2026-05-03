# TODO

> Auto-generated from project review. Tackle issues one by one, marking each complete as you go.

---

## 🔴 High Priority

| # | Area | File / Location | Issue | Recommended Fix |
|---|------|-----------------|-------|-----------------|
| ~~H1~~ | ~~Security~~ | ~~`backend/autoflipr/api/routes/billing.py`~~ | ~~Stripe webhook accepts unsigned requests — unauthenticated POST can upgrade any user to Pro~~ | ~~✅ Done — unsigned fallback removed; 503 returned if secret not configured~~ |
| ~~H2~~ | ~~Security~~ | ~~`backend/autoflipr/config.py`~~ | ~~Insecure credential defaults (`JWT_SECRET`, `AUTH_PASS`, DB password all `"changeme"`) — forged JWTs and admin access if `.env` is missing~~ | ~~✅ Done — `@model_validator` raises `ValueError` on insecure defaults at startup~~ |
| ~~H3~~ | ~~Security~~ | ~~`backend/autoflipr/api/routes/scan.py` — `_check_and_deduct()`~~ | ~~Scan count TOCTOU race — concurrent requests from the same user can both pass the limit check~~ | ~~✅ Done — atomic `UPDATE … WHERE scan_count < limit RETURNING scan_count`~~ |
| ~~H4~~ | ~~Security~~ | ~~`backend/autoflipr/auth/utils.py`~~ | ~~30-day non-revocable JWT with plan and `is_admin` baked in — downgrades and suspensions not enforced until expiry~~ | ~~✅ Done — access token shortened to 60 min; `create_refresh_token` added; `POST /api/auth/refresh` endpoint issued~~ |
| ~~H5~~ | ~~Security~~ | ~~`frontend/src/pages/AdminLogin.tsx`~~ | ~~Base64 credentials stored in `sessionStorage` — readable by XSS or browser extensions; no per-admin audit trail~~ | ~~✅ Done — `POST /api/admin/token` issues 8 h admin JWT; frontend stores token not credentials; all admin routes use `AdminUser` (Bearer JWT) dep~~ |
| ~~H6~~ | ~~Security~~ | ~~Project-wide (no middleware)~~ | ~~No rate limiting on login, register, scan, or Stripe checkout endpoints — trivial brute-force and quota exhaustion~~ | ~~✅ Done — `slowapi` added; `limiter.py` module created; 10/min on login, register, checkout, admin/token; 20/min on scan submit~~ |
| ~~H7~~ | ~~Security~~ | ~~`backend/autoflipr/main.py`~~ | ~~CORS hardcoded to `localhost` — production cross-origin requests will fail~~ | ~~✅ Done — `settings.cors_origin_list` (from `CORS_ORIGINS` env var) passed to middleware~~ |
| ~~H8~~ | ~~Performance~~ | ~~`backend/autoflipr/api/routes/deals.py`~~ | ~~Distance sort fetches up to 5,000 rows into Python memory per request for Haversine sort~~ | ~~✅ Done — `_haversine_expr()` SQL helper added; distance sort uses `ORDER BY <sql haversine>` + normal `LIMIT/OFFSET`; migration 011 adds partial `(latitude, longitude)` B-tree index~~ |
| ~~H9~~ | ~~Architecture~~ | ~~`backend/supervisord.conf` / `docker-compose.yml`~~ | ~~Redis runs inside the backend container — a Redis crash kills uvicorn and all Celery workers~~ | ~~✅ Done — dedicated `redis:7-alpine` service in compose with healthcheck; backend `depends_on` it; removed from `supervisord.conf` and `Dockerfile`~~ |
| ~~H10~~ | ~~Architecture~~ | ~~`frontend/src/App.tsx`~~ | ~~Manual `useState` routing — deep linking, browser back/forward, and OAuth redirects all fail~~ | ~~✅ Done — `react-router-dom` v6 added; `BrowserRouter` + `Routes/Route`; `AppShell` layout; `WatchlistContext` lifts state; `AdminAuthContext`; route guards `RequireAuth/RequirePro/RequireAdmin`~~ |
| ~~H11~~ | ~~Architecture~~ | ~~`backend/autoflipr/api/deps.py`~~ | ~~`is_active` checked only at login, not per request — suspended accounts retain full API access until token expires~~ | ~~✅ Done — `require_user` now does a DB lookup per request; checks `is_active`, returns fresh `plan`/`is_admin`~~ |
| H12 | Testing | Project-wide | Zero automated tests across the entire codebase — critical for a product making financial valuations and processing Stripe payments | Add `pytest`, `pytest-asyncio`, `pytest-mock`, `httpx` to dev deps; start with Stripe webhook and scoring engine |

---

## 🟡 Medium Priority

| # | Area | File / Location | Issue | Recommended Fix |
|---|------|-----------------|-------|-----------------|
| ~~M1~~ | ~~Security~~ | ~~`backend/autoflipr/llm/gemini_client.py`~~ | ~~`_exhausted_models` / `_unavailable_models` sets never cleared — a temporary 503 permanently disables models until worker restart~~ | ~~✅ Done — `list[set]` replaced with `list[dict[str, float]]` (expiry timestamps); `_model_list()` evicts expired entries; 10-min TTL for both 429 and 503~~ |
| ~~M2~~ | ~~Security~~ | ~~`backend/autoflipr/api/routes/health.py`~~ | ~~`SessionLocal()` opened with no context manager — exceptions leave DB connections unclosed~~ | ~~✅ Done — wrapped in `with SessionLocal() as db:` so connection is always released~~ |
| ~~M3~~ | ~~Code Quality~~ | ~~`frontend/src/components/ReportButton.tsx` / `backend/autoflipr/api/routes/listings.py`~~ | ~~Report type strings differ between frontend (`"fake"`, `"finance"`) and DB schema comments (`"scam"`, `"spam"`, `"duplicate"`) — silent data quality divergence~~ | ~~✅ Done — `ReportType` StrEnum added to `models.py`; `ReportRequest` uses it; `gemini_client.py` uses `ReportType.SCAM`; frontend updated to `"scam"/"finance"/"duplicate"/"other"`~~ |
| ~~M4~~ | ~~Code Quality~~ | ~~`frontend/src/hooks/useWatchlist.ts`~~ | ~~`useWatchlist(user?.id ?? 0)` — all logged-out users share key `cf_bookmarked_u0`; anonymous bookmarks lost on login~~ | ~~✅ Done — `getDeviceId()` generates/persists a UUID as `cf_device_id`; anon key uses UUID not `0`; login merges anon slot into user slot then clears it~~ |
| ~~M5~~ | ~~Code Quality~~ | ~~`frontend/src/pages/Scan.tsx`~~ | ~~Inline `authFetch` duplicates logic from `api/client.ts` — auth header changes must be made in two places~~ | ~~✅ Done — `apiFetch`/`apiPost` exported from `client.ts`; inline `authFetch` removed from `Scan.tsx`; `token` destructure removed~~ |
| ~~M6~~ | ~~Code Quality~~ | ~~`backend/autoflipr/scoring/engine.py` — `MIN_COMPS = 1`~~ | ~~Score from a single comparable has no statistical validity; shown with the same ring badge as a 20-comparable score~~ | ~~✅ Done — `MIN_COMPS = 3`; fewer than 3 comparables → `None` → no `DealScore` row written; existing `_confidence_tier` remains correct for 3+ comps~~ |
| ~~M7~~ | ~~Performance~~ | ~~`frontend/src/pages/Deals.tsx`~~ | ~~60-second TanStack Query polling triggers a 5,000-row Python sort per active user per minute~~ | ~~✅ Done — `staleTime` and `refetchInterval` both set to 5 minutes; DB hit rate cut 5×~~ |
| ~~M8~~ | ~~Performance~~ | ~~`backend/autoflipr/api/routes/admin.py`~~ | ~~Admin user list and scrape run list have no `LIMIT`/`OFFSET` — unbounded DB scans as dataset grows~~ | ~~✅ Done — `skip`/`limit` (default 0/100, max 500) added to `list_users` and `list_reports`~~ |
| ~~M9~~ | ~~Performance~~ | ~~`backend/autoflipr/scrapers/gumtree.py` — `refresh_gumtree_listings()`~~ | ~~Gumtree refresh is fully sequential with blocking 2–5 s sleep per listing — 100 listings ≈ 8 min~~ | ~~✅ Done — sequential loop replaced with `asyncio.Semaphore(3)` + `asyncio.gather`; 100 listings now ≈ 3 min; discovery phase kept sequential~~ |
| ~~M10~~ | ~~Architecture~~ | ~~`backend/autoflipr/tasks/` — LLM extraction task~~ | ~~`max_retries=None` — permanently broken/bot-blocked URLs retry indefinitely at 300 s intervals~~ | ~~✅ Done — `max_retries=5`; exponential backoff 5→10→20→40→60 min; `MaxRetriesExceededError` sets `llm_status = "failed_permanent"`~~ |
| ~~M11~~ | ~~Architecture~~ | ~~`frontend/src/api/client.ts`~~ | ~~`fetch()` calls have no `AbortSignal` timeout — slow backend responses leave UI in indefinite loading state~~ | ~~✅ Done — `fetchWithTimeout()` helper added; 15 s `AbortController` timer cleared on response; used by both `apiFetch` and `apiPost`~~ |
| ~~M12~~ | ~~Architecture~~ | ~~Project-wide (Celery + uvicorn logs)~~ | ~~No structured logging or request-ID correlation — tracing a failed scan requires manual timestamp matching across log streams~~ | ~~✅ Done — `structlog` added; `configure_logging()` routes all stdlib loggers through JSON renderer; `RequestIDMiddleware` binds `request_id` per request + echoes `X-Request-ID` header; `before_task_publish` / `task_prerun` signals propagate ID into Celery workers; `worker_hijack_root_logger=False` ensures workers use structlog too~~ |
| ~~M13~~ | ~~Testing~~ | ~~`backend/autoflipr/scoring/engine.py`~~ | ~~Pure function with no tests — covers the core product value proposition~~ | ~~✅ Done — 32 pytest tests across 7 test classes: normal case, insufficient comps, outlier trimming, MOT penalty cap, zero-sigma guard, confidence tiers, mileage adjustment~~ |
| ~~M14~~ | ~~Testing~~ | ~~`backend/autoflipr/llm/schemas.py`~~ | ~~Pydantic validators are pure functions with no tests — a mistyped regex silently passes `None` downstream~~ | ~~✅ Done — 37 pytest tests: year range, mileage bounds, price bounds, reg normalisation (format + LLM hallucination cases), seller type normalisation, VehicleAnalysis percent clamp~~ |
| ~~M15~~ | ~~Testing~~ | ~~`backend/autoflipr/auth/utils.py`~~ | ~~`create_access_token` / `verify_token` have no tests — JWT structure and expiry are security-critical~~ | ~~✅ Done — 21 pytest tests: access/refresh/admin token claim structure, 60-min/30-day/8-hour expiry, tampered signature rejection, wrong secret rejection, expired token rejection~~ |
| M16 | Testing | `backend/autoflipr/api/routes/billing.py` | Stripe webhook has no integration tests — the signature-bypass path is a security vulnerability | Add `pytest` tests: valid signed event upgrades plan; unsigned request without secret is rejected; unknown customer handled gracefully |
| ~~M17~~ | ~~Testing~~ | ~~`backend/autoflipr/scrapers/`~~ | ~~Regex extractors for AutoTrader and Gumtree have no tests — break silently on site redesign~~ | ~~✅ Done — 23 pytest tests: AutoTrader ID extraction (dedup, noise, empty), Gumtree LISTING_HREF_RE (quote styles, length guard, non-href), `_extract_listing_paths` (skip categories, dedup, mixed)~~ |
| ~~M18~~ | ~~Dependencies~~ | ~~`backend/pyproject.toml`~~ | ~~No lock file committed — rebuilds can silently pick up a breaking minor version of `playwright`, `sqlalchemy`, or `stripe`~~ | ~~✅ Done — `uv.lock` generated and committed; `Dockerfile` updated to `uv sync --frozen`; build verified~~ |

---

## 🟢 Low Priority

| # | Area | File / Location | Issue | Recommended Fix |
|---|------|-----------------|-------|-----------------|
| ~~L1~~ | ~~Code Quality~~ | ~~`frontend/src/components/DealModal.tsx`~~ | ~~Road tax `£195/12` and MOT fee `£54.85` are magic numbers — will go stale when rates change~~ | ~~✅ Done — `roadTaxAnnual` and `motFee` added to `AppSettings`; user-editable in Settings → Cost Assumptions; DealModal uses settings values~~ |
| ~~L2~~ | ~~Code Quality~~ | ~~`frontend/src/pages/Settings.tsx`~~ | ~~Save button is cosmetic — settings persist to `localStorage` on every `onChange` regardless; misleads users~~ | ~~✅ Done — Save button removed; subtitle updated to "Changes are saved automatically in your browser"~~ |
| L3 | Code Quality | `frontend/src/pages/Watchlist.tsx` | Watchlist is `localStorage`-only — clearing browser data, switching browser, or using mobile loses all bookmarks | Add server-side persistence (`watchlist` table linked to `User`); sync on login |
| ~~L4~~ | ~~Performance~~ | ~~`backend/autoflipr/api/routes/deals.py` — `_postcode_cache`~~ | ~~Manual FIFO eviction (`if len > 500: delete first key`) is fragile and unclear~~ | ~~✅ Done — replaced with `@lru_cache(maxsize=500)` on `_geocode_postcode()` helper~~ |
| ~~L5~~ | ~~Performance~~ | ~~`frontend/src/pages/Watchlist.tsx`~~ | ~~Watchlist fetches up to 200 deals and filters client-side — most rows are fetched and discarded~~ | ~~✅ Done — `GET /api/deals/by-ids` endpoint added; `Watchlist.tsx` uses `api.dealsByIds()`~~ |
| ~~L6~~ | ~~Architecture~~ | ~~`backend/autoflipr/scrapers/facebook.py`~~ | ~~Cookie expiry causes the Facebook scraper to stop silently with no alert raised~~ | ~~✅ Done — `FacebookLoginWallError` raised from `_dismiss_fb_dialogs`; `_run_scrape` catches it and sets `ScrapeRun.status = "cookie_expired"` without retrying; Scrapes page shows recent runs with a banner when cookies are expired~~ |
| ~~L7~~ | ~~Testing~~ | ~~`frontend/src/components/DealModal.tsx`~~ | ~~Cost breakdown arithmetic shown to paying users has no test coverage~~ | ~~✅ Done — calculation logic extracted to `src/utils/costBreakdown.ts`; 12 Vitest tests in `costBreakdown.test.ts` covering road tax rounding, custom rates, repair buffer (% and fixed), selling fee, inspection fuel, totalCosts, and netProfit~~ |
| ~~L8~~ | ~~Dependencies~~ | ~~`backend/pyproject.toml`~~ | ~~`celery[redis]` already pulls in `redis` — the explicit `redis` dep is redundant~~ | ~~✅ Done — standalone `redis` dep removed~~ |

---

## ✅ Completed

- ~~H1 — Stripe webhook signature bypass: removed unsigned fallback; 503 returned if `STRIPE_WEBHOOK_SECRET` not set~~
- ~~H2 — Insecure credential defaults: `@model_validator` in `config.py` raises `ValueError` on `JWT_SECRET` / `AUTH_PASS` placeholders at startup~~
- ~~H3 — Scan count race condition: atomic `UPDATE … WHERE scan_count < limit RETURNING scan_count` in `scan.py`~~
- ~~H7 — CORS hardcoded to localhost: `cors_origin_list` property in `config.py`; `main.py` reads from `CORS_ORIGINS` env var~~
- ~~H11 — `is_active` not checked per request: `require_user` in `deps.py` now does a DB lookup, checks `is_active`, returns fresh `plan`/`is_admin`~~
- ~~H4 — 30-day JWT / stale plan: access token shortened to 60 min; refresh token added (`create_refresh_token`); `POST /api/auth/refresh` endpoint added~~
- ~~H5 — Admin credentials in sessionStorage: `POST /api/admin/token` issues 8 h admin JWT; `AdminLogin` stores token not credentials; all admin routes use `AdminUser` Bearer JWT dep~~
- ~~H6 — No rate limiting: `slowapi` added; shared `limiter.py`; 10/min on login, register, checkout, admin/token; 20/min on scan~~
- ~~H8 — Distance sort 5,000-row overfetch: `_haversine_expr()` SQL helper; distance sort fully in Postgres with normal LIMIT/OFFSET; migration 011 adds partial `(lat, lng)` index~~
- ~~H9 — Redis co-located in backend container: dedicated `redis:7-alpine` compose service with healthcheck; removed from `supervisord.conf` and `Dockerfile`; `REDIS_URL` updated to `redis://redis:6379/0`~~
- ~~H10 — Manual useState routing: `react-router-dom` v6; `AppShell` + `<Outlet>`; `WatchlistContext`; `AdminAuthContext`; `RequireAuth/RequirePro/RequireAdmin` guards; all pages have real URLs~~
