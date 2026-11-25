"""Versioned timetable, teaching plans and transactional risk invalidation."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = 'e65f4d09a321'
down_revision = 'd7a2c5e9f1b3'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('courses', sa.Column('plan_recorded_from', sa.Date()))
    op.add_column('class_meetings', sa.Column('retire_on', sa.Date()))
    op.create_table('teaching_rule_versions',
        sa.Column('meeting_id', postgresql.UUID(), primary_key=True),
        sa.Column('effective_date', sa.Date(), primary_key=True),
        sa.Column('course_id', postgresql.UUID(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('slot', postgresql.JSONB()))
    op.create_table('teaching_plans',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('course_id', postgresql.UUID(), sa.ForeignKey('courses.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('details', postgresql.JSONB(), nullable=False))
    op.create_table('risk_updates',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('course_id', postgresql.UUID(), nullable=False),
        sa.Column('student_id', postgresql.UUID()),
        sa.Column('class_group', sa.String()))
    for table in ('teaching_rule_versions', 'teaching_plans', 'risk_updates'):
        op.create_index(f'ix_{table}_course_id', table, ['course_id'])
        op.execute(f'ALTER TABLE {table} ENABLE ROW LEVEL SECURITY')
        op.execute(f'REVOKE ALL ON TABLE {table} FROM anon, authenticated')
    op.execute('''
        CREATE TABLE risk_score_history AS SELECT * FROM risk_scores WITH NO DATA;
        ALTER TABLE risk_score_history ADD PRIMARY KEY (id);
        ALTER TABLE risk_score_history ENABLE ROW LEVEL SECURITY;
        REVOKE ALL ON TABLE risk_score_history FROM anon, authenticated;
        WITH ranked AS (
            SELECT id, row_number() OVER (PARTITION BY student_id, course_id
                ORDER BY updated_at DESC NULLS LAST, calculated_at DESC NULLS LAST, id DESC) AS position
            FROM risk_scores WHERE student_id IS NOT NULL AND course_id IS NOT NULL
        ), archived AS (
            INSERT INTO risk_score_history SELECT s.* FROM risk_scores s
            JOIN ranked r ON r.id = s.id WHERE r.position > 1 RETURNING id
        ) DELETE FROM risk_scores s USING archived a WHERE s.id = a.id;
    ''')
    op.create_unique_constraint('uq_current_risk_score', 'risk_scores', ['student_id', 'course_id'])
    op.add_column('risk_scores', sa.Column('assessment_source', sa.String()))
    op.alter_column('risk_scores', 'risk_score', nullable=True)
    op.execute('''
        UPDATE courses SET plan_recorded_from = (now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date
        WHERE semester_id IS NOT NULL;
        CREATE FUNCTION date_course_plan_binding() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        BEGIN
            IF TG_OP = 'UPDATE' AND NEW.semester_id IS NOT DISTINCT FROM OLD.semester_id THEN
                RETURN NEW;
            END IF;
            NEW.plan_recorded_from := CASE WHEN NEW.semester_id IS NOT NULL
                THEN (statement_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur')::date END;
            RETURN NEW;
        END $$;
        CREATE TRIGGER date_course_plan_binding BEFORE INSERT OR UPDATE OF semester_id ON courses
            FOR EACH ROW EXECUTE FUNCTION date_course_plan_binding();
        INSERT INTO teaching_rule_versions (meeting_id, course_id, effective_date, slot)
        SELECT m.id, m.course_id,
            greatest((now() AT TIME ZONE 'Asia/Kuala_Lumpur')::date,
                     (m.effective_from AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')::date),
            jsonb_build_object('day', m.day, 'start', m.start, 'end', m."end", 'room', m.room,
                               'role', m.role, 'class_group', m.class_group)
        FROM class_meetings m;
        INSERT INTO risk_updates (course_id) SELECT id FROM courses WHERE semester_id IS NOT NULL;
    ''')
    op.execute('''
        CREATE FUNCTION capture_teaching_rule() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        DECLARE
            today date := (statement_timestamp() AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
            monday date := date_trunc('week', today)::date + 7;
            term_start date;
            boundary date;
            value jsonb;
            room_only boolean := false;
            meeting uuid := coalesce(NEW.id, OLD.id);
            offering uuid := coalesce(NEW.course_id, OLD.course_id);
        BEGIN
            IF TG_OP = 'UPDATE' AND (OLD.day, OLD.start, OLD."end", OLD.role, OLD.class_group, OLD.retire_on)
                IS NOT DISTINCT FROM (NEW.day, NEW.start, NEW."end", NEW.role, NEW.class_group, NEW.retire_on) THEN
                IF OLD.room IS NOT DISTINCT FROM NEW.room OR NEW.retire_on IS NOT NULL THEN RETURN NULL; END IF;
                room_only := true;
            END IF;
            SELECT s.start_date INTO term_start FROM courses c
                LEFT JOIN academic_semesters s ON s.id = c.semester_id WHERE c.id = offering;
            IF NOT FOUND THEN RETURN NULL; END IF;
            boundary := CASE WHEN term_start IS NULL OR term_start > today
                OR (TG_OP = 'INSERT' AND term_start = today) THEN today ELSE monday END;
            IF TG_OP = 'UPDATE' AND NEW.retire_on IS DISTINCT FROM OLD.retire_on AND NEW.retire_on IS NOT NULL THEN
                boundary := NEW.retire_on;
            ELSIF TG_OP <> 'DELETE' THEN
                value := jsonb_build_object('day', NEW.day, 'start', NEW.start, 'end', NEW."end", 'room', NEW.room,
                                            'role', NEW.role, 'class_group', NEW.class_group);
            END IF;
            IF TG_OP = 'UPDATE' AND NEW.effective_from IS DISTINCT FROM OLD.effective_from THEN
                boundary := (NEW.effective_from AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Kuala_Lumpur')::date;
            END IF;
            -- Multiple edits for the same future Monday supersede the pending rule.
            INSERT INTO teaching_rule_versions (meeting_id, course_id, effective_date, slot)
                VALUES (meeting, offering, boundary, value)
                ON CONFLICT (meeting_id, effective_date) DO UPDATE SET slot = EXCLUDED.slot;
            IF NOT room_only THEN
                INSERT INTO risk_updates (course_id) VALUES (offering);
            END IF;
            RETURN NULL;
        END $$;
        CREATE TRIGGER teaching_rule_changed AFTER INSERT OR UPDATE OR DELETE ON class_meetings
            FOR EACH ROW EXECUTE FUNCTION capture_teaching_rule();
    ''')
    op.execute('''
        CREATE FUNCTION enqueue_risk_input() RETURNS trigger LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
        BEGIN
            IF TG_TABLE_NAME = 'attendance_records' THEN
                IF TG_OP = 'UPDATE' AND (OLD.status, OLD.student_id, OLD.session_id)
                    IS NOT DISTINCT FROM (NEW.status, NEW.student_id, NEW.session_id) THEN RETURN NULL; END IF;
                IF TG_OP <> 'INSERT' THEN
                    INSERT INTO risk_updates (course_id, student_id)
                        SELECT course_id, OLD.student_id FROM class_sessions WHERE id = OLD.session_id AND status = 'completed' AND course_id IS NOT NULL;
                END IF;
                IF TG_OP <> 'DELETE' THEN
                    INSERT INTO risk_updates (course_id, student_id)
                        SELECT course_id, NEW.student_id FROM class_sessions WHERE id = NEW.session_id AND status = 'completed' AND course_id IS NOT NULL;
                END IF;
            ELSIF TG_TABLE_NAME = 'class_sessions' THEN
                IF TG_OP = 'UPDATE' AND (OLD.status, OLD.course_id, OLD.class_group, OLD.meeting_id,
                    OLD.replacement_for_session_id, OLD.scheduled_start, OLD.scheduled_end, OLD.opened_at, OLD.closed_at)
                    IS NOT DISTINCT FROM (NEW.status, NEW.course_id, NEW.class_group, NEW.meeting_id,
                    NEW.replacement_for_session_id, NEW.scheduled_start, NEW.scheduled_end, NEW.opened_at, NEW.closed_at)
                    THEN RETURN NULL; END IF;
                IF TG_OP <> 'INSERT' AND OLD.course_id IS NOT NULL AND (OLD.status = 'completed' OR OLD.replacement_for_session_id IS NOT NULL) THEN
                    INSERT INTO risk_updates (course_id, class_group) VALUES (OLD.course_id, OLD.class_group);
                END IF;
                IF TG_OP <> 'DELETE' AND NEW.course_id IS NOT NULL AND (NEW.status = 'completed' OR NEW.replacement_for_session_id IS NOT NULL) THEN
                    INSERT INTO risk_updates (course_id, class_group) VALUES (NEW.course_id, NEW.class_group);
                END IF;
            ELSIF TG_TABLE_NAME = 'enrolments' THEN
                IF TG_OP <> 'INSERT' AND OLD.course_id IS NOT NULL THEN
                    INSERT INTO risk_updates (course_id, student_id) VALUES (OLD.course_id, OLD.student_id);
                END IF;
                IF TG_OP <> 'DELETE' AND NEW.course_id IS NOT NULL THEN
                    INSERT INTO risk_updates (course_id, student_id) VALUES (NEW.course_id, NEW.student_id);
                END IF;
            ELSIF TG_TABLE_NAME = 'courses' THEN
                INSERT INTO risk_updates (course_id) VALUES (NEW.id);
            ELSIF TG_TABLE_NAME = 'academic_semesters' THEN
                INSERT INTO risk_updates (course_id) SELECT id FROM courses WHERE semester_id = NEW.id;
            END IF;
            RETURN NULL;
        END $$;
        CREATE TRIGGER risk_attendance AFTER INSERT OR UPDATE OR DELETE ON attendance_records
            FOR EACH ROW EXECUTE FUNCTION enqueue_risk_input();
        CREATE TRIGGER risk_session AFTER INSERT OR UPDATE OR DELETE ON class_sessions
            FOR EACH ROW EXECUTE FUNCTION enqueue_risk_input();
        CREATE TRIGGER risk_enrolment AFTER INSERT OR UPDATE OR DELETE ON enrolments
            FOR EACH ROW EXECUTE FUNCTION enqueue_risk_input();
        CREATE TRIGGER risk_course AFTER UPDATE OF semester_id ON courses
            FOR EACH ROW WHEN (OLD.semester_id IS DISTINCT FROM NEW.semester_id) EXECUTE FUNCTION enqueue_risk_input();
        CREATE TRIGGER risk_semester AFTER UPDATE OF start_date, end_date ON academic_semesters
            FOR EACH ROW WHEN ((OLD.start_date, OLD.end_date) IS DISTINCT FROM (NEW.start_date, NEW.end_date))
            EXECUTE FUNCTION enqueue_risk_input();
    ''')


def downgrade():
    for trigger, table in (('teaching_rule_changed', 'class_meetings'), ('risk_attendance', 'attendance_records'),
                           ('risk_session', 'class_sessions'), ('risk_enrolment', 'enrolments'),
                           ('risk_course', 'courses'), ('risk_semester', 'academic_semesters')):
        op.execute(f'DROP TRIGGER {trigger} ON {table}')
    op.execute('DROP FUNCTION capture_teaching_rule(); DROP FUNCTION enqueue_risk_input()')
    op.execute('DROP TRIGGER date_course_plan_binding ON courses; DROP FUNCTION date_course_plan_binding()')
    op.drop_column('courses', 'plan_recorded_from')
    op.drop_column('class_meetings', 'retire_on')
    op.execute("UPDATE risk_scores SET risk_score = 0 WHERE risk_score IS NULL")
    op.alter_column('risk_scores', 'risk_score', nullable=False)
    op.drop_column('risk_scores', 'assessment_source')
    op.drop_constraint('uq_current_risk_score', 'risk_scores', type_='unique')
    op.execute('INSERT INTO risk_scores SELECT * FROM risk_score_history ON CONFLICT (id) DO NOTHING')
    for table in ('risk_updates', 'teaching_plans', 'teaching_rule_versions', 'risk_score_history'):
        op.drop_table(table)
