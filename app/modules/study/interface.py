from app.modules.study.models import Lesson, SentenceSet, Sentence
from app.core.database import SessionLocal
from typing import List, Dict, Any, Optional

def get_lesson_dto(lesson_id: int) -> Optional[Dict[str, Any]]:
    with SessionLocal() as db:
        lesson = db.query(Lesson).get(lesson_id)
        if not lesson:
            return None
        
        return {
            "id": lesson.id,
            "user_id": lesson.user_id,
            "video_id": lesson.video_id,
            "time_spent": lesson.time_spent or 0,
            "is_completed": lesson.is_completed,
            "last_accessed": lesson.last_accessed if lesson.last_accessed else None
        }

def get_user_lessons_dto(user_id: int) -> List[Dict[str, Any]]:
    with SessionLocal() as db:
        lessons = db.query(Lesson).filter_by(user_id=user_id).order_by(Lesson.last_accessed.desc()).all()
        return [get_lesson_dto(l.id) for l in lessons]

def create_lesson(user_id: int, video_id: int) -> Dict[str, Any]:
    with SessionLocal() as db:
        lesson = Lesson(user_id=user_id, video_id=video_id)
        db.add(lesson)
        db.commit()
        db.refresh(lesson)
        return get_lesson_dto(lesson.id)

def delete_lesson(lesson_id: int, user_id: int) -> bool:
    with SessionLocal() as db:
        lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=user_id).first()
        if not lesson:
            return False
        db.delete(lesson)
        db.commit()
        return True

def get_sentence_set_dto(set_id: int, user_id: int) -> Optional[Dict[str, Any]]:
    with SessionLocal() as db:
        s_set = db.query(SentenceSet).filter_by(id=set_id, user_id=user_id).first()
        if not s_set:
            return None
        
        return {
            "id": s_set.id,
            "title": s_set.title,
            "description": s_set.description,
            "set_type": s_set.set_type,
            "visibility": s_set.visibility,
            "count": s_set.sentences.count(),
            "updated_at": s_set.updated_at.isoformat() if s_set.updated_at else None
        }

def get_user_sentence_sets_dto(user_id: int) -> List[Dict[str, Any]]:
    with SessionLocal() as db:
        sets = db.query(SentenceSet).filter_by(user_id=user_id).order_by(SentenceSet.updated_at.desc()).all()
        return [get_sentence_set_dto(s.id, user_id) for s in sets]

def get_sentences_paginated_dto(set_id: int, user_id: int, page: int, per_page: int) -> Dict[str, Any]:
    with SessionLocal() as db:
        s_set = db.query(SentenceSet).filter_by(id=set_id, user_id=user_id).first()
        if not s_set:
            return {"items": [], "total": 0, "pages": 0, "current_page": page}
        
        # Simple manual pagination as SQLAlchemy Base doesn't have .paginate
        total = s_set.sentences.count()
        pages = (total + per_page - 1) // per_page
        items = s_set.sentences.order_by(Sentence.created_at.asc()).offset((page-1)*per_page).limit(per_page).all()
        
        return {
            "items": [{
                "id": s.id,
                "original_text": s.original_text,
                "translated_text": s.translated_text,
                "created_at": s.created_at.isoformat()
            } for s in items],
            "total": total,
            "pages": pages,
            "current_page": page,
            "has_next": page < pages,
            "has_prev": page > 1
        }

def get_lesson_by_video_user_dto(user_id: int, video_id: int) -> Optional[Dict[str, Any]]:
    with SessionLocal() as db:
        lesson = db.query(Lesson).filter_by(user_id=user_id, video_id=video_id).first()
        if not lesson: return None
        return get_lesson_dto(lesson.id)

def create_sentence(user_id: int, set_id: Optional[int], original_text: str, translated_text: str) -> Dict[str, Any]:
    with SessionLocal() as db:
        if not set_id:
            default_set = db.query(SentenceSet).filter_by(user_id=user_id).first()
            if not default_set:
                default_set = SentenceSet(user_id=user_id, title="Bộ học tập cá nhân")
                db.add(default_set)
                db.flush()
            set_id = default_set.id
            
        sentence = Sentence(
            user_id=user_id,
            set_id=set_id,
            original_text=original_text,
            translated_text=translated_text
        )
        db.add(sentence)
        db.commit()
        db.refresh(sentence)
        return {
            "id": sentence.id,
            "original_text": sentence.original_text,
            "translated_text": sentence.translated_text
        }

def delete_sentence(sentence_id: int, user_id: int) -> bool:
    with SessionLocal() as db:
        sentence = db.query(Sentence).filter_by(id=sentence_id, user_id=user_id).first()
        if not sentence:
            return False
        db.delete(sentence)
        db.commit()
        return True
