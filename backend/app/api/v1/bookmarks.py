"""Bookmarks and Question Revision Endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.question import Question
from backend.app.models.test import Bookmark
from backend.app.models.user import User
from backend.app.schemas.test import BookmarkNoteRequest, BookmarkOut, BookmarkToggleRequest

router = APIRouter(prefix="/bookmarks", tags=["Bookmarks & Revision"])


@router.post("/toggle")
def toggle_bookmark(
    bookmark_in: BookmarkToggleRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Toggles bookmark status on a question with optional revision notes."""
    question = db.query(Question).filter(Question.id == bookmark_in.question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    existing = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id, Bookmark.question_id == bookmark_in.question_id)
        .first()
    )

    if existing:
        db.delete(existing)
        db.commit()
        return {"bookmarked": False, "message": "Bookmark removed"}
    else:
        new_bm = Bookmark(
            user_id=current_user.id,
            question_id=bookmark_in.question_id,
            notes=bookmark_in.notes,
        )
        db.add(new_bm)
        db.commit()
        return {"bookmarked": True, "message": "Question bookmarked for revision"}


@router.put("/note")
def save_bookmark_note(
    note_in: BookmarkNoteRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Creates or updates personal revision notes on a question."""
    question = db.query(Question).filter(Question.id == note_in.question_id).first()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    clean_notes = note_in.notes.strip()[:500] if note_in.notes else None
    existing = (
        db.query(Bookmark)
        .filter(Bookmark.user_id == current_user.id, Bookmark.question_id == note_in.question_id)
        .first()
    )
    if existing:
        existing.notes = clean_notes
    else:
        existing = Bookmark(
            user_id=current_user.id,
            question_id=note_in.question_id,
            notes=clean_notes,
        )
        db.add(existing)
    db.commit()
    return {"status": "saved", "question_id": note_in.question_id, "notes": clean_notes}


@router.get("/", response_model=list[BookmarkOut])
def list_bookmarks(
    subject_id: int | None = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves all bookmarked questions for the student, optionally filtered by subject."""
    query = (
        db.query(Bookmark)
        .options(
            joinedload(Bookmark.question).joinedload(Question.options),
            joinedload(Bookmark.question).joinedload(Question.images),
            joinedload(Bookmark.question).joinedload(Question.tags),
            joinedload(Bookmark.question).joinedload(Question.subject),
            joinedload(Bookmark.question).joinedload(Question.topic),
            joinedload(Bookmark.question).joinedload(Question.subtopic),
        )
        .filter(Bookmark.user_id == current_user.id)
    )

    if subject_id:
        query = query.join(Question).filter(Question.subject_id == subject_id)

    items = query.order_by(Bookmark.created_at.desc()).all()
    for bm in items:
        if bm.question:
            if bm.question.subject:
                bm.question.subject_name = bm.question.subject.name
            if bm.question.topic:
                bm.question.topic_name = bm.question.topic.name
            if bm.question.subtopic:
                bm.question.subtopic_name = bm.question.subtopic.name
    return items

