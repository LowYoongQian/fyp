import os
import re
import google.generativeai as genai
from sqlalchemy import text
from sqlalchemy.exc import ProgrammingError, OperationalError
from fastapi import APIRouter, HTTPException, Depends

from utils.security import require_lecturer
from utils.models import User
from utils.schemas import QueryRequest, QueryResponse
from utils.database import engine

# Gemini setup
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

model = genai.GenerativeModel(
    model_name="gemini-flash-lite-latest",
    generation_config={"temperature": 0.1, "max_output_tokens": 512}
)

router = APIRouter(prefix="/query", tags=["Intelligence"])

# Simplified Schema Description to feed Gemini
SCHEMA_CONTEXT = """
Database Tables:
1. users: id, email, role ('student', 'lecturer')
2. students: id, user_id, name, student_code, is_face_registered
3. lecturers: id, user_id, name, staff_id
4. courses: id, course_name, course_code, credit_hours (float, default 3.0), lecturer_id (ref lecturers.id)
5. enrolments: id, student_id (ref students.id), course_id (ref courses.id), semester, class_group
6. class_sessions: id, course_id (ref courses.id), opened_at, closed_at, is_open, class_group
7. attendance_records: id, student_id (ref students.id), session_id (ref class_sessions.id), status ('present', 'absent'), confidence_score, wifi_verified, liveness_passed, marked_at
8. risk_scores: id, student_id (ref students.id), course_id (ref courses.id), risk_score, risk_label ('low', 'medium', 'high'), attendance_rate
"""

# Security checking for query safety
FORBIDDEN_WORDS = ["INSERT", "UPDATE", "DELETE", "DROP", "ALTER", "TRUNCATE", "CREATE"]

def validate_sql(sql: str) -> tuple[bool, str]:
    clean = sql.strip().upper()
    if not clean.startswith("SELECT"):
        return False, "Only SELECT queries are allowed."
    for word in FORBIDDEN_WORDS:
        if re.search(rf"\b{word}\b", clean):
            return False, f"Forbidden keyword detected: {word}"
    if "PG_" in clean:
        return False, "Access to system tables is not allowed."
    if "INFORMATION_SCHEMA" in clean:
        return False, "Access to metadata is not allowed."
    return True, ""

# Hard cap on returned rows — an occasional admin query should never dump a
# whole table into memory (report §2.3.2: query feature is low-frequency).
_MAX_ROWS = 500

# Safe DB runner. Runs inside a READ ONLY transaction as defence-in-depth: even
# if a write somehow passed validate_sql, PostgreSQL itself rejects it.
def execute_sql(sql: str) -> list[dict]:
    with engine.connect().execution_options(postgresql_readonly=True) as conn:
        result = conn.execute(text(sql))
        rows = result.mappings().fetchmany(_MAX_ROWS)
        return [dict(r) for r in rows]

@router.post("/natural", response_model=QueryResponse)
def natural_query(body: QueryRequest, current_user: User = Depends(require_lecturer)):
    question = body.question.strip()
    
    # Anti chit-chat and data-modification filter prompt
    system_prompt = f"""
    You are an SQL generator. Translate this user question into a PostgreSQL SELECT query.
    {SCHEMA_CONTEXT}
    
    Join Guidelines:
    - Join attendance_records and class_sessions on: attendance_records.session_id = class_sessions.id
    - Join students and attendance_records on: students.id = attendance_records.student_id
    - Join courses and class_sessions on: class_sessions.course_id = courses.id
    - Join lecturers and courses on: courses.lecturer_id = lecturers.id
    
    Rules:
    1. Reply ONLY with the SQL code starting with SELECT.
    2. If the user question is a greeting or not related to the database, reply exactly: "I apologize, but I am only able to assist with database attendance queries."
    3. If the user question asks to insert, update, delete, drop, or modify data (e.g. delete students, add user, change role, clean records), you must NOT generate a SELECT query. Instead, reply exactly: "I apologize, but I am only able to assist with database attendance queries and do not support data modifications."
    """
    
    # 1. Ask Gemini to write SQL
    try:
        raw_res = model.generate_content(f"{system_prompt}\nUser: {question}").text.strip()
        # Extract SQL block starting with SELECT (handles any markdown or chatty prefixes)
        sql_match = re.search(r"(SELECT[\s\S]+)", raw_res, re.IGNORECASE)
        if sql_match:
            sql = sql_match.group(1).strip()
            # Clean up trailing markdown if any by splitting at the closing backticks
            if "```" in sql:
                sql = sql.split("```")[0].strip()
        else:
            sql = raw_res
    except Exception as e:
        return {"answer": f"LLM Connection Error: {str(e)}", "success": False}

    # 2. Check if it's chit-chat, rejection or code
    if not sql.upper().startswith("SELECT"):
        return {"answer": sql, "sql_used": None, "success": True}

    # 3. Validate and run SQL query
    is_safe, error_msg = validate_sql(sql)
    if not is_safe:
        raise HTTPException(status_code=400, detail=error_msg)

    try:
        rows = execute_sql(sql)
    except (ProgrammingError, OperationalError) as db_err:
        return {
            "answer": f"Failed to run query. Database error: {db_err.orig}",
            "sql_used": sql,
            "success": False
        }

    # 4. Synthesize human explanation
    summary_prompt = f"""
    Based on the user's question: "{question}", summarize these database results into a natural, user-friendly response.
    Results: {rows}
    
    Rules for response:
    - Keep the reply concise and professional.
    - Note: The database query executed was a read-only SELECT query. Do NOT state or imply that any data was added, updated, or deleted.
    """
    try:
        final_answer = model.generate_content(summary_prompt).text.strip()
    except Exception as e:
        final_answer = f"Data retrieved successfully but failed to summarize: {str(rows)}"

    return {
        "answer": final_answer,
        "sql_used": sql,
        "success": True,
        "row_count": len(rows)
    }
