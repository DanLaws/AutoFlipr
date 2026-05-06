"""add listing assistant columns to flip_entries

Revision ID: 013
Revises: 012
Create Date: 2026-05-06
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "013"
down_revision = "012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("flip_entries", sa.Column("colour", sa.Text(), nullable=True))
    op.add_column("flip_entries", sa.Column("fuel", sa.Text(), nullable=True))
    op.add_column("flip_entries", sa.Column("transmission", sa.Text(), nullable=True))
    op.add_column("flip_entries", sa.Column("features", JSONB(), nullable=True))
    op.add_column("flip_entries", sa.Column("mot_advisories", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("flip_entries", "mot_advisories")
    op.drop_column("flip_entries", "features")
    op.drop_column("flip_entries", "transmission")
    op.drop_column("flip_entries", "fuel")
    op.drop_column("flip_entries", "colour")
