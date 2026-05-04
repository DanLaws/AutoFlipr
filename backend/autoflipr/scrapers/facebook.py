"""
Facebook Marketplace UK car scraper — powered by Scrapling StealthyFetcher.

Authentication: Requires a valid Facebook session stored as a JSON cookie file.
  1. Log in to facebook.com in your browser.
  2. Export cookies using "Cookie-Editor" or similar extension → Export as JSON.
  3. Save the file to ./data/facebook_cookies.json (mounted into the container at /data/).

StealthyFetcher patches Playwright's bot-detection signals automatically:
canvas fingerprint noise, headless-mode flags, WebRTC leak prevention,
navigator.webdriver removal, and consistent browser fingerprints.
"""

import json
import logging
import os
import re
from typing import Optional

from scrapling.fetchers import StealthyFetcher

from autoflipr.config import settings
from autoflipr.scrapers.base import BaseScraper, RawListing

log = logging.getLogger(__name__)


class FacebookLoginWallError(RuntimeError):
    """Raised when FB returns a login wall (cookies expired or invalid)."""


BASE_URL = "https://www.facebook.com"
_SEARCH_URL = (
    "https://www.facebook.com/marketplace/search/"
    "?query=car+for+sale"
    "&exact=false"
    "&categoryID=807311116002614"
    "&lat={lat}&lng={lng}&radius={radius_km}"
    "&minPrice={min_price}&maxPrice={max_price}"
    "&sortBy=creation_time_descend"
)
_LISTING_ID_RE = re.compile(r"/marketplace/item/(\d{10,})/")
_IMG_RE = re.compile(
    r'"(https://[^"]*scontent[^"]+\.(?:jpg|jpeg|webp|png)(?:\?[^"]*)?)"'
)
_TINY_THUMB = re.compile(r"p\d{2}x\d{2}")  # p60x60, p50x50, etc.


# ── Cookie loading ────────────────────────────────────────────────────────────

def _load_cookies(path: str) -> list[dict]:
    """Load a Cookie-Editor JSON export and return Playwright-format cookie dicts."""
    if not os.path.exists(path):
        log.warning("[fb] Cookie file not found: %s — FB scraper disabled", path)
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        cookies = []
        for c in data:
            cookie: dict = {
                "name":     c["name"],
                "value":    c["value"],
                "domain":   c.get("domain", ".facebook.com"),
                "path":     c.get("path", "/"),
                "httpOnly": c.get("httpOnly", False),
                "secure":   c.get("secure", True),
                "sameSite": "None",
            }
            if "expirationDate" in c:
                cookie["expires"] = int(c["expirationDate"])
            cookies.append(cookie)
        log.info("[fb] Loaded %d cookies from %s", len(cookies), path)
        return cookies
    except Exception as exc:
        log.warning("[fb] Failed to load cookies: %s", exc)
        return []


# ── HTML extraction helpers ───────────────────────────────────────────────────

def _extract_listing_ids(html: str) -> list[str]:
    ids = _LISTING_ID_RE.findall(html)
    seen: set[str] = set()
    result = []
    for lid in ids:
        if lid not in seen:
            seen.add(lid)
            result.append(lid)
    return result


def _extract_images(html: str) -> list[str]:
    seen: set[str] = set()
    result = []
    for url in _IMG_RE.findall(html):
        if _TINY_THUMB.search(url):
            continue
        if url not in seen:
            seen.add(url)
            result.append(url)
    return result[:20]


# ── Playwright page-action callbacks ─────────────────────────────────────────
# StealthyFetcher returns the raw HTTP response body (empty for React SPAs).
# We capture the fully-rendered DOM via page.content() inside the page_action
# callback, after scrolling has triggered lazy-loaded listings.

async def _dismiss_dialogs(page) -> None:
    """Accept cookie consent banners. Raises FacebookLoginWallError on login wall."""
    for selector in [
        '[data-cookiebanner="accept_button"]',
        'button[title="Allow all cookies"]',
        'button[title="Accept all"]',
    ]:
        try:
            el = page.locator(selector).first
            if await el.count() > 0:
                await el.click(timeout=3_000)
                await page.wait_for_timeout(800)
                return
        except Exception:
            pass

    for selector in ['[data-testid="royal_login_form"]', 'form[action*="login"]']:
        try:
            if await page.locator(selector).count() > 0:
                raise FacebookLoginWallError("Login wall — cookies expired")
        except FacebookLoginWallError:
            raise
        except Exception:
            pass


def _make_search_action(capture: dict):
    """Return a page_action that scrolls and captures the rendered DOM."""
    async def _action(page) -> None:
        await _dismiss_dialogs(page)
        await page.wait_for_timeout(3_000)  # let React render initial listings
        for _ in range(6):
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await page.wait_for_timeout(1_500)
        capture["html"] = await page.content()
        capture["url"]  = page.url
    return _action


def _make_listing_action(capture: dict):
    """Return a page_action that dismisses dialogs and captures the rendered DOM."""
    async def _action(page) -> None:
        await _dismiss_dialogs(page)
        await page.wait_for_timeout(2_000)
        capture["html"] = await page.content()
        capture["url"]  = page.url
    return _action


# ── Scraper class ─────────────────────────────────────────────────────────────

class FacebookScraper(BaseScraper):
    source = "fb"
    base_rate_limit = 8  # conservative — FB is aggressive about bots

    def _cookies(self) -> list[dict]:
        return _load_cookies(settings.fb_cookies_path)

    def _is_login_wall(self, url: str, html: str) -> bool:
        if any(k in url for k in ("login", "checkpoint", "recover")):
            return True
        if 'id="login_form"' in html or '"loginForm"' in html:
            return True
        return False

    async def discover_listing_ids(self, search_params: dict) -> list[str]:
        cookies = self._cookies()
        if not cookies:
            return []

        url = _SEARCH_URL.format(
            lat=search_params.get("lat", settings.fb_latitude),
            lng=search_params.get("lng", settings.fb_longitude),
            radius_km=search_params.get("radius_km", settings.fb_radius_km),
            min_price=search_params.get("min_price", settings.fb_min_price),
            max_price=search_params.get("max_price", settings.fb_max_price),
        )

        capture: dict = {}
        try:
            log.info("[fb] Fetching search: %s", url)
            await StealthyFetcher.async_fetch(
                url,
                headless=True,
                cookies=cookies,
                page_action=_make_search_action(capture),
                network_idle=True,
                timeout=60_000,
            )

            html = capture.get("html", "")
            current_url = capture.get("url", "")

            if not html or self._is_login_wall(current_url, html):
                raise FacebookLoginWallError("Login wall detected — cookies expired")

            ids = _extract_listing_ids(html)
            log.info("[fb] Discovered %d listing IDs", len(ids))
            return ids

        except FacebookLoginWallError:
            raise
        except Exception as exc:
            log.warning("[fb] discover_listing_ids error: %s", exc)
            return []

    async def fetch_listing(self, listing_id: str) -> Optional[RawListing]:
        cookies = self._cookies()
        if not cookies:
            return None

        url = f"{BASE_URL}/marketplace/item/{listing_id}/"

        capture: dict = {}
        try:
            await StealthyFetcher.async_fetch(
                url,
                headless=True,
                cookies=cookies,
                page_action=_make_listing_action(capture),
                network_idle=True,
                timeout=45_000,
            )

            html = capture.get("html", "")
            current_url = capture.get("url", "")

            if not html or self._is_login_wall(current_url, html):
                raise FacebookLoginWallError("Login wall detected — cookies expired")

            # Removed/invalid listings redirect away from /marketplace/item/
            if "marketplace/item" not in current_url and listing_id not in current_url:
                log.debug("[fb] Listing %s appears removed", listing_id)
                return None

            if len(html) < 2_000:
                log.debug("[fb] Listing %s: HTML too short, skipping", listing_id)
                return None

            return RawListing(
                source="fb",
                external_id=listing_id,
                url=url,
                raw_html=html,
                image_urls=_extract_images(html),
            )

        except FacebookLoginWallError:
            raise
        except Exception as exc:
            log.warning("[fb] fetch_listing %s error: %s", listing_id, exc)
            return None

    async def run(self, search_params: dict) -> list[RawListing]:
        cookies = self._cookies()
        if not cookies:
            log.info("[fb] No cookies available — skipping Facebook scrape")
            return []

        ids = await self.discover_listing_ids(search_params)
        if not ids:
            return []

        results: list[RawListing] = []
        for lid in ids[:40]:
            listing = await self.fetch_listing(lid)
            if listing:
                results.append(listing)
            await self._jitter_sleep_async(60 / self.base_rate_limit)

        log.info("[fb] Scraped %d listings", len(results))
        return results
