from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.study.models import Lesson, Sentence, SentenceSet, VideoGlossary
from app.modules.study.services import vocab_service
from app.modules.engagement import interface as engagement_interface
from app.modules.study.tasks import process_tracking_data
from datetime import datetime, timezone
from app.modules.content.models import SubtitleTrack
from app.modules.content.services import subtitle_service
import logging
import re

logger = logging.getLogger(__name__)
study_api_bp = Blueprint('study_api', __name__)
tracking_api_bp = Blueprint('tracking_api', __name__)

from app.modules.content.models import Video
from app.modules.content import interface as content_interface

# --- Unified Dashboard API ---

@study_api_bp.route('/dashboard/init', methods=['GET'])
@jwt_required()
def get_dashboard_init():
    """Unified endpoint to initialize the React dashboard with all necessary data."""
    # 1. My Lessons
    lessons = Lesson.query.filter_by(user_id=current_user.id).order_by(Lesson.last_accessed.desc()).all()
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
            'last_accessed': l.last_accessed.isoformat() if l.last_accessed else None,
            'video': {
                'id': l.video.id,
                'title': l.video.title,
                'channel_title': l.video.channel_title,
                'thumbnail_url': l.video.thumbnail_url,
                'duration_seconds': l.video.duration_seconds or 1,
                'owner_name': l.video.owner.username if l.video.owner else "System",
                'visibility': l.video.visibility
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

    # 3. Notifications & Pending Invites (Merged for the bell)
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
    sets = SentenceSet.query.filter_by(user_id=current_user.id).order_by(SentenceSet.updated_at.desc()).all()
    sets_data = []
    for s in sets:
        first = s.sentences.order_by(Sentence.created_at.asc()).first()
        sets_data.append({
            'id': s.id,
            'title': s.title,
            'set_type': s.set_type,
            'visibility': s.visibility,
            'count': s.sentences.count(),
            'first_sentence_id': first.id if first else None,
            'updated_at': s.updated_at.isoformat() if s.updated_at else None
        })

    # 5. Stats Summary
    stats = engagement_interface.get_user_stats_dto(current_user.id)

    return jsonify({
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
    })

# --- Tracking API (Non-blocking with Celery) ---

@study_api_bp.route('/track', methods=['POST'])
@jwt_required()
def track_progress():
    """
    Receive high-frequency tracking data and offload processing to Celery.
    Returns 202 Accepted immediately to ensure UI remains responsive.
    """
    data = request.get_json() or {}
    
    # Required parameters
    lesson_id = data.get('lesson_id')
    listening_seconds = int(data.get('listening_seconds', 0))
    shadowing_count = int(data.get('shadowing_count', 0))
    shadowing_seconds = int(data.get('shadowing_seconds', 0))
    
    if listening_seconds < 0 or shadowing_count < 0:
        return jsonify({"error": "Invalid metrics"}), 400

    # Offload to Celery
    process_tracking_data.delay(
        user_id=current_user.id,
        lesson_id=lesson_id,
        listening_seconds=listening_seconds,
        shadowing_count=shadowing_count,
        shadowing_seconds=shadowing_seconds
    )
    
    return jsonify({
        "status": "accepted",
        "message": "Tracking data queued for processing"
    }), 202

@study_api_bp.route('/lesson/<int:lesson_id>/track-time', methods=['POST'])
@jwt_required()
def legacy_track_time(lesson_id):
    """Compatibility route for legacy frontend tracking."""
    data = request.get_json() or {}
    seconds = data.get('seconds_added', 0)
    
    # Still use the non-blocking worker for consistency
    process_tracking_data.delay(
        user_id=current_user.id,
        lesson_id=lesson_id,
        listening_seconds=seconds,
        shadowing_count=0,
        shadowing_seconds=0
    )
    
    return jsonify({'success': True, 'message': 'Legacy tracking accepted'})

@study_api_bp.route('/lesson/<int:lesson_id>/shadowing-stats', methods=['GET'])
@jwt_required()
def get_shadowing_stats(lesson_id):
    """Fetch summarized shadowing stats for each subtitle line in a lesson."""
    # Verify ownership
    Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    stats_results = engagement_interface.get_shadowing_stats_for_lesson(lesson_id)
    return jsonify({'stats': stats_results})

# --- Statistics API ---

@study_api_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_study_summary():
    """
    Aggregate learning metrics for the user dashboard.
    Shows: videos watched today, avg mins/video, sentences heard, total time.
    """
    summary = engagement_interface.get_stats_summary_dto(current_user.id)
    
    # Extract today's stats from engagement summary
    from datetime import date
    today_str = date.today().isoformat()
    daily_data = summary.get('daily_data', {})
    today_stats = daily_data.get(today_str, {'listening_minutes': 0, 'shadowing_count': 0})
    
    # Calculate videos watched today (unique lesson_ids in activity logs for today)
    from app.modules.engagement.models import ActivityLog
    videos_today = db.session.query(ActivityLog.reference_id).filter(
        ActivityLog.user_id == current_user.id,
        ActivityLog.activity_type == 'LISTEN_PODCAST',
        db.func.date(ActivityLog.created_at) == date.today()
    ).distinct().count()

    # Prepare daily stats for charts (transform dict to list of objects)
    daily_data_list = []
    # Sort dates to ensure chronological order for charts
    sorted_dates = sorted(daily_data.keys())
    for d_str in sorted_dates:
        day_info = daily_data[d_str]
        daily_data_list.append({
            "date": d_str,
            "listening_minutes": round(day_info.get('listening_minutes', 0), 1),
            "shadowing_count": day_info.get('shadowing_count', 0)
        })

    # Prepare hourly distribution as a list of objects
    hourly_raw = summary.get('hourly_distribution', {})
    hourly_list = []
    for h in range(24):
        h_str = str(h)
        hourly_list.append({
            "hour": h,
            "minutes": round(hourly_raw.get(h_str, 0), 1)
        })

    return jsonify({
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
    })

# Tracking compatibility (was /api/tracking/stats/summary)
@tracking_api_bp.route('/stats/summary', methods=['GET'])
@jwt_required()
def get_study_summary_legacy():
    return get_study_summary()

# --- Notes API ---

@study_api_bp.route('/lesson/<int:lesson_id>/notes', methods=['GET'])
@jwt_required()
def get_lesson_notes(lesson_id):
    """Fetch all notes for a specific lesson."""
    from app.modules.study.models import Note
    notes = Note.query.filter_by(lesson_id=lesson_id, user_id=current_user.id).order_by(Note.timestamp.asc()).all()
    return jsonify([{
        "id": n.id,
        "timestamp": n.timestamp,
        "content": n.content,
        "created_at": n.created_at.isoformat()
    } for n in notes])

@study_api_bp.route('/lesson/<int:lesson_id>/notes', methods=['POST'])
@jwt_required()
def add_lesson_note(lesson_id):
    """Add a new note to a lesson."""
    from app.modules.study.models import Note
    data = request.get_json() or {}
    timestamp = data.get('timestamp', 0)
    content = data.get('content', '').strip()

    if not content:
        return jsonify({"error": "Content is required"}), 400

    note = Note(
        user_id=current_user.id,
        lesson_id=lesson_id,
        timestamp=float(timestamp),
        content=content
    )
    db.session.add(note)
    db.session.commit()

    return jsonify({
        "success": True,
        "note": {
            "id": note.id,
            "timestamp": note.timestamp,
            "content": note.content,
            "created_at": note.created_at.isoformat()
        }
    }), 201

@study_api_bp.route('/lesson/<int:lesson_id>/notes/batch', methods=['POST'])
@jwt_required()
def batch_add_lesson_notes(lesson_id):
    """Add multiple notes to a lesson in one go."""
    from app.modules.study.models import Note
    data = request.get_json() or {}
    notes_list = data.get('notes', [])

    if not notes_list:
        return jsonify({"error": "No notes provided"}), 400

    added_notes = []
    for item in notes_list:
        content = item.get('content', '').strip()
        if not content:
            continue
        
        note = Note(
            user_id=current_user.id,
            lesson_id=lesson_id,
            timestamp=float(item.get('timestamp', 0)),
            content=content
        )
        db.session.add(note)
        added_notes.append(note)
    
    db.session.commit()

    return jsonify({
        "success": True,
        "count": len(added_notes),
        "notes": [{
            "id": n.id,
            "timestamp": n.timestamp,
            "content": n.content,
            "created_at": n.created_at.isoformat()
        } for n in added_notes]
    }), 201

@study_api_bp.route('/notes/<int:note_id>', methods=['PATCH'])
@jwt_required()
def update_note(note_id):
    from app.modules.study.models import Note
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    
    if 'content' in data:
        note.content = data['content'].strip()
    if 'timestamp' in data:
        note.timestamp = float(data['timestamp'])
        
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/notes/<int:note_id>', methods=['DELETE'])
@jwt_required()
def delete_note(note_id):
    from app.modules.study.models import Note
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    db.session.delete(note)
    db.session.commit()
    return jsonify({"success": True})

# --- Vocabulary CRUD API ---

@study_api_bp.route('/vocab/list/<int:lesson_id>', methods=['GET'])
@jwt_required()
def list_lesson_vocab(lesson_id):
    """List all vocabulary saved in a specific lesson context."""
    from app.modules.study.models import VideoGlossary
    items = VideoGlossary.query.filter_by(lesson_id=lesson_id).order_by(VideoGlossary.updated_at.desc()).all()
    return jsonify({
        "vocab": [{
            "id": v.id,
            "word": v.term,
            "reading": v.reading,
            "meaning": v.definition,
            "source": v.source
        } for v in items]
    })

@study_api_bp.route('/vocab/add', methods=['POST'])
@jwt_required()
def add_vocab():
    from app.modules.study.models import VideoGlossary
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    term = data.get('word', '').strip()
    reading = data.get('reading', '').strip()
    definition = data.get('meaning', '').strip()
    
    if not term or not definition:
        return jsonify({"error": "Word and meaning are required"}), 400

    # Check if exists in this lesson context
    existing = VideoGlossary.query.filter_by(lesson_id=lesson_id, term=term).first()
    if existing:
        existing.definition = definition
        existing.reading = reading
        existing.last_updated_by = current_user.id
    else:
        vocab = VideoGlossary(
            lesson_id=lesson_id,
            term=term,
            reading=reading,
            definition=definition,
            last_updated_by=current_user.id
        )
        db.session.add(vocab)
    
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/vocab/remove', methods=['DELETE'])
@jwt_required()
def remove_vocab():
    from app.modules.study.models import VideoGlossary
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    term = data.get('word', '').strip()
    
    item = VideoGlossary.query.filter_by(lesson_id=lesson_id, term=term).first_or_404()
    db.session.delete(item)
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/vocab/tokens/save', methods=['POST'])
@jwt_required()
def save_vocab_tokens():
    from app.modules.study.models import SentenceToken
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    line_index = data.get('line_index')
    tokens = data.get('tokens', [])
    
    # Simple clear and replace for the line
    SentenceToken.query.filter_by(lesson_id=lesson_id, line_index=line_index).delete()
    
    for idx, t in enumerate(tokens):
        token = SentenceToken(
            lesson_id=lesson_id,
            line_index=line_index,
            token=t.get('surface', t.get('token')),
            lemma_override=t.get('lemma'),
            pos=t.get('pos'),
            order_index=idx
        )
        db.session.add(token)
    
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/vocab/tokens/clear', methods=['DELETE'])
@jwt_required()
def clear_vocab_tokens():
    from app.modules.study.models import SentenceToken
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    line_index = data.get('line_index')
    
    SentenceToken.query.filter_by(lesson_id=lesson_id, line_index=line_index).delete()
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/vocab/tokens/clear-all', methods=['DELETE'])
@jwt_required()
def clear_all_vocab_tokens():
    from app.modules.study.models import SentenceToken
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    
    if not lesson_id:
        return jsonify({"error": "lesson_id required"}), 400
        
    SentenceToken.query.filter_by(lesson_id=lesson_id).delete()
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/vocab/lesson/<int:lesson_id>/analysis', methods=['GET'])
@jwt_required()
def get_lesson_vocab_analysis(lesson_id):
    from app.modules.study.models import SentenceToken
    tokens = SentenceToken.query.filter_by(lesson_id=lesson_id).all()
    
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
        
    return jsonify({"analysis": analysis}) 

@study_api_bp.route('/lesson/<int:lesson_id>/import-ai-pack', methods=['POST'])
@jwt_required()
def import_ai_pack(lesson_id):
    """
    Import a full AI-segmented track:
    - SRT for timing and structure.
    - JSON for AI-generated word tokens (surface, reading, meaning, metadata).
    """
    from app.modules.content.models import SubtitleTrack
    from app.modules.study.models import Lesson, SentenceToken
    from app.modules.content.services.subtitle_service import parse_subtitle_text
    
    lesson = Lesson.query.get_or_404(lesson_id)
    video_id = lesson.video_id
    
    # Get files
    srt_file = request.files.get('srt_file')
    json_file = request.files.get('json_file')
    
    if not srt_file or not json_file:
        return jsonify({"error": "Missing SRT or JSON file"}), 400
        
    lang_code = request.form.get('language_code', 'ja')
    track_name = request.form.get('name', f'[AI] {lang_code.upper()}')
    
    # 1. Parse SRT
    srt_content = srt_file.read().decode('utf-8-sig')
    parsed_srt = parse_subtitle_text(srt_content, '.srt')
    if not parsed_srt.get('success'):
        return jsonify({"error": "Failed to parse SRT", "details": parsed_srt.get('message')}), 400
        
    lines = parsed_srt['lines']
    
    # 2. Parse JSON Analysis
    try:
        import json
        analysis_data = json.load(json_file)
        # Expected format: {"lines": [{"line_index": 0, "tokens": [...]}, ...]}
        # Or simple array of lines
        ai_lines = analysis_data.get('lines', analysis_data) if isinstance(analysis_data, dict) else analysis_data
    except Exception as e:
        return jsonify({"error": "Failed to parse JSON", "details": str(e)}), 400
        
    # 3. Create Subtitle Track
    from app.modules.content.services.subtitle_service import generate_unique_track_name
    new_track = SubtitleTrack(
        video_id=video_id,
        language_code=lang_code,
        name=generate_unique_track_name(video_id, track_name),
        content_json=lines,
        uploader_id=current_user.id,
        uploader_name=current_user.username,
        is_original=False
    )
    db.session.add(new_track)
    db.session.flush() # Get track ID
    
    # 4. Create Sentence Tokens
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
            db.session.add(token)
            tokens_count += 1
            
    db.session.commit()
    
    return jsonify({
        "status": "success", 
        "track_id": new_track.id,
        "tokens_imported": tokens_count
    })

@study_api_bp.route('/lesson/<int:lesson_id>/analysis/import', methods=['POST'])
@jwt_required()
def import_analysis(lesson_id):
    """Bulk import AI-generated linguistic analysis (segmentation)."""
    from app.modules.study.models import SentenceToken
    data = request.get_json() or {}
    lines = data.get('lines', []) # Expected: [{"line_index": 0, "tokens": [...]}]

    if not lines:
        return jsonify({"error": "No lines provided"}), 400

    # Clear old analysis for this lesson
    SentenceToken.query.filter_by(lesson_id=lesson_id).delete()

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
                extra_data=t.get('metadata'), # Input key stays metadata for AI compatibility
                order_index=idx
            )
            db.session.add(token)
            count += 1
    
    db.session.commit()
    return jsonify({"success": True, "tokens_imported": count})

@study_api_bp.route('/vocab/scan-status/<int:lesson_id>', methods=['GET'])
@jwt_required()
def get_scan_status(lesson_id):
    """Check if a lesson has been analyzed (tokens or glossary items)."""
    from app.modules.study.models import SentenceToken, VideoGlossary
    
    # Check per-line tokens
    has_tokens = SentenceToken.query.filter_by(lesson_id=lesson_id).first() is not None
    
    # Check glossary entries (created by sync-batch)
    has_glossary = VideoGlossary.query.filter_by(lesson_id=lesson_id).first() is not None
    
    return jsonify({
        'has_tokens': has_tokens or has_glossary,
        'lesson_id': lesson_id
    })

@study_api_bp.route('/video/glossary/<int:lesson_id>', methods=['GET'])
@jwt_required()
def get_video_glossary(lesson_id):
    from app.modules.study.models import Lesson, VideoGlossary
    lesson = Lesson.query.get_or_404(lesson_id)
    video_id = lesson.video_id
    
    entries = VideoGlossary.query.filter_by(video_id=video_id).all()
    glossary = []
    for e in entries:
        glossary.append({
            "term": e.term,
            "reading": e.reading,
            "meaning": e.meaning,
            "extra_data": e.extra_data or {}
        })
    return jsonify({"glossary": glossary})

@study_api_bp.route('/vocab/sync-batch', methods=['POST'])
@jwt_required()
def sync_vocab_batch():
    """
    Processes a specific list of texts and adds them to the glossary map.
    Only stores the terms (lemmas) to keep DB small.
    """
    try:
        data = request.json
        lesson_id = data.get('lesson_id')
        texts = data.get('texts', [])
        is_first_batch = data.get('is_first_batch', False)
        
        if not lesson_id or not texts:
            return jsonify({"error": "Missing data"}), 400
            
        if is_first_batch:
            # Clear old glossary mapping for this lesson
            VideoGlossary.query.filter_by(lesson_id=lesson_id).delete()
            db.session.commit()
            
        # Get unique terms from the segmented texts
        results = vocab_service.analyze_batch_japanese(texts)
        
        lesson = Lesson.query.get(lesson_id)
        video_id = lesson.video_id if lesson else None
        
        # Save only the terms
        for res in results:
            term = res['lemma']
            # Check if term mapping already exists in this lesson
            existing = VideoGlossary.query.filter_by(lesson_id=lesson_id, term=term).first()
            if not existing:
                item = VideoGlossary(
                    lesson_id=lesson_id,
                    video_id=video_id,
                    term=term,
                    definition="[LOOKUP_REQUIRED]", # Placeholder, meanings are fetched on-the-fly
                    source="offline"
                )
                db.session.add(item)
            
        db.session.commit()
        return jsonify({"status": "success", "count": len(results)})
    except Exception as e:
        logger.error(f"[VOCAB ERROR] sync-batch failed: {e}")
        return jsonify({"error": str(e)}), 500

@study_api_bp.route('/lesson/<int:lesson_id>/dictionary/list', methods=['GET'])
@jwt_required()
def list_dictionaries(lesson_id):
    from app.modules.study.models import VideoDictionary
    dicts = VideoDictionary.query.filter_by(lesson_id=lesson_id).all()
    return jsonify([{
        "id": d.id,
        "name": d.name,
        "is_active": d.is_active,
        "count": d.glossary_items.count()
    } for d in dicts])

@study_api_bp.route('/lesson/<int:lesson_id>/dictionary/toggle/<int:dict_id>', methods=['POST'])
@jwt_required()
def toggle_dictionary(lesson_id, dict_id):
    from app.modules.study.models import VideoDictionary
    d = VideoDictionary.query.filter_by(id=dict_id, lesson_id=lesson_id).first_or_404()
    d.is_active = not d.is_active
    db.session.commit()
    return jsonify({"success": True, "is_active": d.is_active})

@study_api_bp.route('/lesson/<int:lesson_id>/dictionary/delete/<int:dict_id>', methods=['DELETE'])
@jwt_required()
def delete_dictionary(lesson_id, dict_id):
    from app.modules.study.models import VideoDictionary
    d = VideoDictionary.query.filter_by(id=dict_id, lesson_id=lesson_id).first_or_404()
    db.session.delete(d)
    db.session.commit()
    return jsonify({"success": True})

@study_api_bp.route('/lesson/<int:lesson_id>/dictionary/import', methods=['POST'])
@jwt_required()
def import_dictionary(lesson_id):
    """
    Import a custom dictionary for the video associated with this lesson.
    JSON format: {"name": "My Dict", "items": [{"term": "...", "reading": "...", "meaning": "...", "kanji_viet": "..."}]}
    """
    from app.modules.study.models import Lesson, VideoGlossary, VideoDictionary
    lesson = Lesson.query.get_or_404(lesson_id)
    video_id = lesson.video_id
    
    payload = request.json
    if not payload:
        return jsonify({"error": "Missing payload"}), 400
        
    # Support both list and {name, items} formats
    if isinstance(payload, list):
        data = payload
        dict_name = "Main Glossary"
        global_lang = 'ja'
    else:
        data = payload.get('items', [])
        dict_name = payload.get('name', "Main Glossary")
        global_lang = payload.get('lang', 'ja')

    if not data or not isinstance(data, list):
        return jsonify({"error": "Invalid items format. Expected an array."}), 400
        
    # Create or find dictionary
    v_dict = VideoDictionary.query.filter_by(lesson_id=lesson_id, name=dict_name).first()
    if not v_dict:
        v_dict = VideoDictionary(lesson_id=lesson_id, name=dict_name)
        db.session.add(v_dict)
        db.session.flush()

    added = 0
    updated = 0
    errors = []

    for idx, item in enumerate(data):
        try:
            if not isinstance(item, dict):
                errors.append(f"Item at index {idx} is not an object")
                continue

            term = item.get('term')
            if not term:
                errors.append(f"Item at index {idx} missing 'term'")
                continue
            
            lang = item.get('lang', global_lang)
            target_lang = item.get('target_lang', 'vi')
            
            # Check if exists in THIS dictionary
            entry = VideoGlossary.query.filter_by(dictionary_id=v_dict.id, term=term).first()
            if not entry:
                entry = VideoGlossary(dictionary_id=v_dict.id, video_id=video_id, lesson_id=lesson_id, term=term)
                db.session.add(entry)
                added += 1
            else:
                updated += 1
                
            entry.reading = item.get('reading', entry.reading)
            entry.definition = item.get('meaning', entry.definition or "")
            entry.language_code = lang
            entry.target_language_code = target_lang
            entry.source = 'manual'
            entry.extra_data = {
                **(entry.extra_data or {}),
                "kanji_viet": item.get('kanji_viet') or (entry.extra_data or {}).get('kanji_viet')
            }
        except Exception as e:
            errors.append(f"Error at index {idx}: {str(e)}")
            continue
        
    db.session.commit()
    return jsonify({
        "success": True, 
        "added": added, 
        "updated": updated, 
        "errors": errors if errors else None
    })

@study_api_bp.route('/vocab/analyze', methods=['POST'])
@jwt_required()
def analyze_vocab():
    """Live word analysis for a single sentence."""
    try:
        data = request.get_json() or {}
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
            from app.modules.content.models import SubtitleTrack
            track = SubtitleTrack.query.get(track_id)
            if track and track.content_json and len(track.content_json) > line_index:
                text = track.content_json[line_index].get('text', text)

        if not text:
            return jsonify([])

        # Pre-load lesson glossary for quick lookup
        from app.modules.study.models import VideoDictionary, VideoGlossary
        active_user_dicts = VideoDictionary.query.filter_by(lesson_id=lesson_id, is_active=True).all()
        user_map = {}
        if active_user_dicts:
            dict_ids = [d.id for d in active_user_dicts]
            # Include items from active dicts OR legacy items tied to lesson_id with no dict_id
            glossary_items = VideoGlossary.query.filter(
                (VideoGlossary.dictionary_id.in_(dict_ids)) | 
                ((VideoGlossary.lesson_id == lesson_id) & (VideoGlossary.dictionary_id == None))
            ).all()
            user_map = {item.term: item.to_dict() for item in glossary_items}

        delimiters = ['|', '/', ' ']
        active_delimiter = next((d for d in delimiters if d in text), None)

        if active_delimiter:
            raw_segments = [s.strip() for s in text.split(active_delimiter) if s.strip()]
            results = []
            
            from app.modules.study.services.vocab_service import get_dict_paths, query_offline_dict, get_definitions_for_terms
            _, legacy_paths = get_dict_paths()
            
            for seg in raw_segments:
                # Match "Surface [Lemma]" or "Surface [skip]"
                match = re.search(r'(.+?)\[(.+?)\]', seg)
                if match:
                    surface = match.group(1).strip()
                    lemma = match.group(2).strip()
                else:
                    surface = seg.strip()
                    lemma = seg.strip()
                    
                is_skip = (lemma.lower() == 'skip')
                if is_skip:
                    results.append({"surface": surface, "lemma": "skip", "lemma_override": "skip", "word": surface, "reading": "", "meanings": [], "definition": "SKIP", "source": "none"})
                    continue

                found = False
                # 1. Preferred Dictionary
                if preferred_dict_id:
                    dict_path = legacy_paths.get(preferred_dict_id)
                    if dict_path:
                        off_res = query_offline_dict(dict_path, lemma)
                        if off_res:
                            results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": off_res.get('reading', ''), "meanings": off_res.get('meanings', []), "definition": off_res.get('definition', ''), "source": off_res.get('source', 'offline')})
                            found = True

                # 2. Lesson Glossary
                if not found and lemma in user_map:
                    u = user_map[lemma]
                    results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": u.get('reading', ''), "meanings": [u.get('meaning', '')], "definition": u.get('meaning', ''), "source": "user_glossary"})
                    found = True

                # 3. General Offline
                if not found and use_offline:
                    off_res_list = get_definitions_for_terms([lemma], src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id)
                    if off_res_list and off_res_list[0].get('source') != 'none':
                        o = off_res_list[0]
                        results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": o.get('reading', ''), "meanings": o.get('meanings', []), "definition": o.get('definition', ''), "source": o.get('source', 'offline')})
                        found = True
                
                if not found:
                    results.append({"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": "", "meanings": [], "definition": "", "source": "none"})
            
            return jsonify(results)

        # No delimiter found
        if not auto_segmentation:
            match = re.search(r'(.+?)\[(.+?)\]', text)
            surface, lemma = (match.group(1).strip(), match.group(2).strip()) if match else (text, text)
            
            if lemma.lower() == 'skip':
                return jsonify([{"surface": surface, "lemma": "skip", "lemma_override": "skip", "word": surface, "reading": "", "meanings": [], "definition": "SKIP", "source": "none"}])

            from app.modules.study.services.vocab_service import get_definitions_for_terms
            off_res = get_definitions_for_terms([lemma], src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id)
            if off_res and off_res[0].get('source') != 'none':
                o = off_res[0]
                return jsonify([{"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": o.get('reading', ''), "meanings": o.get('meanings', []), "definition": o.get('definition', ''), "source": o.get('source', 'offline')}])
            
            return jsonify([{"surface": surface, "lemma": lemma, "lemma_override": lemma, "word": lemma, "reading": "", "meanings": [], "definition": "", "source": "none"}])

        # Auto Segmentation (default)
        from app.modules.study.services.vocab_service import analyze_japanese_text
        results = analyze_japanese_text(text, src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id, include_all=True)
        return jsonify(results)

    except Exception as e:
        logger.error(f"[VOCAB ERROR] analyze_vocab failed: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@study_api_bp.route('/video/analyze-sentence', methods=['POST'])
@jwt_required()
def analyze_sentence_full():
    """Full linguistic analysis for Vocab Studio."""
    from app.modules.study.services.vocab_service import analyze_japanese_text, get_definitions_for_terms
    from app.modules.study.models import SentenceToken
    
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    lesson_id = data.get('lesson_id')
    active_line_index = data.get('active_line_index')
    
    if not text:
        return jsonify({'words': []})
        
    db_tokens = []
    if lesson_id and active_line_index is not None:
        db_tokens = SentenceToken.query.filter_by(lesson_id=lesson_id, line_index=active_line_index).order_by(SentenceToken.order_index.asc()).all()
        
    if db_tokens:
        lookup_terms = [t.lemma_override or t.token for t in db_tokens]
        original_lang = data.get('original_lang', 'ja')
        target_lang = data.get('target_lang', 'vi')
        results = get_definitions_for_terms(lookup_terms, src_lang=original_lang, target_lang=target_lang, lesson_id=lesson_id)
        formatted = []
        for i, r in enumerate(results):
            t = db_tokens[i]
            formatted.append({
                "surface": t.token,
                "lemma": t.lemma_override or t.token,
                "lemma_override": t.lemma_override,
                "reading": r.get('reading', ''),
                "pos": t.pos or 'manual',
                "meanings": r.get('meanings', []) if isinstance(r.get('meanings'), list) else [r.get('definition', '')],
                "source": r.get('source', 'none')
            })
        return jsonify({'words': formatted, 'is_manual': True})

    # Auto analysis
    words = analyze_japanese_text(text, priority='mazii_offline', include_all=True)
    return jsonify({'words': words, 'is_manual': False})

@study_api_bp.route('/vocab/generate-all', methods=['POST'])
@jwt_required()
def generate_all_vocab_api():
    """Trigger background scan of the entire lesson."""
    from app.modules.study.services.vocab_service import scan_lesson_transcript
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    priority = data.get('priority', 'mazii_offline')
    
    if not lesson_id:
        return jsonify({"error": "lesson_id required"}), 400
        
    # We'll run it synchronously for now as it's usually fast enough for a few hundred lines
    # but in a real high-load app this would be a Celery task.
    scan_lesson_transcript(lesson_id, priority)
    return jsonify({"success": True})

# --- Playlist (Sets) Endpoints ---

@study_api_bp.route('/playlists', methods=['GET'])
@jwt_required()
def get_playlists():
    """List all playlists (sets) of the current user."""
    playlists = content_interface.get_user_playlists_dto(current_user.id)
    return jsonify({
        'playlists': playlists
    })

@study_api_bp.route('/playlists', methods=['POST'])
@jwt_required()
def create_playlist():
    """Create a new playlist (set)."""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
        
    playlist_dto = content_interface.create_playlist_dto(name, data.get('description'), current_user.id)
    
    return jsonify({
        'success': True,
        'playlist': playlist_dto
    })

@study_api_bp.route('/playlists/<int:playlist_id>', methods=['DELETE'])
@jwt_required()
def delete_playlist(playlist_id):
    """Delete a playlist."""
    success = content_interface.delete_playlist(playlist_id, current_user.id)
    if not success:
        return jsonify({'error': 'Playlist not found'}), 404
    return jsonify({'success': True})

@study_api_bp.route('/playlists/<int:playlist_id>/videos', methods=['POST'])
@jwt_required()
def add_video_to_playlist(playlist_id):
    """Add a video to a playlist."""
    data = request.get_json() or {}
    video_id = data.get('video_id')
    
    success = content_interface.add_video_to_playlist(playlist_id, video_id, current_user.id)
    if not success:
        return jsonify({'error': 'Failed to add video to playlist'}), 400
        
    return jsonify({'success': True})

@study_api_bp.route('/playlists/<int:playlist_id>/videos/<int:video_id>', methods=['DELETE'])
@jwt_required()
def remove_video_from_playlist(playlist_id, video_id):
    """Remove a video from a playlist."""
    success = content_interface.remove_video_from_playlist(playlist_id, video_id, current_user.id)
    if not success:
        return jsonify({'error': 'Failed to remove video from playlist'}), 400
        
    return jsonify({'success': True})

# --- Practice API ---

@study_api_bp.route('/practice/sets', methods=['GET'])
@jwt_required()
def list_practice_sets():
    """List all sentence sets (mastery decks) belonging to the user."""
    sets = SentenceSet.query.filter_by(user_id=current_user.id).all()
    return jsonify([{
        "id": s.id,
        "title": s.title,
        "type": s.set_type,
        "count": s.sentences.count(),
        "visibility": s.visibility
    } for s in sets])

@study_api_bp.route('/practice/set/<int:set_id>', methods=['GET'])
@jwt_required()
def get_practice_set(set_id):
    """Fetch all sentences in a specific set with mastery status."""
    s_set = SentenceSet.query.filter_by(id=set_id, user_id=current_user.id).first_or_404()
    sentences = Sentence.query.filter_by(set_id=set_id).order_by(Sentence.created_at.asc()).all()
    
    return jsonify({
        "set_id": s_set.id,
        "title": s_set.title,
        "type": s_set.set_type,
        "sentences": [{
            "id": s.id,
            "text": s.original_text,
            "translation": s.translated_text,
            "mastery_level": s.mastery_level,
            "next_review": s.next_review_at.isoformat() if s.next_review_at else None
        } for s in sentences]
    })

@study_api_bp.route('/practice/sentence/<int:sentence_id>', methods=['GET'])
@jwt_required()
def get_sentence_details(sentence_id):
    """Detailed data for a specific sentence, including AI analysis."""
    sentence = Sentence.query.filter_by(id=sentence_id, user_id=current_user.id).first_or_404()
    
    return jsonify({
        "id": sentence.id,
        "text": sentence.original_text,
        "translation": sentence.translated_text,
        "audio_url": sentence.audio_url,
        "analysis": sentence.detailed_analysis or {},
        "mastery": {
            "level": sentence.mastery_level,
            "ease_factor": sentence.ease_factor,
            "interval_days": sentence.interval_days,
            "next_review": sentence.next_review_at.isoformat() if sentence.next_review_at else None
        }
    })

# --- Dictionary Management (DictManager) ---

@study_api_bp.route('/dictionaries/system', methods=['GET'])
@jwt_required()
def list_system_dictionaries():
    """List all available dictionaries, prioritizing editable ones."""
    from app.modules.study.services.vocab_service import get_dict_paths
    dicts, _ = get_dict_paths()
    return jsonify([{
        "id": d['path'], # Use path as ID for physical files
        "name": d['name'],
        "src": d['src'],
        "target": d['target'],
        "is_active": True,
        "is_editable": d.get('editable', False),
        "count": "N/A" # Count requires opening the DB, skip for list
    } for d in dicts])

@study_api_bp.route('/dictionaries/system', methods=['POST'])
@jwt_required()
def create_system_dictionary():
    """Create a new editable system dictionary file."""
    data = request.get_json() or {}
    name = data.get('name', 'New Dict')
    src = data.get('src', 'ja')
    target = data.get('target', 'vi')
    
    import os, sqlite3
    current_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = current_dir
    for _ in range(5):
        if os.path.exists(os.path.join(root_dir, 'dictionaries')): break
        root_dir = os.path.dirname(root_dir)
        
    filename = f"[{src}-{target}] {name}.db"
    dict_path = os.path.join(root_dir, 'dictionaries', 'editable', filename)
    
    conn = sqlite3.connect(dict_path)
    conn.execute('CREATE TABLE IF NOT EXISTS dictionary (id INTEGER PRIMARY KEY AUTOINCREMENT, word TEXT UNIQUE, reading TEXT, meanings_json TEXT)')
    conn.close()
    
    return jsonify({"id": dict_path, "name": name})

@study_api_bp.route('/dictionaries/items', methods=['GET'])
@jwt_required()
def get_dictionary_items():
    """List all terms in a physical dictionary file."""
    dict_path = request.args.get('id')
    if not dict_path or not os.path.exists(dict_path):
        return jsonify({'error': 'Invalid dictionary path'}), 400
        
    import sqlite3
    conn = sqlite3.connect(dict_path)
    cursor = conn.cursor()
    cursor.execute("SELECT id, word, reading, meanings_json FROM dictionary ORDER BY word ASC")
    rows = cursor.fetchall()
    conn.close()
    
    results = []
    for r in rows:
        import json
        try:
            means = json.loads(r[3]) if r[3] else []
            definition = ", ".join([m.get('mean', '') for m in means]) if isinstance(means, list) else str(means)
        except:
            definition = str(r[3])
            
        results.append({
            "id": r[0],
            "term": r[1],
            "reading": r[2],
            "definition": definition,
            "meanings_json": r[3]
        })
    return jsonify(results)

@study_api_bp.route('/dictionaries/import', methods=['POST'])
@jwt_required()
def import_to_system_dictionary():
    """Incremental JSON import into a physical dictionary file."""
    data = request.get_json() or {}
    dict_path = data.get('id')
    items = data.get('items', [])
    
    if not dict_path or not os.path.exists(dict_path):
        return jsonify({'error': 'Invalid dictionary path'}), 400
        
    import sqlite3, json
    conn = sqlite3.connect(dict_path)
    count = 0
    for item in items:
        term = item.get('term', '').strip()
        if not term: continue
        
        reading = item.get('reading', '')
        meaning = item.get('meaning', '')
        # Convert to offline format: [{"mean": "..."}]
        meanings_json = json.dumps([{"mean": meaning}])
        
        conn.execute("""
            INSERT INTO dictionary (word, reading, meanings_json) 
            VALUES (?, ?, ?)
            ON CONFLICT(word) DO UPDATE SET 
                reading = excluded.reading,
                meanings_json = excluded.meanings_json
        """, (term, reading, meanings_json))
        count += 1
    
    conn.commit()
    conn.close()
    return jsonify({"success": True, "count": count})

@study_api_bp.route('/glossary/item', methods=['PATCH', 'DELETE'])
@jwt_required()
def manage_physical_glossary_item():
    """Edit or delete a single item in a physical dictionary file."""
    data = request.get_json() or {}
    dict_path = data.get('dict_id') # In this architecture, dict_id is the path
    item_id = data.get('item_id')
    
    if not dict_path or not os.path.exists(dict_path):
        return jsonify({'error': 'Invalid dictionary path'}), 400
        
    import sqlite3, json
    conn = sqlite3.connect(dict_path)
    
    if request.method == 'DELETE':
        conn.execute("DELETE FROM dictionary WHERE id = ?", (item_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
        
    term = data.get('term')
    reading = data.get('reading')
    meaning = data.get('meaning')
    meanings_json = json.dumps([{"mean": meaning}])
    
    conn.execute("UPDATE dictionary SET word = ?, reading = ?, meanings_json = ? WHERE id = ?", 
                 (term, reading, meanings_json, item_id))
    conn.commit()
    conn.close()
    return jsonify({"success": True})

# --- Miscellaneous & Tools ---

@study_api_bp.route('/score-pronunciation', methods=['POST'])
@jwt_required()
def score_pronunciation():
    data = request.get_json() or {}
    original = data.get('original_text', '')
    spoken = data.get('spoken_text', '')
    lang = data.get('lang_code', 'ja')
    sentence_id = data.get('sentence_id')
    lesson_id = data.get('lesson_id')
    
    result = engagement_interface.evaluate_pronunciation_manual(
        user_id=current_user.id,
        lesson_id=lesson_id,
        original_text=original,
        spoken_text=spoken,
        lang=lang,
        sentence_id=sentence_id
    )
    return jsonify(result)

@study_api_bp.route('/translate', methods=['POST'])
@jwt_required()
def translate():
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        target_lang = data.get('target_lang', 'vi').strip()
        source_lang = data.get('source_lang', 'auto').strip()

        if not text:
            return jsonify({'error': 'text is required'}), 400

        from deep_translator import GoogleTranslator
        translator = GoogleTranslator(source=source_lang, target=target_lang)
        translated = translator.translate(text)

        return jsonify({
            'original': text,
            'translated': translated,
            'target_lang': target_lang
        })
    except Exception as e:
        return jsonify({'error': str(e), 'translated': None}), 500

@study_api_bp.route('/user/preferences', methods=['GET', 'POST'])
@jwt_required()
def handle_preferences():
    if request.method == 'POST':
        data = request.get_json() or {}
        import json
        current_user.preferences_json = json.dumps(data)
        db.session.commit()
        return jsonify({'success': True})
    
    import json
    prefs = json.loads(current_user.preferences_json or '{}')
    return jsonify(prefs)

@study_api_bp.route('/notifications', methods=['GET'])
@jwt_required()
def get_notifications():
    notifs = engagement_interface.get_user_notifications_dto(current_user.id)
    return jsonify(notifs)

# --- Subtitle Management ---

@study_api_bp.route('/subtitles/upload/<int:lesson_id>', methods=['POST'])
@jwt_required()
def upload_subtitle(lesson_id):
    """Handle manual subtitle file upload (.srt or .vtt)."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    file = request.files.get('file')
    lang_code = request.form.get('language_code')
    user_input_name = request.form.get('name')
    note = request.form.get('note')

    if not file or not lang_code:
        return jsonify({'error': 'File and language_code are required'}), 400

    from werkzeug.utils import secure_filename
    import tempfile
    import os
    
    filename = secure_filename(file.filename)
    ext = os.path.splitext(filename)[1].lower()
    
    temp_fd, temp_path = tempfile.mkstemp(suffix=ext)
    try:
        os.close(temp_fd)
        file.save(temp_path)
        
        result = subtitle_service.parse_uploaded_subtitle(temp_path, ext)
        if 'error' in result:
            return jsonify(result), 400

        parsed_lines = result['lines']
        
        display_name = user_input_name or f"Uploaded by {current_user.username}"
        unique_name = subtitle_service.generate_unique_track_name(lesson.video.id, display_name)

        track = SubtitleTrack(
            video_id=lesson.video.id, 
            language_code=lang_code,
            content_json=parsed_lines,
            uploader_id=current_user.id,
            uploader_name=current_user.username,
            name=unique_name,
            note=note,
            fetched_at=datetime.now(timezone.utc),
            status='completed',
            total_lines=len(parsed_lines),
            progress=len(parsed_lines)
        )
        db.session.add(track)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'track_id': track.id,
            'language_code': lang_code,
            'line_count': len(parsed_lines),
            'lines': parsed_lines
        })
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)

@study_api_bp.route('/subtitles/upload-text/<int:lesson_id>', methods=['POST'])
@jwt_required()
def upload_subtitle_text(lesson_id):
    """Handle manual subtitle text paste."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    lang_code = data.get('language_code')
    user_input_name = data.get('name')
    note = data.get('note')

    if not text or not lang_code:
        return jsonify({'error': 'Text and language_code are required'}), 400

    result = subtitle_service.parse_subtitle_text(text)
    if 'error' in result:
        return jsonify(result), 400

    parsed_lines = result['lines']
    
    display_name = user_input_name or f"Pasted by {current_user.username}"
    unique_name = subtitle_service.generate_unique_track_name(lesson.video.id, display_name)

    track = SubtitleTrack(
        video_id=lesson.video.id, 
        language_code=lang_code,
        content_json=parsed_lines,
        uploader_id=current_user.id,
        uploader_name=current_user.username,
        name=unique_name,
        note=note,
        fetched_at=datetime.now(timezone.utc),
        status='completed',
        total_lines=len(parsed_lines),
        progress=len(parsed_lines)
    )
    db.session.add(track)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'track_id': track.id,
        'language_code': lang_code,
        'line_count': len(parsed_lines),
        'lines': parsed_lines
    })

@study_api_bp.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "PodLearn Study", "version": "2.0.0"}), 200

@study_api_bp.route('/lesson/<int:lesson_id>/settings', methods=['PATCH'])
@jwt_required()
def update_lesson_settings(lesson_id):
    from app.modules.study.models import Lesson
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    
    import json
    try:
        current_settings = json.loads(lesson.settings_json or '{}')
    except:
        current_settings = {}
    
    # Merge new settings
    for key, value in data.items():
        current_settings[key] = value
        
    lesson.settings_json = json.dumps(current_settings)
    
    # Also sync explicit track fields if they are in the settings
    if 's1_track_id' in data: lesson.s1_track_id = data['s1_track_id']
    if 's2_track_id' in data: lesson.s2_track_id = data['s2_track_id']
    if 's3_track_id' in data: lesson.s3_track_id = data['s3_track_id']

    from app.core.extensions import db
    db.session.commit()
    return jsonify({'success': True, 'settings': current_settings})
