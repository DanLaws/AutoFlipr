import re
from typing import Optional
from urllib.parse import urlencode

from playwright.async_api import async_playwright

from carflip.config import settings
from carflip.scrapers.base import BaseScraper, RawListing

SEARCH_URL = "https://www.autotrader.co.uk/car-search"


class AutoTraderScraper(BaseScraper):
    source = "autotrader"
    base_rate_limit = settings.autotrader_rate_limit

    def _build_search_url(self, params: dict, page: int = 1) -> str:
        query = {
            "postcode": params.get("postcode", settings.autotrader_search_postcode),
            "radius": params.get("radius", settings.autotrader_search_radius),
            "include-delivery-option": "on",
            "advertising-location": "at_cars",
            "page": page,
        }
        if "make" in params:
            query["make"] = params["make"].upper()
        if "model" in params:
            query["model"] = params["model"].upper()
        if "price_to" in params:
            query["price-to"] = params["price_to"]
        if "year_from" in params:
            query["year-from"] = params["year_from"]
        return f"{SEARCH_URL}?{urlencode(query)}"

    def _extract_listing_ids_from_html(self, html: str) -> list[str]:
        # AutoTrader embeds listing IDs in /car-details/{id} hrefs
        return list(dict.fromkeys(re.findall(r'/car-details/(\d+)', html)))

    async def discover_listing_ids(self, search_params: dict) -> list[str]:
        all_ids: list[str] = []
        max_pages = search_params.get("max_pages", 5)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await self._make_browser_context(browser)
            page = await ctx.new_page()

            # Block image/font/media requests to speed up scraping
            await page.route(
                "**/*",
                lambda route: route.abort()
                if route.request.resource_type in ("image", "media", "font")
                else route.continue_(),
            )

            for page_num in range(1, max_pages + 1):
                url = self._build_search_url(search_params, page=page_num)
                try:
                    await page.goto(url, wait_until="networkidle", timeout=60_000)
                    html = await page.content()
                    ids = self._extract_listing_ids_from_html(html)
                    if not ids:
                        break  # no more results
                    all_ids.extend(ids)
                    self._jitter_sleep(2.0)
                except Exception as exc:
                    # Log and continue; caller handles partial results
                    print(f"[autotrader] page {page_num} error: {exc}")
                    break

            await browser.close()

        return list(dict.fromkeys(all_ids))  # deduplicate preserving order

    async def _dismiss_consent_wall(self, page) -> bool:
        """Accept the SourcePoint cookie consent wall if present.

        AutoTrader uses SourcePoint (cmpv2.autotrader.co.uk) which renders
        inside a cross-origin iframe and blocks UI interaction until accepted.
        Returns True if consent was successfully dismissed.
        """
        try:
            is_open = await page.evaluate(
                "document.documentElement.classList.contains('sp-message-open')"
            )
            if not is_open:
                return False

            # Try clicking the accept button inside the SourcePoint iframe.
            # AutoTrader's iframe is at cmpv2.autotrader.co.uk.
            for frame in page.frames:
                frame_url = frame.url or ""
                if not (
                    "privacy-mgmt.com" in frame_url
                    or "sourcepoint" in frame_url
                    or "cmpv2" in frame_url
                    or "cmp" in frame_url.lower()
                ):
                    continue
                try:
                    btn = frame.locator(
                        "button:has-text('Accept all'), "
                        "button:has-text('Accept All'), "
                        "button:has-text('ACCEPT ALL')"
                    )
                    if await btn.count() > 0:
                        await btn.first.click(timeout=5_000)
                        await page.wait_for_function(
                            "!document.documentElement.classList.contains('sp-message-open')",
                            timeout=8_000,
                        )
                        await page.wait_for_load_state("networkidle", timeout=15_000)
                        return True
                except Exception:
                    continue

            # Fallback: trigger consent via SourcePoint JS SDK directly
            try:
                accepted = await page.evaluate("""
                    () => {
                        if (window._sp_ && window._sp_.executeMessaging) {
                            window._sp_.executeMessaging();
                            return true;
                        }
                        // Remove the blocking overlay class directly
                        document.documentElement.classList.remove('sp-message-open');
                        const container = document.querySelector('[id^="sp_message_container"]');
                        if (container) container.remove();
                        return false;
                    }
                """)
                await page.wait_for_timeout(1_000)
                return bool(accepted)
            except Exception:
                pass

        except Exception as exc:
            print(f"[autotrader] consent dismiss error: {exc}")
        return False

    async def _collect_gallery_images(self, page) -> list[str]:
        """Click the Gallery button and scroll to extract all image URLs.

        AutoTrader lazy-loads the full gallery only after the Gallery button
        is clicked. We scroll to the bottom to trigger all deferred images,
        then pull every unique atcdn hash from the rendered <img> tags.
        Returns full-resolution (w1400) image URLs.
        """
        try:
            # Use JavaScript to click the Gallery button — this bypasses
            # any consent overlay that intercepts pointer events.
            clicked = await page.evaluate("""
                () => {
                    const btns = [...document.querySelectorAll('button')];
                    const btn = btns.find(b => b.textContent.trim() === 'Gallery');
                    if (btn) { btn.click(); return true; }
                    return false;
                }
            """)
            if not clicked:
                return []

            # Wait for gallery view to render (no networkidle — images lazy load)
            await page.wait_for_timeout(2_000)

            # Scroll repeatedly to trigger lazy loading of all gallery images
            for _ in range(12):
                await page.keyboard.press("End")
                await page.wait_for_timeout(350)

            urls: list[str] = await page.evaluate("""
                () => {
                    const imgs = [...document.querySelectorAll('img')]
                        .map(i => i.src)
                        .filter(s => s.includes('atcdn.co.uk'));
                    const hashes = [...new Set(imgs.map(url => {
                        const m = url.match(/\\/([a-f0-9]{32})\\.jpg/);
                        return m ? m[1] : null;
                    }).filter(Boolean))];
                    return hashes.map(h =>
                        'https://m.atcdn.co.uk/a/media/w1400/' + h + '.jpg'
                    );
                }
            """)
            return urls or []
        except Exception as exc:
            print(f"[autotrader] gallery collection error: {exc}")
            return []

    async def fetch_listing(self, listing_id: str) -> Optional[RawListing]:
        url = f"https://www.autotrader.co.uk/car-details/{listing_id}"

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            ctx = await self._make_browser_context(browser)
            page = await ctx.new_page()

            # Block only image/media/font — keep stylesheets so the
            # SourcePoint consent iframe renders correctly.
            async def _route(route):
                rt = route.request.resource_type
                req_url = route.request.url
                # Allow AutoTrader's own CDN images (needed for gallery lazy-load)
                if rt == "image" and "atcdn.co.uk" in req_url:
                    await route.continue_()
                elif rt in ("image", "media", "font"):
                    await route.abort()
                else:
                    await route.continue_()

            await page.route("**/*", _route)

            try:
                await page.goto(url, wait_until="networkidle", timeout=60_000)

                # AutoTrader redirects removed/invalid listings to /car-search
                if "/car-details/" not in page.url:
                    await browser.close()
                    return None

                # Accept cookie consent if the SourcePoint wall is showing.
                # AutoTrader defers rendering listing data until after consent.
                await self._dismiss_consent_wall(page)

                # Collect all gallery images (lazy-loaded via Gallery button)
                image_urls = await self._collect_gallery_images(page)

                html = await page.content()
                await browser.close()
                return RawListing(
                    source=self.source,
                    external_id=listing_id,
                    url=url,
                    raw_html=html,
                    image_urls=image_urls,
                )
            except Exception as exc:
                print(f"[autotrader] fetch {listing_id} error: {exc}")
                await browser.close()
                return None
