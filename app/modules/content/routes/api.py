from flask import Blueprint, jsonify, request, current_app, Response
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.content.models import SubtitleTrack, Video, VideoCollaborator
from app.modules.study.models import Lesson
import os
import json

content_api = Blueprint('content_api', __name__, url_prefix='/api/content')

# ── Player & Subtitles ────────────────────────────────────────

@content_api.route('/player/lesson/<int:lesson_id>', methods=['GET'])
@jwt_required()
def get_player_data(lesson_id):
    """Retrieve all data needed for the Video Player SPA."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    # Get available tracks for the video
    all_tracks = SubtitleTrack.query.filter_by(video_id=lesson.video.id).all()
    available_tracks = [{
        'id': t.id,
        'language_code': t.language_code,
        'is_auto_generated': t.is_auto_generated,
        'name': t.name or f"{t.language_code.upper()}_Original",
        'uploader_name': t.uploader_name or ("YouTube" if not t.uploader_id else "Unknown"),
        'status': t.status
    } for t in all_tracks]

    return jsonify({
        "status": "success",
        "lesson": {
            "id": lesson.id,
            "title": lesson.video.title,
            "video_id": lesson.video.youtube_id,
            "total_time_spent": lesson.time_spent or 0,
            "settings": json.loads(lesson.settings_json or '{}') if isinstance(lesson.settings_json, str) else (lesson.settings_json or {}),
        },
        "subtitles": {
            "track_1_id": lesson.s1_track_id,  # Primary (Target)
            "track_2_id": lesson.s2_track_id,  # Secondary (Native)
            "track_3_id": lesson.s3_track_id,  # Tertiary (Analysis)
            "available_tracks": available_tracks,
            "youtube_original_available": True  # Client can still pull from YT if needed
        }
    })

@content_api.route('/subtitles/available/<int:lesson_id>', methods=['GET'])
@jwt_required()
def get_available_subtitles(lesson_id):
    """List all available subtitle tracks for a lesson's video with full metadata."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    all_tracks = SubtitleTrack.query.filter_by(video_id=lesson.video.id).all()
    
    return jsonify({
        "subtitles": [{
            'id': t.id,
            'language_code': t.language_code,
            'is_auto_generated': t.is_auto_generated,
            'is_original': t.is_original,
            'name': t.name or f"{t.language_code.upper()}_Original",
            'uploader_name': t.uploader_name or ("YouTube" if not t.uploader_id else "Unknown"),
            'uploader_id': t.uploader_id,
            'fetched_at': t.fetched_at.isoformat() if hasattr(t, 'fetched_at') and t.fetched_at else None,
            'line_count': len(t.content_json) if t.content_json else 0,
            'status': t.status,
            'note': t.note
        } for t in all_tracks]
    })

@content_api.route('/subtitles/<int:track_id>', methods=['GET'])
def get_subtitle_content(track_id):
    """Fetch the actual content_json of a subtitle track."""
    track = SubtitleTrack.query.get_or_404(track_id)
    return jsonify({
        "id": track.id,
        "language_code": track.language_code,
        "content": track.content_json
    })

@content_api.route('/subtitles/<int:track_id>/export', methods=['GET'])
def export_subtitle_track(track_id):
    """Export a subtitle track as SRT or VTT file."""
    from flask import Response
    from app.modules.content.services.subtitle_service import export_track_to_string
    
    track = SubtitleTrack.query.get_or_404(track_id)
    fmt = request.args.get('format', 'srt').lower()
    
    if fmt not in ('srt', 'vtt'):
        return jsonify({"error": "Unsupported format. Use 'srt' or 'vtt'."}), 400
    
    content = export_track_to_string(track, fmt)
    mime = 'text/vtt' if fmt == 'vtt' else 'application/x-subrip'
    filename = f"{track.name or f'track_{track_id}'}.{fmt}"
    
    return Response(
        content,
        mimetype=mime,
        headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
    )

# ── Hands-Free Audio ──────────────────────────────────────────

@content_api.route('/handsfree/generate', methods=['POST'])
@jwt_required()
def generate_handsfree():
    """Start a background task to generate podcast-style audio."""
    from app.modules.content.services.handsfree_service import start_generation_task
    from app.modules.content.models import SubtitleTrack
    
    data = request.get_json() or {}
    video_id = data.get('video_id')
    lesson_id = data.get('lesson_id')
    track_source = data.get('track_source', 'original')
    lang = data.get('lang', 'vi')
    
    if not video_id:
        return jsonify({"error": "video_id is required"}), 400
        
    # Get subtitles for generation
    # Primary (original)
    original_track = SubtitleTrack.query.filter_by(video_id=video_id, language_code='ja').first()
    # Secondary (translation)
    trans_track = SubtitleTrack.query.filter_by(video_id=video_id, language_code=lang).first()
    
    if not original_track:
        return jsonify({"error": "Original subtitles not found"}), 404
        
    task_id = start_generation_task(
        video_id=video_id,
        subtitles=original_track.content_json,
        translation_lines=trans_track.content_json if trans_track else None,
        lang=lang
    )
    
    return jsonify({"status": "processing", "task_id": task_id})

@content_api.route('/handsfree/status/<task_id>', methods=['GET'])
@jwt_required()
def get_handsfree_status(task_id):
    """Check the status of an audio generation task."""
    from app.modules.content.services.handsfree_service import handsfree_tasks
    task = handsfree_tasks.get(task_id)
    if not task:
        return jsonify({"error": "Task not found"}), 404
        
    response = {
        "status": task['status'],
        "progress": task['progress'],
        "step": task['step']
    }
    
    if task['status'] == 'completed':
        response.update(task['result'])
    elif task['status'] == 'failed':
        response['error'] = task['error']
        
    return jsonify(response)

@content_api.route('/handsfree/cached/<video_id>', methods=['GET'])
@jwt_required()
def get_handsfree_cached(video_id):
    """Check if a generated audio file already exists for this video."""
    from app.modules.content.services.handsfree_service import build_handsfree_audio
    from app.modules.content.models import SubtitleTrack
    
    lang = request.args.get('lang', 'vi')
    # Use empty subtitles to just check cache in build_handsfree_audio
    result = build_handsfree_audio(video_id, [], [], lang)
    if result:
        return jsonify({"cached": True, **result})
    return jsonify({"cached": False})

@content_api.route('/handsfree/original/<video_id>', methods=['GET'])
@jwt_required()
def get_handsfree_original(video_id):
    """Get the original YouTube audio info (download if needed)."""
    from app.modules.content.services.handsfree_service import get_original_audio_info
    result = get_original_audio_info(video_id)
    if result:
        return jsonify(result)
    return jsonify({"error": "Failed to fetch original audio"}), 500

# ── AI ASSESSMENT STUBS (Cost Optimization) ───────────────────

@content_api.route('/ai/analyze-sentence', methods=['POST'])
@jwt_required()
def ai_analyze_sentence():
    """AI analysis of a single sentence (Currently on hold)."""
    return jsonify({
        "status": "pending",
        "message": "AI assessment features are currently on hold to optimize costs.",
        "data": None
    })

@content_api.route('/ai/pronunciation-score', methods=['POST'])
@jwt_required()
def ai_pronunciation_score():
    """AI scoring for pronunciation (Currently on hold)."""
    return jsonify({
        "status": "pending",
        "message": "Pronunciation scoring via AI is currently on hold."
    })

# ── Subtitle Management (CRUD) ───────────────────────────────
# (Merging essential subtitle_api.py routes)

@content_api.route('/subtitles/<int:track_id>/full', methods=['PATCH'])
@jwt_required()
def update_subtitle_full(track_id):
    """Update entire track content from pasted SRT/VTT text."""
    from app.modules.content.services.subtitle_service import parse_subtitle_text
    from sqlalchemy.orm.attributes import flag_modified
    
    track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    content = data.get('content', '').strip()
    
    if not content:
        return jsonify({"error": "Content is empty"}), 400
        
    # Auto-detect format and parse
    res = parse_subtitle_text(content)
    if res.get('error'):
        return jsonify(res), 400
        
    track.content_json = res['lines']
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({"status": "success", "count": len(res['lines'])})

@content_api.route('/subtitles/<int:track_id>/line/<int:line_index>', methods=['PATCH'])
@jwt_required()
def update_subtitle_line(track_id, line_index):
    track = SubtitleTrack.query.get_or_404(track_id)
    data = request.get_json() or {}
    
    if not isinstance(track.content_json, list) or line_index >= len(track.content_json):
        return jsonify({"error": "Invalid index"}), 400
        
    lines = list(track.content_json)
    line = dict(lines[line_index])
    if 'text' in data: line['text'] = data['text']
    lines[line_index] = line
    
    from sqlalchemy.orm.attributes import flag_modified
    track.content_json = lines
    flag_modified(track, 'content_json')
    db.session.commit()
    
    return jsonify({"status": "success", "line": line})

@content_api.route('/curated/<string:youtube_id>', methods=['GET'])
def get_curated_content(youtube_id):
    video = Video.query.filter_by(youtube_id=youtube_id).first_or_404()
    
    sections = video.curated_sections
    if not sections:
        # Check if we have legacy data to migrate
        if video.curated_overview or video.curated_grammar or video.curated_vocabulary:
            sections = [
                {"id": "overview", "title": "Tổng quan", "content": video.curated_overview or ""},
                {"id": "grammar", "title": "Ngữ pháp", "content": video.curated_grammar or ""},
                {"id": "vocabulary", "title": "Từ vựng", "content": video.curated_vocabulary or ""}
            ]
        else:
            # Fresh start: only Overview
            sections = [
                {"id": "overview", "title": "Tổng quan", "content": ""}
            ]
    
    return jsonify(sections)

@content_api.route('/curated/<string:youtube_id>', methods=['PATCH'])
@jwt_required()
def update_curated_content(youtube_id):
    # Only admins or collaborators should be able to edit
    if current_user.role != 'admin':
        # Check if collaborator
        video = Video.query.filter_by(youtube_id=youtube_id).first_or_404()
        collab = VideoCollaborator.query.filter_by(video_id=video.id, user_id=current_user.id).first()
        if not collab:
            return jsonify({"error": "Unauthorized"}), 403
    else:
        video = Video.query.filter_by(youtube_id=youtube_id).first_or_404()

    data = request.get_json() or {}
    
    # Support both old keys (for backward compatibility during transition) and new 'sections'
    if 'sections' in data:
        video.curated_sections = data['sections']
    else:
        # Fallback to old fields if they are sent individually
        if 'overview' in data: video.curated_overview = data['overview']
        if 'grammar' in data: video.curated_grammar = data['grammar']
        if 'vocabulary' in data: video.curated_vocabulary = data['vocabulary']
        
        # Also sync to sections if we want to force migration on first save
        video.curated_sections = [
            {"id": "overview", "title": "Tổng quan", "content": video.curated_overview or ""},
            {"id": "grammar", "title": "Ngữ pháp", "content": video.curated_grammar or ""},
            {"id": "vocabulary", "title": "Từ vựng", "content": video.curated_vocabulary or ""}
        ]
    
    db.session.commit()
    return jsonify({"status": "success"})
