"""Performance Analytics and Revision Recommendation Endpoints."""

from collections import defaultdict
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import case, func
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.category import Subject, Topic
from backend.app.models.question import Question
from backend.app.models.test import SessionStatus, TestSession, UserPerformance, UserResponse
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

    # Topic-wise weak areas (lowest accuracy, minimum 5 attempts)
    topic_stats = (
        db.query(
            Topic.id,
            Topic.name,
            Subject.id,
            Subject.name,
            func.count(UserResponse.id).label("attempted"),
            func.sum(case((UserResponse.is_correct == True, 1), else_=0)).label("correct"),
        )
        .join(Question, UserResponse.question_id == Question.id)
        .join(Topic, Question.topic_id == Topic.id)
        .join(Subject, Topic.subject_id == Subject.id)
        .filter(
            UserResponse.user_id == current_user.id,
            UserResponse.selected_option_index.is_not(None),
        )
        .group_by(Topic.id, Subject.id)
        .all()
    )

    weak_topics = []
    for t_id, t_name, s_id, s_name, att, corr in topic_stats:
        att = att or 0
        corr = corr or 0
        if att >= 5:
            t_acc = round((corr / att) * 100.0, 1)
            weak_topics.append({
                "topic_id": t_id,
                "topic_name": t_name,
                "subject_id": s_id,
                "subject_name": s_name,
                "attempted": att,
                "correct": corr,
                "accuracy": t_acc,
            })
    weak_topics.sort(key=lambda x: (x["accuracy"], -x["attempted"]))
    weak_topics = weak_topics[:8]

    # Daily activity heatmap & time-per-question trend (last 90 days)
    day_buckets: dict[str, dict[str, int]] = defaultdict(lambda: {"count": 0, "correct": 0, "time_sum": 0})
    cutoff = datetime.now(timezone.utc).date() - timedelta(days=89)
    for r in responses:
        if r.answered_at:
            d_obj = r.answered_at.date() if isinstance(r.answered_at, datetime) else r.answered_at
            if d_obj >= cutoff:
                d_key = d_obj.isoformat()
                day_buckets[d_key]["count"] += 1
                if r.is_correct:
                    day_buckets[d_key]["correct"] += 1
                day_buckets[d_key]["time_sum"] += r.time_spent_seconds or 0

    daily_activity = [
        {
            "date": d_key,
            "count": vals["count"],
            "correct": vals["correct"],
            "avg_time_seconds": round(vals["time_sum"] / vals["count"], 1) if vals["count"] > 0 else 0.0,
        }
        for d_key, vals in sorted(day_buckets.items())
    ]

    return {
        "total_attempted": total_attempted,
        "total_correct": total_correct,
        "total_incorrect": total_incorrect,
        "overall_accuracy": round(accuracy, 1),
        "total_time_seconds": total_time,
        "avg_seconds_per_question": round(avg_time, 1),
        "weak_subjects": weak_subjects,
        "subject_breakdown": subjects_data,
        "weak_topics": weak_topics,
        "daily_activity": daily_activity,
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


@router.get("/study-summary")
def get_study_summary(
    daily_target: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Returns daily study goal progress, active streak days, and last practiced subject/topic."""
    responses = (
        db.query(
            UserResponse.question_id,
            UserResponse.is_correct,
            UserResponse.answered_at,
            UserResponse.test_session_id,
        )
        .filter(
            UserResponse.user_id == current_user.id,
            UserResponse.selected_option_index.is_not(None),
        )
        .order_by(UserResponse.answered_at.desc())
        .all()
    )

    today = datetime.now(timezone.utc).date()
    active_dates: set[date] = set()
    attempted_today = 0
    solved_today = 0

    for _, is_correct, answered_at, _ in responses:
        if not answered_at:
            continue
        ans_date = answered_at.date() if isinstance(answered_at, datetime) else answered_at
        active_dates.add(ans_date)
        if ans_date == today:
            attempted_today += 1
            if is_correct:
                solved_today += 1

    # Compute consecutive study streak ending today or yesterday
    streak_days = 0
    cursor = today if today in active_dates else (today - timedelta(days=1))
    while cursor in active_dates:
        streak_days += 1
        cursor -= timedelta(days=1)

    continue_from = None
    if responses:
        latest_qid, _, latest_at, latest_sess_id = responses[0]
        latest_q = db.query(Question).filter(Question.id == latest_qid).first()
        if latest_q and latest_q.subject_id:
            subj = db.query(Subject).filter(Subject.id == latest_q.subject_id).first()
            topic = db.query(Topic).filter(Topic.id == latest_q.topic_id).first() if latest_q.topic_id else None

            subj_solved_count = (
                db.query(func.count(func.distinct(UserResponse.question_id)))
                .join(Question, UserResponse.question_id == Question.id)
                .filter(
                    UserResponse.user_id == current_user.id,
                    UserResponse.is_correct == True,
                    Question.subject_id == latest_q.subject_id,
                )
                .scalar()
                or 0
            )

            active_sess = None
            if latest_sess_id:
                cand = (
                    db.query(TestSession)
                    .filter(
                        TestSession.id == latest_sess_id,
                        TestSession.user_id == current_user.id,
                        TestSession.status == SessionStatus.IN_PROGRESS,
                    )
                    .first()
                )
                if cand and cand.test_type != "practice_hub":
                    active_sess = cand

            if subj:
                continue_from = {
                    "subject_id": subj.id,
                    "subject_name": subj.name,
                    "subject_code": subj.code,
                    "topic_id": topic.id if topic else None,
                    "topic_name": topic.name if topic else None,
                    "questions_solved": subj_solved_count,
                    "total_subject_questions": subj.total_questions,
                    "active_session_id": active_sess.id if active_sess else None,
                    "active_session_title": active_sess.title if active_sess else None,
                    "last_activity_at": latest_at.isoformat() if latest_at else None,
                }

    return {
        "daily_goal": {
            "attempted_today": attempted_today,
            "solved_today": solved_today,
            "target": max(5, min(200, daily_target)),
        },
        "streak_days": streak_days,
        "continue_from": continue_from,
    }


