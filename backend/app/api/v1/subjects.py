"""Subjects, Topics, and Subtopics Hierarchy Endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import case, func
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.category import Subject, Topic, Subtopic
from backend.app.models.question import Question
from backend.app.models.test import UserResponse
from backend.app.models.user import User
from backend.app.schemas.category import SubjectDetailOut, SubjectOut, TopicOut, TopicUserProgress

router = APIRouter(prefix="/subjects", tags=["Subjects & Topics"])


@router.get("/", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db)):
    """Returns all 19 NEET PG subjects ordered by curriculum sequence."""
    return db.query(Subject).filter(Subject.is_active == True).order_by(Subject.display_order).all()


@router.get("/{subject_id}", response_model=SubjectDetailOut)
def get_subject_detail(subject_id: int, db: Session = Depends(get_db)):
    """Returns a subject with all its topics and subtopics."""
    subject = (
        db.query(Subject)
        .options(
            joinedload(Subject.topics).joinedload(Topic.subtopics)
        )
        .filter(Subject.id == subject_id, Subject.is_active == True)
        .first()
    )
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )
    return subject


@router.get("/{subject_id}/topics", response_model=list[TopicOut])
def list_subject_topics(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns all topics for a specific subject with user's solved/attempted metrics."""
    topics = (
        db.query(Topic)
        .options(joinedload(Topic.subtopics))
        .filter(Topic.subject_id == subject_id, Topic.is_active == True)
        .order_by(Topic.display_order)
        .all()
    )

    # Compute topic stats for current user
    topic_stats = (
        db.query(
            Question.topic_id,
            func.count(UserResponse.id).label("attempted"),
            func.sum(case((UserResponse.is_correct == True, 1), else_=0)).label("solved"),
        )
        .join(Question, UserResponse.question_id == Question.id)
        .filter(
            UserResponse.user_id == current_user.id,
            Question.subject_id == subject_id,
        )
        .group_by(Question.topic_id)
        .all()
    )

    stats_map = {
        t_id: {
            "attempted": att,
            "solved": sol or 0,
            "incorrect": (att - (sol or 0)),
            "accuracy_percentage": round(((sol or 0) / att * 100.0), 1) if att > 0 else 0.0,
        }
        for t_id, att, sol in topic_stats
    }

    # Compute subtopic stats for current user
    subtopic_stats = (
        db.query(
            Question.subtopic_id,
            func.count(UserResponse.id).label("attempted"),
            func.sum(case((UserResponse.is_correct == True, 1), else_=0)).label("solved"),
        )
        .join(Question, UserResponse.question_id == Question.id)
        .filter(
            UserResponse.user_id == current_user.id,
            Question.subject_id == subject_id,
            Question.subtopic_id.is_not(None),
        )
        .group_by(Question.subtopic_id)
        .all()
    )

    sub_stats_map = {
        s_id: {
            "attempted": att,
            "solved": sol or 0,
            "incorrect": (att - (sol or 0)),
            "accuracy_percentage": round(((sol or 0) / att * 100.0), 1) if att > 0 else 0.0,
        }
        for s_id, att, sol in subtopic_stats
    }

    res = []
    for t in topics:
        t_out = TopicOut.model_validate(t)
        if t.id in stats_map:
            t_out.user_progress = TopicUserProgress(**stats_map[t.id])
        else:
            t_out.user_progress = TopicUserProgress()

        for sub in t_out.subtopics:
            if sub.id in sub_stats_map:
                sub.user_progress = TopicUserProgress(**sub_stats_map[sub.id])
            else:
                sub.user_progress = TopicUserProgress()

        res.append(t_out)

    return res


