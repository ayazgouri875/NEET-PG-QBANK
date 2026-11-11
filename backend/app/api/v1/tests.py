"""MCQ Test Engine and Custom Test Generator Endpoints."""

from datetime import datetime, timezone
import random
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.question import Question, QuestionOption
from backend.app.models.test import (
    Bookmark,
    SessionStatus,
    TestMode,
    TestQuestion,
    TestSession,
    UserPerformance,
    UserResponse,
)
from backend.app.models.user import User
from backend.app.schemas.test import (
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TestCreateRequest,
    TestSessionDetailOut,
    TestSessionOut,
    TestSessionResponseItem,
)

router = APIRouter(prefix="/tests", tags=["Test Engine & Generator"])


@router.post("/custom", response_model=TestSessionOut, status_code=status.HTTP_201_CREATED)
def create_custom_test(
    test_in: TestCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generates a customized NEET PG MCQ test session without duplicate questions."""
    query = db.query(Question.id).filter(Question.is_active == True)

    if test_in.question_ids:
        valid_ids = [
            r[0]
            for r in db.query(Question.id)
            .filter(Question.is_active == True, Question.id.in_(test_in.question_ids))
            .all()
        ]
        if not valid_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="None of the requested questions were found.",
            )
        selected_question_ids = valid_ids[: test_in.question_count]
        sample_size = len(selected_question_ids)
    else:
        if test_in.subject_ids:
            query = query.filter(Question.subject_id.in_(test_in.subject_ids))
        if test_in.topic_ids:
            query = query.filter(Question.topic_id.in_(test_in.topic_ids))
        if test_in.subtopic_ids:
            query = query.filter(Question.subtopic_id.in_(test_in.subtopic_ids))
        if test_in.difficulty:
            query = query.filter(Question.difficulty == test_in.difficulty)

        # Filter status logic
        if test_in.filter_status == "unattempted":
            attempted_subq = db.query(UserResponse.question_id).filter(UserResponse.user_id == current_user.id)
            query = query.filter(~Question.id.in_(attempted_subq))
        elif test_in.filter_status == "incorrect":
            incorrect_subq = (
                db.query(UserResponse.question_id)
                .filter(UserResponse.user_id == current_user.id, UserResponse.is_correct == False)
            )
            query = query.filter(Question.id.in_(incorrect_subq))
        elif test_in.filter_status == "bookmarked":
            bm_subq = db.query(Bookmark.question_id).filter(Bookmark.user_id == current_user.id)
            query = query.filter(Question.id.in_(bm_subq))

        all_matching_ids = [r[0] for r in query.all()]
        if not all_matching_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No questions match the selected criteria. Try adjusting filters.",
            )

        # True random sampling avoiding duplicate questions
        sample_size = min(test_in.question_count, len(all_matching_ids))
        selected_question_ids = random.sample(all_matching_ids, sample_size)

    # Create TestSession entity
    session = TestSession(
        user_id=current_user.id,
        title=test_in.title,
        test_type=test_in.test_type,
        test_mode=test_in.test_mode,
        status=SessionStatus.IN_PROGRESS,
        total_questions=sample_size,
        duration_minutes=test_in.duration_minutes,
        is_timed=test_in.is_timed,
        marks_per_correct=4.0,
        negative_marks_per_wrong=1.0,
        score=0.0,
        correct_count=0,
        incorrect_count=0,
        skipped_count=0,
        accuracy_percentage=0.0,
        started_at=datetime.now(timezone.utc),
    )
    db.add(session)
    db.flush()

    # Assign TestQuestions in sequential order
    for idx, q_id in enumerate(selected_question_ids, 1):
        db.add(
            TestQuestion(
                test_session_id=session.id,
                question_id=q_id,
                question_order=idx,
                is_marked_for_review=False,
            )
        )

    db.commit()
    db.refresh(session)
    return session


def _build_session_detail(session: TestSession, db: Session) -> TestSessionDetailOut:
    """Hydrates ordered questions, explanations, marked IDs, and saved responses for a TestSession."""
    test_questions = (
        db.query(TestQuestion)
        .filter(TestQuestion.test_session_id == session.id)
        .order_by(TestQuestion.question_order.asc())
        .all()
    )
    q_ids = [tq.question_id for tq in test_questions]
    marked_ids = [tq.question_id for tq in test_questions if tq.is_marked_for_review]

    questions = (
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
        .filter(Question.id.in_(q_ids))
        .all()
    ) if q_ids else []

    q_map = {}
    for q in questions:
        if q.subject:
            q.subject_name = q.subject.name
        if q.topic:
            q.topic_name = q.topic.name
        if q.subtopic:
            q.subtopic_name = q.subtopic.name
        q_map[q.id] = q
    ordered_questions = [q_map[qid] for qid in q_ids if qid in q_map]

    saved_responses = (
        db.query(UserResponse)
        .filter(UserResponse.test_session_id == session.id)
        .all()
    )
    reveal_answers = (session.test_mode == TestMode.PRACTICE) or (session.status == SessionStatus.COMPLETED)

    response_items: list[TestSessionResponseItem] = []
    for ur in saved_responses:
        q_obj = q_map.get(ur.question_id)
        correct_idx = None
        exp_html = None
        ref_txt = None
        if reveal_answers and q_obj:
            correct_opt = next((o for o in q_obj.options if o.is_correct), None)
            correct_idx = correct_opt.option_index if correct_opt else 0
            exp_html = q_obj.explanation.html_content if q_obj.explanation else None
            ref_txt = q_obj.explanation.references if q_obj.explanation else None
        response_items.append(
            TestSessionResponseItem(
                question_id=ur.question_id,
                selected_option_index=ur.selected_option_index,
                is_correct=ur.is_correct,
                correct_option_index=correct_idx,
                explanation=exp_html,
                references=ref_txt,
                time_spent_seconds=ur.time_spent_seconds,
            )
        )

    res = TestSessionDetailOut.model_validate(session)
    res.questions = ordered_questions
    res.responses = response_items
    res.marked_question_ids = marked_ids
    return res


@router.get("/{session_id}", response_model=TestSessionDetailOut)
def get_test_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves an active or completed test session with ordered questions and auto-saved responses."""
    session = (
        db.query(TestSession)
        .filter(TestSession.id == session_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test session not found")

    return _build_session_detail(session, db)


@router.patch("/{session_id}/mark/{question_id}")
def toggle_mark_for_review(
    session_id: int,
    question_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggles mark-for-review state on a question inside a test session."""
    session = (
        db.query(TestSession)
        .filter(TestSession.id == session_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test session not found")

    tq = (
        db.query(TestQuestion)
        .filter(TestQuestion.test_session_id == session.id, TestQuestion.question_id == question_id)
        .first()
    )
    if not tq:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not in session")

    tq.is_marked_for_review = not tq.is_marked_for_review
    db.commit()
    return {"question_id": question_id, "marked": tq.is_marked_for_review}


@router.post("/{session_id}/answer", response_model=SubmitAnswerResponse)
def submit_question_answer(
    session_id: int,
    answer_in: SubmitAnswerRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Submits or updates an answer to a question in a test session."""
    session = (
        db.query(TestSession)
        .filter(TestSession.id == session_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test session not found")
    if session.status != SessionStatus.IN_PROGRESS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Test session is already completed")

    # Get question with options and explanation
    question = (
        db.query(Question)
        .options(joinedload(Question.options), joinedload(Question.explanation))
        .filter(Question.id == answer_in.question_id)
        .first()
    )
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    # Determine correct option
    correct_opt = next((o for o in question.options if o.is_correct), None)
    correct_idx = correct_opt.option_index if correct_opt else 0
    is_correct = (answer_in.selected_option_index == correct_idx) if answer_in.selected_option_index is not None else False

    # Check existing response or create new
    existing_resp = (
        db.query(UserResponse)
        .filter(
            UserResponse.test_session_id == session.id,
            UserResponse.question_id == question.id,
        )
        .first()
    )

    if existing_resp:
        existing_resp.selected_option_index = answer_in.selected_option_index
        existing_resp.is_correct = is_correct
        existing_resp.time_spent_seconds += answer_in.time_spent_seconds
        existing_resp.answered_at = datetime.now(timezone.utc)
    else:
        new_resp = UserResponse(
            user_id=current_user.id,
            test_session_id=session.id,
            question_id=question.id,
            selected_option_index=answer_in.selected_option_index,
            is_correct=is_correct,
            time_spent_seconds=answer_in.time_spent_seconds,
            answered_at=datetime.now(timezone.utc),
        )
        db.add(new_resp)

    db.commit()

    # Practice mode: reveal explanation immediately. Exam mode: conceal until completion.
    exp_text = None
    ref_text = None
    if session.test_mode == TestMode.PRACTICE:
        exp_text = question.explanation.html_content if question.explanation else None
        ref_text = question.explanation.references if question.explanation else None

    return SubmitAnswerResponse(
        question_id=question.id,
        selected_option_index=answer_in.selected_option_index,
        is_correct=is_correct,
        correct_option_index=correct_idx,
        explanation=exp_text,
        references=ref_text,
    )


@router.post("/{session_id}/complete", response_model=TestSessionDetailOut)
def complete_test_session(
    session_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Finalizes test session, computes scores, negative marking, and updates analytics."""
    session = (
        db.query(TestSession)
        .filter(TestSession.id == session_id, TestSession.user_id == current_user.id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Test session not found")

    responses = (
        db.query(UserResponse)
        .filter(UserResponse.test_session_id == session.id)
        .all()
    )

    correct = sum(1 for r in responses if r.is_correct)
    incorrect = sum(1 for r in responses if not r.is_correct and r.selected_option_index is not None)
    skipped = session.total_questions - (correct + incorrect)
    total_time = sum(r.time_spent_seconds for r in responses)

    # Standard NEET PG scoring: +4 per correct, -1 per incorrect
    score = (correct * session.marks_per_correct) - (incorrect * session.negative_marks_per_wrong)
    attempted = correct + incorrect
    accuracy = (correct / attempted * 100.0) if attempted > 0 else 0.0

    session.correct_count = correct
    session.incorrect_count = incorrect
    session.skipped_count = skipped
    session.score = score
    session.accuracy_percentage = accuracy
    session.total_time_seconds = total_time
    session.status = SessionStatus.COMPLETED
    session.completed_at = datetime.now(timezone.utc)

    # Update UserPerformance records
    for r in responses:
        q = db.query(Question.subject_id, Question.topic_id).filter(Question.id == r.question_id).first()
        if not q:
            continue
        subj_id, top_id = q[0], q[1]

        perf = (
            db.query(UserPerformance)
            .filter(
                UserPerformance.user_id == current_user.id,
                UserPerformance.subject_id == subj_id,
                UserPerformance.topic_id == top_id,
            )
            .first()
        )
        if not perf:
            perf = UserPerformance(
                user_id=current_user.id,
                subject_id=subj_id,
                topic_id=top_id,
                total_attempted=0,
                total_correct=0,
                total_incorrect=0,
                total_time_seconds=0,
                accuracy_percentage=0.0,
            )
            db.add(perf)

        perf.total_attempted += 1
        if r.is_correct:
            perf.total_correct += 1
        else:
            perf.total_incorrect += 1
        perf.total_time_seconds += r.time_spent_seconds
        perf.accuracy_percentage = (perf.total_correct / perf.total_attempted) * 100.0

    db.commit()
    db.refresh(session)
    return _build_session_detail(session, db)

