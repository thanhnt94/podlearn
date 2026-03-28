"""API routes — AJAX endpoints for subtitles, notes, etc."""

import os
import tempfile
import webvtt
import re
from werkzeug.utils import secure_filename

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from ..extensions import db
from ..models.lesson import Lesson
from ..models.video import Video
from ..models.note import Note
from ..models.subtitle import SubtitleTrack
from ..services.subtitle_service import get_subtitle_track, get_lines_as_dicts

api_bp = Blueprint('api', __name__)

@api_bp.route('/video/status/<int:video_id>', methods=['GET'])
@login_required
def get_video_status(video_id):
    """Check background processing status of a video."""
    video = Video.query.get_or_404(video_id)
    return jsonify({
        'id': video.id,
        'youtube_id': video.youtube_id,
        'title': video.title,
        'status': video.status or 'unknown'
    })

def _parse_srt(filepath: str) -> list[dict]:
    """Parse SRT file into a list of dicts."""
    entries = []
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    pattern = re.compile(
        r'\d+\s*\n(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*\n(.*?)(?=\n\n|\Z)',
        re.DOTALL
    )
    for match in pattern.finditer(content + '\n\n'):
        parts = match.groups()
        h1, m1, s1, ms1, h2, m2, s2, ms2 = [int(p) for p in parts[:8]]
        text = parts[8].replace('\n', ' ').strip()
        
        start = h1 * 3600 + m1 * 60 + s1 + ms1 / 1000.0
        end = h2 * 3600 + m2 * 60 + s2 + ms2 / 1000.0
        entries.append({
            'start': round(start, 3),
            'duration': round(end - start, 3),
            'text': text
        })
    return entries


@api_bp.route('/subtitles/available/<int:lesson_id>', methods=['GET'])
@login_required
def get_available_subtitles(lesson_id):
    """Return list of subtitles currently uploaded/cached in the DB."""
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    tracks = SubtitleTrack.query.filter_by(video_id=lesson.video.id).all()
    results = []
    for t in tracks:
        results.append({
            'language_code': t.language_code,
            'is_auto_generated': t.is_auto_generated,
            'uploader_name': t.uploader_name or "Unknown",
            'fetched_at': t.fetched_at.isoformat() if hasattr(t, 'fetched_at') and t.fetched_at else None,
            'line_count': len(t.content_json) if t.content_json else 0
        })
        
    return jsonify({'subtitles': results})


@api_bp.route('/subtitles/fetch/<int:lesson_id>', methods=['POST'])
@login_required
def fetch_subtitles(lesson_id):
    """Fetch (or load cached) subtitles for a specific language."""
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    data = request.get_json() or {}
    lang_code = data.get('language_code', '').strip()

    if not lang_code:
        return jsonify({'error': 'language_code is required'}), 400

    track = SubtitleTrack.query.filter_by(
        video_id=lesson.video.id,
        language_code=lang_code
    ).first()

    has_lines = (track.content_json and len(track.content_json) > 0)
    if not track or not has_lines:
        return jsonify({'error': f'Subtitles for language "{lang_code}" have not been uploaded yet. Please upload a file first.'}), 404

    lines = get_lines_as_dicts(track)
    return jsonify({
        'track_id': track.id,
        'language_code': track.language_code,
        'is_auto_generated': track.is_auto_generated,
        'uploader_name': track.uploader_name or "Unknown",
        'fetched_at': track.fetched_at.isoformat() if track.fetched_at else None,
        'line_count': len(lines),
        'lines': lines,
    })


@api_bp.route('/subtitles/upload/<int:lesson_id>', methods=['POST'])
@login_required
def upload_subtitles(lesson_id):
    """Handle manual subtitle file uploads (.vtt, .srt)."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file part provided'}), 400
        
    file = request.files['file']
    lang_code = request.form.get('language_code', '').strip()
    
    if not file or not file.filename:
        return jsonify({'error': 'No selected file'}), 400
    if not lang_code:
        return jsonify({'error': 'language_code is required'}), 400
        
    filename = secure_filename(file.filename)
    is_vtt = filename.endswith('.vtt')
    is_srt = filename.endswith('.srt')
    
    if not (is_vtt or is_srt):
        return jsonify({'error': 'Only .vtt and .srt files are allowed'}), 400
        
    parsed_data = []
    video_id = lesson.video.id
    
    with tempfile.TemporaryDirectory() as tmpdir:
        temp_path = os.path.join(tmpdir, filename)
        file.save(temp_path)
        
        try:
            if is_vtt:
                for caption in webvtt.read(temp_path):
                    text_clean = caption.text.replace('\n', ' ').strip()
                    if not text_clean:
                        continue
                    parsed_data.append({
                        "start": round(caption.start_in_seconds, 3),
                        "duration": round(caption.end_in_seconds - caption.start_in_seconds, 3),
                        "text": text_clean
                    })
            elif is_srt:
                parsed_data = _parse_srt(temp_path)
        except Exception as e:
            return jsonify({'error': f'Failed to parse subtitle file: {e}'}), 500
            
    if not parsed_data:
        return jsonify({'error': 'No valid subtitle lines found in file'}), 400
        
    # Get custom metadata
    custom_name = request.form.get('name', '').strip()
    custom_note = request.form.get('note', '').strip()
    
    final_uploader_name = custom_name if custom_name else current_user.username

    # Check if a track already exists to reuse/overwrite
    track = SubtitleTrack.query.filter_by(video_id=video_id, language_code=lang_code).first()
    if not track:
        track = SubtitleTrack(
            video_id=video_id,
            language_code=lang_code,
            is_auto_generated=False
        )
        db.session.add(track)

    # Update track data
    track.uploader_id = current_user.id
    track.uploader_name = final_uploader_name
    track.note = custom_note
    track.content_json = parsed_data
    
    # Optional: No cleanup needed if SubtitleLine is removed from model
        
    db.session.commit()
    
    lines = get_lines_as_dicts(track)
    return jsonify({
        'status': 'ok',
        'track_id': track.id,
        'language_code': track.language_code,
        'is_auto_generated': track.is_auto_generated,
        'uploader_name': track.uploader_name or "Unknown",
        'fetched_at': track.fetched_at.isoformat() if hasattr(track, 'fetched_at') and track.fetched_at else None,
        'line_count': len(lines),
        'lines': lines,
    })


@api_bp.route('/lesson/<int:lesson_id>/set-languages', methods=['POST'])
@login_required
def set_languages(lesson_id):
    """Save the user's chosen original + target + third language and UI settings for a lesson."""
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    data = request.get_json() or {}
    original = data.get('original_lang_code')
    target = data.get('target_lang_code')
    third = data.get('third_lang_code')
    settings = data.get('settings')

    if original is not None:
        lesson.original_lang_code = original.strip()
    if target is not None:
        lesson.target_lang_code = target.strip()
    if third is not None:
        lesson.third_lang_code = third.strip()
        
    if settings:
        import json
        lesson.settings_json = json.dumps(settings)

    db.session.commit()
    return jsonify({'status': 'ok'})


@api_bp.route('/notes/<int:note_id>', methods=['PUT', 'PATCH'])
@login_required
def edit_note(note_id):
    """Update note content and/or timestamp."""
    note = Note.query.filter_by(
        id=note_id,
        user_id=current_user.id
    ).first_or_404()

    data = request.get_json() or {}
    content = data.get('content')
    timestamp = data.get('timestamp')

    if content is not None:
        note.content = content.strip()
    
    if timestamp is not None:
        try:
            note.timestamp = float(timestamp)
        except ValueError:
            return jsonify({'error': 'Invalid timestamp format'}), 400

    db.session.commit()
    return jsonify({
        'status': 'ok',
        'note': {
            'id': note.id,
            'timestamp': note.timestamp,
            'content': note.content
        }
    })


@api_bp.route('/lesson/<int:lesson_id>/notes', methods=['GET'])
@login_required
def get_notes(lesson_id):
    """Get all notes for a specific lesson."""
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    notes = Note.query.filter_by(lesson_id=lesson.id, user_id=current_user.id).order_by(Note.timestamp).all()
    
    return jsonify({
        'notes': [{
            'id': note.id,
            'timestamp': note.timestamp,
            'content': note.content,
            'created_at': note.created_at.isoformat()
        } for note in notes]
    })


@api_bp.route('/lesson/<int:lesson_id>/notes', methods=['POST'])
@login_required
def add_note(lesson_id):
    """Add a new note at a specific timestamp."""
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    data = request.get_json() or {}
    timestamp = data.get('timestamp')
    content = data.get('content', '').strip()

    if timestamp is None or not content:
        return jsonify({'error': 'Timestamp and content are required'}), 400

    try:
        timestamp = float(timestamp)
    except ValueError:
        return jsonify({'error': 'Invalid timestamp format'}), 400

    new_note = Note(
        user_id=current_user.id,
        lesson_id=lesson.id,
        timestamp=timestamp,
        content=content
    )
    db.session.add(new_note)
    db.session.commit()

    return jsonify({
        'status': 'ok',
        'note': {
            'id': new_note.id,
            'timestamp': new_note.timestamp,
            'content': new_note.content,
            'created_at': new_note.created_at.isoformat()
        }
    })


@api_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@login_required
def delete_note(note_id):
    """Delete a note."""
    note = Note.query.filter_by(
        id=note_id,
        user_id=current_user.id
    ).first_or_404()

    db.session.delete(note)
    db.session.commit()
    
    return jsonify({'status': 'ok'})


@api_bp.route('/lesson/<int:lesson_id>/transcript/edit', methods=['POST'])
@login_required
def edit_transcript(lesson_id):
    """Edit a single line in a subtitle track."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    data = request.get_json() or {}
    lang_code = data.get('language_code')
    line_index = data.get('line_index')
    new_text = data.get('new_text', '').strip()

    if lang_code is None or line_index is None:
        return jsonify({'error': 'Missing language_code or line_index'}), 400

    from ..models.subtitle import SubtitleTrack
    track = SubtitleTrack.query.filter_by(video_id=lesson.video_id, language_code=lang_code).first_or_404()
    
    # JSON update
    if track.content_json and 0 <= line_index < len(track.content_json):
        # SQLAlchemy might not detect mutations if we don't re-assign or use MutableList
        new_list = list(track.content_json)
        new_list[line_index]['text'] = new_text
        track.content_json = new_list
    else:
        return jsonify({'error': 'Line index out of bounds or track is empty'}), 400
    
    db.session.commit()
    return jsonify({'status': 'ok'})


@api_bp.route('/lesson/<int:lesson_id>/transcript/time-edit', methods=['POST'])
@login_required
def edit_transcript_time(lesson_id):
    """Edit the start time of a transcript line for all tracks in this video."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    data = request.get_json() or {}
    line_index = data.get('line_index')
    new_start = data.get('new_start')

    if line_index is None or new_start is None:
        return jsonify({'error': 'Missing line_index or new_start'}), 400

    from ..models.subtitle import SubtitleTrack
    tracks = SubtitleTrack.query.filter_by(video_id=lesson.video_id).all()
    
    for t in tracks:
        if t.content_json and 0 <= line_index < len(t.content_json):
            # Update modern JSON
            new_list = list(t.content_json)
            new_list[line_index]['start'] = float(new_start)
            t.content_json = new_list
    
    db.session.commit()
    return jsonify({'status': 'ok'})
@api_bp.route('/lesson/<int:lesson_id>/track-time', methods=['POST'])
@login_required
def track_time(lesson_id):
    """Add study time and update last accessed."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    data = request.get_json() or {}
    seconds = data.get('seconds_added', 0)
    
    if seconds > 0:
        lesson.time_spent = (lesson.time_spent or 0) + int(seconds)
        # last_accessed is auto-updated by SQLAlchemy's onupdate or explicitly here
        from datetime import datetime, timezone
        lesson.last_accessed = datetime.now(timezone.utc)
        
        db.session.commit()
        
    return jsonify({
        'status': 'ok',
        'total_time_spent': lesson.time_spent
    })


@api_bp.route('/lesson/<int:lesson_id>/toggle-complete', methods=['POST'])
@login_required
def toggle_complete(lesson_id):
    """Toggle a lesson as completed."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    lesson.is_completed = not lesson.is_completed
    db.session.commit()
    
    return jsonify({
        'status': 'ok',
        'is_completed': lesson.is_completed
    })
