"""add password reset token columns to users

Revision ID: 016
Revises: 015
Create Date: 2026-05-10
"""
from alembic import op
import sqlalchemy as sa

revision = "016"
down_revision = "015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("reset_token", sa.Text(), nullable=True))
    op.add_column("users", sa.Column("reset_token_expires", sa.TIMESTAMP(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "reset_token_expires")
    op.drop_column("users", "reset_token")
