"""add index on listings(make, model, year) for comparables query

Revision ID: 003
Revises: 002
Create Date: 2026-04-24
"""
from alembic import op

revision = "003"
down_revision = "002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_listings_make_model_year", "listings", ["make", "model", "year"], if_not_exists=True)


def downgrade() -> None:
    op.drop_index("ix_listings_make_model_year", table_name="listings")
