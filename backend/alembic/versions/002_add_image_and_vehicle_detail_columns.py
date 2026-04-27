"""add image_urls, colour, body_type, seller_name columns

Revision ID: 002
Revises: 001
Create Date: 2026-04-22
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "002"
down_revision = "001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("image_urls", postgresql.JSONB(), nullable=True))
    op.add_column("listings", sa.Column("colour", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("body_type", sa.Text(), nullable=True))
    op.add_column("listings", sa.Column("seller_name", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("listings", "seller_name")
    op.drop_column("listings", "body_type")
    op.drop_column("listings", "colour")
    op.drop_column("listings", "image_urls")
