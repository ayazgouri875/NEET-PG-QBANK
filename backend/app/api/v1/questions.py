"""Question Bank Retrieval, LeetCode-style Problem Set, and Attempted Questions Endpoints."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.category import Subject
from backend.app.models.question import DifficultyLevel, Question
from backend.app.models.test import (
    SessionStatus,
    TestMode,
    TestType,
    TestSession,
    UserPerformance,
    UserResponse,
)
from backend.app.models.user import User
from backend.app.schemas.question import (
    AttemptedQuestionItem,
    AttemptedQuestionsStats,
    PaginatedAttemptedQuestions,
    PaginatedQuestions,
    QuestionDetailOut,
    QuestionOut,
    QuestionUserStatus,
    SolveQuestionRequest,
    SolveQuestionResponse,
)

router = APIRouter(prefix="/questions", tags=["Questions"])


def get_or_create_practice_session(user_id: int, db: Session) -> TestSession:
    """Gets or creates a persistent self-study test session for direct question solving."""
    session = (
        db.query(TestSession)
        .filter(TestSession.user_id == user_id, TestSession.title == "Self-Study Practice Drill")
        .first()
    )
    if not session:
        session = TestSession(
            user_id=user_id,
            title="Self-Study Practice Drill",
            test_type=TestType.CUSTOM,
            test_mode=TestMode.PRACTICE,
            status=SessionStatus.IN_PROGRESS,
            total_questions=0,
            is_timed=False,
            started_at=datetime.now(timezone.utc),
        )
        db.add(session)
        db.flush()
    return session


@router.get("/", response_model=PaginatedQuestions)
def search_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: int | None = Query(None),
    topic_id: int | None = Query(None),
    subtopic_id: int | None = Query(None),
    difficulty: DifficultyLevel | None = Query(None),
    status_filter: str | None = Query(None, description="'all', 'attempted', 'solved', 'incorrect', 'unattempted'"),
    is_clinical: bool | None = Query(None),
    has_images: bool | None = Query(None),
    pyq_year: int | None = Query(None),
    q: str | None = Query(None, description="Full-text search query across question content"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves paginated questions matching medical filter criteria with LeetCode-style user attempt statuses."""
    query = (
        db.query(Question)
        .options(
            joinedload(Question.options),
            joinedload(Question.images),
            joinedload(Question.tags),
            joinedload(Question.subject),
            joinedload(Question.topic),
            joinedload(Question.subtopic),
        )
        .filter(Question.is_active == True)
    )

    if subject_id:
        query = query.filter(Question.subject_id == subject_id)
    if topic_id:
        query = query.filter(Question.topic_id == topic_id)
    if subtopic_id:
        query = query.filter(Question.subtopic_id == subtopic_id)
    if difficulty:
        query = query.filter(Question.difficulty == difficulty)
    if is_clinical is not None:
        query = query.filter(Question.is_clinical == is_clinical)
    if has_images is not None:
        query = query.filter(Question.has_images == has_images)
    if pyq_year:
        query = query.filter(Question.pyq_year == pyq_year)
    if q:
        query = query.filter(Question.text.ilike(f"%{q}%"))

    # Status filter logic (LeetCode-style solved/attempted/unattempted)
    if status_filter == "attempted":
        attempted_subq = db.query(UserResponse.question_id).filter(UserResponse.user_id == current_user.id)
        query = query.filter(Question.id.in_(attempted_subq))
    elif status_filter in ("solved", "correct"):
        solved_subq = db.query(UserResponse.question_id).filter(
            UserResponse.user_id == current_user.id, UserResponse.is_correct == True
        )
        query = query.filter(Question.id.in_(solved_subq))
    elif status_filter == "incorrect":
        incorrect_subq = db.query(UserResponse.question_id).filter(
            UserResponse.user_id == current_user.id, UserResponse.is_correct == False
        )
        query = query.filter(Question.id.in_(incorrect_subq))
    elif status_filter == "unattempted":
        attempted_subq = db.query(UserResponse.question_id).filter(UserResponse.user_id == current_user.id)
        query = query.filter(~Question.id.in_(attempted_subq))

    total = query.count()
    offset = (page - 1) * page_size
    items = query.order_by(Question.id.asc()).offset(offset).limit(page_size).all()

    # Populate user_status for each question in this page
    if items:
        q_ids = [item.id for item in items]
        user_responses = (
            db.query(UserResponse)
            .filter(UserResponse.user_id == current_user.id, UserResponse.question_id.in_(q_ids))
            .all()
        )
        resp_map = {r.question_id: r for r in user_responses}
        for item in items:
            if item.subject:
                item.subject_name = item.subject.name
            if item.topic:
                item.topic_name = item.topic.name
            if item.subtopic:
                item.subtopic_name = item.subtopic.name

            if item.id in resp_map:
                r = resp_map[item.id]
                item.user_status = QuestionUserStatus(
                    is_attempted=True,
                    is_correct=r.is_correct,
                    selected_option_index=r.selected_option_index,
                    answered_at=r.answered_at,
                )
            else:
                item.user_status = QuestionUserStatus(
                    is_attempted=False,
                    is_correct=False,
                    selected_option_index=None,
                    answered_at=None,
                )

    return PaginatedQuestions(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )


@router.get("/attempted", response_model=PaginatedAttemptedQuestions)
def get_attempted_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    status_filter: str | None = Query(None, description="'all', 'correct', 'incorrect'"),
    subject_id: int | None = Query(None),
    difficulty: DifficultyLevel | None = Query(None),
    q: str | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all questions attempted by the student with submitted answers, correctness, explanations, and stats."""
    base_query = (
        db.query(UserResponse)
        .join(Question, UserResponse.question_id == Question.id)
        .filter(UserResponse.user_id == current_user.id)
    )

    # Compute aggregate stats for the user across all attempts
    all_user_responses = (
        db.query(UserResponse, Question)
        .join(Question, UserResponse.question_id == Question.id)
        .filter(UserResponse.user_id == current_user.id)
        .all()
    )

    total_attempted = len(all_user_responses)
    total_correct = sum(1 for ur, q_obj in all_user_responses if ur.is_correct)
    total_incorrect = total_attempted - total_correct
    accuracy = (total_correct / total_attempted * 100.0) if total_attempted > 0 else 0.0
    easy_count = sum(1 for ur, q_obj in all_user_responses if q_obj.difficulty == DifficultyLevel.EASY)
    med_count = sum(1 for ur, q_obj in all_user_responses if q_obj.difficulty == DifficultyLevel.MEDIUM)
    hard_count = sum(1 for ur, q_obj in all_user_responses if q_obj.difficulty == DifficultyLevel.HARD)

    stats = AttemptedQuestionsStats(
        total_attempted=total_attempted,
        total_correct=total_correct,
        total_incorrect=total_incorrect,
        accuracy_percentage=round(accuracy, 1),
        easy_attempted=easy_count,
        medium_attempted=med_count,
        hard_attempted=hard_count,
    )

    # Filter by status
    filtered_query = base_query
    if status_filter in ("correct", "solved"):
        filtered_query = filtered_query.filter(UserResponse.is_correct == True)
    elif status_filter == "incorrect":
        filtered_query = filtered_query.filter(UserResponse.is_correct == False)

    if subject_id:
        filtered_query = filtered_query.filter(Question.subject_id == subject_id)
    if difficulty:
        filtered_query = filtered_query.filter(Question.difficulty == difficulty)
    if q:
        filtered_query = filtered_query.filter(Question.text.ilike(f"%{q}%"))

    total = filtered_query.count()
    offset = (page - 1) * page_size
    responses = (
        filtered_query.options(
            joinedload(UserResponse.question).joinedload(Question.options),
            joinedload(UserResponse.question).joinedload(Question.images),
            joinedload(UserResponse.question).joinedload(Question.tags),
            joinedload(UserResponse.question).joinedload(Question.explanation),
            joinedload(UserResponse.question).joinedload(Question.subject),
            joinedload(UserResponse.question).joinedload(Question.topic),
            joinedload(UserResponse.question).joinedload(Question.subtopic),
        )
        .order_by(UserResponse.answered_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = []
    labels = ["A", "B", "C", "D", "E", "F"]
    for resp in responses:
        q_obj = resp.question
        # Find correct option
        correct_opt = next((o for o in q_obj.options if o.is_correct), None)
        correct_idx = correct_opt.option_index if correct_opt else (q_obj.options[0].option_index if q_obj.options else 0)
        correct_lbl = labels[correct_idx] if correct_idx < len(labels) else str(correct_idx + 1)
        correct_txt = correct_opt.text if correct_opt else ""

        # Find selected option
        sel_opt = next((o for o in q_obj.options if o.option_index == resp.selected_option_index), None)
        sel_lbl = (
            labels[resp.selected_option_index]
            if (resp.selected_option_index is not None and resp.selected_option_index < len(labels))
            else None
        )
        sel_txt = sel_opt.text if sel_opt else None

        items.append(
            AttemptedQuestionItem(
                id=resp.id,
                question_id=q_obj.id,
                mcq_id=q_obj.mcq_id,
                text=q_obj.text,
                html_content=q_obj.html_content,
                subject_id=q_obj.subject_id,
                subject_name=q_obj.subject.name if q_obj.subject else None,
                topic_name=q_obj.topic.name if q_obj.topic else None,
                subtopic_name=q_obj.subtopic.name if q_obj.subtopic else None,
                difficulty=q_obj.difficulty,
                is_clinical=q_obj.is_clinical,
                has_images=q_obj.has_images,
                pyq_year=q_obj.pyq_year,
                selected_option_index=resp.selected_option_index,
                selected_option_label=sel_lbl,
                selected_option_text=sel_txt,
                is_correct=resp.is_correct,
                correct_option_index=correct_idx,
                correct_option_label=correct_lbl,
                correct_option_text=correct_txt,
                time_spent_seconds=resp.time_spent_seconds,
                answered_at=resp.answered_at,
                options=q_obj.options,
                images=q_obj.images,
                explanation=q_obj.explanation,
            )
        )

    return PaginatedAttemptedQuestions(
        total=total,
        page=page,
        page_size=page_size,
        stats=stats,
        items=items,
    )


@router.post("/{question_id}/solve", response_model=SolveQuestionResponse)
def solve_question_directly(
    question_id: int,
    solve_in: SolveQuestionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits an answer for an individual question directly (LeetCode-style solving)."""
    question = (
        db.query(Question)
        .options(joinedload(Question.options), joinedload(Question.explanation))
        .filter(Question.id == question_id, Question.is_active == True)
        .first()
    )
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    correct_opt = next((o for o in question.options if o.is_correct), None)
    correct_idx = correct_opt.option_index if correct_opt else (question.options[0].option_index if question.options else 0)
    is_correct = solve_in.selected_option_index == correct_idx

    session = get_or_create_practice_session(current_user.id, db)

    # Upsert UserResponse
    existing_resp = (
        db.query(UserResponse)
        .filter(
            UserResponse.test_session_id == session.id,
            UserResponse.question_id == question.id,
        )
        .first()
    )

    if existing_resp:
        existing_resp.selected_option_index = solve_in.selected_option_index
        existing_resp.is_correct = is_correct
        existing_resp.time_spent_seconds += solve_in.time_spent_seconds
        existing_resp.answered_at = datetime.now(timezone.utc)
    else:
        new_resp = UserResponse(
            user_id=current_user.id,
            test_session_id=session.id,
            question_id=question.id,
            selected_option_index=solve_in.selected_option_index,
            is_correct=is_correct,
            time_spent_seconds=solve_in.time_spent_seconds,
            answered_at=datetime.now(timezone.utc),
        )
        db.add(new_resp)

    # Update UserPerformance analytics for this subject/topic
    perf = (
        db.query(UserPerformance)
        .filter(
            UserPerformance.user_id == current_user.id,
            UserPerformance.subject_id == question.subject_id,
            UserPerformance.topic_id == question.topic_id,
        )
        .first()
    )
    if not perf:
        perf = UserPerformance(
            user_id=current_user.id,
            subject_id=question.subject_id,
            topic_id=question.topic_id,
            total_attempted=1,
            total_correct=1 if is_correct else 0,
            total_incorrect=0 if is_correct else 1,
            total_time_seconds=solve_in.time_spent_seconds,
            accuracy_percentage=100.0 if is_correct else 0.0,
        )
        db.add(perf)
    else:
        perf.total_attempted += 1
        if is_correct:
            perf.total_correct += 1
        else:
            perf.total_incorrect += 1
        perf.total_time_seconds += solve_in.time_spent_seconds
        if perf.total_attempted > 0:
            perf.accuracy_percentage = (perf.total_correct / perf.total_attempted) * 100.0

    db.commit()

    exp_html = question.explanation.html_content if question.explanation else None
    ref_text = question.explanation.references if question.explanation else None

    return SolveQuestionResponse(
        question_id=question.id,
        selected_option_index=solve_in.selected_option_index,
        is_correct=is_correct,
        correct_option_index=correct_idx,
        explanation=exp_html,
        references=ref_text,
    )


@router.get("/{question_id}", response_model=QuestionDetailOut)
def get_question_detail(question_id: int, db: Session = Depends(get_db)):
    """Retrieves a single question with options, explanation, textbook references, and images."""
    question = (
        db.query(Question)
        .options(
            joinedload(Question.options),
            joinedload(Question.images),
            joinedload(Question.tags),
            joinedload(Question.explanation),
            joinedload(Question.subject),
            joinedload(Question.topic),
            joinedload(Question.subtopic),
        )
        .filter(Question.id == question_id, Question.is_active == True)
        .first()
    )
    if not question:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Question not found",
        )
    if question.subject:
        question.subject_name = question.subject.name
    if question.topic:
        question.topic_name = question.topic.name
    if question.subtopic:
        question.subtopic_name = question.subtopic.name
    return question
