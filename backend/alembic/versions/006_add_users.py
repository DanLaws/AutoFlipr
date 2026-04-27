"""add users table

Revision ID: 006
Revises: 005
Create Date: 2026-04-25
"""
from alembic import op
import sqlalchemy as sa

revision = "006"
down_revision = "005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("password_hash", sa.Text(), nullable=False),
        sa.Column("plan", sa.Text(), server_default="free", nullable=False),
        sa.Column("scan_count", sa.Integer(), server_default="0", nullable=False),
        sa.Column("scan_month", sa.Text()),
        sa.Column("stripe_customer_id", sa.Text()),
        sa.Column("stripe_subscription_id", sa.Text()),
        sa.Column("is_admin", sa.Boolean(), server_default="false", nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default="true", nullable=False),
        sa.Column(
            "created_at",
            sa.TIMESTAMP(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )


def downgrade() -> None:
    op.drop_table("users")
