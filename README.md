# AutoFlipr

AI-powered UK car deal finder — scrapes AutoTrader, Gumtree & Facebook Marketplace, scores listings against live comparables, and surfaces underpriced cars in a ranked dashboard.

![Stack](https://img.shields.io/badge/stack-FastAPI_·_React_·_Celery_·_Gemini-black)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## What it does

Carflip runs continuously in the background, scraping UK car listings and ranking them by how underpriced they are relative to the current market.

- **Scrapes** AutoTrader, Gumtree, and Facebook Marketplace on a schedule
- **Extracts** structured data (make, model, year, mileage, price, location) from raw listing HTML using Gemini AI
- **Scores** each listing with a Z-score engine against recent comparable sales — higher score = better deal
- **Analyses** listing quality: red flags, condition notes, and positives via a second LLM pass
- **Checks** MOT history via the DVSA API and factors it into the score
- **Surfaces** results in a ranked, filterable React dashboard with distance filtering, watchlist, and price history

---

## Stack

| Layer | Tech |
|---|---|
| Backend API | FastAPI (Python) |
| Database | PostgreSQL + Alembic migrations |
| Task queue | Celery + Redis |
| LLM | Gemini 2.5 Flash Lite (Google AI Studio) |
| Scraping | Playwright (headless Chromium) |
| Frontend | React + Vite + TanStack Query + Tailwind CSS |
| Deploy | Docker Compose — single host, all services in one container via supervisord |

---

## Architecture

```
Celery Beat
  └── scrape_autotrader / scrape_gumtree / scrape_facebook  (queue: scrape)
        └── _persist_raw_listings → extract_listing_task     (queue: llm)
              └── Gemini: extract structured fields
              └── score_listing_task                         (queue: score)
                    └── Z-score vs comparables → DealScore
              └── analyse_vehicle_task                       (queue: llm)
                    └── Gemini: red flags, condition, positives
              └── analyse_mot_task                           (queue: llm)
                    └── Gemini: MOT narrative summary

User-submitted scan (POST /api/scan)
  └── scan_url_task  (queue: scan)
        └── scrape → extract → score → analyse  (all inline, single task)
```

---

## Getting started

### Prerequisites

- Docker + Docker Compose
- A [Google AI Studio](https://aistudio.google.com/app/apikey) API key (free tier works)
- Optionally: [DVSA MOT API](https://developer-portal.driver-vehicle-licensing.api.gov.uk/) credentials for MOT history

### Setup

```bash
# 1. Clone
git clone https://github.com/yourusername/carflip.git
cd carflip

# 2. Create your .env from the example
cp .env.example .env
# Edit .env — at minimum set GEMINI_API_KEY and a strong JWT_SECRET

# 3. Build and start
docker compose up -d --build

# 4. Run database migrations
docker compose exec backend uv run alembic upgrade head
```

The UI is available at `http://localhost` (nginx) or `http://localhost:8000` (API direct).

Default admin credentials are set via `AUTH_USER` / `AUTH_PASS` in `.env`.

---

## Configuration

All configuration is via environment variables. Copy `.env.example` to `.env` and fill in your values.

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | ✅ | Google AI Studio API key |
| `JWT_SECRET` | ✅ | Random secret for signing user JWTs |
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `AUTH_USER` / `AUTH_PASS` | ✅ | Admin panel HTTP Basic credentials |
| `DVSA_CLIENT_ID/SECRET` | Optional | Enables MOT history checks |
| `AUTOTRADER_SEARCH_POSTCODE` | Optional | Centre point for AutoTrader search |
| `FB_COOKIES_PATH` | Optional | Path to Facebook session cookies file |

See `.env.example` for the full list with descriptions.

---

## Facebook Marketplace

Facebook scraping requires a logged-in session cookie file:

1. Log in to `facebook.com` in your browser
2. Export cookies using the [Cookie-Editor](https://cookie-editor.com/) extension → **Export as JSON**
3. Save the file to the path set in `FB_COOKIES_PATH` (default: `/data/facebook_cookies.json`)

The scraper exits gracefully if the cookie file is missing or expired.

---

## Scoring

Listings are scored 0–100 using a **mileage-adjusted Z-score** against comparable listings seen in the last 60 days:

- **Score ≥ 70** — significantly underpriced vs market
- **Score 50–70** — around market value
- **Score < 50** — at or above market

Confidence tiers (high/medium/low) reflect how many comparables were available. MOT history applies a penalty for failures and missing records.

> **LLM boundary**: Gemini is used for data *extraction* and *listing quality analysis* only. Scoring and pricing are handled entirely in Python — no LLM is involved in the deal score calculation.

---

## Services

All services run inside the backend container via supervisord:

```bash
# Check status
docker compose exec backend supervisorctl status

# View logs
docker compose logs -f backend
```

| Service | Description |
|---|---|
| `api` | FastAPI / uvicorn on port 8000 |
| `worker-scrape` | Playwright scrape tasks |
| `worker-llm` | Gemini extraction + analysis tasks |
| `worker-score` | Scoring tasks |
| `worker-scan` | On-demand user scan tasks |
| `beat` | Celery beat scheduler |
| `redis` | In-process Redis broker |

---

## API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/deals` | Ranked deals with filters |
| `POST` | `/api/scan` | Submit a single URL for instant analysis |
| `GET` | `/api/scan/{id}` | Poll scan result |
| `GET` | `/api/scan/history` | User's scan history |
| `POST` | `/api/listings/{id}/report` | Report a scam/spam listing |
| `GET` | `/api/listings/pipeline/stats` | Pipeline health |
| `POST` | `/api/auth/register` | Create account |
| `POST` | `/api/auth/login` | Get JWT |
| `GET` | `/health` | Health check |

---

## License

MIT
