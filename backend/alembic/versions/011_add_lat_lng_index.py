"""add composite index on listings (latitude, longitude)

Supports the bounding-box pre-filter used by the distance sort/filter in the
deals endpoint.  A B-tree composite index lets Postgres scan the latitude range
efficiently, then apply the longitude range as a secondary filter — orders-of-
magnitude faster than a full-table scan on large listing sets.

Revision ID: 011
Revises: 010
Create Date: 2026-05-02
"""
from alembic import op

revision = "011"
down_revision = "010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_listings_lat_lng "
        "ON listings (latitude, longitude) "
        "WHERE latitude IS NOT NULL AND longitude IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_listings_lat_lng")
