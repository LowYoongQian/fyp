from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime, timezone
from utils.timeutil import iso_utc, utcnow
from typing import List, Optional
import os
import uuid

from domain.announcements import announcement_dict, visible_announcements
from db.database import get_db
from domain.scheduler import (
    calculate_schedule, lecture_meetings,
    meeting_key_for, session_end_utc, slots_for_assignment,
)
from db.models import (
    User, Lecturer, Course, CourseStaffAssignment, Enrolment, Alert, Student, Announcement,
    ClassMeeting, ClassSession, AttendanceRecord, UserNotification
)
from integrations.announcement_files import ALLOWED_TYPES, download as download_announcement_file, upload as upload_announcement_file
from routers.attendance_features import add_notification
from utils.security import require_lecturer
from utils.db_helpers import get_or_404, my_course_ids, require_own_profile

router = APIRouter(prefix="/lecturers", tags=["Lecturers"])


def _naive_utc(value: Optional[datetime]) -> Optional[datetime]:
    if value is None or value.tzinfo is None:
        return value
    return value.astimezone(timezone.utc).replace(tzinfo=None)

class AlertCreate(BaseModel):
    student_id: str
    course_id: str

@router.get("/me/courses")
def get_lecturer_courses(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    # Get courses assigned directly or via assignments
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()

    # Batch enrolled counts — single GROUP BY instead of one COUNT per course
    course_ids = [c.id for c in courses]
    enrol_counts = dict(
        db.query(Enrolment.course_id, func.count(Enrolment.id))
        .filter(Enrolment.course_id.in_(course_ids))
        .group_by(Enrolment.course_id)
        .all()
    )

    # Lecture times come from class_meetings (source of truth).
    lecture_by_course = lecture_meetings(db, course_ids)

    result = []
    for c in courses:
        m = lecture_by_course.get(c.id)
        result.append({
            "id": c.id,
            "course_code": c.course_code,
            "course_name": c.course_name,
            "credit_hours": c.credit_hours,
            "schedule_day": m.day if m else None,
            "schedule_start": m.start if m else None,
            "schedule_end": m.end if m else None,
            "schedule_room": m.room if m else None,
            "enrolled_students_count": enrol_counts.get(c.id, 0),
            "lecturer_id": c.lecturer_id,
            "lecturer_name": lecturer.name
        })
    return result

@router.get("/me/alerts")
def get_lecturer_alerts(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()
    course_ids = [c.id for c in courses]
    
    alerts = db.query(Alert).filter(Alert.course_id.in_(course_ids)).order_by(Alert.triggered_at.desc()).all()

    # Pre-load all referenced students and courses in two queries instead of 2×N
    alert_student_ids = list({a.student_id for a in alerts})
    alert_course_ids  = list({a.course_id  for a in alerts})
    students_map = {s.id: s for s in db.query(Student).filter(Student.id.in_(alert_student_ids)).all()}
    courses_map  = {c.id: c for c in db.query(Course).filter(Course.id.in_(alert_course_ids)).all()}

    result = []
    for a in alerts:
        student = students_map.get(a.student_id)
        course  = courses_map.get(a.course_id)
        result.append({
            "id": a.id,
            "student_id": a.student_id,
            "student_name": student.name if student else "Unknown Student",
            "student_code": student.student_code if student else "N/A",
            "course_id": a.course_id,
            "course_code": course.course_code if course else "N/A",
            "course_name": course.course_name if course else "N/A",
            "alert_type": a.alert_type,
            "email_body": a.email_body,
            "triggered_by": a.triggered_by,
            "triggered_at": iso_utc(a.triggered_at),
            "sent_at": iso_utc(a.sent_at),
        })
    return result

@router.post("/me/alerts")
def trigger_manual_alert(body: AlertCreate, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    student = get_or_404(db, Student, body.student_id, "Student")
    course = get_or_404(db, Course, body.course_id, "Course")
        
    email_body = (
        f"DEAR {student.name.upper()},\n\n"
        f"This is an automated warning regarding your low attendance in {course.course_name} ({course.course_code}). "
        f"Your current attendance rate is below the 80% threshold. Please meet with your academic counselor immediately.\n\n"
        f"Regards,\nLecturer / Academic Office"
    )
    
    new_alert = Alert(
        student_id=body.student_id,
        course_id=body.course_id,
        alert_type="manual_warning",
        email_body=email_body,
        triggered_by="lecturer",
        triggered_at=utcnow(),
        sent_at=utcnow()
    )
    db.add(new_alert)
    db.commit()
    db.refresh(new_alert)
    return {"status": "success", "alert_id": new_alert.id}


@router.get("/me/timetable")
def get_lecturer_timetable(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    # Find the lecturer profile
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    # Get all courses where this lecturer is primary OR has staff assignments
    assigned_assignments = db.query(CourseStaffAssignment).filter(CourseStaffAssignment.lecturer_id == lecturer.id).all()
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()

    # Batch enrolled counts — single GROUP BY instead of one COUNT per course
    timetable_course_ids = [c.id for c in courses]
    timetable_enrol_counts = dict(
        db.query(Enrolment.course_id, func.count(Enrolment.id))
        .filter(Enrolment.course_id.in_(timetable_course_ids))
        .group_by(Enrolment.course_id)
        .all()
    )

    # Calculate deterministic clash-free schedules
    schedule_map = calculate_schedule(db)
    
    result = []
    for c in courses:
        enrolled_count = timetable_enrol_counts.get(c.id, 0)
        
        # 1. Lecture Slot
        is_primary = (c.lecturer_id == lecturer.id)
        assigned_as_lecturer = any(a.course_id == c.id and a.role == 'Lecturer' for a in assigned_assignments)
        
        if is_primary or assigned_as_lecturer:
            lect_slot = schedule_map.get(f"Lecture-{c.id}")
            if lect_slot:
                # "id" is the meeting_key, matching schedule_map. See the same
                # note in routers/students.py — course ids are UUID strings, so
                # arithmetic on them is either a TypeError or a junk string.
                result.append({
                    "id": f"Lecture-{c.id}",
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "credit_hours": c.credit_hours,
                    "schedule_day": lect_slot["day"],
                    "schedule_start": lect_slot["start"],
                    "schedule_end": lect_slot["end"],
                    "schedule_room": lect_slot["room"],
                    "enrolled_students_count": enrolled_count,
                    "lecturer_id": c.lecturer_id,
                    "lecturer_name": lecturer.name,
                    "role": "Lecture"
                })
            
        # 2 & 3. Tutor / Practical assignments — one row PER GROUP. Each group meets at
        # its own time, so a staff member teaching two groups has two entries here.
        for role in ("Tutor", "Practical"):
            assign = next((a for a in assigned_assignments
                           if a.course_id == c.id and a.role == role), None)
            if not assign:
                continue
            for slot in slots_for_assignment(schedule_map, assign.id):
                result.append({
                    "id": meeting_key_for(role, c.id, assign.id, slot["class_group"]),
                    "course_id": c.id,
                    "course_code": c.course_code,
                    "course_name": c.course_name,
                    "credit_hours": c.credit_hours,
                    "class_group": slot["class_group"],
                    "schedule_day": slot["day"],
                    "schedule_start": slot["start"],
                    "schedule_end": slot["end"],
                    "schedule_room": slot["room"],
                    "enrolled_students_count": enrolled_count,
                    "lecturer_id": c.lecturer_id,
                    "lecturer_name": lecturer.name,
                    "role": role
                })


    return result


@router.get("/me/announcements", response_model=List[dict])
def get_my_announcements(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    """Return published and targeted announcements for the authenticated staff member,
    ordered by priority (High -> Medium -> Low) and date.
    """
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
        
    now = utcnow()

    my_courses = db.query(Course).filter(
        Course.id.in_(my_course_ids(db, lecturer.id))
    ).all()

    return [
        announcement_dict(a) for a in visible_announcements(
            db, "staff",
            {c.programme.code for c in my_courses
             if getattr(c, "programme", None) and c.programme.code},
            {c.course_code for c in my_courses if c.course_code},
        )
    ]


def _owned_announcement(db: Session, announcement_id: str, user_id: str) -> Announcement:
    row = db.query(Announcement).filter(Announcement.id == announcement_id,
        Announcement.creator_user_id == user_id).first()
    if not row:
        raise HTTPException(404, "Course notice not found")
    return row


def _assigned_course(db: Session, lecturer: Lecturer, course_id: str) -> Course:
    if course_id not in {str(value) for value in my_course_ids(db, lecturer.id)}:
        raise HTTPException(403, "You are not assigned to this course")
    course = db.get(Course, course_id)
    if not course:
        raise HTTPException(404, "Course not found")
    return course


def _notify_course(db: Session, row: Announcement, course: Course) -> int:
    if row.publish_start and row.publish_start > utcnow():
        return 0
    query = db.query(Enrolment, Student).join(Student, Student.id == Enrolment.student_id).filter(Enrolment.course_id == course.id)
    if row.target_group and row.target_group.lower() != "all":
        query = query.filter(Enrolment.class_group == row.target_group)
    recipient_ids = {student.user_id for _enrolment, student in query.all() if student.user_id}
    for user_id in recipient_ids:
        add_notification(db, user_id, "course_announcement", row.title,
            f"{course.course_code}: {row.content[:180]}", f"announcement:{row.id}",
            {"announcement_id": row.id, "course_id": course.id, "course_code": course.course_code})
    return len(recipient_ids)


@router.get("/me/course-announcements")
def list_course_announcements(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    return [announcement_dict(row) for row in db.query(Announcement).filter(
        Announcement.creator_user_id == current_user.id).order_by(Announcement.created_at.desc()).all()]


@router.get("/me/course-announcement-options")
def course_announcement_options(db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    courses = db.query(Course).filter(Course.id.in_(my_course_ids(db, lecturer.id))).all()
    result = []
    for course in courses:
        groups = [value for (value,) in db.query(Enrolment.class_group).filter(
            Enrolment.course_id == course.id).distinct().order_by(Enrolment.class_group).all() if value]
        result.append({"id": course.id, "course_code": course.course_code, "course_name": course.course_name, "groups": groups})
    return result


@router.get("/me/enrolments")
def get_lecturer_enrolments(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    """Return only enrolments for courses assigned to the current lecturer."""
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    course_ids = my_course_ids(db, lecturer.id)
    rows = (
        db.query(Enrolment, Student, Course)
        .join(Student, Student.id == Enrolment.student_id)
        .join(Course, Course.id == Enrolment.course_id)
        .filter(Enrolment.course_id.in_(course_ids))
        .all()
    )
    return [
        {
            "id": enrolment.id,
            "student_id": enrolment.student_id,
            "student_name": student.name,
            "student_code": student.student_code,
            "course_id": enrolment.course_id,
            "course_code": course.course_code,
            "course_name": course.course_name,
            "semester": enrolment.semester,
            "class_group": enrolment.class_group,
        }
        for enrolment, student, course in rows
    ]


@router.get("/me/dashboard-summary")
def get_lecturer_dashboard_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    """Database-backed profile and counters for the authenticated lecturer dashboard."""
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    course_ids = my_course_ids(db, lecturer.id)

    total_enrolled = (
        db.query(func.count(func.distinct(Enrolment.student_id)))
        .filter(Enrolment.course_id.in_(course_ids))
        .scalar()
        or 0
    )
    open_sessions = (
        db.query(ClassSession)
        .filter(
            ClassSession.course_id.in_(course_ids),
            ClassSession.is_open.is_(True),
        )
        .all()
    )
    now_utc = utcnow()
    timetable_slots = list(calculate_schedule(db).values()) if open_sessions else []
    active_sessions = sum(
        1
        for session in open_sessions
        if now_utc <= session_end_utc(
            session,
            [
                slot for slot in timetable_slots
                if slot["course_id"] == session.course_id
                and (
                    (session.class_group == "All" and slot["role"] == "Lecture")
                    or (
                        session.class_group != "All"
                        and slot["class_group"] == session.class_group
                    )
                )
            ],
        )
    )

    assignment_ids = [
        assignment_id
        for assignment_id, in db.query(CourseStaffAssignment.id)
        .filter(CourseStaffAssignment.lecturer_id == lecturer.id)
        .all()
    ]
    primary_course_ids = [
        course_id
        for course_id, in db.query(Course.id)
        .filter(Course.lecturer_id == lecturer.id)
        .all()
    ]
    roster_classes = (
        db.query(func.count(func.distinct(ClassMeeting.id)))
        .filter(
            (ClassMeeting.lecturer_id == lecturer.id)
            | (ClassMeeting.assignment_id.in_(assignment_ids))
            | (
                (ClassMeeting.role == "Lecture")
                & (ClassMeeting.course_id.in_(primary_course_ids))
            )
        )
        .scalar()
        or 0
    )

    attendance_total, attendance_present = (
        db.query(
            func.count(AttendanceRecord.id),
            func.count(AttendanceRecord.id).filter(AttendanceRecord.status == "present"),
        )
        .join(ClassSession, ClassSession.id == AttendanceRecord.session_id)
        .filter(ClassSession.course_id.in_(course_ids))
        .one()
    )
    attendance_rate = round((attendance_present / attendance_total) * 100, 1) if attendance_total else 0.0

    return {
        "profile": {
            "name": lecturer.name,
            "staff_id": lecturer.staff_id,
            "email": current_user.email,
            "role": "Lecturer",
            "avatar_url": current_user.avatar_url,
            "joined_at": iso_utc(current_user.created_at),
        },
        "total_enrolled": int(total_enrolled),
        "active_sessions": int(active_sessions),
        "my_courses": len(course_ids),
        "roster_classes": int(roster_classes),
        "overall_attendance_rate": attendance_rate,
    }


@router.post("/me/course-announcements", status_code=201)
def create_course_announcement(
    course_id: str = Form(...), target_group: str = Form("all"), title: str = Form(...),
    content: str = Form(...), priority: str = Form("Medium"), publish_start: Optional[datetime] = Form(None),
    publish_end: Optional[datetime] = Form(None), external_link: Optional[str] = Form(None),
    attachment: Optional[UploadFile] = File(None), db: Session = Depends(get_db),
    current_user: User = Depends(require_lecturer),
):
    publish_start, publish_end = _naive_utc(publish_start), _naive_utc(publish_end)
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    course = _assigned_course(db, lecturer, course_id)
    clean_title, clean_content = title.strip(), content.strip()
    if not clean_title or not clean_content:
        raise HTTPException(400, "Title and message are required")
    if publish_start and publish_end and publish_end <= publish_start:
        raise HTTPException(400, "Expiry must be after publish time")
    groups = {value for (value,) in db.query(Enrolment.class_group).filter(Enrolment.course_id == course.id).distinct().all() if value}
    if target_group.lower() != "all" and target_group not in groups:
        raise HTTPException(400, "Class group not found")
    row = Announcement(title=clean_title, content=clean_content, faculty="Course", department="Academic",
        priority=priority if priority in {"High", "Medium", "Low"} else "Medium",
        publisher=lecturer.name, publish_start=publish_start, publish_end=publish_end,
        target_scope="course", target_role="students", target_course_code=course.course_code,
        target_group=target_group, creator_user_id=current_user.id, external_link=(external_link or "").strip() or None)
    if attachment:
        mime_type = (attachment.content_type or "").lower()
        if mime_type not in ALLOWED_TYPES:
            raise HTTPException(415, "Use PDF, PNG, JPG, DOC, or DOCX")
        data = attachment.file.read(5 * 1024 * 1024 + 1)
        if not data or len(data) > 5 * 1024 * 1024:
            raise HTTPException(413, "File must be under 5 MB")
        path = f"{current_user.id}/{uuid.uuid4().hex}/{os.path.basename(attachment.filename or 'attachment')}"
        try:
            upload_announcement_file(path, data, mime_type)
        except Exception as exc:
            raise HTTPException(503, "File upload failed") from exc
        row.attachment_path, row.attachment_name = path, os.path.basename(attachment.filename or "attachment")
        row.attachment_mime_type, row.attachment_size = mime_type, len(data)
    db.add(row)
    db.flush()
    recipient_count = _notify_course(db, row, course)
    db.commit()
    db.refresh(row)
    result = announcement_dict(row)
    result["recipient_count"] = recipient_count
    return result


@router.delete("/me/course-announcements/{announcement_id}")
def delete_course_announcement(announcement_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    row = _owned_announcement(db, announcement_id, current_user.id)
    db.delete(row)
    db.commit()
    return {"message": "Course notice deleted"}


@router.put("/me/course-announcements/{announcement_id}")
def update_course_announcement(
    announcement_id: str, course_id: str = Form(...), target_group: str = Form("all"),
    title: str = Form(...), content: str = Form(...), priority: str = Form("Medium"),
    publish_start: Optional[datetime] = Form(None), publish_end: Optional[datetime] = Form(None),
    external_link: Optional[str] = Form(None), attachment: Optional[UploadFile] = File(None),
    db: Session = Depends(get_db), current_user: User = Depends(require_lecturer),
):
    publish_start, publish_end = _naive_utc(publish_start), _naive_utc(publish_end)
    lecturer = require_own_profile(db, Lecturer, current_user.id, "Lecturer")
    course = _assigned_course(db, lecturer, course_id)
    row = _owned_announcement(db, announcement_id, current_user.id)
    groups = {value for (value,) in db.query(Enrolment.class_group).filter(Enrolment.course_id == course.id).distinct().all() if value}
    if target_group.lower() != "all" and target_group not in groups:
        raise HTTPException(400, "Class group not found")
    if not title.strip() or not content.strip():
        raise HTTPException(400, "Title and message are required")
    if publish_start and publish_end and publish_end <= publish_start:
        raise HTTPException(400, "Expiry must be after publish time")
    row.title, row.content = title.strip(), content.strip()
    row.priority = priority if priority in {"High", "Medium", "Low"} else "Medium"
    row.publish_start, row.publish_end = publish_start, publish_end
    row.target_course_code, row.target_group = course.course_code, target_group
    row.external_link = (external_link or "").strip() or None
    if attachment:
        mime_type = (attachment.content_type or "").lower()
        if mime_type not in ALLOWED_TYPES:
            raise HTTPException(415, "Use PDF, PNG, JPG, DOC, or DOCX")
        data = attachment.file.read(5 * 1024 * 1024 + 1)
        if not data or len(data) > 5 * 1024 * 1024:
            raise HTTPException(413, "File must be under 5 MB")
        path = f"{current_user.id}/{uuid.uuid4().hex}/{os.path.basename(attachment.filename or 'attachment')}"
        try:
            upload_announcement_file(path, data, mime_type)
        except Exception as exc:
            raise HTTPException(503, "File upload failed") from exc
        row.attachment_path, row.attachment_name = path, os.path.basename(attachment.filename or "attachment")
        row.attachment_mime_type, row.attachment_size = mime_type, len(data)
    db.query(UserNotification).filter(UserNotification.dedupe_key == f"announcement:{row.id}").delete(synchronize_session=False)
    recipient_count = _notify_course(db, row, course)
    db.commit()
    db.refresh(row)
    result = announcement_dict(row)
    result["recipient_count"] = recipient_count
    return result


@router.get("/me/course-announcements/{announcement_id}/attachment")
def lecturer_announcement_attachment(announcement_id: str, db: Session = Depends(get_db), current_user: User = Depends(require_lecturer)):
    row = _owned_announcement(db, announcement_id, current_user.id)
    if not row.attachment_path:
        raise HTTPException(404, "Attachment not found")
    try:
        data = download_announcement_file(row.attachment_path)
    except Exception as exc:
        raise HTTPException(503, "Download failed") from exc
    return Response(data, media_type=row.attachment_mime_type or "application/octet-stream", headers={
        "Content-Disposition": f'attachment; filename="{row.attachment_name or "attachment"}"'
    })
