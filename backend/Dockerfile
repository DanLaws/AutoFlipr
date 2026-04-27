FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl wget gnupg ca-certificates redis-server supervisor \
    && rm -rf /var/lib/apt/lists/*

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock* ./
RUN uv sync --no-dev

# Install Playwright browsers (needed only in worker-scrape; harmless elsewhere)
RUN uv run playwright install chromium --with-deps

COPY . .

ENV PATH="/app/.venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1

RUN mkdir -p /data/redis
COPY supervisord.conf /etc/supervisor/conf.d/carflip.conf
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/supervisord.conf"]
