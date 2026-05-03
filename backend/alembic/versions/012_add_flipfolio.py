"""add flip_entries table for Flipfolio feature

Revision ID: 012
Revises: 011
Create Date: 2026-05-02
"""
from alembic import op
import sqlalchemy as sa

revision = "012"
down_revision = "011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "flip_entries",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("make", sa.Text(), nullable=False),
        sa.Column("model", sa.Text(), nullable=False),
        sa.Column("year", sa.SmallInteger(), nullable=True),
        sa.Column("mileage", sa.Integer(), nullable=True),
        sa.Column("purchase_price", sa.Integer(), nullable=False),
        sa.Column("sale_price", sa.Integer(), nullable=True),
        sa.Column("additional_costs", sa.Integer(), server_default="0", nullable=False),
        sa.Column("date_bought", sa.Date(), nullable=False),
        sa.Column("date_sold", sa.Date(), nullable=True),
        sa.Column("source", sa.Text(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.TIMESTAMP(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_flip_entries_user_id", "flip_entries", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_flip_entries_user_id", table_name="flip_entries")
    op.drop_table("flip_entries")
