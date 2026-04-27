# Carflip — Claude Context

## What this project is
Self-hosted car-deal finder. Scrapes AutoTrader UK, extracts listing data via LLM, scores underpriced vehicles, presents ranked deals in a React UI.

## Critical rule — LLM boundary
Gemini is **extraction/parsing only**. NEVER scoring, pricing, or deal evaluation. `carflip.scoring` has an import guard. Flag any violation immediately.

## Stack
| Layer | Tech |
|---|---|
| Backend API | FastAPI (`backend/`) |
| DB | PostgreSQL — migrations via Alembic (mandatory, non-negotiable) |
| Queue | Celery + Redis |
| LLM | `gemini-2.5-flash-lite` via Google AI Studio (`v1beta` endpoint) |
| Frontend | React + Vite + TanStack Query/Table + Tailwind (`frontend/`) |
| Scraping | Playwright async, Chromium headless |
| Deploy | Docker Compose, single host — all services in `docker-compose.yml` |

## All services run inside the backend container via supervisord
`redis`, `api` (uvicorn), `worker-scrape`, `worker-llm`, `worker-score`, `beat`
Check status: `docker compose exec backend /usr/bin/supervisorctl -c /etc/supervisor/supervisord.conf status`

## After any backend code change — rebuild is mandatory
```bash
docker compose build backend && docker compose up -d --force-recreate backend
```
Code changes are NOT live until the image is rebuilt.

## Gemini LLM config
- Model: `gemini-2.5-flash-lite` (`.env` → `GEMINI_MODEL`)
- Endpoint: `v1beta` (set via `http_options` in `genai.Client` in `gemini_client.py`)
- Free tier: 15 RPM, 1,000 RPD — resets midnight UTC
- New API keys from the same GCP project share the same quota pool
- `limit: 0` on a new project = use `v1beta` endpoint; if it persists, check billing in AI Studio
- Exponential backoff (2→64s) on 429 in `_call_gemini()`; Celery `rate_limit="12/m"`, `max_retries=None`, `default_retry_delay=300`

## Pipeline flow
```
beat → scrape_autotrader (queue: scrape)
  → Playwright → listings table (raw_html stored)
  → extract_listing_task (queue: llm)
    → gemini_client.extract_listing() → ListingExtraction Pydantic
    → score_listing_task (queue: score)
      → comparables + Z-score engine → deal_scores table
```

## Key LLM extraction rules
- Strip HTML to text first (`_html_to_text()`) — raw HTML is ~170k chars, stripped ~5k
- Mileage must be **optional** in schema (not in `required`) — Gemini returns `0` as default integer
- Only write `listing.mileage` if `extracted.mileage is not None`

## Check pipeline status
```bash
docker compose exec backend uv run python -c "
from carflip.db.session import SessionLocal
from carflip.db.models import Listing
from collections import Counter
db = SessionLocal()
counts = Counter(r[0] for r in db.query(Listing.llm_status).all())
valid_mileage = db.query(Listing).filter(Listing.llm_status=='valid', Listing.mileage > 0).count()
print('Status:', dict(counts), '| With mileage:', valid_mileage)
db.close()
"
```

## Queue N pending listings
```bash
docker compose exec backend uv run python -c "
from carflip.celery_app import celery
from carflip.db.session import SessionLocal
from carflip.db.models import Listing
db = SessionLocal()
ids = [l.id for l in db.query(Listing).filter(Listing.llm_status == 'pending').limit(60).all()]
for lid in ids: celery.send_task('carflip.llm.tasks.extract_listing_task', args=[lid], queue='llm')
print(f'Queued {len(ids)}')
db.close()
"
```

## Purge a queue
```bash
docker compose exec backend uv run celery -A carflip.celery_app purge -Q llm -f
```

## Memory files
Full project memory lives in `~/.claude/projects/-Users-danlaws-Projects-carflip/memory/`.
Key files: `overview.md`, `architecture.md`, `features.md`, `scrapers.md`, `scraper-status.md`, `lessons.md`, `fixed-issues.md`, `todo.md`.
