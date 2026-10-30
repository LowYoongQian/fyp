import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, Query
from sqlalchemy import String, cast, func, or_


class RecordFilters:
    def __init__(self, page: int = Query(1, ge=1), per_page: int = Query(10, ge=1, le=100),
                 search: str = Query("", max_length=255), status: str = Query("All", max_length=32),
                 submitted_from: datetime | None = Query(None), submitted_to: datetime | None = Query(None),
                 focus_id: str | None = Query(None, max_length=64)):
        self.page, self.per_page, self.search, self.status = page, per_page, search.strip(), status
        # Optional locator: ask for the page that contains this record under the same scoping, filters and order.
        self.focus_id = self.uuid_or_none(focus_id)
        self.start, self.end = self.utc(submitted_from), self.utc(submitted_to)
        if self.start and self.end and self.end <= self.start:
            raise HTTPException(422, "The end date/time must be after the start date/time.")

    @staticmethod
    def uuid_or_none(value):
        """Only a complete, canonical UUID may reach a typed UUID column; anything else is ignored, never a DB error."""
        try:
            return str(uuid.UUID(value)) if value else None
        except (ValueError, AttributeError, TypeError):
            return None

    @staticmethod
    def utc(value):
        if value is None:
            return None
        if value.tzinfo is None:
            raise HTTPException(422, "Submission filters must include a timezone.")
        return value.astimezone(timezone.utc).replace(tzinfo=None)

    def apply(self, query, timestamp, searchable):
        if self.start:
            query = query.filter(timestamp >= self.start)
        if self.end:
            query = query.filter(timestamp < self.end)
        if self.search:
            clean = self.search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            query = query.filter(or_(*(cast(column, String).ilike(f"%{clean}%", escape="\\") for column in searchable)))
        return query

    def fetch(self, query, order, serialize=lambda row: row, stats=None, id_column=None):
        total = query.order_by(None).count()
        page = min(self.page, max(1, (total + self.per_page - 1) // self.per_page))
        focus = None
        if self.focus_id and id_column is not None:
            # One windowed query over the already scoped/filtered rows: never scans or downloads the list.
            ranked = query.order_by(None).with_entities(id_column.label("record_id"),
                func.row_number().over(order_by=list(order)).label("position")).subquery()
            position = query.session.query(ranked.c.position).filter(ranked.c.record_id == self.focus_id).scalar()
            focus = {"id": self.focus_id, "found": position is not None}
            if position is not None:
                page = (position - 1) // self.per_page + 1
        rows = query.order_by(*order).offset((page - 1) * self.per_page).limit(self.per_page).all()
        result = {"items": [serialize(row) for row in rows], "total": total, "page": page,
                  "per_page": self.per_page, "stats": stats or {}}
        if focus is not None:
            result["focus"] = focus
        return result


def status_counts(query, status):
    return {name: count for name, count in query.with_entities(status, func.count()).group_by(status).all()}
