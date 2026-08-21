from datetime import timedelta


COUNTED_STATUS = "completed"


def close_class_if_due(class_record, now) -> bool:
    """Close an open class at its scheduled end, never at the poll time."""
    if (getattr(class_record, "status", None) != "open"
            or not class_record.scheduled_end
            or now < class_record.scheduled_end):
        return False
    class_record.status = "completed"
    class_record.is_open = False
    class_record.closed_at = class_record.scheduled_end
    return True


def barred_list_readiness(classes) -> dict:
    unresolved = sum(1 for item in classes if item.status == "needs_attention")
    return {"ready": unresolved == 0, "unresolved_count": unresolved}


def effective_class_count(classes) -> int:
    return sum(1 for item in classes if item.status == COUNTED_STATUS)


def class_can_open(class_record, now) -> bool:
    return (
        class_record.scheduled_start - timedelta(hours=1)
        <= now
        < class_record.scheduled_end
    )


def has_active_replacement(replacements) -> bool:
    return any(item.status != "cancelled" for item in replacements)
