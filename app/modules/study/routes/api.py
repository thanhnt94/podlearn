import os
import tempfile
import webvtt
import re
import json
import logging
import sqlite3
from datetime import datetime, timezone, date, timedelta
from typing import List, Optional, Dict, Any

from fastapi import APIRouter, Depends, HTTPException, status, Request, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.database import get_db
from app.core.security import get_current_user
from app.core.config import settings
from app.core.task_runner import get_task_runner
from app.modules.identity.models import User
from app.modules.content.models import Video, SubtitleTrack, VideoCollaborator
from app.modules.study.models import (
    Lesson, Note, SentenceSet, Sentence, VideoGlossary, 
    VocabEditHistory, SentenceToken, LessonWordStatus,
    VideoDictionary, AIInsightTrack, AIInsightItem
)
from app.modules.engagement.models import AppSetting, ActivityLog
from app.modules.study.schemas import (
    DashboardInitResponse, TrackProgressRequest, NoteResponse, 
    NoteCreate, NoteBatchCreate, NoteUpdate, VocabListResponse,
    VocabItem, VocabAddRequest, VocabUpdateRequest, SaveTokensRequest,
    PropagateVocabRequest, ShadowingTrackRequest, LessonSettingsUpdate,
    VideoCreateRequest, BatchAnalyzeRequest, WordMapUpdateStatus
)
from app.modules.study.services import shadowing_service, vocab_service
from app.modules.study.tasks import run_process_tracking_data, process_tracking_data_task
from app.modules.content.services import subtitle_service, audio_service, portable_service
from app.modules.content.services.youtube_service import extract_video_id
from app.modules.content.services.sentence_service import import_sentence_from_raw_json
from app.modules.content.services.subtitle_service import get_available_subs_from_youtube
from app.modules.content.services.audio_service import generate_bilingual_audio, generate_text_audio
from app.modules.identity import interface as identity_interface
from app.modules.content import interface as content_interface
from app.modules.engagement import interface as engagement_interface

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/study", tags=["Study"])
tracking_router = APIRouter(prefix="/api/tracking", tags=["Tracking"])

# --- Helper for task dispatch ---
def dispatch_tracking_task(background_tasks: BackgroundTasks, **kwargs):
    get_task_runner(background_tasks).run(process_tracking_data_task, **kwargs)

# --- Unified Dashboard API ---

@router.get('/dashboard/init', response_model=DashboardInitResponse)
def get_dashboard_init(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Unified endpoint to initialize the React dashboard with all necessary data."""
    # 1. My Lessons
    lessons = db.query(Lesson).filter_by(user_id=current_user.id).order_by(Lesson.last_accessed.desc()).all()
    lessons_data = []
    for l in lessons:
        is_locked = False
        if current_user.role == 'free' and (l.time_spent or 0) >= 600:
            is_locked = True

        lessons_data.append({
            'id': l.id,
            'time_spent': l.time_spent or 0,
            'is_completed': l.is_completed,
            'is_locked': is_locked,
            'last_accessed': l.last_accessed,
            'video': {
                'id': l.video.id,
                'title': l.video.title,
                'channel_title': l.video.channel_title,
                'thumbnail_url': l.video.thumbnail_url,
                'duration_seconds': l.video.duration_seconds or 1,
                'owner_name': l.video.owner.username if l.video.owner else "System",
                'visibility': l.video.visibility,
                'available_languages': [t.language_code.upper() for t in l.video.subtitle_tracks]
            }
        })

    # 2. Community Videos (Discovery)
    discovery_data = content_interface.get_public_videos_dto(24)
    discovery_formatted = []
    for v in discovery_data:
        discovery_formatted.append({
            'id': v['id'],
            'video': v,
            'time_spent': 0,
            'is_completed': False,
            'last_accessed': None
        })

    # 3. Notifications & Pending Invites
    real_notifs = engagement_interface.get_user_notifications_dto(current_user.id)
    pending_shares = engagement_interface.get_pending_shares_dto(current_user.id)
    
    notifications_data = real_notifs + [{
        'id': f"share_{s['id']}", 
        'type': 'invite',
        'title': f"Invite from {s['sender_name']}",
        'message': f"Wants to share: {s['video_title']}",
        'is_read': False,
        'created_at': s['created_at'],
        'link_url': f"/share/{s['id']}"
    } for s in pending_shares]
    
    # 4. Sentence Sets
    sets = db.query(SentenceSet).filter_by(user_id=current_user.id).order_by(SentenceSet.updated_at.desc()).all()
    sets_data = []
    for s in sets:
        first = db.query(Sentence).filter_by(set_id=s.id).order_by(Sentence.created_at.asc()).first()
        sets_data.append({
            'id': s.id,
            'title': s.title,
            'set_type': s.set_type,
            'visibility': s.visibility,
            'count': db.query(Sentence).filter_by(set_id=s.id).count(),
            'first_sentence_id': first.id if first else None,
            'updated_at': s.updated_at
        })

    # 5. Stats Summary
    stats = engagement_interface.get_user_stats_dto(current_user.id)

    return {
        'lessons': lessons_data,
        'community_videos': discovery_formatted,
        'notifications': notifications_data,
        'sets': sets_data,
        'stats': {
            'current_streak': stats.get('current_streak', 0),
            'longest_streak': stats.get('longest_streak', 0),
            'completed_count': stats.get('completed_count', 0),
            'total_lessons': len(lessons_data),
            'total_time_seconds': stats.get('total_listening_seconds', 0)
        }
    }

# --- Tracking API ---

@router.post('/track')
def track_progress(data: TrackProgressRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Receive high-frequency tracking data and offload processing."""
    if data.listening_seconds < 0 or data.shadowing_count < 0:
        raise HTTPException(status_code=400, detail="Invalid metrics")

    dispatch_tracking_task(
        background_tasks,
        user_id=current_user.id,
        lesson_id=data.lesson_id,
        listening_seconds=data.listening_seconds,
        shadowing_count=data.shadowing_count,
        shadowing_seconds=data.shadowing_seconds
    )
    
    return {
        "status": "accepted",
        "message": "Tracking data queued for processing"
    }

@router.post('/lesson/{lesson_id}/track-time')
def legacy_track_time(lesson_id: int, data: Dict[str, int], background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user)):
    """Compatibility route for legacy frontend tracking."""
    seconds = data.get('seconds_added', 0)
    
    dispatch_tracking_task(
        background_tasks,
        user_id=current_user.id,
        lesson_id=lesson_id,
        listening_seconds=seconds,
        shadowing_count=0,
        shadowing_seconds=0
    )
    
    return {'success': True, 'message': 'Legacy tracking accepted'}

@router.get('/lesson/{lesson_id}/shadowing-stats')
def get_shadowing_stats(lesson_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch summarized shadowing stats for each subtitle line in a lesson."""
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    stats_results = engagement_interface.get_shadowing_stats_for_lesson(lesson_id)
    return {'stats': stats_results}

# --- Statistics API ---

@router.get('/stats/summary')
def get_study_summary(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Aggregate learning metrics for the user dashboard."""
    summary = engagement_interface.get_stats_summary_dto(current_user.id)
    
    today_dt = date.today()
    
    # Calculate videos watched today
    from app.modules.engagement.models import ActivityLog
    videos_today = db.query(ActivityLog.reference_id).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.activity_type == 'LISTEN_PODCAST',
        func.date(ActivityLog.created_at) == today_dt
    ).distinct().count()

    daily_data = summary.get('daily_data', {})
    daily_data_list = []
    sorted_dates = sorted(daily_data.keys())
    for d_str in sorted_dates:
        day_info = daily_data[d_str]
        daily_data_list.append({
            "date": d_str,
            "listening_minutes": round(day_info.get('listening_minutes', 0), 1),
            "shadowing_count": day_info.get('shadowing_count', 0)
        })

    hourly_raw = summary.get('hourly_distribution', {})
    hourly_list = []
    for h in range(24):
        h_str = str(h)
        hourly_list.append({
            "hour": h,
            "minutes": round(hourly_raw.get(h_str, 0), 1)
        })

    return {
        "total_listening_time": current_user.total_listening_seconds or 0,
        "total_shadowing_count": current_user.total_shadowing_count or 0,
        "current_streak": current_user.current_streak or 0,
        "total_exp": current_user.total_exp or 0,
        "daily_data": daily_data_list,
        "hourly_distribution": hourly_list,
        "activity_mix": {
            "listening_minutes": round((current_user.total_listening_seconds or 0) / 60, 1),
            "shadowing_minutes": round(summary.get('total_shadowing_duration_seconds', 0) / 60, 1)
        }
    }

@tracking_router.get('/stats/summary')
def get_study_summary_legacy(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return get_study_summary(current_user, db)

# --- Notes API ---

@router.get('/lesson/{lesson_id}/notes', response_model=List[NoteResponse])
def get_lesson_notes(lesson_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Fetch all notes for a specific lesson."""
    notes = db.query(Note).filter_by(lesson_id=lesson_id, user_id=current_user.id).order_by(Note.timestamp.asc()).all()
    return notes

@router.post('/lesson/{lesson_id}/notes', response_model=Dict[str, Any])
def add_lesson_note(lesson_id: int, data: NoteCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add a new note to a lesson."""
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="Content is required")

    note = Note(
        user_id=current_user.id,
        lesson_id=lesson_id,
        timestamp=data.timestamp,
        content=data.content.strip()
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return {
        "success": True,
        "note": note
    }

@router.post('/lesson/{lesson_id}/notes/batch')
def batch_add_lesson_notes(lesson_id: int, data: NoteBatchCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Add multiple notes to a lesson in one go."""
    if not data.notes:
        raise HTTPException(status_code=400, detail="No notes provided")

    added_notes = []
    for item in data.notes:
        if not item.content.strip():
            continue
        
        note = Note(
            user_id=current_user.id,
            lesson_id=lesson_id,
            timestamp=item.timestamp,
            content=item.content.strip()
        )
        db.add(note)
        added_notes.append(note)
    
    db.commit()

    return {
        "success": True,
        "count": len(added_notes),
        "notes": added_notes
    }

@router.patch('/notes/{note_id}')
def update_note(note_id: int, data: NoteUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter_by(id=note_id, user_id=current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    if data.content is not None:
        note.content = data.content.strip()
    if data.timestamp is not None:
        note.timestamp = data.timestamp
        
    db.commit()
    return {"success": True}

@router.delete('/notes/{note_id}')
def delete_note(note_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    note = db.query(Note).filter_by(id=note_id, user_id=current_user.id).first()
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    db.delete(note)
    db.commit()
    return {"success": True}

# --- Vocabulary CRUD API ---

@router.get('/vocab/list/{lesson_id}', response_model=VocabListResponse)
def list_lesson_vocab(lesson_id: int, db: Session = Depends(get_db)):
    """List all vocabulary saved in a specific lesson context."""
    items = db.query(VideoGlossary).filter_by(lesson_id=lesson_id).order_by(VideoGlossary.updated_at.desc()).all()
    return {
        "vocab": [
            VocabItem(
                id=v.id,
                front=v.front,
                back=v.back,
                reading=v.reading,
                source=v.source
            ) for v in items
        ]
    }

@router.post('/vocab/add')
def add_vocab(data: VocabAddRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not data.word.strip() or not data.meaning.strip():
        raise HTTPException(status_code=400, detail="Front and back content are required")

    existing = db.query(VideoGlossary).filter_by(lesson_id=data.lesson_id, front=data.word.strip()).first()
    if existing:
        existing.back = data.meaning.strip()
        existing.reading = data.reading.strip() if data.reading else existing.reading
        existing.last_updated_by = current_user.id
    else:
        vocab = VideoGlossary(
            lesson_id=data.lesson_id,
            front=data.word.strip(),
            reading=data.reading.strip() if data.reading else None,
            back=data.meaning.strip(),
            last_updated_by=current_user.id
        )
        db.add(vocab)
    
    db.commit()
    return {"success": True}

@router.patch('/vocab/{item_id}')
def update_vocab_item(item_id: int, data: VocabUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    item = db.query(VideoGlossary).get(item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    lesson = db.query(Lesson).get(item.lesson_id)
    if not lesson or lesson.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    if data.reading is not None:
        item.reading = data.reading.strip()
    if data.meaning is not None:
        item.back = data.meaning.strip()
    if data.front is not None:
        item.front = data.front.strip()
    if data.back is not None:
        item.back = data.back.strip()
        
    item.last_updated_by = current_user.id
    db.commit()
    return {"success": True}

@router.delete('/vocab/remove')
def remove_vocab(lesson_id: int, word: str, db: Session = Depends(get_db)):
    item = db.query(VideoGlossary).filter_by(lesson_id=lesson_id, front=word.strip()).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"success": True}

@router.post('/vocab/tokens/save')
def save_vocab_tokens(data: SaveTokensRequest, db: Session = Depends(get_db)):
    db.query(SentenceToken).filter_by(lesson_id=data.lesson_id, line_index=data.line_index).delete()
    
    for idx, t in enumerate(data.tokens):
        token = SentenceToken(
            lesson_id=data.lesson_id,
            line_index=data.line_index,
            token=t.surface,
            lemma_override=t.lemma,
            pos=t.pos,
            order_index=idx
        )
        db.add(token)
        
        if data.sync_global and t.lemma:
            status_val = 'skip' if t.is_skipped else 'use'
            ws = db.query(LessonWordStatus).filter_by(lesson_id=data.lesson_id, lemma=t.lemma).first()
            if ws:
                ws.status = status_val
            else:
                ws = LessonWordStatus(lesson_id=data.lesson_id, lemma=t.lemma, status=status_val)
                db.add(ws)
    
    db.commit()
    return {"success": True}

@router.delete('/vocab/tokens/clear')
def clear_vocab_tokens(lesson_id: int, line_index: int, db: Session = Depends(get_db)):
    db.query(SentenceToken).filter_by(lesson_id=lesson_id, line_index=line_index).delete()
    db.commit()
    return {"success": True}

@router.delete('/vocab/tokens/clear-all')
def clear_all_vocab_tokens(lesson_id: int, db: Session = Depends(get_db)):
    db.query(SentenceToken).filter_by(lesson_id=lesson_id).delete()
    db.commit()
    return {"success": True}

@router.post('/vocab/propagate')
def propagate_vocab_change(data: PropagateVocabRequest, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).get(data.lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    track_id = lesson.s1_track_id
    if not track_id:
        raise HTTPException(status_code=400, detail="No primary track (S1) found for this lesson")
        
    track = db.query(SubtitleTrack).get(track_id)
    if not track or not track.content_json:
        raise HTTPException(status_code=400, detail="Track content missing")
        
    content = track.content_json
    changed_count = 0
    pattern = re.compile(r'\|([^\|\]]+)(?:\[([^\|\]]+)\])?\|')
    
    for line in content:
        text = line.get('text', '')
        if '|' not in text: continue
        
        def replacer(match):
            nonlocal changed_count
            surface = match.group(1).strip()
            current_lemma = match.group(2).strip() if match.group(2) else surface
            
            if current_lemma == data.lemma:
                changed_count += 1
                target_lemma = data.new_lemma if data.new_lemma else data.lemma
                
                if data.status == 'skip':
                    if not target_lemma.startswith('-'):
                        target_lemma = '-' + target_lemma
                elif data.status == 'use':
                    if target_lemma.startswith('-'):
                        target_lemma = target_lemma[1:]
                
                return f"| {surface} [{target_lemma}] |"
            return match.group(0)
            
        new_text = pattern.sub(replacer, text)
        if new_text != text:
            line['text'] = new_text
            
    if changed_count > 0:
        track.content_json = content
        db.commit()
        
    return {"success": True, "changed_count": changed_count}

@router.get('/vocab/lesson/{lesson_id}/analysis')
def get_lesson_vocab_analysis(lesson_id: int, db: Session = Depends(get_db)):
    tokens = db.query(SentenceToken).filter_by(lesson_id=lesson_id).all()
    analysis = {}
    for t in tokens:
        idx = str(t.line_index)
        if idx not in analysis:
            analysis[idx] = []
        analysis[idx].append({
            "surface": t.token,
            "lemma": t.lemma_override,
            "pos": t.pos,
            "reading": t.reading,
            "meaning": t.meaning,
            "metadata": t.extra_data
        })
    return {"analysis": analysis}

@router.post('/lesson/{lesson_id}/import-ai-pack')
async def import_ai_pack(
    lesson_id: int, 
    srt_file: UploadFile = File(...), 
    json_file: UploadFile = File(...),
    language_code: str = Form('ja'),
    name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    video_id = lesson.video_id
    srt_content = (await srt_file.read()).decode('utf-8-sig')
    parsed_srt = subtitle_service.parse_subtitle_text(srt_content, '.srt')
    if not parsed_srt.get('success'):
        raise HTTPException(status_code=400, detail=f"Failed to parse SRT: {parsed_srt.get('message')}")
        
    lines = parsed_srt['lines']
    
    try:
        json_content = await json_file.read()
        analysis_data = json.loads(json_content)
        ai_lines = analysis_data.get('lines', analysis_data) if isinstance(analysis_data, dict) else analysis_data
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse JSON: {str(e)}")
        
    track_name = name or f"[AI] {language_code.upper()}"
    new_track = SubtitleTrack(
        video_id=video_id,
        language_code=language_code,
        name=subtitle_service.generate_unique_track_name(video_id, track_name),
        content_json=lines,
        uploader_id=current_user.id,
        uploader_name=current_user.username,
        is_original=False
    )
    db.add(new_track)
    db.flush()
    
    tokens_count = 0
    for ai_line in ai_lines:
        l_idx = ai_line.get('line_index')
        ai_tokens = ai_line.get('tokens', [])
        if l_idx is None or l_idx >= len(lines): continue
        
        for idx, t in enumerate(ai_tokens):
            token = SentenceToken(
                lesson_id=lesson_id,
                line_index=l_idx,
                token=t.get('surface', ''),
                lemma_override=t.get('lemma'),
                pos=t.get('pos'),
                reading=t.get('reading'),
                meaning=t.get('meaning'),
                extra_data=t.get('metadata'),
                order_index=idx
            )
            db.add(token)
            tokens_count += 1
            
    db.commit()
    return {"status": "success", "track_id": new_track.id, "tokens_imported": tokens_count}

@router.post('/lesson/{lesson_id}/analysis/import')
def import_analysis(lesson_id: int, data: Dict[str, Any], db: Session = Depends(get_db)):
    lines = data.get('lines', [])
    if not lines:
        raise HTTPException(status_code=400, detail="No lines provided")

    db.query(SentenceToken).filter_by(lesson_id=lesson_id).delete()

    count = 0
    for line_data in lines:
        l_idx = line_data.get('line_index')
        tokens = line_data.get('tokens', [])
        for idx, t in enumerate(tokens):
            token = SentenceToken(
                lesson_id=lesson_id,
                line_index=l_idx,
                token=t.get('surface', ''),
                lemma_override=t.get('lemma'),
                pos=t.get('pos'),
                reading=t.get('reading'),
                meaning=t.get('meaning'),
                extra_data=t.get('metadata'),
                order_index=idx
            )
            db.add(token)
            count += 1
    
    db.commit()
    return {"success": True, "tokens_imported": count}

@router.get('/vocab/scan-status/{lesson_id}')
def get_scan_status(lesson_id: int, db: Session = Depends(get_db)):
    has_tokens = db.query(SentenceToken).filter_by(lesson_id=lesson_id).first() is not None
    has_glossary = db.query(VideoGlossary).filter_by(lesson_id=lesson_id).first() is not None
    return {'has_tokens': has_tokens or has_glossary, 'lesson_id': lesson_id}

@router.get('/video/glossary/{lesson_id}')
def get_video_glossary(lesson_id: int, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    entries = db.query(VideoGlossary).filter_by(video_id=lesson.video_id).all()
    return {
        "glossary": [
            {
                "front": e.front,
                "reading": e.reading,
                "back": e.back,
                "extra_data": e.extra_data or {}
            } for e in entries
        ]
    }

@router.post('/vocab/sync-batch')
def sync_vocab_batch(data: BatchAnalyzeRequest, db: Session = Depends(get_db)):
    try:
        if data.is_first_batch:
            db.query(VideoGlossary).filter_by(lesson_id=data.lesson_id).delete()
            db.commit()
            
        results = vocab_service.analyze_batch_japanese(data.texts)
        lesson = db.query(Lesson).get(data.lesson_id)
        video_id = lesson.video_id if lesson else None
        
        for res in results:
            term = res['lemma']
            existing = db.query(VideoGlossary).filter_by(lesson_id=data.lesson_id, front=term).first()
            if not existing:
                item = VideoGlossary(
                    lesson_id=data.lesson_id,
                    video_id=video_id,
                    front=term,
                    back="[LOOKUP_REQUIRED]",
                    source="offline"
                )
                db.add(item)
            
        db.commit()
        return {"status": "success", "count": len(results)}
    except Exception as e:
        logger.error(f"[VOCAB ERROR] sync-batch failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/lesson/{lesson_id}/dictionary/list')
def list_dictionaries(lesson_id: int, db: Session = Depends(get_db)):
    dicts = db.query(VideoDictionary).filter_by(lesson_id=lesson_id).all()
    return [{
        "id": d.id,
        "name": d.name,
        "is_active": d.is_active,
        "count": db.query(VideoGlossary).filter_by(dictionary_id=d.id).count()
    } for d in dicts]

@router.post('/lesson/{lesson_id}/dictionary/toggle/{dict_id}')
def toggle_dictionary(lesson_id: int, dict_id: int, db: Session = Depends(get_db)):
    d = db.query(VideoDictionary).filter_by(id=dict_id, lesson_id=lesson_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dictionary not found")
    d.is_active = not d.is_active
    db.commit()
    return {"success": True, "is_active": d.is_active}

@router.delete('/lesson/{lesson_id}/dictionary/delete/{dict_id}')
def delete_dictionary(lesson_id: int, dict_id: int, db: Session = Depends(get_db)):
    d = db.query(VideoDictionary).filter_by(id=dict_id, lesson_id=lesson_id).first()
    if not d:
        raise HTTPException(status_code=404, detail="Dictionary not found")
    db.delete(d)
    db.commit()
    return {"success": True}

@router.post('/lesson/{lesson_id}/dictionary/import')
def import_dictionary(lesson_id: int, payload: Any, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    video_id = lesson.video_id
    
    if isinstance(payload, list):
        data = payload
        dict_name = "Main Glossary"
        global_lang = 'ja'
    else:
        data = payload.get('items', [])
        dict_name = payload.get('name', "Main Glossary")
        global_lang = payload.get('lang', 'ja')

    if not isinstance(data, list):
        raise HTTPException(status_code=400, detail="Invalid items format. Expected an array.")
        
    v_dict = db.query(VideoDictionary).filter_by(lesson_id=lesson_id, name=dict_name).first()
    if not v_dict:
        v_dict = VideoDictionary(lesson_id=lesson_id, name=dict_name)
        db.add(v_dict)
        db.flush()

    added = 0
    updated = 0
    errors = []

    for idx, item in enumerate(data):
        try:
            if not isinstance(item, dict): continue
            term = item.get('term')
            if not term: continue
            
            lang = item.get('lang', global_lang)
            target_lang = item.get('target_lang', 'vi')
            
            entry = db.query(VideoGlossary).filter_by(dictionary_id=v_dict.id, front=term).first()
            if not entry:
                entry = VideoGlossary(dictionary_id=v_dict.id, video_id=video_id, lesson_id=lesson_id, front=term)
                db.add(entry)
                added += 1
            else:
                updated += 1
                
            entry.reading = item.get('reading', entry.reading)
            entry.back = item.get('meaning', entry.back or "")
            entry.language_code = lang
            entry.target_language_code = target_lang
            entry.source = 'manual'
            entry.extra_data = {
                **(entry.extra_data or {}),
                "kanji_viet": item.get('kanji_viet') or (entry.extra_data or {}).get('kanji_viet')
            }
        except Exception as e:
            errors.append(f"Error at index {idx}: {str(e)}")
        
    db.commit()
    return {"success": True, "added": added, "updated": updated, "errors": errors if errors else None}

@router.post('/vocab/analyze')
def analyze_vocab(data: Dict[str, Any], db: Session = Depends(get_db)):
    """Live word analysis for a single sentence."""
    try:
        text = data.get('text', '').strip()
        lesson_id = data.get('lesson_id')
        line_index = data.get('line_index')
        source = data.get('source', 'auto')
        track_id = data.get('track_id')
        auto_segmentation = data.get('auto_segmentation', True)
        use_offline = data.get('use_offline', True)
        original_lang = data.get('original_lang', 'ja')
        target_lang = data.get('target_lang', 'vi')
        preferred_dict_id = data.get('dict_id')
        
        if source == 'track' and track_id and line_index is not None:
            track = db.query(SubtitleTrack).get(track_id)
            if track and track.content_json and len(track.content_json) > line_index:
                text = track.content_json[line_index].get('text', text)

        if not text:
            return []

        active_user_dicts = db.query(VideoDictionary).filter_by(lesson_id=lesson_id, is_active=True).all()
        user_map = {}
        if active_user_dicts:
            dict_ids = [d.id for d in active_user_dicts]
            glossary_items = db.query(VideoGlossary).filter(
                (VideoGlossary.dictionary_id.in_(dict_ids)) | 
                ((VideoGlossary.lesson_id == lesson_id) & (VideoGlossary.dictionary_id == None))
            ).all()
            user_map = {item.front: item.to_dict() for item in glossary_items}

        delimiters = ['|', '/', ' ']
        active_delimiter = next((d for d in delimiters if d in text), None)

        if active_delimiter:
            raw_segments = [s.strip() for s in text.split(active_delimiter) if s.strip()]
            results = []
            _, legacy_paths = vocab_service.get_dict_paths()
            
            for seg in raw_segments:
                match = re.search(r'(.+?)\[(.+?)\]', seg)
                surface, lemma = (match.group(1).strip(), match.group(2).strip().replace('{', '').replace('}', '')) if match else (seg.strip(), re.sub(r'\{[^\}]+\}', '', seg).strip())
                    
                if lemma.lower() == 'skip':
                    results.append({"surface": surface, "lemma": "skip", "lemma_override": "skip", "word": surface, "reading": "", "meanings": [], "definition": "SKIP", "source": "none"})
                    continue

                found = False
                if preferred_dict_id:
                    dict_path = legacy_paths.get(preferred_dict_id)
                    if dict_path:
                        off_res = vocab_service.query_offline_dict(dict_path, lemma)
                        if off_res:
                            results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": off_res.get('reading', ''), "meanings": off_res.get('meanings', []), "definition": off_res.get('definition', ''), "source": off_res.get('source', 'offline')})
                            found = True

                if not found and lemma in user_map:
                    u = user_map[lemma]
                    results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": u.get('reading', ''), "meanings": [u.get('back', '')], "definition": u.get('back', ''), "source": "user_glossary"})
                    found = True

                if not found and use_offline:
                    off_res_list = vocab_service.get_definitions_for_terms([lemma], src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id)
                    if off_res_list and off_res_list[0].get('source') != 'none':
                        o = off_res_list[0]
                        results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": o.get('reading', ''), "meanings": o.get('meanings', []), "definition": o.get('definition', ''), "source": o.get('source', 'offline')})
                        found = True
                
                if not found:
                    results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": "", "meanings": [], "definition": "", "source": "none"})
            
            return results

        if not auto_segmentation:
            match = re.search(r'(.+?)\[(.+?)\]', text)
            surface, lemma = (match.group(1).strip(), match.group(2).strip()) if match else (text, text)
            if lemma.lower() == 'skip':
                return [{"surface": surface, "lemma": "skip", "lemma_override": "skip", "word": surface, "reading": "", "meanings": [], "definition": "SKIP", "source": "none"}]
            off_res = vocab_service.get_definitions_for_terms([lemma], src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id)
            if off_res and off_res[0].get('source') != 'none':
                o = off_res[0]
                return [{"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": o.get('reading', ''), "meanings": o.get('meanings', []), "definition": o.get('definition', ''), "source": o.get('source', 'offline')}]
            return [{"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": "", "meanings": [], "definition": "", "source": "none"}]

        return vocab_service.analyze_japanese_text(text, src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id, include_all=True)
    except Exception as e:
        logger.error(f"[VOCAB ERROR] analyze_vocab failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/vocab/import-custom-dict')
def import_custom_dict(data: Dict[str, Any], db: Session = Depends(get_db)):
    lesson_id = data.get('lesson_id')
    text = data.get('text', '').strip()
    lang_tag = data.get('lang_tag', 'ja-vi')
    if not lesson_id or not text:
        raise HTTPException(status_code=400, detail="Missing lesson_id or text")
        
    src_lang, target_lang = ('ja', 'vi')
    if '-' in lang_tag:
        parts = lang_tag.split('-')
        src_lang, target_lang = parts[0], parts[1]
    
    try:
        v_dict = db.query(VideoDictionary).filter_by(lesson_id=lesson_id, name="Lesson Custom", language_code=src_lang, target_language_code=target_lang).first()
        if not v_dict:
            v_dict = VideoDictionary(lesson_id=lesson_id, name="Lesson Custom", language_code=src_lang, target_language_code=target_lang)
            db.add(v_dict)
            db.flush()
            
        lines = text.split('\n')
        added = 0
        for line in lines:
            if '|' not in line: continue
            parts = line.split('|')
            front, back = parts[0].strip(), parts[1].strip()
            item = db.query(VideoGlossary).filter_by(dictionary_id=v_dict.id, front=front).first()
            if not item:
                item = VideoGlossary(dictionary_id=v_dict.id, front=front, back=back, lesson_id=lesson_id, language_code=src_lang, target_language_code=target_lang)
                db.add(item)
            else:
                item.back = back
            added += 1
            
        db.commit()
        return {"success": True, "added": added}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get('/vocab/word-map/{lesson_id}')
@router.get('/vocab/word-map/{lesson_id}/{track_id}')
def get_lesson_word_map(lesson_id: int, track_id: Optional[int] = None, db: Session = Depends(get_db)):
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    target_track_id = track_id if track_id else lesson.s1_track_id
    if not target_track_id:
        raise HTTPException(status_code=400, detail="No subtitle track found")
        
    track = db.query(SubtitleTrack).get(target_track_id)
    if not track or not track.content_json:
        raise HTTPException(status_code=400, detail="Subtitle content empty")
        
    try:
        unique_words = {}
        overrides = db.query(LessonWordStatus).filter_by(lesson_id=lesson_id).all()
        override_map = {o.lemma: o.status for o in overrides}
        
        raw_content = track.content_json
        lines = raw_content if isinstance(raw_content, list) else (raw_content.get('content') or raw_content.get('lines') or [])
        lines_to_scan = lines[:1000]
        
        for line in lines_to_scan:
            if not line or not isinstance(line, dict): continue
            text = line.get('text', '')
            if not text: continue
            
            words = vocab_service.analyze_japanese_text(text, lesson_id=lesson_id, include_all=True)
            for w in words:
                if not isinstance(w, dict): continue
                lemma = w.get('lemma')
                if not lemma or lemma == '-': continue
                
                if lemma not in unique_words:
                    unique_words[lemma] = {
                        "lemma": lemma,
                        "surface": w.get('surface'),
                        "pos": w.get('pos'),
                        "reading": w.get('reading'),
                        "frequency": 1,
                        "status": override_map.get(lemma, 'use'),
                        "source": w.get('source') or 'auto'
                    }
                else:
                    unique_words[lemma]["frequency"] += 1
                    
        manual_tokens = db.query(SentenceToken).filter_by(lesson_id=lesson_id).all()
        for mt in manual_tokens:
            lemma = mt.lemma_override
            if lemma and lemma != '-':
                if lemma not in unique_words:
                    unique_words[lemma] = {
                        "lemma": lemma,
                        "surface": mt.token,
                        "pos": mt.pos or 'manual',
                        "reading": mt.reading or '',
                        "frequency": 1,
                        "status": override_map.get(lemma, 'use'),
                        "source": 'manual'
                    }
                elif lemma not in override_map:
                    unique_words[lemma]["status"] = 'use'
                        
        return {"success": True, "words": sorted(list(unique_words.values()), key=lambda x: x['frequency'], reverse=True)}
    except Exception as e:
        logger.error(f"Word Map scan failed: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post('/vocab/word-map/update-status')
def update_word_status(data: WordMapUpdateStatus, lesson_id: int, db: Session = Depends(get_db)):
    override = db.query(LessonWordStatus).filter_by(lesson_id=lesson_id, lemma=data.lemma).first()
    if not override:
        override = LessonWordStatus(lesson_id=lesson_id, lemma=data.lemma, status=data.status)
        db.add(override)
    else:
        override.status = data.status
    db.commit()
    return {"success": True}

@router.get('/vocab/custom-dict/{lesson_id}')
def get_custom_dict_raw(lesson_id: int, lang: str = 'ja-vi', db: Session = Depends(get_db)):
    try:
        src_lang, target_lang = lang.split('-')
    except:
        src_lang, target_lang = 'ja', 'vi'

    v_dict = db.query(VideoDictionary).filter_by(lesson_id=lesson_id, name="Lesson Custom", language_code=src_lang, target_language_code=target_lang).first()
    if not v_dict:
        return {"success": True, "text": "", "lang_tag": lang}
        
    items = db.query(VideoGlossary).filter_by(dictionary_id=v_dict.id).all()
    text = "\n".join([f"{item.reading if item.reading else item.front} | {item.back}" for item in items])
    return {"success": True, "text": text, "lang_tag": lang}

@router.post('/video/analyze-sentence')
def analyze_sentence_full(data: Dict[str, Any], db: Session = Depends(get_db)):
    text, lesson_id, active_line_index = data.get('text', '').strip(), data.get('lesson_id'), data.get('active_line_index')
    mode = data.get('mode', 'auto')
    if not text: return {'words': []}
        
    db_tokens = []
    if lesson_id and active_line_index is not None and mode != 'sub':
        db_tokens = db.query(SentenceToken).filter_by(lesson_id=lesson_id, line_index=active_line_index).order_by(SentenceToken.order_index.asc()).all()
        
    if mode != 'db' and '|' in text:
        raw_segments = [s.strip() for s in text.split('|') if s.strip()]
        lookup_terms, token_metas = [], []
        for seg in raw_segments:
            match = re.search(r'(.+?)\[(.+?)\]', seg)
            surface, lemma = (match.group(1).strip(), match.group(2).strip().replace('{', '').replace('}', '')) if match else (seg.strip(), re.sub(r'\{[^\}]+\}', '', seg).strip())
            lookup_terms.append(lemma)
            token_metas.append((surface, lemma if lemma != surface else None))

        results = vocab_service.get_definitions_for_terms(lookup_terms, src_lang=data.get('original_lang', 'ja'), target_lang=data.get('target_lang', 'vi'), lesson_id=lesson_id)
        formatted = []
        for i, r in enumerate(results):
            surface, lemma_override = token_metas[i]
            formatted.append({"surface": surface, "lemma": lookup_terms[i], "lemma_override": lemma_override, "reading": r.get('reading', ''), "pos": 'manual', "meanings": r.get('meanings', []) if isinstance(r.get('meanings'), list) else [r.get('definition', '')], "source": r.get('source', 'none')})
        return {'words': formatted, 'is_manual': True, 'mode_used': 'sub'}

    if db_tokens and mode != 'sub':
        lookup_terms = [t.lemma_override or t.token for t in db_tokens]
        results = vocab_service.get_definitions_for_terms(lookup_terms, src_lang=data.get('original_lang', 'ja'), target_lang=data.get('target_lang', 'vi'), lesson_id=lesson_id)
        formatted = []
        for i, r in enumerate(results):
            t = db_tokens[i]
            formatted.append({"surface": t.token, "lemma": t.lemma_override or t.token, "lemma_override": t.lemma_override, "reading": r.get('reading', ''), "pos": t.pos or 'manual', "meanings": r.get('meanings', []) if isinstance(r.get('meanings'), list) else [r.get('definition', '')], "source": r.get('source', 'none')})
        return {'words': formatted, 'is_manual': True, 'mode_used': 'db'}

    return {'words': vocab_service.analyze_japanese_text(text, lesson_id=lesson_id, include_all=True), 'is_manual': False, 'mode_used': 'auto'}

@router.post('/vocab/generate-all')
def generate_all_vocab_api(data: Dict[str, Any], db: Session = Depends(get_db)):
    lesson_id = data.get('lesson_id')
    if not lesson_id: raise HTTPException(status_code=400, detail="lesson_id required")
    vocab_service.scan_lesson_transcript(lesson_id, data.get('priority', 'mazii_offline'))
    return {"success": True}

# --- Playlist ---

@router.get('/playlists')
def get_playlists(current_user: User = Depends(get_current_user)):
    return {'playlists': content_interface.get_user_playlists_dto(current_user.id)}

@router.post('/playlists')
def create_playlist(data: Dict[str, str], current_user: User = Depends(get_current_user)):
    name = data.get('name', '').strip()
    if not name: raise HTTPException(status_code=400, detail="Name is required")
    return {'success': True, 'playlist': content_interface.create_playlist_dto(name, data.get('description'), current_user.id)}

@router.delete('/playlists/{playlist_id}')
def delete_playlist(playlist_id: int, current_user: User = Depends(get_current_user)):
    if not content_interface.delete_playlist(playlist_id, current_user.id):
        raise HTTPException(status_code=404, detail="Playlist not found")
    return {'success': True}

@router.post('/playlists/{playlist_id}/videos')
def add_video_to_playlist(playlist_id: int, data: Dict[str, int], current_user: User = Depends(get_current_user)):
    if not content_interface.add_video_to_playlist(playlist_id, data.get('video_id'), current_user.id):
        raise HTTPException(status_code=400, detail="Failed to add video")
    return {'success': True}

@router.delete('/playlists/{playlist_id}/videos/{video_id}')
def remove_video_from_playlist(playlist_id: int, video_id: int, current_user: User = Depends(get_current_user)):
    if not content_interface.remove_video_from_playlist(playlist_id, video_id, current_user.id):
        raise HTTPException(status_code=400, detail="Failed to remove video")
    return {'success': True}

# --- Practice ---

@router.get('/practice/sets')
def list_practice_sets(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sets = db.query(SentenceSet).filter_by(user_id=current_user.id).all()
    return [{"id": s.id, "title": s.title, "type": s.set_type, "count": db.query(Sentence).filter_by(set_id=s.id).count(), "visibility": s.visibility} for s in sets]

@router.get('/practice/set/{set_id}')
def get_practice_set(set_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    s_set = db.query(SentenceSet).filter_by(id=set_id, user_id=current_user.id).first()
    if not s_set: raise HTTPException(status_code=404, detail="Set not found")
    sentences = db.query(Sentence).filter_by(set_id=set_id).order_by(Sentence.created_at.asc()).all()
    return {"set_id": s_set.id, "title": s_set.title, "type": s_set.set_type, "sentences": [{"id": s.id, "text": s.original_text, "translation": s.translated_text, "mastery_level": s.mastery_level, "next_review": s.next_review_at} for s in sentences]}

@router.get('/practice/sentence/{sentence_id}')
def get_sentence_details(sentence_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sentence = db.query(Sentence).filter_by(id=sentence_id, user_id=current_user.id).first()
    if not sentence: raise HTTPException(status_code=404, detail="Sentence not found")
    return {"id": sentence.id, "text": sentence.original_text, "translation": sentence.translated_text, "audio_url": sentence.audio_url, "analysis": sentence.detailed_analysis or {}, "mastery": {"level": sentence.mastery_level, "ease_factor": sentence.ease_factor, "interval_days": sentence.interval_days, "next_review": sentence.next_review_at}}

# --- Dictionary Manager ---

@router.get('/dictionaries/system')
def list_system_dictionaries():
    dicts, _ = vocab_service.get_dict_paths()
    return [{"id": d['path'], "name": d['name'], "src": d['src'], "target": d['target'], "is_active": True, "is_editable": d.get('editable', False), "count": "N/A"} for d in dicts]

@router.post('/dictionaries/system')
def create_system_dictionary(data: Dict[str, str]):
    name, src, target = data.get('name', 'New Dict'), data.get('src', 'ja'), data.get('target', 'vi')
    root_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    dict_path = os.path.join(root_dir, 'dictionaries', 'editable', f"[{src}-{target}] {name}.db")
    os.makedirs(os.path.dirname(dict_path), exist_ok=True)
    conn = sqlite3.connect(dict_path)
    conn.execute('CREATE TABLE IF NOT EXISTS dictionary (id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT UNIQUE, reading TEXT, meanings_json TEXT)')
    conn.close()
    return {"id": dict_path, "name": name}

@router.get('/dictionaries/items')
def get_dictionary_items(id: str):
    if not os.path.exists(id): raise HTTPException(status_code=400, detail="Invalid dictionary path")
    conn = sqlite3.connect(id)
    cursor = conn.cursor()
    cursor.execute("SELECT id, word, reading, meanings_json FROM dictionary ORDER BY word ASC")
    rows, results = cursor.fetchall(), []
    conn.close()
    for r in rows:
        try:
            means = json.loads(r[3]) if r[3] else []
            definition = ", ".join([m.get('mean', '') for m in means]) if isinstance(means, list) else str(means)
        except: definition = str(r[3])
        results.append({"id": r[0], "term": r[1], "reading": r[2], "definition": definition, "meanings_json": r[3]})
    return results

@router.post('/dictionaries/import')
def import_to_system_dictionary(data: Dict[str, Any]):
    dict_path, items = data.get('id'), data.get('items', [])
    if not dict_path or not os.path.exists(dict_path): raise HTTPException(status_code=400, detail="Invalid path")
    conn = sqlite3.connect(dict_path)
    count = 0
    for item in items:
        term = item.get('term', '').strip()
        if not term: continue
        conn.execute("INSERT INTO dictionary (word, reading, meanings_json) VALUES (?, ?, ?) ON CONFLICT(word) DO UPDATE SET reading = excluded.reading, meanings_json = excluded.meanings_json", (term, item.get('reading', ''), json.dumps([{"mean": item.get('meaning', '')}])))
        count += 1
    conn.commit()
    conn.close()
    return {"success": True, "count": count}

# --- Tools ---

@router.post('/score-pronunciation')
def score_pronunciation(data: Dict[str, Any], current_user: User = Depends(get_current_user)):
    return engagement_interface.evaluate_pronunciation_manual(user_id=current_user.id, lesson_id=data.get('lesson_id'), original_text=data.get('original_text', ''), spoken_text=data.get('spoken_text', ''), lang=data.get('lang_code', 'ja'), sentence_id=data.get('sentence_id'))

@router.post('/translate')
def translate_text(data: Dict[str, str]):
    text, target, source = data.get('text', '').strip(), data.get('target_lang', 'vi').strip(), data.get('source_lang', 'auto').strip()
    if not text: raise HTTPException(status_code=400, detail="text is required")
    from deep_translator import GoogleTranslator
    return {'original': text, 'translated': GoogleTranslator(source=source, target=target).translate(text), 'target_lang': target}

@router.get('/user/preferences')
def get_preferences(current_user: User = Depends(get_current_user)):
    return json.loads(current_user.preferences_json or '{}')

@router.post('/user/preferences')
def set_preferences(data: Dict[str, Any], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.preferences_json = json.dumps(data)
    db.commit()
    return {'success': True}

@router.get('/notifications')
def get_notifications(current_user: User = Depends(get_current_user)):
    return engagement_interface.get_user_notifications_dto(current_user.id)

# --- Subtitles ---

@router.post('/subtitles/upload-text/{lesson_id}')
async def upload_subtitle_text(
    lesson_id: int, 
    data: Dict[str, Any],
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Import subtitle track from pasted SRT/VTT text."""
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
        
    text = data.get('text', '').strip()
    language_code = data.get('language_code', 'en')
    name = data.get('name')
    
    if not text:
        raise HTTPException(status_code=400, detail="Text content is required")
        
    res = subtitle_service.parse_subtitle_text(text)
    if res.get('error'):
        raise HTTPException(status_code=400, detail=res.get('message'))
        
    track = SubtitleTrack(
        video_id=lesson.video_id,
        language_code=language_code,
        name=name or f"Pasted_{language_code.upper()}",
        content_json=res['lines'],
        is_auto_generated=False,
        is_original=False,
        uploader_id=current_user.id,
        uploader_name=current_user.username,
        status='completed',
        fetched_at=datetime.now(timezone.utc)
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    
    return {"success": True, "track_id": track.id, "line_count": len(res['lines'])}

@router.post('/subtitles/upload/{lesson_id}')
async def upload_subtitle(lesson_id: int, file: UploadFile = File(...), language_code: str = Form(...), name: Optional[str] = Form(None), note: Optional[str] = Form(None), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson: raise HTTPException(status_code=404)
    ext = os.path.splitext(file.filename)[1].lower()
    with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name
    try:
        result = subtitle_service.parse_uploaded_subtitle(tmp_path, ext)
        if 'error' in result: raise HTTPException(status_code=400, detail=result['error'])
        lines = result['lines']
        track = SubtitleTrack(video_id=lesson.video.id, language_code=language_code, content_json=lines, uploader_id=current_user.id, uploader_name=current_user.username, name=subtitle_service.generate_unique_track_name(lesson.video.id, name or f"Uploaded by {current_user.username}"), note=note, fetched_at=datetime.now(timezone.utc), status='completed', total_lines=len(lines), progress=len(lines))
        db.add(track)
        db.commit()
        return {'success': True, 'track_id': track.id, 'language_code': language_code, 'line_count': len(lines), 'lines': lines}
    finally: os.remove(tmp_path)

@router.get('/subtitles/available/{lesson_id}')
def get_available_subtitles(lesson_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson: raise HTTPException(status_code=404)
    tracks = db.query(SubtitleTrack).filter_by(video_id=lesson.video.id).all()
    return {'subtitles': [{'id': t.id, 'language_code': t.language_code, 'is_auto_generated': t.is_auto_generated, 'is_original': t.is_original, 'name': t.name or f"{t.language_code.upper()}_Original", 'uploader_name': t.uploader_name or "Unknown", 'uploader_id': t.uploader_id, 'fetched_at': t.fetched_at, 'line_count': len(t.content_json) if t.content_json else 0, 'status': t.status, 'note': t.note} for t in tracks]}

@router.delete('/subtitles/{sub_id}')
def delete_subtitle(sub_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(SubtitleTrack).get(sub_id)
    if not track: raise HTTPException(status_code=404)
    video = db.query(Video).get(track.video_id)
    if not (current_user.is_admin or video.owner_id == current_user.id or db.query(VideoCollaborator).filter_by(video_id=video.id, user_id=current_user.id).first()) and track.uploader_id != current_user.id:
        raise HTTPException(status_code=403)
    db.delete(track)
    db.commit()
    return {'success': True}

@router.get('/youtube/subtitles-list/{video_id}')
def get_youtube_subs_list_api(video_id: str):
    res = get_available_subs_from_youtube(video_id)
    if 'error' in res: raise HTTPException(status_code=400, detail=res['error'])
    return res

@router.post('/youtube/subtitles-download/{lesson_id}')
def download_youtube_sub(lesson_id: int, data: Dict[str, Any], background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson: raise HTTPException(status_code=404)
    lang, is_auto = data.get('lang_code'), data.get('is_auto', False)
    if not lang: raise HTTPException(status_code=400, detail="lang_code required")
    existing = db.query(SubtitleTrack).filter_by(video_id=lesson.video.id, language_code=lang, is_auto_generated=is_auto).first()
    if existing: return {'success': True, 'track_id': existing.id, 'is_duplicate': True}
    track = SubtitleTrack(video_id=lesson.video.id, language_code=lang, content_json=[], is_auto_generated=is_auto, uploader_id=current_user.id, uploader_name=current_user.username, status='pending', fetched_at=datetime.now(timezone.utc))
    db.add(track); db.commit()
    from app.modules.content.tasks import fetch_youtube_subtitle_background
    get_task_runner(background_tasks).run(fetch_youtube_subtitle_background, track.id, lesson.video.youtube_id, lang, is_auto)
    return {'success': True, 'track_id': track.id}

@router.get('/subtitles/fetch/{lesson_id}')
def fetch_subtitles_api(lesson_id: int, track_id: Optional[int] = None, language_code: Optional[str] = None, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson: raise HTTPException(status_code=404)
    if track_id: track = db.query(SubtitleTrack).get(track_id)
    elif language_code: track = db.query(SubtitleTrack).filter_by(video_id=lesson.video.id, language_code=language_code.strip()).order_by(SubtitleTrack.fetched_at.desc()).first()
    else: track = db.query(SubtitleTrack).filter_by(video_id=lesson.video.id).order_by(SubtitleTrack.fetched_at.desc()).first()
    all_tracks = db.query(SubtitleTrack).filter_by(video_id=lesson.video.id).all()
    res = {'lesson_id': lesson.id, 'lesson_title': lesson.video.title, 'video_id': lesson.video.youtube_id, 'available_tracks': [{'id': t.id, 'language_code': t.language_code, 'uploader_name': t.uploader_name or 'YouTube'} for t in all_tracks], 'settings_json': lesson.settings_json, 'is_completed': lesson.is_completed, 'total_time_spent': lesson.time_spent, 'metadata': {'original_lang': lesson.original_lang_code or lesson.video.language_code, 'target_lang': lesson.target_lang_code, 's1_track_id': lesson.s1_track_id, 's2_track_id': lesson.s2_track_id, 's3_track_id': lesson.s3_track_id}, 'lines': []}
    if track:
        if current_user.role == 'free' and (lesson.time_spent or 0) >= 600:
            raise HTTPException(status_code=403, detail="Video locked")
        lines = []
        for line in track.content_json:
            if 'end' not in line: line['end'] = round(line['start'] + line.get('duration', 2.0), 3)
            lines.append(line)
        res.update({'track_id': track.id, 'language_code': track.language_code, 'lines': lines})
    return res

# --- Video ---

@router.post('/video/import')
def import_video(data: Dict[str, str], background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    url = data.get('youtube_url', '').strip()
    if not url: raise HTTPException(status_code=400, detail="URL required")
    if not current_user.is_at_least_vip: raise HTTPException(status_code=403, detail="VIP required")
    v_id = extract_video_id(url)
    if not v_id: raise HTTPException(status_code=400, detail="Invalid URL")
    video = db.query(Video).filter_by(youtube_id=v_id).first()
    if not video:
        video = Video(youtube_id=v_id, title="Processing...", status='pending', language_code=data.get('language_code', 'en'))
        db.add(video); db.commit()
    if video.status != 'completed':
        from app.modules.content.tasks import process_video_metadata
        get_task_runner(background_tasks).run(process_video_metadata, video.id)
    if not db.query(Lesson).filter_by(user_id=current_user.id, video_id=video.id).first():
        db.add(Lesson(user_id=current_user.id, video_id=video.id)); db.commit()
    return {'success': True, 'video_id': video.id, 'title': video.title}

@router.delete('/lesson/{lesson_id}')
def delete_lesson_api(lesson_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson: raise HTTPException(status_code=404)
    db.delete(lesson); db.commit()
    return {'success': True}

@router.get('/health')
def health():
    return {"status": "ok", "service": "PodLearn Study", "version": "3.0.0"}

@router.patch('/lesson/{lesson_id}/settings')
def update_lesson_settings_api(lesson_id: int, data: Dict[str, Any], current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    lesson = db.query(Lesson).filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson: raise HTTPException(status_code=404)
    prefs = json.loads(lesson.settings_json or '{}')
    
    # If frontend sends stringified settings_json, parse and merge
    if 'settings_json' in data:
        try:
            s_data = data['settings_json']
            if isinstance(s_data, str):
                new_settings = json.loads(s_data)
                prefs.update(new_settings)
            else:
                prefs.update(s_data)
        except Exception as e:
            logger.error(f"Failed to parse settings_json: {e}")
    
    # Merge other flat fields (like track IDs)
    for k, v in data.items():
        if k != 'settings_json':
            prefs[k] = v

    lesson.settings_json = json.dumps(prefs)
    
    # Sync specific columns if they exist in prefs
    if 's1_track_id' in prefs: lesson.s1_track_id = prefs['s1_track_id']
    if 's2_track_id' in prefs: lesson.s2_track_id = prefs['s2_track_id']
    if 's3_track_id' in prefs: lesson.s3_track_id = prefs['s3_track_id']
    if 'sourceTrackId' in prefs: lesson.s1_track_id = prefs['sourceTrackId']

    db.commit()
    return {'success': True, 'settings': prefs}

@router.get('/portable/export/{lesson_id}')
def export_lesson_api(lesson_id: int, current_user: User = Depends(get_current_user)):
    data = portable_service.export_lesson_package(lesson_id)
    if not data: raise HTTPException(status_code=404)
    return Response(json.dumps(data, ensure_ascii=False, indent=2), mimetype="application/json", headers={"Content-disposition": f"attachment; filename=podlearn_{data['video']['youtube_id']}.json"})
