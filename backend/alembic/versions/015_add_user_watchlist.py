"""add user_watchlist table

Revision ID: 015
Revises: 014
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_watchlist",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("listing_id", sa.BigInteger(), sa.ForeignKey("listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("saved_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("user_id", "listing_id", name="uq_watchlist_user_listing"),
    )
    op.create_index("ix_watchlist_user_id", "user_watchlist", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_watchlist_user_id", table_name="user_watchlist")
    op.drop_table("user_watchlist")
