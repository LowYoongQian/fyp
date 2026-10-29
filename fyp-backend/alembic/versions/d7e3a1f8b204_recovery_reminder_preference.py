"""Account-owned recovery reminder preference; verification is unchanged."""
from alembic import op
import sqlalchemy as sa

revision = "d7e3a1f8b204"
down_revision = "c5cc61db6fff"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("recovery_prompt_dismissed", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    op.drop_column("users", "recovery_prompt_dismissed")
