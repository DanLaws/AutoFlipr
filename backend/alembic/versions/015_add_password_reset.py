"""add password reset token columns to users

Revision ID: 015
Revises: 014
Create Date: 2026-05-07
"""
from alembic import op
import sqlalchemy as sa

revision = "015"
down_revision = "014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("reset_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("reset_token_expires", sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "reset_token_expires")
    op.drop_column("users", "reset_token")
