"""Pydantic schemas for Subject, Topic, and Subtopic hierarchies."""

from pydantic import BaseModel, ConfigDict
from backend.app.models.category import SubjectCategory


class TopicUserProgress(BaseModel):
    attempted: int = 0
    solved: int = 0
    incorrect: int = 0
    accuracy_percentage: float = 0.0


class SubtopicOut(BaseModel):
    id: int
    name: str
    display_order: int
    total_questions: int
    user_progress: TopicUserProgress | None = None

    model_config = ConfigDict(from_attributes=True)


class TopicOut(BaseModel):
    id: int
    subject_id: int
    name: str
    display_order: int
    total_questions: int
    subtopics: list[SubtopicOut] = []
    user_progress: TopicUserProgress | None = None

    model_config = ConfigDict(from_attributes=True)


class SubjectOut(BaseModel):
    id: int
    name: str
    code: str
    category: SubjectCategory
    display_order: int
    icon_name: str | None = None
    total_questions: int

    model_config = ConfigDict(from_attributes=True)


class SubjectDetailOut(SubjectOut):
    topics: list[TopicOut] = []

