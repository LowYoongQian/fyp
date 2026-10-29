from datetime import datetime, timezone

from fastapi import HTTPException, Query
from sqlalchemy import String, cast, func, or_


class RecordFilters:
    def __init__(self, page: int = Query(1, ge=1), per_page: int = Query(10, ge=1, le=100),
                 search: str = Query("", max_length=255), status: str = Query("All", max_length=32),
                 submitted_from: datetime | None = Query(None), submitted_to: datetime | None = Query(None)):
        self.page, self.per_page, self.search, self.status = page, per_page, search.strip(), status
        self.start, self.end = self.utc(submitted_from), self.utc(submitted_to)
        if self.start and self.end and self.end <= self.start:
            raise HTTPException(422, "The end date/time must be after the start date/time.")

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

    def fetch(self, query, order, serialize=lambda row: row, stats=None):
        total = query.order_by(None).count()
        page = min(self.page, max(1, (total + self.per_page - 1) // self.per_page))
        rows = query.order_by(*order).offset((page - 1) * self.per_page).limit(self.per_page).all()
        return {"items": [serialize(row) for row in rows], "total": total, "page": page,
                "per_page": self.per_page, "stats": stats or {}}


def status_counts(query, status):
    return {name: count for name, count in query.with_entities(status, func.count()).group_by(status).all()}
