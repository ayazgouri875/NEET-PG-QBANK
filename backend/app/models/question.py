import enum
from sqlalchemy import String, Integer, Text, Boolean, Enum, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, TimestampMixin


class DifficultyLevel(str, enum.Enum):
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"


class ImageType(str, enum.Enum):
    QUESTION = "question"
    EXPLANATION = "explanation"


class Question(Base, TimestampMixin):
    __tablename__ = "questions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    mcq_id: Mapped[str] = mapped_column(String(50), unique=False, index=True, nullable=True)  # e.g. Q865383
    text: Mapped[str] = mapped_column(Text, nullable=False)  # Plain stripped text for search & preview
    html_content: Mapped[str] = mapped_column(Text, nullable=False)  # Preserved rich HTML formatting

    # Subject, Topic, Subtopic Hierarchy
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="RESTRICT"), nullable=False, index=True)
    topic_id: Mapped[int | None] = mapped_column(ForeignKey("topics.id", ondelete="SET NULL"), nullable=True, index=True)
    subtopic_id: Mapped[int | None] = mapped_column(ForeignKey("subtopics.id", ondelete="SET NULL"), nullable=True, index=True)

    # Medical Question Characteristics
    difficulty: Mapped[DifficultyLevel] = mapped_column(
        Enum(DifficultyLevel, name="difficulty_level_enum", native_enum=False),
        default=DifficultyLevel.MEDIUM,
        nullable=False,
    )
    is_clinical: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    has_images: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_multiple_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    pyq_year: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # NEET PG / INI-CET year if available
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False, index=True)

    # Provenance and Traceability
    original_source_file: Mapped[str | None] = mapped_column(String(255), nullable=True)
    original_source_nid: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)  # Anki note ID
    deck_path: Mapped[str | None] = mapped_column(String(500), nullable=True)

    # Relationships
    subject = relationship("Subject", back_populates="questions")
    topic = relationship("Topic", back_populates="questions")
    subtopic = relationship("Subtopic", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan", order_by="QuestionOption.option_index")
    images = relationship("QuestionImage", back_populates="question", cascade="all, delete-orphan", order_by="QuestionImage.display_order")
    tags = relationship("QuestionTag", back_populates="question", cascade="all, delete-orphan")
    explanation = relationship("Explanation", back_populates="question", uselist=False, cascade="all, delete-orphan")
    test_questions = relationship("TestQuestion", back_populates="question", cascade="all, delete-orphan")
    user_responses = relationship("UserResponse", back_populates="question", cascade="all, delete-orphan")
    bookmarks = relationship("Bookmark", back_populates="question", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_questions_subject_topic_active", "subject_id", "topic_id", "is_active"),
        Index("ix_questions_difficulty_clinical", "difficulty", "is_clinical"),
    )

    def __repr__(self) -> str:
        return f"<Question id={self.id} mcq_id={self.mcq_id} subject_id={self.subject_id}>"


class QuestionOption(Base):
    __tablename__ = "question_options"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    option_index: Mapped[int] = mapped_column(Integer, nullable=False)  # 0, 1, 2, 3...
    option_label: Mapped[str] = mapped_column(String(10), nullable=False)  # 'A', 'B', 'C', 'D'...
    text: Mapped[str] = mapped_column(Text, nullable=False)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Relationships
    question = relationship("Question", back_populates="options")

    __table_args__ = (
        Index("ix_options_question_index", "question_id", "option_index", unique=True),
    )

    def __repr__(self) -> str:
        return f"<QuestionOption id={self.id} q_id={self.question_id} label={self.option_label} correct={self.is_correct}>"


class QuestionImage(Base):
    __tablename__ = "question_images"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    image_type: Mapped[ImageType] = mapped_column(
        Enum(ImageType, name="image_type_enum", native_enum=False),
        nullable=False,
    )
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    url_or_path: Mapped[str] = mapped_column(String(500), nullable=False)
    original_anki_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    caption: Mapped[str | None] = mapped_column(String(500), nullable=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    question = relationship("Question", back_populates="images")

    def __repr__(self) -> str:
        return f"<QuestionImage id={self.id} q_id={self.question_id} type={self.image_type} file={self.filename}>"


class QuestionTag(Base):
    __tablename__ = "question_tags"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), nullable=False, index=True)
    tag_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # Relationships
    question = relationship("Question", back_populates="tags")

    __table_args__ = (
        Index("ix_question_tag_unique", "question_id", "tag_name", unique=True),
    )

    def __repr__(self) -> str:
        return f"<QuestionTag id={self.id} q_id={self.question_id} tag={self.tag_name}>"


class Explanation(Base, TimestampMixin):
    __tablename__ = "explanations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    question_id: Mapped[int] = mapped_column(ForeignKey("questions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    references: Mapped[str | None] = mapped_column(Text, nullable=True)  # Standard textbooks (Harrison, Bailey & Love, etc.)

    # Relationships
    question = relationship("Question", back_populates="explanation")

    def __repr__(self) -> str:
        return f"<Explanation id={self.id} question_id={self.question_id}>"

