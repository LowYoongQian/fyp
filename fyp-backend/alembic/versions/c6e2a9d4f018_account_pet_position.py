"""Where the account's pet was last dropped, so it is the same on every browser and on the live site. NULL = the default corner."""
from alembic import op
import sqlalchemy as sa

revision = "c6e2a9d4f018"
down_revision = "b4d7e1f0a2c9"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("users", sa.Column("pet_offset_x", sa.Integer(), nullable=True))
    op.add_column("users", sa.Column("pet_offset_y", sa.Integer(), nullable=True))


def downgrade():
    op.drop_column("users", "pet_offset_y")
    op.drop_column("users", "pet_offset_x")
