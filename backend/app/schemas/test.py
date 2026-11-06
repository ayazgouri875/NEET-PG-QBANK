"""Pydantic schemas for Test Sessions, Question Navigation, and Responses."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict
from backend.app.models.test import SessionStatus, TestMode, TestType
from backend.app.schemas.question import QuestionDetailOut, QuestionOut


class TestCreateRequest(BaseModel):
    title: str = "Custom Practice Test"
    test_type: TestType = TestType.CUSTOM
    test_mode: TestMode = TestMode.PRACTICE
    subject_ids: list[int] = []
    topic_ids: list[int] = []
    subtopic_ids: list[int] = []
    question_count: int = 25
    is_timed: bool = False
    duration_minutes: int | None = None
    filter_status: str = "all"  # 'all', 'unattempted', 'incorrect', 'bookmarked'
    difficulty: str | None = None  # 'easy', 'medium', 'hard', or None for all


class SubmitAnswerRequest(BaseModel):
    question_id: int
    selected_option_index: int | None  # None if skipped
    time_spent_seconds: int = 0


class SubmitAnswerResponse(BaseModel):
    question_id: int
    selected_option_index: int | None
    is_correct: bool
    correct_option_index: int
    explanation: str | None = None  # Revealed immediately in practice mode
    references: str | None = None


class TestSessionOut(BaseModel):
    id: int
    user_id: int
    title: str
    test_type: TestType
    test_mode: TestMode
    status: SessionStatus
    total_questions: int
    duration_minutes: int | None
    is_timed: bool
    score: float
    correct_count: int
    incorrect_count: int
    skipped_count: int
    accuracy_percentage: float
    started_at: datetime
    completed_at: datetime | None

    model_config = ConfigDict(from_attributes=True)


class TestSessionDetailOut(TestSessionOut):
    questions: list[QuestionOut] = []


class BookmarkToggleRequest(BaseModel):
    question_id: int
    notes: str | None = None


class BookmarkOut(BaseModel):
    id: int
    question_id: int
    notes: str | None
    created_at: datetime
    question: QuestionOut

    model_config = ConfigDict(from_attributes=True)

