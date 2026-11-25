"""Contact-minute assessments and the existing Random Forest classifier."""
import logging
import math
from pathlib import Path

from ml.features import FEATURE_ORDER, compute_features, features_to_row

logger = logging.getLogger(__name__)


def _load_model():
    try:
        import joblib

        model = joblib.load(Path(__file__).resolve().parents[1] / "ml" / "risk_model.pkl")
    except Exception as error:
        logger.warning("At-Risk model unavailable (%s)", type(error).__name__)
        return None
    logger.info("At-Risk model loaded: %s", type(model).__name__)
    return model


_MODEL = _load_model()

PENDING_TEACHING = "Pending Teaching Completion"
FINAL_MET = "Final Attendance Met"
FINAL_BELOW = "Final Attendance Below Minimum"


def assess(sequence, minutes, planned, issue=None, *, semester_ended=False, outstanding_reason=None):
    held = sum(minutes)
    credited = sum(duration for present, duration in zip(sequence, minutes) if present)
    rate = credited / held if held else None

    def result(source, reason, label=None, score=None):
        return dict(assessment_source=source, risk_factors=reason, risk_label=label,
                    risk_score=score, attendance_rate=rate)

    if issue or not planned or held > planned:
        return result("Plan Incomplete", issue or (
            "Completed minutes exceed the teaching plan" if planned else "A complete teaching plan is unavailable"
        ))
    if semester_ended:
        if held < planned:
            return result(PENDING_TEACHING, f"{planned - held} of {planned} planned minutes outstanding. "
                          + (outstanding_reason or "Teaching obligations remain incomplete."))
        if 5 * credited >= 4 * planned:
            return result(FINAL_MET, f"{credited} of {planned} minutes credited; 80% requirement met.", "low", 0.0)
        return result(FINAL_BELOW, f"{credited} of {planned} minutes credited; below the 80% requirement.", "high", 1.0)
    if not held:
        return result("No Attendance Data", "No eligible classes have completed")
    possible = credited + planned - held
    if 5 * possible < 4 * planned:
        return result("Guaranteed High", f"Cannot reach 80% (best case {100 * possible // planned}%)", "high", 1.0)
    if 5 * credited >= 4 * planned:
        return result("Guaranteed Low", "The 80% requirement is already secured", "low", 0.0)
    if 10 * held < 3 * planned:
        return result("Observing", "Less than 30% of the planned contact minutes have completed")
    if _MODEL is not None:
        try:
            import pandas as pd

            features = compute_features(sequence, minutes)
            row = pd.DataFrame([features_to_row(features)], columns=FEATURE_ORDER)
            probability = float(_MODEL.predict_proba(row)[0][list(_MODEL.classes_).index(1)])
            if not math.isfinite(probability) or not 0 <= probability <= 1:
                raise ValueError("Invalid model probability")
        except Exception as error:
            logger.warning("At-Risk model prediction failed (%s)", type(error).__name__)
        else:
            score = round(probability, 4)
            label = "low" if score < .35 else "medium" if score < .60 else "high"
            factors = []
            if 5 * credited < 4 * held:
                factors.append("Current attendance is below 80%")
            if features["consecutive_absent"] >= 3:
                factors.append(f"Missed {features['consecutive_absent']} classes in a row")
            if features["trend"] <= -.10:
                factors.append("Attendance has declined")
            reason = "; ".join(factors) or "Random Forest assessment of the attendance pattern"
            return result("ML Prediction", reason, label, score)
    return result("Model Unavailable", "The attendance model is unavailable")
