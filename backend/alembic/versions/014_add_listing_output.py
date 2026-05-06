"""add listing_output column to flip_entries

Revision ID: 014
Revises: 013
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "014"
down_revision = "013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("flip_entries", sa.Column("listing_output", JSONB(), nullable=True))


def downgrade() -> None:
    op.drop_column("flip_entries", "listing_output")
