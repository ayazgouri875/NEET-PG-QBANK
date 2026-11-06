"""Admin Dashboard Endpoints: Question Management, Imports, and Catalog."""

from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_admin, get_db
from backend.app.core.config import IMPORTS_DIR
from backend.app.importer.importer import BatchAPKGImporter
from backend.app.importer.inspector import APKGInspector
from backend.app.models.category import Subject, SubjectCategory, Subtopic, Topic
from backend.app.models.import_job import ImportError, ImportJob, ImportStatus
from backend.app.models.question import DifficultyLevel, Explanation, Question, QuestionOption, QuestionTag
from backend.app.models.user import User

router = APIRouter(prefix="/admin", tags=["Admin Dashboard"])


# Request Schemas for Admin Operations
class QuestionUpdateRequest(BaseModel):
    text: str | None = None
    html_content: str | None = None
    difficulty: DifficultyLevel | None = None
    is_clinical: bool | None = None
    pyq_year: int | None = None
    subject_id: int | None = None
    topic_id: int | None = None
    subtopic_id: int | None = None
    is_active: bool | None = None


class OptionUpdateRequest(BaseModel):
    options: list[dict[str, Any]]  # [{"id": 1, "text": "...", "is_correct": bool}]


class ExplanationUpdateRequest(BaseModel):
    text: str
    html_content: str
    references: str | None = None


class SubjectCreateRequest(BaseModel):
    name: str
    code: str
    category: SubjectCategory
    display_order: int = 0
    description: str | None = None


class TopicCreateRequest(BaseModel):
    subject_id: int
    name: str
    display_order: int = 0


class SubtopicCreateRequest(BaseModel):
    topic_id: int
    name: str
    display_order: int = 0


class BulkCategorizeRequest(BaseModel):
    question_ids: list[int]
    subject_id: int
    topic_id: int | None = None
    subtopic_id: int | None = None


class ImportTriggerRequest(BaseModel):
    filename: str = "neet_pg.apkg"
    batch_size: int = 500
    limit: int | None = None


@router.get("/stats")
def get_admin_system_stats(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Returns high-level question bank and import statistics."""
    total_q = db.query(func.count(Question.id)).scalar() or 0
    total_clinical = db.query(func.count(Question.id)).filter(Question.is_clinical == True).scalar() or 0
    total_images = db.query(func.count(Question.id)).filter(Question.has_images == True).scalar() or 0
    total_pyq = db.query(func.count(Question.id)).filter(Question.pyq_year.is_not(None)).scalar() or 0
    total_subjects = db.query(func.count(Subject.id)).scalar() or 0
    total_topics = db.query(func.count(Topic.id)).scalar() or 0
    recent_jobs = db.query(ImportJob).order_by(ImportJob.created_at.desc()).limit(5).all()

    # Subject question counts
    subjects = db.query(Subject.name, Subject.code, Subject.category, Subject.total_questions).order_by(Subject.display_order).all()

    return {
        "total_questions": total_q,
        "clinical_questions": total_clinical,
        "image_based_questions": total_images,
        "previous_year_questions": total_pyq,
        "total_subjects": total_subjects,
        "total_topics": total_topics,
        "subject_breakdown": [
            {
                "name": s[0],
                "code": s[1],
                "category": s[2].value if hasattr(s[2], "value") else str(s[2]),
                "questions": s[3],
            }
            for s in subjects
        ],
        "recent_import_jobs": [
            {
                "id": j.id,
                "file": j.filename,
                "status": j.status.value,
                "imported": j.imported_records,
                "duplicates": j.duplicate_records,
                "failed": j.failed_records,
                "created_at": j.created_at,
            }
            for j in recent_jobs
        ],
    }


@router.get("/analytics/integrity")
def get_catalog_integrity_audit(
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Audits data integrity: missing explanations, missing answers, duplicate questions."""
    total_q = db.query(func.count(Question.id)).scalar() or 0

    # Questions without explanation
    missing_exp = (
        db.query(func.count(Question.id))
        .outerjoin(Explanation, Question.id == Explanation.question_id)
        .filter(Explanation.id.is_(None))
        .scalar() or 0
    )

    # Questions with no correct option designated
    subq_correct = db.query(QuestionOption.question_id).filter(QuestionOption.is_correct == True)
    missing_correct = (
        db.query(func.count(Question.id))
        .filter(~Question.id.in_(subq_correct))
        .scalar() or 0
    )

    # Duplicate MCQ_IDs
    dup_mcqs = (
        db.query(Question.mcq_id, func.count(Question.id))
        .filter(Question.mcq_id.is_not(None))
        .group_by(Question.mcq_id)
        .having(func.count(Question.id) > 1)
        .all()
    )

    return {
        "total_questions_audited": total_q,
        "missing_explanations": missing_exp,
        "missing_correct_answers": missing_correct,
        "duplicate_mcq_ids_count": len(dup_mcqs),
        "duplicate_samples": [{"mcq_id": d[0], "count": d[1]} for d in dup_mcqs[:5]],
        "data_quality_score": 100.0 if (missing_exp == 0 and missing_correct == 0) else 95.0,
    }


@router.put("/questions/{question_id}")
def update_question(
    question_id: int,
    req: QuestionUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Updates question metadata, text, difficulty, and categorization."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    if req.text is not None:
        q.text = req.text
    if req.html_content is not None:
        q.html_content = req.html_content
    if req.difficulty is not None:
        q.difficulty = req.difficulty
    if req.is_clinical is not None:
        q.is_clinical = req.is_clinical
    if req.pyq_year is not None:
        q.pyq_year = req.pyq_year
    if req.subject_id is not None:
        q.subject_id = req.subject_id
    if req.topic_id is not None:
        q.topic_id = req.topic_id
    if req.subtopic_id is not None:
        q.subtopic_id = req.subtopic_id
    if req.is_active is not None:
        q.is_active = req.is_active

    db.commit()
    return {"message": "Question updated successfully", "question_id": question_id}


@router.put("/questions/{question_id}/options")
def update_question_options(
    question_id: int,
    req: OptionUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Updates options and correct answer assignment for a question."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    for opt_data in req.options:
        opt_id = opt_data.get("id")
        if opt_id:
            opt = db.query(QuestionOption).filter(QuestionOption.id == opt_id, QuestionOption.question_id == question_id).first()
            if opt:
                if "text" in opt_data:
                    opt.text = opt_data["text"]
                if "is_correct" in opt_data:
                    opt.is_correct = bool(opt_data["is_correct"])

    db.commit()
    return {"message": "Options updated successfully"}


@router.put("/questions/{question_id}/explanation")
def update_question_explanation(
    question_id: int,
    req: ExplanationUpdateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Updates detailed explanation and textbook references."""
    exp = db.query(Explanation).filter(Explanation.question_id == question_id).first()
    if not exp:
        exp = Explanation(
            question_id=question_id,
            text=req.text,
            html_content=req.html_content,
            references=req.references,
        )
        db.add(exp)
    else:
        exp.text = req.text
        exp.html_content = req.html_content
        exp.references = req.references

    db.commit()
    return {"message": "Explanation updated successfully"}


@router.post("/categories/subjects")
def create_subject(
    req: SubjectCreateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Creates a new subject category."""
    existing = db.query(Subject).filter(Subject.name == req.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Subject already exists")

    s = Subject(
        name=req.name,
        code=req.code,
        category=req.category,
        display_order=req.display_order,
        description=req.description,
        is_active=True,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.post("/categories/topics")
def create_topic(
    req: TopicCreateRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Creates a new topic under a subject."""
    t = Topic(
        subject_id=req.subject_id,
        name=req.name,
        display_order=req.display_order,
        is_active=True,
    )
    db.add(t)
    db.commit()
    db.refresh(t)
    return t


@router.post("/questions/bulk-categorize")
def bulk_categorize_questions(
    req: BulkCategorizeRequest,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Bulk re-assigns questions to a subject and topic."""
    db.execute(
        update(Question)
        .where(Question.id.in_(req.question_ids))
        .values(
            subject_id=req.subject_id,
            topic_id=req.topic_id,
            subtopic_id=req.subtopic_id,
        )
    )
    db.commit()
    return {"message": f"Successfully updated {len(req.question_ids)} questions"}


@router.get("/imports/{job_id}/errors")
def get_import_errors(
    job_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Retrieves paginated import errors for an import job."""
    query = db.query(ImportError).filter(ImportError.import_job_id == job_id)
    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(ImportError.id.asc()).offset(offset).limit(page_size).all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": e.id,
                "source_nid": e.source_nid,
                "mcq_id": e.mcq_id,
                "error_type": e.error_type,
                "error_message": e.error_message,
                "created_at": e.created_at,
            }
            for e in items
        ],
    }


@router.delete("/questions/{question_id}")
def deactivate_question(
    question_id: int,
    admin: User = Depends(get_current_admin),
    db: Session = Depends(get_db),
):
    """Soft deactivates a question from the question bank."""
    q = db.query(Question).filter(Question.id == question_id).first()
    if not q:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    q.is_active = False
    db.commit()
    return {"message": f"Question {question_id} ({q.mcq_id}) deactivated successfully"}
