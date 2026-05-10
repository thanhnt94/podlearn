from fastapi import APIRouter, Depends, HTTPException, status, Request, Response, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import json
import os
import unicodedata
from urllib.parse import quote
from typing import List, Optional

from app.core.database import get_db
from app.core.security import get_current_user
from app.modules.content.models import SubtitleTrack, Video, VideoCollaborator
from app.modules.study.models import Lesson
from app.modules.content.schemas import (
    PlayerDataResponse, LessonPlayerInfo, SubtitlesPlayerInfo, TrackMetadata,
    SubtitleUpdateName, SubtitleTranslateRequest, HandsFreeGenerateRequest,
    SubtitleFullUpdate, SubtitleLineUpdate, CuratedSection, VideoVisibilityUpdate
)
from app.modules.content.services.subtitle_service import (
    export_track_to_string, parse_subtitle_text, run_translation_background
)
from app.modules.content.services.handsfree_service import (
    start_generation_task, handsfree_tasks, build_handsfree_audio,
    get_direct_audio_url, get_original_audio_info
)
from app.modules.identity.models import User
from app.core.config import settings

router = APIRouter(prefix="/api/content", tags=["Content"])

# ── Player & Subtitles ────────────────────────────────────────

@router.get('/player/lesson/{lesson_id}', response_model=PlayerDataResponse)
def get_player_data(lesson_id: int, current_user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve all data needed for the Video Player SPA."""
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    video = db.query(Video).get(lesson.video_id)
    is_owner = current_user and lesson.user_id == current_user.id
    is_public = video and video.visibility == 'public'
    
    if not is_owner and not is_public:
        raise HTTPException(status_code=403, detail="Unauthorized or Private Content")
    
    all_tracks = db.query(SubtitleTrack).filter_by(video_id=video.id).all()
    available_tracks = [
        TrackMetadata(
            id=t.id,
            language_code=t.language_code,
            is_auto_generated=t.is_auto_generated,
            name=t.name or f"{t.language_code.upper()}_Original",
            uploader_name=t.uploader_name or ("YouTube" if not t.uploader_id else "Unknown"),
            status=t.status
        ) for t in all_tracks
    ]

    settings_dict = {}
    if lesson.settings_json:
        if isinstance(lesson.settings_json, str):
            try:
                settings_dict = json.loads(lesson.settings_json)
            except:
                pass
        else:
            settings_dict = lesson.settings_json

    return PlayerDataResponse(
        lesson=LessonPlayerInfo(
            id=lesson.id,
            title=video.title,
            video_id=video.youtube_id,
            total_time_spent=lesson.time_spent or 0,
            settings=settings_dict
        ),
        subtitles=SubtitlesPlayerInfo(
            track_1_id=lesson.s1_track_id,
            track_2_id=lesson.s2_track_id,
            track_3_id=lesson.s3_track_id,
            available_tracks=available_tracks
        )
    )

@router.get('/subtitles/available/{lesson_id}')
def get_available_subtitles(lesson_id: int, current_user: Optional[User] = Depends(get_current_user), db: Session = Depends(get_db)):
    """List all available subtitle tracks for a lesson's video with full metadata."""
    lesson = db.query(Lesson).get(lesson_id)
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    video = db.query(Video).get(lesson.video_id)
    is_owner = current_user and lesson.user_id == current_user.id
    is_public = video and video.visibility == 'public'
    
    if not is_owner and not is_public:
        raise HTTPException(status_code=403, detail="Unauthorized")
        
    all_tracks = db.query(SubtitleTrack).filter_by(video_id=video.id).all()
    
    return {
        "subtitles": [
            {
                'id': t.id,
                'language_code': t.language_code,
                'is_auto_generated': t.is_auto_generated,
                'is_original': t.is_original,
                'name': t.name or f"{t.language_code.upper()}_Original",
                'uploader_name': t.uploader_name or ("YouTube" if not t.uploader_id else "Unknown"),
                'uploader_id': t.uploader_id,
                'fetched_at': t.fetched_at.isoformat() if t.fetched_at else None,
                'line_count': len(t.content_json) if t.content_json else 0,
                'status': t.status,
                'note': t.note
            } for t in all_tracks
        ]
    }

@router.get('/subtitles/{track_id}')
def get_subtitle_content(track_id: int, db: Session = Depends(get_db)):
    """Fetch the actual content_json of a subtitle track."""
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return {
        "id": track.id,
        "language_code": track.language_code,
        "content": track.content_json
    }

@router.get('/subtitles/{track_id}/export')
def export_subtitle_track(track_id: int, format: str = 'srt', db: Session = Depends(get_db)):
    """Export a subtitle track as SRT or VTT file."""
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    fmt = format.lower()
    if fmt not in ('srt', 'vtt'):
        raise HTTPException(status_code=400, detail="Unsupported format. Use 'srt' or 'vtt'.")
    
    content = export_track_to_string(track, fmt)
    media_type = 'text/vtt' if fmt == 'vtt' else 'application/x-subrip'
    filename = f"{track.name or f'track_{track_id}'}.{fmt}"
    
    def slugify(text):
        normalized = unicodedata.normalize('NFKD', text).encode('ascii', 'ignore').decode('ascii')
        return normalized if normalized else "subtitle"

    safe_filename = slugify(filename)
    encoded_filename = quote(filename)
    
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename=\"{safe_filename}\"; filename*=UTF-8''{encoded_filename}"}
    )

@router.patch('/subtitles/{track_id}')
def update_subtitle_name(track_id: int, data: SubtitleUpdateName, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update track name or metadata."""
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if data.name is not None:
        track.name = data.name
    if data.language_code is not None:
        track.language_code = data.language_code
    
    db.commit()
    return {"success": True}

@router.delete('/subtitles/{track_id}')
def delete_subtitle_track(track_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Permanently remove a subtitle track."""
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    db.delete(track)
    db.commit()
    return {"success": True}

@router.post('/subtitles/{track_id}/translate')
def translate_subtitle_track(track_id: int, data: SubtitleTranslateRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Translate an entire subtitle track using AI."""
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")

    if not track.content_json:
        raise HTTPException(status_code=400, detail="Track has no content to translate")

    target_lang = data.target_lang
    new_name = data.name or f"{track.name} ({target_lang.upper()})"
    
    new_track = SubtitleTrack(
        video_id=track.video_id,
        language_code=target_lang,
        name=new_name,
        content_json=[],
        uploader_id=current_user.id,
        status='pending'
    )
    db.add(new_track)
    db.commit()
    db.refresh(new_track)
    
    # Run translation in background
    background_tasks.add_task(run_translation_background, new_track.id, target_lang, track.language_code)
    
    return {"success": True, "track_id": new_track.id}

# ── Hands-Free Audio ──────────────────────────────────────────

@router.post('/handsfree/generate')
def generate_handsfree(data: HandsFreeGenerateRequest, background_tasks: BackgroundTasks, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Start a background task to generate podcast-style audio."""
    video_id = data.video_id
    lang = data.lang
    
    # Get subtitles for generation
    original_track = db.query(SubtitleTrack).filter_by(video_id=video_id, language_code='ja').first()
    trans_track = db.query(SubtitleTrack).filter_by(video_id=video_id, language_code=lang).first()
    
    if not original_track:
        raise HTTPException(status_code=404, detail="Original subtitles not found")
        
    task_id = f"hf_{hashlib.md5(f'{video_id}{time.time()}'.encode()).hexdigest()[:12]}"
    handsfree_tasks[task_id] = {
        'status': 'processing',
        'step': 'queued',
        'progress': 0.0,
        'result': None,
        'error': None
    }
    
    background_tasks.add_task(
        build_handsfree_audio, 
        video_id, 
        original_track.content_json, 
        trans_track.content_json if trans_track else None, 
        lang, 
        task_id
    )
    
    return {"status": "processing", "task_id": task_id}

@router.get('/handsfree/status/{task_id}')
def get_handsfree_status(task_id: str, current_user: User = Depends(get_current_user)):
    """Check the status of an audio generation task."""
    task = handsfree_tasks.get(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
        
    response = {
        "status": task['status'],
        "progress": task['progress'],
        "step": task['step']
    }
    
    if task['status'] == 'completed':
        response.update(task['result'])
    elif task['status'] == 'failed':
        response['error'] = task['error']
        
    return response

@router.get('/handsfree/cached/{video_id}')
def get_handsfree_cached(video_id: str, lang: str = 'vi', current_user: User = Depends(get_current_user)):
    """Check if a generated audio file already exists for this video."""
    result = build_handsfree_audio(video_id, [], [], lang)
    if result:
        return {"cached": True, **result}
    return {"cached": False}

@router.get('/handsfree/original/{video_id}')
def get_handsfree_original(video_id: str, current_user: User = Depends(get_current_user)):
    """Get the original YouTube audio info."""
    result = get_original_audio_info(video_id)
    if result:
        return result
    raise HTTPException(status_code=500, detail="Failed to fetch original audio")

@router.get('/audio-stream/{video_id}')
def get_audio_stream_url(video_id: str, current_user: User = Depends(get_current_user)):
    """Extract a direct audio stream URL."""
    result = get_direct_audio_url(video_id)
    if result:
        return {"success": True, **result}
    raise HTTPException(status_code=500, detail="Could not extract audio stream.")

@router.post('/subtitles/upload/{video_id}')
async def upload_subtitle(
    video_id: int, 
    file: UploadFile = File(...), 
    language_code: str = Form(...), 
    name: Optional[str] = Form(None),
    current_user: User = Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Manual upload for SRT/VTT subtitle files."""
    video = db.get(Video, video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    content_bytes = await file.read()
    try:
        content_text = content_bytes.decode('utf-8')
    except UnicodeDecodeError:
        content_text = content_bytes.decode('latin-1', errors='replace')
        
    res = parse_subtitle_text(content_text)
    if res.get('error'):
        raise HTTPException(status_code=400, detail=res.get('message'))
        
    track = SubtitleTrack(
        video_id=video.id,
        language_code=language_code,
        name=name or f"Manual_{language_code.upper()}",
        content_json=res['lines'],
        is_auto_generated=False,
        is_original=True,
        uploader_id=current_user.id,
        uploader_name=current_user.username,
        status='completed',
        fetched_at=datetime.now(timezone.utc)
    )
    db.add(track)
    db.commit()
    db.refresh(track)
    
    return {"success": True, "track_id": track.id, "line_count": len(res['lines'])}

# ── AI ASSESSMENT STUBS ───────────────────

@router.post('/ai/analyze-sentence')
def ai_analyze_sentence(current_user: User = Depends(get_current_user)):
    return {
        "status": "pending",
        "message": "AI assessment features are currently on hold to optimize costs.",
        "data": None
    }

@router.post('/ai/pronunciation-score')
def ai_pronunciation_score(current_user: User = Depends(get_current_user)):
    return {
        "status": "pending",
        "message": "Pronunciation scoring via AI is currently on hold."
    }

# ── Subtitle Management (CRUD) ───────────────────────────────

@router.patch('/subtitles/{track_id}/full')
def update_subtitle_full(track_id: int, data: SubtitleFullUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update entire track content from pasted SRT/VTT text."""
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
        
    content = data.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content is empty")
        
    res = parse_subtitle_text(content)
    if res.get('error'):
        raise HTTPException(status_code=400, detail=res.get('message'))
        
    track.content_json = res['lines']
    db.commit()
    
    return {"status": "success", "count": len(res['lines'])}

@router.patch('/subtitles/{track_id}/line/{line_index}')
def update_subtitle_line(track_id: int, line_index: int, data: SubtitleLineUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    track = db.query(SubtitleTrack).get(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    if not isinstance(track.content_json, list) or line_index >= len(track.content_json):
        raise HTTPException(status_code=400, detail="Invalid index")
        
    lines = list(track.content_json)
    line = dict(lines[line_index])
    line['text'] = data.text
    lines[line_index] = line
    
    track.content_json = lines
    db.commit()
    
    return {"status": "success", "line": line}

@router.get('/curated/{youtube_id}')
def get_curated_content(youtube_id: str, db: Session = Depends(get_db)):
    video = db.query(Video).filter_by(youtube_id=youtube_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    sections = video.curated_sections
    if not sections:
        if video.curated_overview or video.curated_grammar or video.curated_vocabulary:
            sections = [
                {"id": "overview", "title": "Tổng quan", "content": video.curated_overview or ""},
                {"id": "grammar", "title": "Ngữ pháp", "content": video.curated_grammar or ""},
                {"id": "vocabulary", "title": "Từ vựng", "content": video.curated_vocabulary or ""}
            ]
        else:
            sections = [{"id": "overview", "title": "Tổng quan", "content": ""}]
    
    return sections

@router.patch('/curated/{youtube_id}')
def update_curated_content(youtube_id: str, data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    video = db.query(Video).filter_by(youtube_id=youtube_id).first()
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
        
    # Only admins or collaborators should be able to edit
    if current_user.role != 'admin':
        collab = db.query(VideoCollaborator).filter_by(video_id=video.id, user_id=current_user.id).first()
        if not collab:
            raise HTTPException(status_code=403, detail="Unauthorized")

    if 'sections' in data:
        video.curated_sections = data['sections']
    else:
        if 'overview' in data: video.curated_overview = data['overview']
        if 'grammar' in data: video.curated_grammar = data['grammar']
        if 'vocabulary' in data: video.curated_vocabulary = data['vocabulary']
        
        video.curated_sections = [
            {"id": "overview", "title": "Tổng quan", "content": video.curated_overview or ""},
            {"id": "grammar", "title": "Ngữ pháp", "content": video.curated_grammar or ""},
            {"id": "vocabulary", "title": "Từ vựng", "content": video.curated_vocabulary or ""}
        ]
    
    db.commit()
    return {"status": "success"}

@router.patch('/video/{video_id}/visibility')
def set_video_visibility(video_id: int, data: VideoVisibilityUpdate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update video visibility."""
    video = db.query(Video).get(video_id)
    if not video:
        raise HTTPException(status_code=404, detail="Video not found")
    
    target_visibility = data.visibility
    if data.is_public is not None:
        target_visibility = 'public' if data.is_public else 'private'

    if not target_visibility:
        raise HTTPException(status_code=400, detail="Missing visibility parameter")

    if current_user.role == 'admin':
        video.visibility = target_visibility
    else:
        if target_visibility == 'public':
            video.visibility = 'pending_public'
        elif target_visibility == 'private':
            video.visibility = 'private'
        else:
            raise HTTPException(status_code=403, detail="Unauthorized visibility change")
            
    db.commit()
    return {"success": True, "visibility": video.visibility}
