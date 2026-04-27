import hashlib
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Optional

import httpx
from playwright.async_api import async_playwright, Browser, BrowserContext

from carflip.config import settings

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
]


@dataclass
class RawListing:
    source: str
    external_id: str
    url: str
    raw_html: str
    image_urls: list = field(default_factory=list)
    raw_hash: str = field(init=False)

    def __post_init__(self) -> None:
        self.raw_hash = hashlib.sha256(self.raw_html.encode()).hexdigest()


class BaseScraper(ABC):
    source: str
    base_rate_limit: int = 30  # requests per minute

    def _random_ua(self) -> str:
        return random.choice(USER_AGENTS)

    def _jitter_sleep(self, base_seconds: float = 2.0) -> None:
        time.sleep(base_seconds * random.uniform(0.5, 1.5))

    async def _make_browser_context(self, browser: Browser) -> BrowserContext:
        proxy = {"server": settings.proxy_url} if settings.proxy_url else None
        ctx = await browser.new_context(
            user_agent=self._random_ua(),
            proxy=proxy,
            locale="en-GB",
            timezone_id="Europe/London",
            viewport={"width": 1440, "height": 900},
        )
        return ctx

    @abstractmethod
    async def discover_listing_ids(self, search_params: dict) -> list[str]:
        """Return list of source-specific listing IDs from search results."""

    @abstractmethod
    async def fetch_listing(self, listing_id: str) -> Optional[RawListing]:
        """Fetch and return raw HTML for a single listing."""

    async def run(self, search_params: dict) -> list[RawListing]:
        listing_ids = await self.discover_listing_ids(search_params)
        results: list[RawListing] = []
        for listing_id in listing_ids:
            raw = await self.fetch_listing(listing_id)
            if raw:
                results.append(raw)
            self._jitter_sleep(60 / self.base_rate_limit)
        return results
