"""add price_history table

Revision ID: 004
Revises: 003
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "004"
down_revision = "003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "price_history",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("listing_id", sa.BigInteger(), sa.ForeignKey("listings.id"), nullable=False),
        sa.Column("price_gbp", sa.Integer(), nullable=False),
        sa.Column("recorded_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_price_history_listing_id", "price_history", ["listing_id"])


def downgrade() -> None:
    op.drop_index("ix_price_history_listing_id", table_name="price_history")
    op.drop_table("price_history")
