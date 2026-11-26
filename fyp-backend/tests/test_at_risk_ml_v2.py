"""Targeted QA for the At-Risk V2 model integration (docs/03-MLModel/phase2/INTEGRATION_REPORT.md).
Unit tests run anywhere; the DB tests reuse the Phase 1 isolated synthetic PostgreSQL fixture."""
from datetime import timedelta
import warnings
from uuid import uuid4

import joblib
import pandas as pd
import pytest
from fastapi import HTTPException
from sqlalchemy import text

from db.database import SessionLocal
from db.models import AttendanceRecord, Course, RiskScore, RiskUpdate, User
from domain import risk_decision as rd, risk_service
from domain.planned_hours import planned_minutes
from ml.features import FEATURE_ORDER, FEATURE_ORDER_V2, compute_features_v2
from routers import analytics, lecturers
from test_at_risk_phase1 import add_lesson, offering, snapshots  # noqa: F401  (offering is a fixture)

V1 = (joblib.load(rd.Path(rd.__file__).parents[1] / "ml" / "risk_model.pkl"), FEATURE_ORDER, (.35, .60))
V2 = (rd._MODEL, FEATURE_ORDER_V2, (.32, .87))


class Fake:
    classes_ = [0, 1]

    def __init__(self, p):
        self.p, self.rows = p, []

    def predict_proba(self, rows):
        self.rows.append(rows)
        return [[1 - self.p, self.p]]


def use(monkeypatch, spec):
    model, order, bands = spec
    monkeypatch.setattr(rd, "_MODEL", model)
    monkeypatch.setattr(rd, "_ORDER", order)
    monkeypatch.setattr(rd, "_BANDS", bands)


def test_v2_artifact_is_the_approved_candidate():
    model = rd._MODEL
    assert rd.MODEL_VERSION == "v2" and rd._BANDS == (.32, .87) and rd._ORDER == FEATURE_ORDER_V2
    assert list(model.feature_names_in_) == FEATURE_ORDER_V2
    params = model.get_params()
    assert {k: params[k] for k in ("n_estimators", "max_depth", "min_samples_leaf", "class_weight", "random_state", "n_jobs")} == \
        dict(n_estimators=200, max_depth=6, min_samples_leaf=20, class_weight="balanced", random_state=42, n_jobs=None)
    import sklearn
    assert sklearn.__version__ == "1.9.0"   # the loader also refuses any InconsistentVersionWarning


# Frozen Phase 2 snapshots (results/integration_parity.json golden_cases): candidate artifact score -> label.
GOLDEN = [
    ([1] * 8, [90] * 8, 1080, 0.094, "low"),
    ([1] * 14 + [0, 0], [180, 90] * 8, 3780, 0.4821, "medium"),
    ([0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 1, 1, 1, 1], [120, 60, 60] * 6, 3360, 0.8912, "high"),
    ([1, 1, 1, 1, 0, 1], [60] * 6, 960, 0.6173, "medium"),
]


@pytest.mark.parametrize("sequence,minutes,planned,score,label", GOLDEN)
def test_integrated_prediction_matches_frozen_candidate(sequence, minutes, planned, score, label):
    out = rd.assess(sequence, minutes, planned)
    assert (out["assessment_source"], out["risk_score"], out["risk_label"]) == ("ML Prediction", score, label)


@pytest.mark.parametrize("probability,label", [
    (0.0, "low"), (0.3199, "low"), (0.32, "medium"), (0.32004, "medium"), (0.8699, "medium"),
    (0.87, "high"), (0.87004, "high"), (1.0, "high"),
])
def test_risk_score_band_edges(monkeypatch, probability, label):
    fake = Fake(probability)
    use(monkeypatch, (fake, FEATURE_ORDER_V2, (.32, .87)))
    out = rd.assess([1, 0, 1, 1], [60, 60, 60, 60], 600)
    assert (out["assessment_source"], out["risk_label"]) == ("ML Prediction", label)
    row, = fake.rows
    assert list(row.columns) == FEATURE_ORDER_V2
    assert row.iloc[0].tolist() == [compute_features_v2([1, 0, 1, 1], [60] * 4, 600)[k] for k in FEATURE_ORDER_V2]
    assert "Teaching 40% complete; needs 300 of the remaining 360 planned minutes (84%) to reach 80%" in out["risk_factors"]


@pytest.mark.parametrize("args,kwargs,source", [
    (([1], [60], None, "Plan changed"), {}, "Plan Incomplete"),
    (([1], [60], None), {}, "Plan Incomplete"),
    (([1], [101], 100), {}, "Plan Incomplete"),
    (([1, 0], [80, 20], 200), {"semester_ended": True}, "Pending Teaching Completion"),
    (([1, 0], [8000, 2000], 10000), {"semester_ended": True}, "Final Attendance Met"),          # exactly 80%
    (([1, 0], [7999, 2001], 10000), {"semester_ended": True}, "Final Attendance Below Minimum"),
    (([], [], 100), {}, "No Attendance Data"),
    (([1, 0], [7999, 2001], 10000), {}, "Guaranteed High"),                                      # best case 79.99%
    (([1], [8000], 10000), {}, "Guaranteed Low"),                                                 # exactly 80% secured
    (([1], [2999], 10000), {}, "Observing"),                                                      # cold start 29.99%
])
def test_rule_states_never_call_the_model(monkeypatch, args, kwargs, source):
    fake = Fake(.5)
    use(monkeypatch, (fake, FEATURE_ORDER_V2, (.32, .87)))
    assert rd.assess(*args, **kwargs)["assessment_source"] == source
    assert fake.rows == []


def test_ml_starts_at_exactly_30_percent_and_best_case_exactly_80(monkeypatch):
    fake = Fake(.5)
    use(monkeypatch, (fake, FEATURE_ORDER_V2, (.32, .87)))
    out = rd.assess([1, 0], [1000, 2000], 10000)   # 30% held; best case 8000/10000
    assert out["assessment_source"] == "ML Prediction"
    assert fake.rows[0].iloc[0]["progress"] == 0.3 and fake.rows[0].iloc[0]["required_future_rate"] == 1.0
    assert "needs 7000 of the remaining 7000 planned minutes (100%)" in out["risk_factors"]


def test_progress_features_refuse_impossible_plans():
    for planned in (0, None, -100, 120):
        with pytest.raises((ValueError, TypeError)):
            compute_features_v2([1, 1], [60, 60], planned)


def test_model_failures_show_model_unavailable_never_v1(monkeypatch):
    def raises(*_):
        raise RuntimeError
    broken = Fake(.5)
    broken.predict_proba = raises
    use(monkeypatch, (broken, FEATURE_ORDER_V2, (.32, .87)))
    assert rd.assess([1, 0, 1, 1], [60] * 4, 600)["assessment_source"] == "Model Unavailable"
    use(monkeypatch, (Fake(float("nan")), FEATURE_ORDER_V2, (.32, .87)))
    assert rd.assess([1, 0, 1, 1], [60] * 4, 600)["assessment_source"] == "Model Unavailable"
    # Loader refusals: wrong file contents, wrong features, other scikit-learn, unknown version.
    assert rd._load_model() is not None
    monkeypatch.setattr(rd, "_SHA256", "0" * 64)
    assert rd._load_model() is None
    monkeypatch.setattr(rd, "_SHA256", rd._MODELS["v2"][1])
    monkeypatch.setattr(rd, "_ORDER", FEATURE_ORDER)
    assert rd._load_model() is None
    monkeypatch.setattr(rd, "_ORDER", FEATURE_ORDER_V2)
    from sklearn.exceptions import InconsistentVersionWarning
    real_load = joblib.load

    def other_sklearn(*args):
        warnings.warn(InconsistentVersionWarning(estimator_name="RF", current_sklearn_version="1.9.1",
                                                 original_sklearn_version="1.9.0"))
        return real_load(*args)
    monkeypatch.setattr(joblib, "load", other_sklearn)
    assert rd._load_model() is None
    monkeypatch.setattr(joblib, "load", real_load)
    monkeypatch.setattr(rd, "_FILE", None)
    assert rd._load_model() is None


def test_rollback_spec_is_the_untouched_v1_model():
    name, digest, order, bands = rd._MODELS["v1"]
    assert (name, order, bands) == ("risk_model.pkl", FEATURE_ORDER, (.35, .60))
    assert rd.hashlib.sha256((rd.Path(rd.__file__).parents[1] / "ml" / name).read_bytes()).hexdigest() == digest


# ---------------------------------------------------------------- isolated PostgreSQL

def _lectures(db, data, attended):
    """Completed 120-minute lectures (all groups), one per week; attended[i] -> status for both students."""
    records = []
    for week, status in enumerate(attended):
        lesson = add_lesson(db, data, day_offset=7 * week, status="completed")
        for student in data["students"]:
            records.append(AttendanceRecord(student_id=student, session_id=lesson.id, status=status))
    db.add_all(records)
    db.flush()
    return [r.id for r in records]


def test_group_plans_mc_parity_and_automatic_update(offering):
    first, second = offering["students"]   # G1 (60-min tutorial) / G2 (90-min practical)
    with SessionLocal() as db:
        obligations, issue, _, _ = risk_service._plan_details(db, db.get(Course, offering["course"]))
        assert issue is None
        g1, g2 = planned_minutes(obligations, "G1"), planned_minutes(obligations, "G2")
        assert (g1, g2) == (720, 840)
        records = _lectures(db, offering, ["present", "absent"])
        db.commit()
    risk_service.process_risk_updates(limit=100)   # attendance writes queue the course; no manual recompute
    with SessionLocal() as db:
        rows = snapshots(db, offering)
        a, b = rows[first], rows[second]
        # Same attendance, different group plans: 240/720 held passes cold start, 240/840 does not.
        assert b.assessment_source == "Observing"
        assert a.assessment_source == "ML Prediction"
        expected = round(float(rd._MODEL.predict_proba(pd.DataFrame(
            [compute_features_v2([1, 0], [120, 120], g1)])[FEATURE_ORDER_V2])[0][1]), 4)
        assert a.risk_score == expected
        assert a.risk_label == ("low" if expected < .32 else "medium" if expected < .87 else "high")
        assert a.risk_factors.startswith("Teaching 33% complete; needs 456 of the remaining 480 planned minutes (95%)")
        before = (a.risk_score, a.risk_label, a.risk_factors, a.attendance_rate)
        db.query(AttendanceRecord).filter_by(id=records[0]).update({"status": "mc_approved"})
        db.commit()
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        a = snapshots(db, offering)[first]
        assert (a.risk_score, a.risk_label, a.risk_factors, a.attendance_rate) == before   # approved MC == Present
        assert db.query(RiskUpdate).filter_by(course_id=offering["course"]).count() == 0


def test_v1_snapshot_transition_and_stale_warning_preview(offering, monkeypatch):
    first = offering["students"][0]
    sent = []
    monkeypatch.setattr(lecturers.resend_mail, "configured", lambda: True)
    monkeypatch.setattr(lecturers.resend_mail, "send", lambda *args: sent.append(args) or "synthetic-id")
    with SessionLocal() as db:
        _lectures(db, offering, ["present", "absent"])
        db.commit()
        attendance = db.query(AttendanceRecord).count()
    use(monkeypatch, V1)   # the release before this one
    risk_service.process_risk_updates(limit=100)
    with SessionLocal() as db:
        teacher = db.get(User, offering["teachers"][0])
        body = lecturers.AlertCreate(course_id=offering["course"], student_id=first, alert_id=str(uuid4()))
        old_preview = lecturers.warning_preview(body, db, teacher)
        old = snapshots(db, offering)[first]
        v1 = (old.risk_score, old.risk_label)
    assert old_preview["assessment_source"] == "ML Prediction"

    use(monkeypatch, V2)   # deploy: the new process loads v2
    with SessionLocal() as db:
        teacher = db.get(User, offering["teachers"][0])
        listed, = [r for r in analytics.get_risk_scores(course_id=offering["course"], student_id=first, db=db,
                                                         current_user=teacher)]
        assert (listed["risk_score"], listed["risk_label"]) == v1   # stored v1 label is never re-banded on read
        body.assessment_token = old_preview["assessment_token"]
        with pytest.raises(HTTPException) as stale:
            lecturers.trigger_manual_alert(body, db, teacher)
        assert stale.value.status_code == 409 and not sent
    with SessionLocal() as db:   # verify: detects the v1 snapshot and writes nothing
        assert offering["course"] in risk_service.stale_model_courses(db)
        row = snapshots(db, offering)[first]
        assert (row.risk_score, row.risk_label) == v1
    with SessionLocal.begin() as db:
        assert risk_service.queue_model_refresh(db) >= 1
        assert risk_service.queue_model_refresh(db) >= 1   # repeatable
    risk_service.process_risk_updates(limit=1000)
    with SessionLocal() as db:
        new = snapshots(db, offering)[first]
        assert new.assessment_source == "ML Prediction" and (new.risk_score, new.risk_label) != v1
        assert db.query(RiskUpdate).filter_by(course_id=offering["course"]).count() == 0
        assert db.query(AttendanceRecord).count() == attendance
        assert offering["course"] not in risk_service.stale_model_courses(db)
        other_group = db.get(User, offering["teachers"][2])   # G2 practical teacher, student is G1
        with pytest.raises(HTTPException) as denied:
            lecturers.warning_preview(lecturers.AlertCreate(course_id=offering["course"], student_id=first), db, other_group)
        assert denied.value.status_code == 403
        db.rollback()
        teacher = db.get(User, offering["teachers"][0])
        fresh = lecturers.warning_preview(body, db, teacher)
        assert (fresh["risk_score"], fresh["risk_label"]) == (new.risk_score, new.risk_label)
        body.assessment_token, body.email_body = fresh["assessment_token"], fresh["email_body"]
        assert lecturers.trigger_manual_alert(body, db, teacher)["delivery_status"] == "accepted"
        assert len(sent) == 1   # mocked provider; only the lecturer's explicit send
        assert db.scalar(text("SELECT count(*) FROM alerts WHERE student_id=:s"), {"s": first}) == 1
    # Rollback to v1: factors keep the same wording, so only reassessment can tell the rows are stale.
    use(monkeypatch, V1)
    with SessionLocal() as db:
        assert snapshots(db, offering)[first].risk_factors.startswith("Teaching ")
        assert offering["course"] in risk_service.stale_model_courses(db)


def test_model_switch_voids_preview_even_with_identical_assessment(offering, monkeypatch):
    first = offering["students"][0]
    sent = []
    monkeypatch.setattr(lecturers.resend_mail, "configured", lambda: True)
    monkeypatch.setattr(lecturers.resend_mail, "send", lambda *args: sent.append(args) or "synthetic-id")
    with SessionLocal() as db:
        _lectures(db, offering, ["present", "absent"])
        db.commit()
        teacher = db.get(User, offering["teachers"][0])
        body = lecturers.AlertCreate(course_id=offering["course"], student_id=first, alert_id=str(uuid4()))
        use(monkeypatch, (Fake(.5), FEATURE_ORDER, (.35, .60)))
        monkeypatch.setattr(rd, "MODEL_VERSION", "v1")
        old = lecturers.warning_preview(body, db, teacher)
        use(monkeypatch, (Fake(.5), FEATURE_ORDER_V2, (.32, .87)))
        monkeypatch.setattr(rd, "MODEL_VERSION", "v2")
        new = lecturers.warning_preview(body, db, teacher)
        shown = ("risk_score", "risk_label", "risk_factors", "assessment_source", "attendance_rate")
        assert [old[k] for k in shown] == [new[k] for k in shown] and old["risk_label"] == "medium"
        assert old["assessment_token"] != new["assessment_token"]
        body.assessment_token = old["assessment_token"]
        with pytest.raises(HTTPException) as stale:
            lecturers.trigger_manual_alert(body, db, teacher)
        assert stale.value.status_code == 409 and not sent
