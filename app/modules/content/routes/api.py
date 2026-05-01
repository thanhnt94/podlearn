from flask import Blueprint, jsonify, request, current_app, Response
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.content.models import SubtitleTrack, Video
from app.modules.study.models import Lesson
import os

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
        'name': t.name or f"{t.language_code.upper()}_Original",
        'uploader_name': t.uploader_name if t.uploader_id else 'YouTube'
    } for t in all_tracks]

    return jsonify({
        "status": "success",
        "lesson": {
            "id": lesson.id,
            "title": lesson.video.title,
            "video_id": lesson.video.youtube_id,
            "total_time_spent": lesson.time_spent or 0,
            "settings": lesson.settings_json,
        },
        "subtitles": {
            "track_1_id": lesson.s1_track_id,  # Primary (Target)
            "track_2_id": lesson.s2_track_id,  # Secondary (Native)
            "track_3_id": lesson.s3_track_id,  # Tertiary (Analysis)
            "available_tracks": available_tracks,
            "youtube_original_available": True  # Client can still pull from YT if needed
        }
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

# ── Hands-Free Audio ──────────────────────────────────────────

@content_api.route('/handsfree/generate', methods=['POST'])
@jwt_required()
def generate_handsfree():
    """Stub or Proxy for Hands-free generation."""
    # Logic from handsfree_routes.py would go here
    # For now, we maintain the API structure
    return jsonify({"status": "processing", "message": "Hands-free generation started (Stub)"})

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
