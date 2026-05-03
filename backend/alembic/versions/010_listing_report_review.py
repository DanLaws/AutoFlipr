"""add report review status and globally_hidden flag

Revision ID: 010
Revises: 009
Create Date: 2026-04-28
"""
from alembic import op
import sqlalchemy as sa

revision = "010"
down_revision = "009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Review state per report: pending | confirmed | denied
    op.add_column(
        "listing_reports",
        sa.Column("review_status", sa.Text(), nullable=False, server_default="pending"),
    )
    op.add_column(
        "listing_reports",
        sa.Column(
            "reviewed_at",
            sa.TIMESTAMP(timezone=True),
            nullable=True,
        ),
    )
    op.create_index("ix_listing_reports_review_status", "listing_reports", ["review_status"])

    # Global hide flag on the listing itself — set when an admin confirms a report
    op.add_column(
        "listings",
        sa.Column("globally_hidden", sa.Boolean(), nullable=False, server_default="false"),
    )
    op.create_index("ix_listings_globally_hidden", "listings", ["globally_hidden"])


def downgrade() -> None:
    op.drop_index("ix_listings_globally_hidden", "listings")
    op.drop_column("listings", "globally_hidden")
    op.drop_index("ix_listing_reports_review_status", "listing_reports")
    op.drop_column("listing_reports", "reviewed_at")
    op.drop_column("listing_reports", "review_status")
