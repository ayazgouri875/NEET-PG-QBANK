import enum
from sqlalchemy import String, Integer, Boolean, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, TimestampMixin


class SubjectCategory(str, enum.Enum):
    PRE_CLINICAL = "Pre-clinical"
    PARA_CLINICAL = "Para-clinical"
    CLINICAL = "Clinical"


class Subject(Base, TimestampMixin):
    __tablename__ = "subjects"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True, nullable=False)
    category: Mapped[SubjectCategory] = mapped_column(
        Enum(SubjectCategory, name="subject_category_enum", native_enum=False),
        nullable=False,
    )
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    icon_name: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    topics = relationship("Topic", back_populates="subject", cascade="all, delete-orphan", order_by="Topic.display_order")
    questions = relationship("Question", back_populates="subject")
    user_performances = relationship("UserPerformance", back_populates="subject", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Subject id={self.id} name={self.name} category={self.category}>"


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    subject_id: Mapped[int] = mapped_column(ForeignKey("subjects.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    subject = relationship("Subject", back_populates="topics")
    subtopics = relationship("Subtopic", back_populates="topic", cascade="all, delete-orphan", order_by="Subtopic.display_order")
    questions = relationship("Question", back_populates="topic")
    user_performances = relationship("UserPerformance", back_populates="topic", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<Topic id={self.id} subject_id={self.subject_id} name={self.name}>"


class Subtopic(Base, TimestampMixin):
    __tablename__ = "subtopics"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    topic_id: Mapped[int] = mapped_column(ForeignKey("topics.id", ondelete="CASCADE"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    total_questions: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Relationships
    topic = relationship("Topic", back_populates="subtopics")
    questions = relationship("Question", back_populates="subtopic")

    def __repr__(self) -> str:
        return f"<Subtopic id={self.id} topic_id={self.topic_id} name={self.name}>"

