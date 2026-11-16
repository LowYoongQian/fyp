-- Frozen 71c97fdeebc7 structure for new databases (18 legacy tables, no data).
-- Reconstructed from the schema-only f4a8b0c3d206 snapshot by executing that
-- revision's recorded downgrades in an empty, isolated database. Do not regenerate
-- from current ORM metadata: later migrations own every subsequent change.
CREATE TABLE public.alerts (
    alert_type character varying,
    email_body text,
    triggered_by character varying,
    triggered_at timestamp without time zone DEFAULT now(),
    sent_at timestamp without time zone,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    course_id uuid,
    severity character varying DEFAULT 'Medium'::character varying,
    message text,
    is_resolved boolean DEFAULT false
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    title character varying NOT NULL,
    content text NOT NULL,
    faculty character varying NOT NULL,
    department character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    is_draft boolean DEFAULT false NOT NULL,
    priority character varying DEFAULT 'Medium'::character varying NOT NULL,
    image_base64 text,
    publish_start timestamp without time zone,
    publish_end timestamp without time zone,
    target_audience character varying DEFAULT 'all'::character varying,
    target_programme_code character varying,
    target_scope character varying DEFAULT 'all'::character varying,
    target_role character varying DEFAULT 'all'::character varying,
    target_course_code character varying,
    publisher character varying DEFAULT 'ADMIN'::character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: attendance_records; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendance_records (
    status character varying,
    confidence_score double precision,
    liveness_passed boolean,
    marked_at timestamp without time zone DEFAULT now(),
    source_ip character varying,
    reported_ssid character varying,
    reported_bssid character varying,
    reported_gateway_ip character varying,
    network_verified boolean DEFAULT false,
    verify_detail character varying,
    liveness_challenge_ms integer,
    liveness_suspicious boolean DEFAULT false,
    device_id character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    session_id uuid,
    method character varying,
    wifi_ssid character varying,
    bssid character varying,
    gateway_ip character varying,
    local_ip character varying,
    is_flagged boolean,
    flag_reason character varying,
    image_url character varying,
    mc_proof_url character varying,
    "timestamp" timestamp without time zone DEFAULT now(),
    confidence double precision,
    wifi_verified boolean
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    user_id uuid,
    user_name character varying NOT NULL,
    user_role character varying NOT NULL,
    category character varying NOT NULL,
    action character varying NOT NULL,
    details text,
    ip_address character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: campus_networks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.campus_networks (
    label character varying NOT NULL,
    cidr character varying,
    ssid character varying,
    bssid_prefix character varying,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    location_name character varying,
    bssid character varying,
    gateway_ip character varying,
    subnet_range character varying
);


--
-- Name: class_meetings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_meetings (
    meeting_key character varying NOT NULL,
    role character varying NOT NULL,
    day character varying NOT NULL,
    start character varying NOT NULL,
    "end" character varying NOT NULL,
    room character varying NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    assignment_id uuid,
    lecturer_id uuid
);


--
-- Name: class_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.class_sessions (
    opened_at timestamp without time zone DEFAULT now(),
    closed_at timestamp without time zone,
    is_open boolean,
    class_group character varying(255) DEFAULT 'All'::character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid
);


--
-- Name: course_staff_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.course_staff_assignments (
    role character varying NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    course_id uuid,
    lecturer_id uuid
);


--
-- Name: courses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.courses (
    course_name character varying NOT NULL,
    course_code character varying NOT NULL,
    credit_hours double precision DEFAULT 3.0,
    planned_total_hours double precision,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    lecturer_id uuid,
    programme_id uuid,
    schedule_day character varying,
    schedule_start character varying,
    schedule_end character varying,
    schedule_room character varying
);


--
-- Name: enrolments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.enrolments (
    semester character varying NOT NULL,
    class_group character varying(255) DEFAULT 'G1'::character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    course_id uuid
);


--
-- Name: face_embeddings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.face_embeddings (
    embedding bytea NOT NULL,
    is_active boolean,
    created_at timestamp without time zone DEFAULT now(),
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    sample_count integer,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: lecturers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lecturers (
    name character varying NOT NULL,
    staff_id character varying NOT NULL,
    role character varying DEFAULT 'Lecturer'::character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid
);


--
-- Name: programmes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.programmes (
    name character varying NOT NULL,
    code character varying NOT NULL,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: risk_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.risk_scores (
    risk_score double precision NOT NULL,
    risk_label character varying,
    attendance_rate double precision,
    updated_at timestamp without time zone DEFAULT now(),
    risk_factors character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    student_id uuid,
    course_id uuid,
    risk_level character varying,
    absent_percentage double precision,
    consecutive_absences integer,
    calculated_at timestamp without time zone DEFAULT now()
);


--
-- Name: security_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.security_settings (
    key character varying NOT NULL,
    value character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: student_feedback; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.student_feedback (
    id uuid NOT NULL,
    student_id uuid,
    student_name character varying NOT NULL,
    student_code character varying NOT NULL,
    subject character varying NOT NULL,
    category character varying NOT NULL,
    message text NOT NULL,
    status character varying NOT NULL,
    admin_notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: students; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.students (
    name character varying NOT NULL,
    student_code character varying NOT NULL,
    is_face_registered boolean,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    programme_id uuid
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    email character varying NOT NULL,
    password_hash character varying NOT NULL,
    role character varying NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    avatar_url character varying,
    status character varying DEFAULT 'Active'::character varying,
    last_login_at timestamp without time zone,
    two_factor_enabled boolean DEFAULT false,
    theme_preference character varying DEFAULT 'light'::character varying,
    font_size_preference character varying DEFAULT 'medium'::character varying,
    language_preference character varying DEFAULT 'en'::character varying,
    notifications_enabled boolean DEFAULT true,
    email_notifications boolean DEFAULT true,
    push_notifications boolean DEFAULT true,
    in_app_notifications boolean DEFAULT true,
    profile_name character varying,
    profile_code character varying,
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: alerts alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attendance_records attendance_records_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: campus_networks campus_networks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.campus_networks
    ADD CONSTRAINT campus_networks_pkey PRIMARY KEY (id);


--
-- Name: class_meetings class_meetings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_meetings
    ADD CONSTRAINT class_meetings_pkey PRIMARY KEY (id);


--
-- Name: class_sessions class_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_pkey PRIMARY KEY (id);


--
-- Name: course_staff_assignments course_staff_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_staff_assignments
    ADD CONSTRAINT course_staff_assignments_pkey PRIMARY KEY (id);


--
-- Name: courses courses_course_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_course_code_key UNIQUE (course_code);


--
-- Name: courses courses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_pkey PRIMARY KEY (id);


--
-- Name: enrolments enrolments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_pkey PRIMARY KEY (id);


--
-- Name: face_embeddings face_embeddings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.face_embeddings
    ADD CONSTRAINT face_embeddings_pkey PRIMARY KEY (id);


--
-- Name: lecturers lecturers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturers
    ADD CONSTRAINT lecturers_pkey PRIMARY KEY (id);


--
-- Name: lecturers lecturers_staff_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturers
    ADD CONSTRAINT lecturers_staff_id_key UNIQUE (staff_id);


--
-- Name: programmes programmes_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT programmes_code_key UNIQUE (code);


--
-- Name: programmes programmes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.programmes
    ADD CONSTRAINT programmes_pkey PRIMARY KEY (id);


--
-- Name: risk_scores risk_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_pkey PRIMARY KEY (id);


--
-- Name: security_settings security_settings_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_key_key UNIQUE (key);


--
-- Name: security_settings security_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.security_settings
    ADD CONSTRAINT security_settings_pkey PRIMARY KEY (id);


--
-- Name: student_feedback student_feedback_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_feedback
    ADD CONSTRAINT student_feedback_pkey PRIMARY KEY (id);


--
-- Name: students students_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_pkey PRIMARY KEY (id);


--
-- Name: students students_student_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_student_code_key UNIQUE (student_code);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: courses_course_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX courses_course_code_idx ON public.courses USING btree (course_code);


--
-- Name: ix_audit_logs_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_id ON public.audit_logs USING btree (id);


--
-- Name: ix_audit_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_audit_logs_user_id ON public.audit_logs USING btree (user_id);


--
-- Name: ix_class_meetings_meeting_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX ix_class_meetings_meeting_key ON public.class_meetings USING btree (meeting_key);


--
-- Name: ix_student_feedback_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_student_feedback_id ON public.student_feedback USING btree (id);


--
-- Name: ix_student_feedback_student_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX ix_student_feedback_student_id ON public.student_feedback USING btree (student_id);


--
-- Name: lecturers_staff_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX lecturers_staff_id_idx ON public.lecturers USING btree (staff_id);


--
-- Name: programmes_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX programmes_code_idx ON public.programmes USING btree (code);


--
-- Name: students_student_code_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX students_student_code_idx ON public.students USING btree (student_code);


--
-- Name: alerts alerts_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: alerts alerts_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.alerts
    ADD CONSTRAINT alerts_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.class_sessions(id) ON DELETE CASCADE;


--
-- Name: attendance_records attendance_records_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendance_records
    ADD CONSTRAINT attendance_records_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: class_meetings class_meetings_assignment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_meetings
    ADD CONSTRAINT class_meetings_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES public.course_staff_assignments(id) ON DELETE CASCADE;


--
-- Name: class_meetings class_meetings_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_meetings
    ADD CONSTRAINT class_meetings_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: class_meetings class_meetings_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_meetings
    ADD CONSTRAINT class_meetings_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.lecturers(id) ON DELETE SET NULL;


--
-- Name: class_sessions class_sessions_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.class_sessions
    ADD CONSTRAINT class_sessions_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_staff_assignments course_staff_assignments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_staff_assignments
    ADD CONSTRAINT course_staff_assignments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: course_staff_assignments course_staff_assignments_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.course_staff_assignments
    ADD CONSTRAINT course_staff_assignments_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.lecturers(id) ON DELETE CASCADE;


--
-- Name: courses courses_lecturer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_lecturer_id_fkey FOREIGN KEY (lecturer_id) REFERENCES public.lecturers(id) ON DELETE CASCADE;


--
-- Name: courses courses_programme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.courses
    ADD CONSTRAINT courses_programme_id_fkey FOREIGN KEY (programme_id) REFERENCES public.programmes(id) ON DELETE SET NULL;


--
-- Name: enrolments enrolments_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: enrolments enrolments_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.enrolments
    ADD CONSTRAINT enrolments_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: face_embeddings face_embeddings_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.face_embeddings
    ADD CONSTRAINT face_embeddings_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: lecturers lecturers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lecturers
    ADD CONSTRAINT lecturers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: risk_scores risk_scores_course_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_course_id_fkey FOREIGN KEY (course_id) REFERENCES public.courses(id) ON DELETE CASCADE;


--
-- Name: risk_scores risk_scores_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.risk_scores
    ADD CONSTRAINT risk_scores_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: student_feedback student_feedback_student_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.student_feedback
    ADD CONSTRAINT student_feedback_student_id_fkey FOREIGN KEY (student_id) REFERENCES public.students(id) ON DELETE CASCADE;


--
-- Name: students students_programme_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_programme_id_fkey FOREIGN KEY (programme_id) REFERENCES public.programmes(id) ON DELETE SET NULL;


--
-- Name: students students_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.students
    ADD CONSTRAINT students_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
