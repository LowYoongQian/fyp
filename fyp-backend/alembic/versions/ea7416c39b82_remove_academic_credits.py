"""Remove academic credits and enforce unique staff roles."""
from alembic import op
import sqlalchemy as sa

revision = "ea7416c39b82"
down_revision = "a6c9e2f41083"
branch_labels = None
depends_on = None


def upgrade():
    # Retain each legacy meeting and its session links if duplicate assignments exist.
    op.execute("""
        CREATE TEMP TABLE duplicate_roles ON COMMIT DROP AS
        SELECT id, first_value(id) OVER (PARTITION BY course_id, lecturer_id, role ORDER BY id) AS keeper
        FROM course_staff_assignments
    """)
    # Two existing slots for the same role and group cannot share the scheduler's
    # lookup key. Refuse to hide either row or rewrite its attendance history.
    collisions = op.get_bind().execute(sa.text("""
        SELECT d.keeper, m.class_group FROM class_meetings m
        JOIN duplicate_roles d ON m.assignment_id = d.id
        GROUP BY d.keeper, m.class_group HAVING count(DISTINCT d.id) > 1 LIMIT 1
    """)).first()
    if collisions:
        raise RuntimeError(f"Duplicate staff assignments have overlapping group meetings: {collisions}. Review before migrating.")
    op.execute("""UPDATE class_meetings m SET assignment_id = d.keeper FROM duplicate_roles d
                  WHERE d.id <> d.keeper AND m.assignment_id = d.id""")
    op.execute("""DELETE FROM course_staff_assignments a USING duplicate_roles d
                  WHERE d.id <> d.keeper AND a.id = d.id""")
    op.create_unique_constraint("uq_course_staff_role", "course_staff_assignments", ["course_id", "lecturer_id", "role"])
    # Older Staff Roles saves did not link the existing Lecture. Repair only an
    # unambiguous owner and keep every meeting ID, slot and historical session.
    op.execute("""
        WITH sole_lecturer AS (
            SELECT course_id, min(lecturer_id::text)::uuid AS lecturer_id
            FROM course_staff_assignments WHERE role = 'Lecturer'
            GROUP BY course_id HAVING count(*) = 1
        )
        UPDATE courses c SET lecturer_id = s.lecturer_id FROM sole_lecturer s
        WHERE c.id = s.course_id AND c.lecturer_id IS NULL AND NOT EXISTS (
            SELECT 1 FROM class_meetings m WHERE m.course_id = c.id
            AND m.role = 'Lecture' AND m.lecturer_id <> s.lecturer_id
        )
    """)
    op.execute("""UPDATE class_meetings m SET lecturer_id = c.lecturer_id FROM courses c
                  WHERE m.course_id = c.id AND m.role = 'Lecture'
                  AND m.lecturer_id IS NULL AND c.lecturer_id IS NOT NULL""")
    op.drop_constraint("ck_semester_credit_limit", "academic_semesters", type_="check")
    op.drop_column("academic_semesters", "max_student_credits")
    op.drop_column("courses", "credit_hours")


def downgrade():
    # The removed per-row credit values cannot be reconstructed.
    op.add_column("courses", sa.Column("credit_hours", sa.Float(), server_default="3"))
    op.add_column("academic_semesters", sa.Column("max_student_credits", sa.Float(), nullable=False, server_default="18"))
    op.create_check_constraint("ck_semester_credit_limit", "academic_semesters", "max_student_credits > 0 AND max_student_credits <= 60")
    op.drop_constraint("uq_course_staff_role", "course_staff_assignments", type_="unique")
