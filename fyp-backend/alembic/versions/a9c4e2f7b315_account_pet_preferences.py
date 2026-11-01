"""Account-owned pet visibility and pet choice; NULL means the account has not chosen yet."""
from alembic import op
import sqlalchemy as sa

revision = "a9c4e2f7b315"
down_revision = "f2b8d4e6a731"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("pet_visible", sa.Boolean(), nullable=True))
    op.add_column("users", sa.Column("pet_choice", sa.String(length=32), nullable=True))


def downgrade():
    op.drop_column("users", "pet_choice")
    op.drop_column("users", "pet_visible")
