"""add latitude/longitude to listings

Revision ID: 005
Revises: 004
Create Date: 2026-04-24
"""
from alembic import op
import sqlalchemy as sa

revision = "005"
down_revision = "004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("listings", sa.Column("longitude", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("listings", "longitude")
    op.drop_column("listings", "latitude")
