"""
Tests for scraper regex extractors — no Playwright, no network.
Uses representative HTML fixtures containing known field values.
"""
import re

import pytest

from autoflipr.scrapers.gumtree import (
    LISTING_HREF_RE,
    _SKIP_CATEGORIES,
    _extract_listing_paths,
)


# ---------------------------------------------------------------------------
# AutoTrader — _extract_listing_ids_from_html
# ---------------------------------------------------------------------------
# Import the method via an instance with a mocked settings attribute to avoid
# triggering the Playwright import at class body level.

from autoflipr.scrapers.autotrader import AutoTraderScraper


class _FakeSettings:
    autotrader_rate_limit = 30
    autotrader_search_postcode = "SW1A1AA"
    autotrader_search_radius = 50


# Patch settings before instantiating
import autoflipr.scrapers.autotrader as _at_module


@pytest.fixture()
def at_scraper(monkeypatch):
    monkeypatch.setattr(_at_module, "settings", _FakeSettings())
    return AutoTraderScraper()


class TestAutoTraderExtractIds:
    _HTML_SINGLE = '<a href="/car-details/202312345678">View</a>'
    _HTML_MULTI = """
        <a href="/car-details/111111111111">car A</a>
        <a href="/car-details/222222222222">car B</a>
        <a href="/car-details/333333333333">car C</a>
    """
    _HTML_DUPLICATE = """
        <a href="/car-details/999999999999">dup</a>
        <a href="/car-details/999999999999">dup again</a>
        <a href="/car-details/888888888888">other</a>
    """
    _HTML_NOISE = """
        <p>Check out our /car-details/ page!</p>
        <a href="/car-parts/12345">parts</a>
        <a href="/car-details/777777777777">real listing</a>
        <script>var x = '/car-details/abc-not-numeric';</script>
    """

    def test_single_id_extracted(self, at_scraper):
        ids = at_scraper._extract_listing_ids_from_html(self._HTML_SINGLE)
        assert ids == ["202312345678"]

    def test_multiple_ids_extracted(self, at_scraper):
        ids = at_scraper._extract_listing_ids_from_html(self._HTML_MULTI)
        assert ids == ["111111111111", "222222222222", "333333333333"]

    def test_duplicates_deduplicated(self, at_scraper):
        ids = at_scraper._extract_listing_ids_from_html(self._HTML_DUPLICATE)
        assert ids.count("999999999999") == 1
        assert "888888888888" in ids

    def test_order_preserved_after_dedup(self, at_scraper):
        ids = at_scraper._extract_listing_ids_from_html(self._HTML_DUPLICATE)
        assert ids == ["999999999999", "888888888888"]

    def test_non_numeric_paths_ignored(self, at_scraper):
        html = '<a href="/car-details/abc-slug">no</a>'
        ids = at_scraper._extract_listing_ids_from_html(html)
        assert ids == []

    def test_noise_html_only_real_listing(self, at_scraper):
        ids = at_scraper._extract_listing_ids_from_html(self._HTML_NOISE)
        assert ids == ["777777777777"]

    def test_empty_html_returns_empty(self, at_scraper):
        assert at_scraper._extract_listing_ids_from_html("") == []

    def test_only_real_ids_no_partial_path(self, at_scraper):
        # Bare "/car-details/" with no id should not match
        html = '<a href="/car-details/">browse</a>'
        assert at_scraper._extract_listing_ids_from_html(html) == []


# ---------------------------------------------------------------------------
# Gumtree — LISTING_HREF_RE and _extract_listing_paths
# ---------------------------------------------------------------------------

class TestGumtreeListingHrefRe:
    def test_double_quoted_href_matched(self):
        html = '<a href="/p/ford/2015-ford-focus/12345678">listing</a>'
        matches = LISTING_HREF_RE.findall(html)
        assert len(matches) == 1
        full_path, numeric_id = matches[0]
        assert numeric_id == "12345678"
        assert full_path == "/p/ford/2015-ford-focus/12345678"

    def test_single_quoted_href_matched(self):
        html = "<a href='/p/vw/2018-vw-golf/98765432'>listing</a>"
        matches = LISTING_HREF_RE.findall(html)
        assert len(matches) == 1
        assert matches[0][1] == "98765432"

    def test_short_numeric_id_not_matched(self):
        # IDs must be at least 8 digits
        html = '<a href="/p/ford/old/1234">too short</a>'
        assert LISTING_HREF_RE.findall(html) == []

    def test_exactly_8_digits_matched(self):
        html = '<a href="/p/ford/car/12345678">ok</a>'
        matches = LISTING_HREF_RE.findall(html)
        assert matches[0][1] == "12345678"

    def test_path_not_starting_with_p_not_matched(self):
        html = '<a href="/cars/ford/2018/12345678">other</a>'
        assert LISTING_HREF_RE.findall(html) == []

    def test_non_href_attribute_not_matched(self):
        html = 'data-url="/p/ford/2018/12345678"'
        assert LISTING_HREF_RE.findall(html) == []


class TestGumtreeExtractListingPaths:
    def _html(self, path: str, numeric_id: str) -> str:
        return f'<a href="{path}">{numeric_id}</a>'

    def test_valid_car_listing_returned(self):
        html = '<a href="/p/ford/2015-ford-focus/12345678">listing</a>'
        results = _extract_listing_paths(html)
        assert ("12345678", "/p/ford/2015-ford-focus/12345678") in results

    def test_skip_category_filtered_out(self):
        skip_cat = next(iter(_SKIP_CATEGORIES))  # e.g. "car-part-accessories"
        html = f'<a href="/p/{skip_cat}/some-item/12345678">parts</a>'
        results = _extract_listing_paths(html)
        assert results == []

    def test_all_skip_categories_filtered(self):
        lines = [
            f'<a href="/p/{cat}/item-{i}/1234567{i}">x</a>'
            for i, cat in enumerate(_SKIP_CATEGORIES)
        ]
        html = "\n".join(lines)
        results = _extract_listing_paths(html)
        assert results == []

    def test_duplicates_deduplicated(self):
        html = """
            <a href="/p/ford/first-path/12345678">one</a>
            <a href="/p/ford/second-path/12345678">two</a>
        """
        results = _extract_listing_paths(html)
        numeric_ids = [r[0] for r in results]
        assert numeric_ids.count("12345678") == 1

    def test_first_occurrence_wins_on_duplicate(self):
        html = """
            <a href="/p/ford/first-path/12345678">one</a>
            <a href="/p/ford/second-path/12345678">two</a>
        """
        results = _extract_listing_paths(html)
        assert results[0][1] == "/p/ford/first-path/12345678"

    def test_multiple_valid_listings_all_returned(self):
        html = """
            <a href="/p/ford/focus/11111111">a</a>
            <a href="/p/vw/golf/22222222">b</a>
            <a href="/p/bmw/3series/33333333">c</a>
        """
        results = _extract_listing_paths(html)
        ids = [r[0] for r in results]
        assert "11111111" in ids
        assert "22222222" in ids
        assert "33333333" in ids

    def test_path_too_short_skipped(self):
        # Only 2 path segments after stripping: /p/{id} — no category segment
        html = '<a href="/p/12345678">short</a>'
        results = _extract_listing_paths(html)
        assert results == []

    def test_empty_html_returns_empty(self):
        assert _extract_listing_paths("") == []

    def test_mixed_valid_and_skip_categories(self):
        html = """
            <a href="/p/ford/focus/11111111">real</a>
            <a href="/p/car-part-accessories/item/22222222">parts</a>
            <a href="/p/vw/golf/33333333">real</a>
        """
        results = _extract_listing_paths(html)
        ids = [r[0] for r in results]
        assert "11111111" in ids
        assert "33333333" in ids
        assert "22222222" not in ids
