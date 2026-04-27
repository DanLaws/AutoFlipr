"""add user_scans table

Revision ID: 007
Revises: 006
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa

revision = "007"
down_revision = "006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "user_scans",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("user_id", sa.BigInteger(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("listing_id", sa.BigInteger(), sa.ForeignKey("listings.id"), nullable=True),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("status", sa.Text(), server_default="pending", nullable=False),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column(
            "scanned_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("completed_at", sa.TIMESTAMP(timezone=True), nullable=True),
    )
    op.create_index("ix_user_scans_user_id", "user_scans", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_user_scans_user_id", "user_scans")
    op.drop_table("user_scans")
