.PHONY: up down build migrate shell-api shell-db logs

up:
	docker compose up -d

down:
	docker compose down

build:
	docker compose build

migrate:
	docker compose exec backend alembic upgrade head

shell-api:
	docker compose exec backend bash

shell-db:
	docker compose exec database psql -U carflip carflip

logs:
	docker compose logs -f --tail=100

# Local dev (without Docker)
dev-install:
	cd backend && uv sync
	cd frontend && npm install

dev-api:
	cd backend && DATABASE_URL=postgresql://carflip:changeme@localhost:5432/carflip \
		REDIS_URL=redis://localhost:6379/0 \
		uv run uvicorn carflip.main:app --reload --port 8000

dev-worker:
	cd backend && uv run celery -A carflip.celery_app worker -Q scrape,llm,score,mot,default --loglevel=info

dev-beat:
	cd backend && uv run celery -A carflip.celery_app beat --loglevel=info

dev-frontend:
	cd frontend && npm run dev
