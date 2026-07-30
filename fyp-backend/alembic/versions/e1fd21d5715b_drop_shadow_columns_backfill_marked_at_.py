"""drop shadow columns: backfill marked_at/network_verified, drop timestamp/confidence/wifi_verified

Revision ID: e1fd21d5715b
Revises: 71c97fdeebc7
Create Date: 2026-07-30 19:32:28.826052

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1fd21d5715b'
down_revision: Union[str, None] = '71c97fdeebc7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Collapse four shadow column pairs onto the name the API already exposes.

    A rename left both names physically present: the ORM mapped one side while all
    the data sat on the other, so the API served nulls and false for 1993 rows.
    Backfill onto the keeper, then drop the shadow.

    marked_at is not a straight copy — neither column is wholly right. Rows split
    into three eras by whether they agree with their session's date, so prefer
    whichever column matches, and fall back to the session's own opened_at for the
    1400 seed rows where both are noise. Verified split: 493 keep / 100 take
    timestamp / 1400 derived.
    """
    op.execute(
        """
        UPDATE attendance_records a
        SET    marked_at = CASE
                 WHEN date(a.marked_at) = date(s.opened_at) THEN a.marked_at
                 WHEN date(a.timestamp) = date(s.opened_at) THEN a.timestamp
                 ELSE s.opened_at
               END
        FROM   class_sessions s
        WHERE  a.session_id = s.id
        """
    )

    # network_verified is the keeper: "the whole network was verified" is a real
    # semantic upgrade over "wifi looked right". 1153 rows carry the true value.
    op.execute(
        """
        UPDATE attendance_records
        SET    network_verified = COALESCE(wifi_verified, FALSE)
        WHERE  wifi_verified IS TRUE
        """
    )

    # liveness_passed and liveness_suspicious stay two INDEPENDENT columns: one is
    # "the liveness check passed", the other is "the gesture was suspiciously fast".
    # The property that made them each other's negation is what collapsed two
    # signals into one. Its side effect: marking a student absent wrote
    # liveness_passed=False, which the setter turned into suspicious=True on 200
    # absent rows. No row anywhere carries a genuine gesture flag (the fast-gesture
    # path never reached the DB), so the column is reset rather than derived.
    op.execute("UPDATE attendance_records SET liveness_suspicious = FALSE")

    # confidence_score needs no backfill: its shadow (confidence) is NULL on all
    # 1993 rows, which is itself the evidence that no check-in succeeded while the
    # property layer was in place.
    op.drop_column("attendance_records", "timestamp")
    op.drop_column("attendance_records", "confidence")
    op.drop_column("attendance_records", "wifi_verified")


def downgrade() -> None:
    """Best effort: the columns come back, but the pre-backfill values are gone.

    marked_at's three-era split is not invertible — the original per-row values were
    the defect. Restoring the columns lets an older revision of the code import;
    it does not restore the old data.
    """
    op.add_column("attendance_records", sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now()))
    op.add_column("attendance_records", sa.Column("confidence", sa.Float(), nullable=True))
    op.add_column("attendance_records", sa.Column("wifi_verified", sa.Boolean(), nullable=True))
    op.execute("UPDATE attendance_records SET timestamp = marked_at, wifi_verified = network_verified")
