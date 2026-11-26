"""Contact-minute assessments and the Random Forest Risk Score."""
import hashlib
import io
import logging
import math
import os
import warnings
from pathlib import Path

from ml.features import FEATURE_ORDER, FEATURE_ORDER_V2, compute_features_v2, features_to_row

logger = logging.getLogger(__name__)

# Model, features and Risk Score bands travel together, so a rollback can never mix them.
# v2 and its bands: docs/03-MLModel/phase2/INTEGRATION_REPORT.md (owner-approved option A).
_MODELS = {
    "v2": ("risk_model_v2.pkl", "5c8245529e3c204519074b4891c7bd12bbac439a4477768834d371e34c3b5145",
           FEATURE_ORDER_V2, (.32, .87)),
    "v1": ("risk_model.pkl", "dd01a3074b4869aca2e22f34e806ac07ae791d467b468f01e789d4d5aa7e3e60",
           FEATURE_ORDER, (.35, .60)),   # rollback: AT_RISK_MODEL_VERSION=v1
}
MODEL_VERSION = os.getenv("AT_RISK_MODEL_VERSION", "v2")
_FILE, _SHA256, _ORDER, _BANDS = _MODELS.get(MODEL_VERSION, (None, None, None, None))


def _load_model():
    try:
        import joblib
        from sklearn.exceptions import InconsistentVersionWarning

        if _FILE is None:
            raise KeyError(MODEL_VERSION)
        data = (Path(__file__).resolve().parents[1] / "ml" / _FILE).read_bytes()
        if hashlib.sha256(data).hexdigest() != _SHA256:
            raise ValueError("model file checksum mismatch")
        with warnings.catch_warnings():
            warnings.simplefilter("error", InconsistentVersionWarning)   # a different scikit-learn is refused
            model = joblib.load(io.BytesIO(data))
        if list(getattr(model, "feature_names_in_", [])) != _ORDER:
            raise ValueError("model features differ from the extractor")
    except Exception as error:
        logger.warning("At-Risk model %s unavailable (%s)", MODEL_VERSION, type(error).__name__)
        return None
    logger.info("At-Risk model %s loaded: %s", MODEL_VERSION, type(model).__name__)
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

            features = compute_features_v2(sequence, minutes, planned)
            row = pd.DataFrame([features_to_row(features, _ORDER)], columns=_ORDER)
            probability = float(_MODEL.predict_proba(row)[0][list(_MODEL.classes_).index(1)])
            if not math.isfinite(probability) or not 0 <= probability <= 1:
                raise ValueError("Invalid model output")
        except Exception as error:
            logger.warning("At-Risk model prediction failed (%s)", type(error).__name__)
        else:
            score = round(probability, 4)   # a ranking Risk Score, not a calibrated probability
            medium, high = _BANDS
            label = "low" if score < medium else "medium" if score < high else "high"
            remaining = planned - held
            needed = -(-(4 * planned - 5 * credited) // 5)   # whole minutes still to be credited for 80%
            # Observed inputs only; they describe the data, not how the forest weighed it.
            factors = [f"Teaching {100 * held // planned}% complete",
                       f"needs {needed} of the remaining {remaining} planned minutes "
                       f"({-(-100 * needed // remaining)}%) to reach 80%"]
            if 5 * credited < 4 * held:
                factors.append("current attendance is below 80%")
            if features["consecutive_absent"] >= 3:
                factors.append(f"missed {features['consecutive_absent']} classes in a row")
            if features["trend"] <= -.10:
                factors.append("attendance has declined")
            return result("ML Prediction", "; ".join(factors), label, score)
    return result("Model Unavailable", "The attendance model is unavailable")
