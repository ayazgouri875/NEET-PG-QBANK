"""Bookmarks and Question Revision Endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db
from backend.app.models.question import Question
from backend.app.models.test import Bookmark
from backend.app.models.user import User
from backend.app.schemas.test import BookmarkOut, BookmarkToggleRequest

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
        )
        .filter(Bookmark.user_id == current_user.id)
    )

    if subject_id:
        query = query.join(Question).filter(Question.subject_id == subject_id)

    return query.order_by(Bookmark.created_at.desc()).all()

