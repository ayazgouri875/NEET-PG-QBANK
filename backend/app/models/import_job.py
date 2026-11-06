import enum
from sqlalchemy import String, Integer, Text, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from backend.app.models.base import Base, TimestampMixin


class ImportStatus(str, enum.Enum):
    PENDING = "pending"
    ANALYZING = "analyzing"
    PREVIEW_READY = "preview_ready"
    IMPORTING = "importing"
    COMPLETED = "completed"
    FAILED = "failed"
    PAUSED = "paused"


class ImportJob(Base, TimestampMixin):
    __tablename__ = "import_jobs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(Integer, nullable=False)
    status: Mapped[ImportStatus] = mapped_column(
        Enum(ImportStatus, name="import_status_enum", native_enum=False),
        default=ImportStatus.PENDING,
        nullable=False,
        index=True,
    )

    # Statistics
    total_notes_in_source: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    processed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    imported_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    duplicate_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_records: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    # Configuration & Mapping
    field_mapping_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary_report_json: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Relationships
    errors = relationship("ImportError", back_populates="import_job", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<ImportJob id={self.id} file={self.filename} status={self.status} imported={self.imported_records}>"


class ImportError(Base, TimestampMixin):
    __tablename__ = "import_errors"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    import_job_id: Mapped[int] = mapped_column(ForeignKey("import_jobs.id", ondelete="CASCADE"), nullable=False, index=True)
    source_nid: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    mcq_id: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    error_type: Mapped[str] = mapped_column(String(100), nullable=False)
    raw_data_json: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str] = mapped_column(Text, nullable=False)

    # Relationships
    import_job = relationship("ImportJob", back_populates="errors")

    def __repr__(self) -> str:
        return f"<ImportError id={self.id} job={self.import_job_id} error={self.error_type}>"

