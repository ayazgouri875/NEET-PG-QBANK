"""Pydantic schemas for Questions, Options, Images, and Filters."""

from datetime import datetime
from pydantic import BaseModel, ConfigDict
from backend.app.models.question import DifficultyLevel, ImageType


class QuestionOptionOut(BaseModel):
    id: int
    option_index: int
    option_label: str
    text: str
    html_content: str
    is_correct: bool = False  # Only revealed in practice mode or post-test review

    model_config = ConfigDict(from_attributes=True)


class QuestionImageOut(BaseModel):
    id: int
    image_type: ImageType
    filename: str
    url_or_path: str
    caption: str | None = None
    display_order: int

    model_config = ConfigDict(from_attributes=True)


class ExplanationOut(BaseModel):
    id: int
    html_content: str
    text: str
    references: str | None = None

    model_config = ConfigDict(from_attributes=True)


class QuestionTagOut(BaseModel):
    id: int
    tag_name: str

    model_config = ConfigDict(from_attributes=True)


class QuestionUserStatus(BaseModel):
    is_attempted: bool = False
    is_correct: bool = False
    selected_option_index: int | None = None
    answered_at: datetime | None = None
    is_bookmarked: bool = False


class QuestionOut(BaseModel):
    id: int
    mcq_id: str | None
    text: str
    html_content: str
    subject_id: int
    topic_id: int | None
    subtopic_id: int | None
    subject_name: str | None = None
    topic_name: str | None = None
    subtopic_name: str | None = None
    difficulty: DifficultyLevel
    is_clinical: bool
    has_images: bool
    is_multiple_correct: bool
    pyq_year: int | None
    options: list[QuestionOptionOut] = []
    images: list[QuestionImageOut] = []
    tags: list[QuestionTagOut] = []
    user_status: QuestionUserStatus | None = None

    model_config = ConfigDict(from_attributes=True)


class QuestionDetailOut(QuestionOut):
    explanation: ExplanationOut | None = None


class PaginatedQuestions(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[QuestionOut]


class AttemptedQuestionItem(BaseModel):
    id: int
    question_id: int
    mcq_id: str | None
    text: str
    html_content: str
    subject_id: int
    subject_name: str | None = None
    topic_name: str | None = None
    subtopic_name: str | None = None
    difficulty: DifficultyLevel
    is_clinical: bool
    has_images: bool
    pyq_year: int | None
    selected_option_index: int | None
    selected_option_label: str | None
    selected_option_text: str | None
    is_correct: bool
    correct_option_index: int
    correct_option_label: str
    correct_option_text: str
    time_spent_seconds: int
    answered_at: datetime
    options: list[QuestionOptionOut] = []
    images: list[QuestionImageOut] = []
    explanation: ExplanationOut | None = None


class AttemptedQuestionsStats(BaseModel):
    total_attempted: int
    total_correct: int
    total_incorrect: int
    accuracy_percentage: float
    easy_attempted: int
    medium_attempted: int
    hard_attempted: int


class AttemptedTrendPoint(BaseModel):
    date: str
    attempted: int
    correct: int
    accuracy: float


class PaginatedAttemptedQuestions(BaseModel):
    total: int
    page: int
    page_size: int
    stats: AttemptedQuestionsStats
    items: list[AttemptedQuestionItem]
    trend: list[AttemptedTrendPoint] = []


class QuestionReportRequest(BaseModel):
    reason: str
    details: str | None = None


class SolveQuestionRequest(BaseModel):
    selected_option_index: int
    time_spent_seconds: int = 10


class SolveQuestionResponse(BaseModel):
    question_id: int
    selected_option_index: int
    is_correct: bool
    correct_option_index: int
    explanation: str | None = None
    references: str | None = None


