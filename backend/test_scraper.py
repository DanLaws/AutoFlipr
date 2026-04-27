"""Quick smoke test for the AutoTrader scraper — run with: uv run python test_scraper.py"""
import asyncio
from carflip.scrapers.autotrader import AutoTraderScraper


async def main() -> None:
    scraper = AutoTraderScraper()

    print("=== 1. discover_listing_ids (1 page) ===")
    ids = await scraper.discover_listing_ids({"max_pages": 1})
    print(f"  Found {len(ids)} IDs")
    assert len(ids) > 0, "No listing IDs found — selector broken"
    print(f"  Sample: {ids[:3]}")

    print("\n=== 2. fetch_listing (valid) ===")
    listing = await scraper.fetch_listing(ids[0])
    assert listing is not None, "fetch_listing returned None for a valid ID"
    assert "/car-details/" in listing.url
    assert len(listing.raw_html) > 10_000, f"HTML suspiciously short: {len(listing.raw_html)} chars"
    print(f"  OK — {listing.url} ({len(listing.raw_html):,} chars)")

    print("\n=== 3. fetch_listing (invalid/removed ID) ===")
    removed = await scraper.fetch_listing("000000000000001")
    assert removed is None, "Expected None for invalid listing — redirect not detected"
    print("  OK — returns None as expected")

    print("\nAll checks passed.")


asyncio.run(main())
