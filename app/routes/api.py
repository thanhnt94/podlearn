"""API routes — AJAX endpoints for subtitles, notes, etc."""

import os
import tempfile
import webvtt
import re
from datetime import datetime, timezone, date, timedelta
from werkzeug.utils import secure_filename

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user

from deep_translator import GoogleTranslator
from ..extensions import db
from ..models.user import User
from ..models.lesson import Lesson
from ..models.video import Video
from ..models.note import Note
from ..models.subtitle import SubtitleTrack
from ..services.subtitle_service import get_subtitle_track, get_lines_as_dicts

api_bp = Blueprint('api', __name__)

@api_bp.route('/translate', methods=['POST'])
@login_required
def translate():
    """Proxy translation requests through server to avoid CORS/IP blocks."""
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        target_lang = data.get('target_lang', 'vi').strip()
        source_lang = data.get('source_lang', 'auto').strip()

        if not text:
            return jsonify({'error': 'text is required'}), 400

        # Run translation
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)

        return jsonify({
            'original': text,
            'translated': translated,
            'target_lang': target_lang
        })
    except Exception as e:
        print(f"[API ERROR] Translation failed: {str(e)}")
        return jsonify({'error': str(e), 'translated': None}), 500

@api_bp.route('/lesson/<int:lesson_id>/track-time', methods=['POST'])
@login_required
def track_time(lesson_id):
    """Update time spent on a lesson and handle Streak logic."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    seconds = data.get('seconds_added', 0)

    # 1. Update Lesson stats
    lesson.time_spent += int(seconds)
    lesson.last_accessed = datetime.now(timezone.utc)

    # 2. Gamification: Study Streak
    user = current_user
    today = date.today()
    
    if seconds > 0: # Only count if they actually studied
        if user.last_study_date is None:
            # First time ever
            user.current_streak = 1
            user.last_study_date = today
        else:
            if user.last_study_date == today:
                # Already studied today, do nothing to streak
                pass
            elif user.last_study_date == today - timedelta(days=1):
                # Studied yesterday! Increase streak
                user.current_streak += 1
                user.last_study_date = today
            else:
                # Gap in study, reset streak to 1
                user.current_streak = 1
                user.last_study_date = today
        
        # Update longest streak
        cur = user.current_streak or 0
        lng = user.longest_streak or 0
        if cur > lng:
            user.longest_streak = cur

    db.session.commit()
    return jsonify({
        'success': True, 
        'current_streak': user.current_streak or 0,
        'longest_streak': user.longest_streak or 0
    })


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

@api_bp.route('/subtitles/available/<int:lesson_id>', methods=['GET'])
@login_required
def get_available_subtitles(lesson_id):
    """Return list of subtitles currently uploaded/cached in the DB."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
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

def _parse_timestamp(ts):
    """Convert SRT/VTT timestamp to seconds."""
    ts = ts.replace(',', '.')
    parts = ts.split(':')
    if len(parts) == 3:
        h, m, s = parts
        return int(h) * 3600 + int(m) * 60 + float(s)
    return 0

def _parse_srt(filepath):
    """Simple regex-based SRT parser."""
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        content = f.read()
    
    # Normalize line endings
    content = content.replace('\r\n', '\n')
    blocks = content.split('\n\n')
    entries = []
    
    for block in blocks:
        if not block.strip(): continue
        lines = block.strip().split('\n')
        if len(lines) < 3: continue
        
        # Line 0 is ID, Line 1 is times, Line 2+ is text
        times = lines[1]
        text = " ".join(lines[2:])
        
        # 00:00:01,000 --> 00:00:04,000
        match = re.search(r'(\d+:\d+:\d+[.,]\d+)\s*-->\s*(\d+:\d+:\d+[.,]\d+)', times)
        if match:
            start = _parse_timestamp(match.group(1))
            end = _parse_timestamp(match.group(2))
            entries.append({
                'start': round(start, 3),
                'end': round(end, 3),
                'duration': round(end - start, 3),
                'text': text.strip()
            })
    return entries

@api_bp.route('/subtitles/fetch/<int:lesson_id>', methods=['POST'])
@login_required
def fetch_subtitles(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json(force=True) or {}
    lang_code = data.get('language_code', '').strip()

    if not lang_code: return jsonify({'error': 'language_code required'}), 400
    track = SubtitleTrack.query.filter_by(video_id=lesson.video.id, language_code=lang_code).first()
    if track:
        # Compatibility fix: Ensure 'end' is present for all lines
        lines = []
        for line in track.content_json:
            if 'end' not in line and 'duration' in line:
                line['end'] = round(line['start'] + line['duration'], 3)
            elif 'end' not in line:
                line['end'] = line['start'] + 2.0 # Fallback
            lines.append(line)
        return jsonify({'language_code': track.language_code, 'lines': lines})
    return jsonify({'error': 'Track not found'}), 404

@api_bp.route('/subtitles/upload/<int:lesson_id>', methods=['POST'])
@login_required
def upload_subtitle(lesson_id):
    """Handle manual subtitle file upload (.srt or .vtt)."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    file = request.files.get('file')
    lang_code = request.form.get('language_code')
    uploader_name = request.form.get('name') or current_user.username
    note = request.form.get('note')

    if not file or not lang_code:
        return jsonify({'error': 'File and language_code are required'}), 400

    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()
    
    temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        os.close(temp_fd)
        file.save(temp_path)
        
        parsed_lines = []
        if ext == '.vtt':
            for caption in webvtt.read(temp_path):
                # webvtt returns captions with start, end, text
                # We normalize to 'start', 'end', 'duration', 'text'
                s = caption.start_in_seconds
                e = caption.end_in_seconds
                parsed_lines.append({
                    'start': round(s, 3),
                    'end': round(e, 3),
                    'duration': round(e - s, 3),
                    'text': caption.text.replace('\n', ' ').strip()
                })
        elif ext == '.srt':
            parsed_lines = _parse_srt(temp_path)
        else:
            return jsonify({'error': 'Unsupported file format'}), 400

        if not parsed_lines:
            return jsonify({'error': 'No lines found in file'}), 400

        # Check for existing track
        track = SubtitleTrack.query.filter_by(video_id=lesson.video.id, language_code=lang_code).first()
        if not track:
            track = SubtitleTrack(video_id=lesson.video.id, language_code=lang_code)
            db.session.add(track)

        track.content_json = parsed_lines
        track.uploader_id = current_user.id
        track.uploader_name = uploader_name
        track.note = note
        track.fetched_at = datetime.now(timezone.utc)
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'language_code': lang_code,
            'line_count': len(parsed_lines),
            'lines': parsed_lines
        })
    except Exception as e:
        print(f"[API ERROR] Upload failed: {str(e)}")
        return jsonify({'error': str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@api_bp.route('/lesson/<int:lesson_id>/set-languages', methods=['POST'])
@login_required
def set_languages(lesson_id):
    """Save user's subtitle selection and UI settings."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json(force=True) or {}
    
    lesson.original_lang_code = data.get('original_lang_code')
    lesson.target_lang_code = data.get('target_lang_code')
    lesson.third_lang_code = data.get('third_lang_code')
    
    # Save explicit timing settings
    if 'note_appear_before' in data:
        lesson.note_appear_before = float(data.get('note_appear_before'))
    if 'note_duration' in data:
        lesson.note_duration = float(data.get('note_duration'))
    
    # Save shadowing specific settings
    if 'shadowing_extra_time' in data:
        lesson.shadowing_extra_time = float(data.get('shadowing_extra_time'))
    if 'shadowing_hide_subs' in data:
        lesson.shadowing_hide_subs = bool(data.get('shadowing_hide_subs'))

    import json
    if 'settings' in data:
        lesson.settings_json = json.dumps(data.get('settings'))

        
    db.session.commit()

    return jsonify({'success': True})

# Restore Note Routes
@api_bp.route('/lesson/<int:lesson_id>/notes', methods=['GET', 'POST'])
@login_required
def manage_notes(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    if request.method == 'POST':
        data = request.get_json(force=True) or {}
        note = Note(
            user_id=current_user.id,
            lesson_id=lesson.id,
            timestamp=data.get('timestamp', 0),
            content=data.get('content', '')
        )
        db.session.add(note)

        db.session.commit()
        return jsonify({
            'success': True,
            'note': {
                'id': note.id,
                'timestamp': note.timestamp,
                'content': note.content,
                'created_at': note.created_at.isoformat()
            }
        })
    
    notes = Note.query.filter_by(lesson_id=lesson_id, user_id=current_user.id).order_by(Note.timestamp).all()
    return jsonify({
        'notes': [{
            'id': n.id, 'timestamp': n.timestamp, 'content': n.content, 'created_at': n.created_at.isoformat()
        } for n in notes]
    })

@api_bp.route('/notes/<int:note_id>', methods=['PATCH', 'DELETE'])
@login_required
def note_ops(note_id):
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    
    if request.method == 'DELETE':
        db.session.delete(note)
        db.session.commit()
        return jsonify({'success': True})
        
    if request.method == 'PATCH':
        data = request.get_json(force=True) or {}
        if 'content' in data:
            note.content = data.get('content')

        if 'timestamp' in data:
            note.timestamp = data.get('timestamp')
            
        db.session.commit()
        return jsonify({
            'success': True,
            'note': {
                'id': note.id,
                'content': note.content,
                'timestamp': note.timestamp
            }
        })


@api_bp.route('/lesson/<int:lesson_id>/toggle-complete', methods=['POST'])
@login_required
def toggle_complete(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    lesson.is_completed = not lesson.is_completed
    db.session.commit()
    return jsonify({'is_completed': lesson.is_completed})

