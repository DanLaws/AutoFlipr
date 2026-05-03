"""add performance indexes

Revision ID: 009
Revises: 008
Create Date: 2026-04-28
"""
from alembic import op

revision = "009"
down_revision = "008"
branch_labels = None
depends_on = None


def _create_if_missing(index_name: str, table: str, columns: list[str]) -> None:
    """Create an index only when it doesn't already exist in the schema."""
    op.execute(
        f"CREATE INDEX IF NOT EXISTS {index_name} ON {table} ({', '.join(columns)})"
    )


def upgrade() -> None:
    # Listings — heavily filtered/sorted columns
    _create_if_missing("ix_listings_source",        "listings",    ["source"])
    _create_if_missing("ix_listings_llm_status",    "listings",    ["llm_status"])
    _create_if_missing("ix_listings_removed_at",    "listings",    ["removed_at"])
    _create_if_missing("ix_listings_mileage",       "listings",    ["mileage"])
    _create_if_missing("ix_listings_first_seen_at", "listings",    ["first_seen_at"])
    # Composite for the list_deals subquery (latest score per listing)
    _create_if_missing(
        "ix_deal_scores_listing_id_computed_at",
        "deal_scores",
        ["listing_id", "computed_at"],
    )
    # LLM insights — bulk fetch by listing_id + kind
    _create_if_missing(
        "ix_llm_insights_listing_id_kind",
        "llm_insights",
        ["listing_id", "kind"],
    )
    # Price history — bulk fetch by listing_id
    _create_if_missing("ix_price_history_listing_id", "price_history", ["listing_id"])


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_price_history_listing_id")
    op.execute("DROP INDEX IF EXISTS ix_llm_insights_listing_id_kind")
    op.execute("DROP INDEX IF EXISTS ix_deal_scores_listing_id_computed_at")
    op.execute("DROP INDEX IF EXISTS ix_listings_first_seen_at")
    op.execute("DROP INDEX IF EXISTS ix_listings_mileage")
    op.execute("DROP INDEX IF EXISTS ix_listings_removed_at")
    op.execute("DROP INDEX IF EXISTS ix_listings_llm_status")
    op.execute("DROP INDEX IF EXISTS ix_listings_source")
