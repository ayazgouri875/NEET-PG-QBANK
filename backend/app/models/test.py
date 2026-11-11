import enum
from datetime import datetime, timezone
from sqlalchemy import String, Integer, Float, Boolean, Enum, ForeignKey, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, TimestampMixin


class TestMode(str, enum.Enum):
    PRACTICE = "practice"  # Instant explanation after submitting each question
    EXAM = "exam"          # Explanations hidden until test submission


class TestType(str, enum.Enum):
    CUSTOM = "custom"
    SUBJECT = "subject"
    TOPIC = "topic"
    GRAND = "grand"
    BOOKMARKED = "bookmarked"
    INCORRECT = "incorrect"


class SessionStatus(str, enum.Enum):
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class TestSession(Base, TimestampMixin):
    __tablename__ = "test_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    test_type: Mapped[TestType] = mapped_column(
        Enum(TestType, name="test_type_enum", native_enum=False),
        default=TestType.CUSTOM,
        nullable=False,
    )
    test_mode: Mapped[TestMode] = mapped_column(
        Enum(TestMode, name="test_mode_enum", native_enum=False),
        default=TestMode.PRACTICE,
        nullable=False,
    )
    status: Mapped[SessionStatus] = mapped_column(
        Enum(SessionStatus, name="session_status_enum", native_enum=False),
        default=SessionStatus.IN_PROGRESS,
        nullable=False,
        index=True,
    )

    # Configuration
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    duration_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Null if untimed
    is_timed: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    marks_per_correct: Mapped[float] = mapped_column(Float, default=4.0, nullable=False)
    negative_marks_per_wrong: Mapped[float] = mapped_column(Float, default=1.0, nullable=False)

    # Results & Summary
    score: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    incorrect_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accuracy_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Relationships
    user = relationship("User", back_populates="test_sessions")
    test_questions = relationship("TestQuestion", back_populates="test_session", cascade="all, delete-orphan", order_by="TestQuestion.question_order")
    responses = relationship("UserResponse", back_populates="test_session", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<TestSession id={self.id} user_id={self.user_id} title={self.title} status={self.status}>"


class TestQuestion(Base):
    __tablename__ = "test_questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    test_session_id: Mapped[int] = mapped_column(ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_order: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-based order in test
    is_marked_for_review: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    test_session = relationship("TestSession", back_populates="test_questions")
    question = relationship("Question", back_populates="test_questions")

    __table_args__ = (
        Index("ix_session_question_order", "test_session_id", "question_order", unique=True),
        Index("ix_session_question_unique", "test_session_id", "question_id", unique=True),
    )


class UserResponse(Base, TimestampMixin):
    __tablename__ = "user_responses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    test_session_id: Mapped[int] = mapped_column(ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)

    # Submission Data
    selected_option_index: Mapped[int | None] = mapped_column(Integer, nullable=True)  # Null if skipped
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    time_spent_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    answered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    user = relationship("User", back_populates="user_responses")
    test_session = relationship("TestSession", back_populates="responses")
    question = relationship("Question", back_populates="user_responses")

    __table_args__ = (
        Index("ix_user_question_response", "user_id", "question_id"),
        Index("ix_session_question_resp", "test_session_id", "question_id", unique=True),
    )


class Bookmark(Base, TimestampMixin):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    notes: Mapped[str | None] = mapped_column(String(500), nullable=True)  # Student personal revision notes

    # Relationships
    user = relationship("User", back_populates="bookmarks")
    question = relationship("Question", back_populates="bookmarks")

    __table_args__ = (
        Index("ix_user_question_bookmark", "user_id", "question_id", unique=True),
    )


class UserPerformance(Base, TimestampMixin):
    """Aggregated subject and topic-wise analytics for fast Marrow-style dashboard rendering."""
    __tablename__ = "user_performance"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=True, index=True)

    total_attempted: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_correct: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_incorrect: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    total_time_seconds: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accuracy_percentage: Mapped[float] = mapped_column(Float, default=0.0, nullable=False)

    # Relationships
    user = relationship("User", back_populates="performances")
    subject = relationship("Subject", back_populates="user_performances")
    topic = relationship("Topic", back_populates="user_performances")

    __table_args__ = (
        Index("ix_user_subject_topic_perf", "user_id", "subject_id", "topic_id", unique=True),
    )


class QuestionReport(Base, TimestampMixin):
    """Stores student-submitted error/typo reports for specific questions."""
    __tablename__ = "question_reports"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(120), nullable=False)
    details: Mapped[str | None] = mapped_column(String(1000), nullable=True)


