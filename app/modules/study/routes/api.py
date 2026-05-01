from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.study.models import Lesson, Sentence, SentenceSet, VideoGlossary
from app.modules.study.services import vocab_service
from app.modules.engagement import interface as engagement_interface
from app.modules.study.tasks import process_tracking_data
import logging

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
            "pos": t.pos
        })
        
    return jsonify({"analysis": analysis}) # Fixed key to match frontend expectation

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

@study_api_bp.route('/vocab/analyze', methods=['POST'])
@jwt_required()
def analyze_vocab():
    """Live word analysis for a single sentence."""
    from app.modules.study.services.vocab_service import analyze_japanese_text
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    priority = data.get('priority', 'mazii_offline')
    lesson_id = data.get('lesson_id')
    line_index = data.get('line_index')
    
    if not text:
        return jsonify([])

    # Try to use existing tokens if available
    from app.modules.study.models import SentenceToken
    db_tokens = []
    if lesson_id and line_index is not None:
        db_tokens = SentenceToken.query.filter_by(lesson_id=lesson_id, line_index=line_index).order_by(SentenceToken.order_index.asc()).all()
    
    if db_tokens:
        from app.modules.study.services.vocab_service import get_definitions_for_terms
        lookup_terms = [t.lemma_override or t.token for t in db_tokens]
        results = get_definitions_for_terms(lookup_terms, priority=priority)
        
        formatted = []
        for i, r in enumerate(results):
            t = db_tokens[i]
            formatted.append({
                "surface": t.token,
                "lemma": t.lemma_override or t.token,
                "reading": r.get('reading', ''),
                "meanings": r.get('meanings', []) if isinstance(r.get('meanings'), list) else [r.get('definition', '')],
                "source": r.get('source', priority)
            })
        return jsonify(formatted)

    # Fallback to auto-analysis
    words = analyze_japanese_text(text, priority=priority, include_all=True)
    return jsonify(words)

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
        results = get_definitions_for_terms(lookup_terms, priority='mazii_offline')
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

@study_api_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
@jwt_required()
def mark_notification_read(notif_id):
    success = engagement_interface.mark_notification_read(notif_id, current_user.id)
    return jsonify({'success': success}), 200 if success else 404

@study_api_bp.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "PodLearn Study", "version": "2.0.0"}), 200
