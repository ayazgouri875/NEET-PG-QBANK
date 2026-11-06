"""Performance Analytics and Revision Recommendation Endpoints."""

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.category import Subject
from backend.app.models.question import Question
from backend.app.models.test import UserPerformance, UserResponse
from backend.app.models.user import User

router = APIRouter(prefix="/analytics", tags=["Performance Analytics"])


@router.get("/dashboard")
def get_analytics_dashboard(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Calculates student overview: accuracy, total attempts, weak areas, and time metrics."""
    responses = db.query(UserResponse).filter(UserResponse.user_id == current_user.id).all()

    total_attempted = len(responses)
    total_correct = sum(1 for r in responses if r.is_correct)
    total_incorrect = sum(1 for r in responses if not r.is_correct and r.selected_option_index is not None)
    accuracy = (total_correct / total_attempted * 100.0) if total_attempted > 0 else 0.0
    total_time = sum(r.time_spent_seconds for r in responses)
    avg_time = (total_time / total_attempted) if total_attempted > 0 else 0.0

    # Subject-wise aggregation
    subject_stats = (
        db.query(
            Subject.name,
            Subject.code,
            Subject.category,
            func.sum(UserPerformance.total_attempted).label("attempted"),
            func.sum(UserPerformance.total_correct).label("correct"),
            func.sum(UserPerformance.total_incorrect).label("incorrect"),
        )
        .join(UserPerformance, UserPerformance.subject_id == Subject.id)
        .filter(UserPerformance.user_id == current_user.id)
        .group_by(Subject.id)
        .all()
    )

    subjects_data = []
    weak_subjects = []

    for name, code, category, att, corr, incorr in subject_stats:
        att = att or 0
        corr = corr or 0
        incorr = incorr or 0
        subj_acc = (corr / att * 100.0) if att > 0 else 0.0
        item = {
            "subject": name,
            "code": code,
            "category": category.value if hasattr(category, "value") else str(category),
            "attempted": att,
            "correct": corr,
            "incorrect": incorr,
            "accuracy": round(subj_acc, 1),
        }
        subjects_data.append(item)
        if att >= 5 and subj_acc < 60.0:
            weak_subjects.append(name)

    return {
        "total_attempted": total_attempted,
        "total_correct": total_correct,
        "total_incorrect": total_incorrect,
        "overall_accuracy": round(accuracy, 1),
        "total_time_seconds": total_time,
        "avg_seconds_per_question": round(avg_time, 1),
        "weak_subjects": weak_subjects,
        "subject_breakdown": subjects_data,
    }


@router.get("/recommendations")
def get_revision_recommendations(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Provides personalized revision recommendations targeting weak subtopics and incorrect questions."""
    # Find top 5 topics with highest incorrect count
    incorrect_topics = (
        db.query(
            Question.topic_id,
            func.count(UserResponse.id).label("incorrect_count"),
        )
        .join(UserResponse, UserResponse.question_id == Question.id)
        .filter(
            UserResponse.user_id == current_user.id,
            UserResponse.is_correct == False,
            Question.topic_id.is_not(None),
        )
        .group_by(Question.topic_id)
        .order_by(func.count(UserResponse.id).desc())
        .limit(5)
        .all()
    )

    from backend.app.models.category import Topic
    recommendations = []
    for top_id, err_cnt in incorrect_topics:
        topic = db.query(Topic).filter(Topic.id == top_id).first()
        if topic:
            recommendations.append({
                "topic_id": topic.id,
                "topic_name": topic.name,
                "subject_name": topic.subject.name,
                "incorrect_attempts": err_cnt,
                "suggested_action": f"Reattempt {err_cnt} incorrect questions in {topic.name} ({topic.subject.name})",
            })

    return {
        "recommended_revision_modules": recommendations,
    }

