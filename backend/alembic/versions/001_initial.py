"""initial schema

Revision ID: 001
Create Date: 2026-04-21
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "listings",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.Text(), nullable=False),
        sa.Column("external_id", sa.Text(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("raw_html", sa.Text()),
        sa.Column("raw_hash", sa.Text()),
        sa.Column("make", sa.Text()),
        sa.Column("model", sa.Text()),
        sa.Column("variant", sa.Text()),
        sa.Column("year", sa.SmallInteger()),
        sa.Column("mileage", sa.Integer()),
        sa.Column("price_gbp", sa.Integer()),
        sa.Column("registration", sa.Text()),
        sa.Column("location_raw", sa.Text()),
        sa.Column("location_postcode_area", sa.Text()),
        sa.Column("seller_type", sa.Text()),
        sa.Column("urgency_tags", postgresql.ARRAY(sa.Text())),
        sa.Column("llm_status", sa.Text(), server_default="pending"),
        sa.Column("first_seen_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.Column("last_scraped_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("removed_at", sa.TIMESTAMP(timezone=True)),
        sa.UniqueConstraint("source", "external_id", name="uq_listings_source_external_id"),
        sa.CheckConstraint("source IN ('autotrader','gumtree','fb')", name="ck_listings_source"),
    )
    op.create_index("ix_listings_make_model_year", "listings", ["make", "model", "year"])
    op.create_index("ix_listings_registration", "listings", ["registration"])
    op.create_index("ix_listings_price", "listings", ["price_gbp"])
    op.execute(
        "CREATE INDEX ix_listings_feed ON listings (last_scraped_at DESC) WHERE removed_at IS NULL"
    )
    op.execute(
        "CREATE INDEX ix_listings_llm_pending ON listings (llm_status) WHERE llm_status = 'pending'"
    )

    op.create_table(
        "mot_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("registration", sa.Text(), nullable=False),
        sa.Column("test_date", sa.Date(), nullable=False),
        sa.Column("test_result", sa.Text()),
        sa.Column("odometer", sa.Integer()),
        sa.Column("odometer_unit", sa.Text()),
        sa.Column("expiry_date", sa.Date()),
        sa.Column("advisories", postgresql.ARRAY(sa.Text())),
        sa.Column("failures", postgresql.ARRAY(sa.Text())),
        sa.Column("fetched_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("registration", "test_date", name="uq_mot_reg_date"),
    )
    op.create_index("ix_mot_registration", "mot_history", ["registration"])

    op.create_table(
        "deal_scores",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("listing_id", sa.BigInteger(), sa.ForeignKey("listings.id"), nullable=False),
        sa.Column("score", sa.Numeric(5, 2)),
        sa.Column("estimated_value_gbp", sa.Integer()),
        sa.Column("estimated_margin_gbp", sa.Integer()),
        sa.Column("price_deviation_pct", sa.Numeric(6, 2)),
        sa.Column("comparable_count", sa.Integer()),
        sa.Column("mot_penalty", sa.Numeric(4, 2)),
        sa.Column("confidence", sa.Text()),
        sa.Column("algorithm_version", sa.Text()),
        sa.Column("computed_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_scores_listing", "deal_scores", ["listing_id", "computed_at"])
    op.execute(
        "CREATE INDEX ix_scores_hot ON deal_scores (score DESC) WHERE score > 60"
    )

    op.create_table(
        "llm_insights",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("listing_id", sa.BigInteger(), sa.ForeignKey("listings.id"), nullable=False),
        sa.Column("kind", sa.Text()),
        sa.Column("model", sa.Text()),
        sa.Column("prompt_version", sa.Text()),
        sa.Column("raw_output", postgresql.JSONB()),
        sa.Column("parsed_output", postgresql.JSONB()),
        sa.Column("validation_status", sa.Text()),
        sa.Column("input_tokens", sa.Integer()),
        sa.Column("output_tokens", sa.Integer()),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_llm_listing_kind", "llm_insights", ["listing_id", "kind"])

    op.create_table(
        "scrape_runs",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.Text()),
        sa.Column("started_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True)),
        sa.Column("listings_found", sa.Integer()),
        sa.Column("listings_new", sa.Integer()),
        sa.Column("listings_updated", sa.Integer()),
        sa.Column("errors", postgresql.JSONB()),
        sa.Column("status", sa.Text()),
    )
    op.create_index("ix_scrape_runs_source", "scrape_runs", ["source", "started_at"])


def downgrade() -> None:
    op.drop_table("scrape_runs")
    op.drop_table("llm_insights")
    op.drop_table("deal_scores")
    op.drop_table("mot_history")
    op.drop_table("listings")
