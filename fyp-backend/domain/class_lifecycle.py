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


def reminder_stage(scheduled_start, scheduled_end, status, now) -> str | None:
    """Return the one reminder stage due for a scheduled class."""
    if (not scheduled_start or not scheduled_end
            or status in ("cancelled", "completed")):
        return None
    start = scheduled_start
    if start - timedelta(minutes=15) <= now < start:
        return "before"
    if start <= now < start + timedelta(minutes=10):
        return "started"
    if (start + timedelta(minutes=10) <= now < scheduled_end
            and status != "open"):
        return "not_opened"
    return None


def mark_class_held(class_record, user_id) -> None:
    """Resolve a missed gate without cancelling a class that really took place."""
    if class_record.status != "needs_attention":
        raise ValueError("Only a class needing review can be marked as held")
    class_record.status = "completed"
    class_record.is_open = False
    class_record.opened_at = class_record.opened_at or class_record.scheduled_start
    class_record.closed_at = class_record.scheduled_end
    class_record.opened_by_user_id = user_id


def needs_admin_escalation(class_record, now) -> bool:
    return (
        class_record.status == "needs_attention"
        and class_record.scheduled_end is not None
        and now >= class_record.scheduled_end + timedelta(hours=24)
    )
