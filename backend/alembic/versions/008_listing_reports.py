"""add listing_reports table

Revision ID: 008
Revises: 007
Create Date: 2026-04-27
"""
from alembic import op
import sqlalchemy as sa

revision = "008"
down_revision = "007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "listing_reports",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("listing_id", sa.BigInteger(), sa.ForeignKey("listings.id"), nullable=False),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column(
            "report_type",
            sa.Text(),
            nullable=False,
            server_default="scam",
        ),  # scam | spam | duplicate | other
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column(
            "reported_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_listing_reports_listing_id", "listing_reports", ["listing_id"])
    op.create_index("ix_listing_reports_report_type", "listing_reports", ["report_type"])


def downgrade() -> None:
    op.drop_index("ix_listing_reports_report_type", "listing_reports")
    op.drop_index("ix_listing_reports_listing_id", "listing_reports")
    op.drop_table("listing_reports")
