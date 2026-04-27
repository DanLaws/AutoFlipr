"""
Facebook Marketplace UK car scraper.

Authentication: Requires a valid Facebook session stored as a JSON cookie file.
  1. Log in to facebook.com in your browser.
  2. Export cookies using "Cookie-Editor" or similar extension → Export as JSON.
  3. Save the file to the path configured in FB_COOKIES_PATH (default: /data/facebook_cookies.json).

The scraper uses a coordinate + radius search on the Marketplace vehicles category,
then fetches each individual listing for raw HTML storage.

External ID: the numeric listing ID from the URL, e.g.
  https://www.facebook.com/marketplace/item/1234567890/ → "1234567890"
"""

import json
import logging
import os
import re
from typing import Optional

from playwright.async_api import async_playwright, BrowserContext, Page

from carflip.config import settings
from carflip.scrapers.base import BaseScraper, RawListing, USER_AGENTS

import random

log = logging.getLogger(__name__)

BASE_URL = "https://www.facebook.com"
# FB Marketplace vehicles search with lat/lng/radius
_SEARCH_URL = (
    "https://www.facebook.com/marketplace/search/"
    "?query=car+for+sale"
    "&exact=false"
    "&categoryID=807311116002614"  # Vehicles category
    "&lat={lat}&lng={lng}&radius={radius_km}"
    "&minPrice={min_price}&maxPrice={max_price}"
    "&daysSinceListed=3"
    "&sortBy=creation_time_descend"
)

_LISTING_ID_RE = re.compile(r"/marketplace/item/(\d{10,})/")
_IMG_DOMAIN = "scontent"  # Facebook CDN prefix


async def _fb_route(route) -> None:
    """Block non-essential resources to speed up Facebook page loads."""
    rt = route.request.resource_type
    req_url = route.request.url
    if rt in ("media", "font"):
        await route.abort()
    elif rt == "image" and _IMG_DOMAIN not in req_url:
        await route.abort()
    else:
        await route.continue_()


def _load_cookies(path: str) -> list[dict]:
    """Load cookies from a JSON file (Cookie-Editor export format)."""
    if not os.path.exists(path):
        log.warning("[fb] Cookie file not found at %s — FB scraper disabled", path)
        return []
    try:
        with open(path) as f:
            data = json.load(f)
        # Cookie-Editor exports an array of {name, value, domain, path, ...}
        # Playwright expects {name, value, url} or {name, value, domain, path}
        cookies = []
        for c in data:
            cookie: dict = {
                "name": c["name"],
                "value": c["value"],
                "domain": c.get("domain", ".facebook.com"),
                "path": c.get("path", "/"),
                "httpOnly": c.get("httpOnly", False),
                "secure": c.get("secure", True),
                "sameSite": "None",
            }
            if "expirationDate" in c:
                cookie["expires"] = int(c["expirationDate"])
            cookies.append(cookie)
        log.info("[fb] Loaded %d cookies from %s", len(cookies), path)
        return cookies
    except Exception as exc:
        log.warning("[fb] Failed to load cookies from %s: %s", path, exc)
        return []


async def _dismiss_fb_dialogs(page: Page) -> None:
    """Dismiss login prompts or cookie consent dialogs."""
    # Cookie consent
    for selector in [
        '[data-cookiebanner="accept_button"]',
        'button[title="Allow all cookies"]',
        'button[title="Accept all"]',
    ]:
        try:
            el = page.locator(selector).first
            if await el.count() > 0:
                await el.click(timeout=3_000)
                await page.wait_for_timeout(1_000)
                return
        except Exception:
            pass

    # Login wall — if we see a login dialog, cookies have expired
    for selector in ['[data-testid="royal_login_form"]', 'form[action*="login"]']:
        try:
            el = page.locator(selector)
            if await el.count() > 0:
                log.warning("[fb] Login wall detected — cookies may have expired")
                return
        except Exception:
            pass


def _extract_listing_ids(html: str) -> list[str]:
    """Extract unique listing IDs from marketplace search results HTML."""
    ids = _LISTING_ID_RE.findall(html)
    seen: set[str] = set()
    result = []
    for lid in ids:
        if lid not in seen:
            seen.add(lid)
            result.append(lid)
    return result


def _extract_images(page_content: str) -> list[str]:
    """Extract Facebook CDN image URLs from page HTML."""
    # Match og:image or data-src containing scontent
    patterns = [
        re.compile(r'content="(https://[^"]*scontent[^"]+\.(?:jpg|jpeg|webp|png)[^"]*)"'),
        re.compile(r'"(https://[^"]*scontent[^"]+\.(?:jpg|jpeg|webp)[^"]*)"'),
    ]
    seen: set[str] = set()
    result = []
    for pat in patterns:
        for url in pat.findall(page_content):
            # Skip tiny thumbnails (profile pics etc)
            if "p60x60" in url or "p50x50" in url:
                continue
            if url not in seen:
                seen.add(url)
                result.append(url)
    return result[:20]  # cap at 20 images


class FacebookScraper(BaseScraper):
    source = "fb"
    base_rate_limit = 8  # conservative — FB is aggressive about bots

    async def _new_context(self, p, cookies: list[dict]) -> BrowserContext:
        browser = await p.chromium.launch(
            headless=True,
            args=[
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage",
                "--no-sandbox",
            ],
        )
        ctx = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            locale="en-GB",
            timezone_id="Europe/London",
            viewport={"width": 1440, "height": 900},
            # Mask automation signals
            extra_http_headers={
                "Accept-Language": "en-GB,en;q=0.9",
                "sec-ch-ua-platform": '"Windows"',
            },
        )
        if cookies:
            await ctx.add_cookies(cookies)
        return ctx

    async def discover_listing_ids(self, search_params: dict) -> list[str]:
        """Scrape search results page and return listing IDs."""
        lat = search_params.get("lat", settings.fb_latitude)
        lng = search_params.get("lng", settings.fb_longitude)
        radius_km = search_params.get("radius_km", settings.fb_radius_km)
        min_price = search_params.get("min_price", settings.fb_min_price)
        max_price = search_params.get("max_price", settings.fb_max_price)

        url = _SEARCH_URL.format(
            lat=lat, lng=lng, radius_km=radius_km,
            min_price=min_price, max_price=max_price,
        )

        cookies = _load_cookies(settings.fb_cookies_path)
        if not cookies:
            return []

        ids: list[str] = []
        async with async_playwright() as p:
            ctx = await self._new_context(p, cookies)
            page = await ctx.new_page()

            await page.route("**/*", _fb_route)

            try:
                log.info("[fb] Fetching search results: %s", url)
                await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                await page.wait_for_timeout(3_000)
                await _dismiss_fb_dialogs(page)

                # Scroll to load more listings
                for _ in range(3):
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await page.wait_for_timeout(1_500)

                html = await page.content()
                ids = _extract_listing_ids(html)
                log.info("[fb] Discovered %d listing IDs", len(ids))

            except Exception as exc:
                log.warning("[fb] Search page error: %s", exc)
            finally:
                await ctx.browser.close()

        return ids

    async def fetch_listing(self, listing_id: str) -> Optional[RawListing]:
        """Fetch a single FB Marketplace listing by ID."""
        url = f"{BASE_URL}/marketplace/item/{listing_id}/"
        cookies = _load_cookies(settings.fb_cookies_path)
        if not cookies:
            return None

        async with async_playwright() as p:
            ctx = await self._new_context(p, cookies)
            page = await ctx.new_page()

            await page.route("**/*", _fb_route)

            try:
                await page.goto(url, wait_until="domcontentloaded", timeout=45_000)
                await page.wait_for_timeout(2_000)
                await _dismiss_fb_dialogs(page)

                html = await page.content()

                if len(html) < 2_000:
                    log.debug("[fb] Listing %s: HTML too short, skipping", listing_id)
                    return None

                # Check if listing is still live (removed listings redirect)
                current_url = page.url
                if "marketplace/item" not in current_url and listing_id not in current_url:
                    log.debug("[fb] Listing %s appears removed (redirected)", listing_id)
                    return None

                image_urls = _extract_images(html)

                return RawListing(
                    source="fb",
                    external_id=listing_id,
                    url=url,
                    raw_html=html,
                    image_urls=image_urls,
                )

            except Exception as exc:
                log.warning("[fb] fetch_listing %s error: %s", listing_id, exc)
                return None
            finally:
                await ctx.browser.close()

    async def run(self, search_params: dict) -> list[RawListing]:
        """Discover listing IDs then fetch each one, reusing browser context."""
        cookies = _load_cookies(settings.fb_cookies_path)
        if not cookies:
            log.info("[fb] No cookies available — skipping Facebook scrape")
            return []

        lat = search_params.get("lat", settings.fb_latitude)
        lng = search_params.get("lng", settings.fb_longitude)
        radius_km = search_params.get("radius_km", settings.fb_radius_km)
        min_price = search_params.get("min_price", settings.fb_min_price)
        max_price = search_params.get("max_price", settings.fb_max_price)

        search_url = _SEARCH_URL.format(
            lat=lat, lng=lng, radius_km=radius_km,
            min_price=min_price, max_price=max_price,
        )

        results: list[RawListing] = []

        async with async_playwright() as p:
            ctx = await self._new_context(p, cookies)

            try:
                # ── Step 1: discover listing IDs ──────────────────────────
                page = await ctx.new_page()
                await page.route("**/*", _fb_route)
                log.info("[fb] Fetching search: %s", search_url)
                await page.goto(search_url, wait_until="domcontentloaded", timeout=45_000)
                await page.wait_for_timeout(3_000)
                await _dismiss_fb_dialogs(page)

                for _ in range(3):
                    await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                    await page.wait_for_timeout(1_500)

                html = await page.content()
                listing_ids = _extract_listing_ids(html)
                log.info("[fb] Found %d candidate listings", len(listing_ids))
                await page.close()

                # ── Step 2: fetch each listing ────────────────────────────
                for lid in listing_ids[:40]:  # cap per run
                    listing_url = f"{BASE_URL}/marketplace/item/{lid}/"
                    page = await ctx.new_page()
                    await page.route("**/*", _fb_route)
                    try:
                        await page.goto(listing_url, wait_until="domcontentloaded", timeout=30_000)
                        await page.wait_for_timeout(1_500)
                        await _dismiss_fb_dialogs(page)

                        listing_html = await page.content()
                        if len(listing_html) < 2_000:
                            continue
                        if "marketplace/item" not in page.url and lid not in page.url:
                            continue  # redirected = removed

                        images = _extract_images(listing_html)
                        results.append(RawListing(
                            source="fb",
                            external_id=lid,
                            url=listing_url,
                            raw_html=listing_html,
                            image_urls=images,
                        ))
                        self._jitter_sleep(60 / self.base_rate_limit)
                    except Exception as exc:
                        log.debug("[fb] fetch %s: %s", lid, exc)
                    finally:
                        await page.close()

            except Exception as exc:
                log.warning("[fb] run() error: %s", exc)
            finally:
                await ctx.browser.close()

        log.info("[fb] Scraped %d listings", len(results))
        return results
