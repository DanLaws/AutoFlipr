"""
Gumtree UK car scraper.

Uses headless Playwright (same approach as AutoTrader) — no browser window opens.

Gumtree listing URL format (discovered empirically):
  Search results:  /p/{make}/{description}/{numeric_id}
  e.g.             /p/volkswagen/2013-volkswagen-golf-1.4-tsi/1512903321

The numeric ID is used as external_id; the full path is preserved for fetching.
Images are hosted on img.gumtree.com (not i.gumtree.com).
"""
import asyncio
import logging
import re
from typing import Optional
from urllib.parse import urlencode

from playwright.async_api import async_playwright, BrowserContext

from autoflipr.scrapers.base import BaseScraper, RawListing

log = logging.getLogger(__name__)

SEARCH_CATEGORY = "cars-vans-motorbikes"
BASE_URL = "https://www.gumtree.com"

# Matches listing hrefs — captures (full_path, numeric_id)
LISTING_HREF_RE = re.compile(r'href=["\'](/p/[a-zA-Z0-9][^"\']+?/(\d{8,}))["\']')

# Non-car categories to skip (second path segment of /p/{category}/...)
_SKIP_CATEGORIES = {
    "car-part-accessories", "car-parts-for-sale", "accessories-styling",
    "campervans-motorhomes", "caravans",
    "vans", "trucks-buses",
    "motorbikes-scooters", "other-motorbikes-scooters",
    "husqvarna-motorbikes", "kawasaki-motorbikes", "yamaha-motorbikes",
    "honda-motorbikes", "suzuki-motorbikes", "ducati-motorbikes",
    "bmw-motorbikes", "triumph-motorbikes", "harley-davidson-motorbikes",
    "ktm-motorbikes", "aprilia-motorbikes",
    "bikes", "boats-watercraft", "other-vehicles",
}

# CDN domain that hosts Gumtree listing images (confirmed via inspection)
_IMG_CDN = "img.gumtree.com"


def _build_search_url(params: dict, page: int = 1) -> str:
    location = params.get("search_location", "uk")
    base = f"{BASE_URL}/{SEARCH_CATEGORY}/{location}"
    query: dict = {"sort": "date", "results_per_page": 25}
    if page > 1:
        query["page"] = page
    if params.get("max_price"):
        query["max_price"] = params["max_price"]
    if params.get("min_year"):
        query["vehicle_registration_year"] = params["min_year"]
    if params.get("max_mileage"):
        query["vehicle_mileage"] = params["max_mileage"]
    return f"{base}?{urlencode(query)}"


def _extract_listing_paths(html: str) -> list[tuple[str, str]]:
    """Return list of (numeric_id, full_path), skipping non-car categories."""
    seen: dict[str, str] = {}
    for full_path, numeric_id in LISTING_HREF_RE.findall(html):
        parts = full_path.strip("/").split("/")
        if len(parts) < 3:
            continue
        if parts[1] in _SKIP_CATEGORIES:
            continue
        if numeric_id not in seen:
            seen[numeric_id] = full_path
    return list(seen.items())  # [(numeric_id, full_path)]


async def _dismiss_onetrust(page) -> None:
    try:
        btn = page.locator("#onetrust-accept-btn-handler")
        if await btn.count() > 0:
            await btn.first.click(timeout=5_000)
            await page.wait_for_timeout(1_500)
    except Exception:
        pass


class GumtreeScraper(BaseScraper):
    source = "gumtree"
    base_rate_limit = 12

    async def _new_context(self, p) -> BrowserContext:
        browser = await p.chromium.launch(
            headless=True,
            args=["--disable-blink-features=AutomationControlled"],
        )
        return await self._make_browser_context(browser)

    # ------------------------------------------------------------------ #
    #  Main entry point — overrides BaseScraper.run() to reuse browser   #
    # ------------------------------------------------------------------ #

    async def run(self, search_params: dict) -> list[RawListing]:
        """
        Overrides BaseScraper.run() to reuse a single browser across
        all fetches — much faster than launching a new browser per listing.
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            ctx = await self._make_browser_context(browser)

            # ---- Discovery ----
            all_pairs: dict[str, str] = {}
            max_pages = search_params.get("max_pages", 3)
            disc_page = await ctx.new_page()
            await disc_page.route(
                "**/*",
                lambda route: route.abort()
                if route.request.resource_type in ("image", "media", "font")
                else route.continue_(),
            )
            consent_dismissed = False
            for page_num in range(1, max_pages + 1):
                url = _build_search_url(search_params, page=page_num)
                try:
                    await disc_page.goto(url, wait_until="networkidle", timeout=60_000)
                    await disc_page.wait_for_timeout(2_000)
                    if not consent_dismissed:
                        await _dismiss_onetrust(disc_page)
                        consent_dismissed = True
                        await disc_page.wait_for_timeout(1_000)
                    html = await disc_page.content()
                    if len(html) < 2_000:
                        log.warning("[gumtree] page %d: bot protection detected", page_num)
                        break
                    pairs = _extract_listing_paths(html)
                    if not pairs:
                        break
                    log.info("[gumtree] page %d: found %d listings", page_num, len(pairs))
                    for nid, path in pairs:
                        all_pairs[nid] = path
                    await self._jitter_sleep_async(2.0)
                except Exception as exc:
                    log.warning("[gumtree] discovery page %d error: %s", page_num, exc)
                    break
            await disc_page.close()

            # ---- Fetch each listing concurrently (same browser, semaphore-capped) ----
            sem = asyncio.Semaphore(3)

            async def _fetch_one(numeric_id: str, path: str) -> Optional[RawListing]:
                listing_url = f"{BASE_URL}{path}"
                async with sem:
                    fetch_page = await ctx.new_page()
                    try:
                        async def _route(route):
                            rt = route.request.resource_type
                            req_url = route.request.url
                            if rt == "image" and _IMG_CDN in req_url:
                                await route.continue_()
                            elif rt in ("image", "media", "font"):
                                await route.abort()
                            else:
                                await route.continue_()

                        await fetch_page.route("**/*", _route)
                        await fetch_page.goto(listing_url, wait_until="domcontentloaded", timeout=45_000)
                        await fetch_page.wait_for_timeout(2_000)
                        await _dismiss_onetrust(fetch_page)

                        html = await fetch_page.content()
                        if len(html) < 2_000:
                            log.warning("[gumtree] fetch %s: bot protection", numeric_id)
                            return None
                        if numeric_id not in fetch_page.url:
                            return None  # listing removed

                        image_urls = await fetch_page.evaluate(f"""
                            () => {{
                                const cdn = '{_IMG_CDN}';
                                const id = '{numeric_id}';
                                const imgs = [...document.querySelectorAll('img')]
                                    .map(i => i.src)
                                    .filter(src => src.includes(cdn) && src.includes(id));
                                const seen = new Set();
                                return imgs.filter(src => {{
                                    if (seen.has(src)) return false;
                                    seen.add(src);
                                    return true;
                                }});
                            }}
                        """)

                        return RawListing(
                            source=self.source,
                            external_id=numeric_id,
                            url=listing_url,
                            raw_html=html,
                            image_urls=image_urls or [],
                        )
                    except Exception as exc:
                        log.warning("[gumtree] fetch %s error: %s", numeric_id, exc)
                        return None
                    finally:
                        await fetch_page.close()

            fetched = await asyncio.gather(*[
                _fetch_one(nid, path) for nid, path in all_pairs.items()
            ])
            results = [r for r in fetched if r is not None]

            await browser.close()

        return results

    async def fetch_listing(self, listing_url: str) -> Optional[RawListing]:
        """Fetch a single Gumtree listing by its full URL. Returns None if removed/redirected."""
        m = re.search(r"/(\d{8,})(?:[/?]|$)", listing_url)
        if not m:
            return None
        numeric_id = m.group(1)

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                headless=True,
                args=["--disable-blink-features=AutomationControlled"],
            )
            ctx = await self._make_browser_context(browser)
            page = await ctx.new_page()
            try:
                await page.route(
                    "**/*",
                    lambda route: route.abort()
                    if route.request.resource_type in ("image", "media", "font")
                    else route.continue_(),
                )
                await page.goto(listing_url, wait_until="domcontentloaded", timeout=45_000)
                await page.wait_for_timeout(1_500)
                await _dismiss_onetrust(page)

                html = await page.content()
                if numeric_id not in page.url or len(html) < 2_000:
                    return None  # sold / redirected away

                return RawListing(
                    source=self.source,
                    external_id=numeric_id,
                    url=listing_url,
                    raw_html=html,
                    image_urls=[],
                )
            except Exception as exc:
                log.warning("[gumtree] fetch_listing %s error: %s", listing_url, exc)
                return None
            finally:
                await browser.close()

    # BaseScraper ABC compliance
    async def discover_listing_ids(self, search_params: dict) -> list[str]:  # type: ignore[override]
        raise NotImplementedError("Use run() directly")
