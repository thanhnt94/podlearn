from flask import Blueprint, jsonify, request
from flask_jwt_extended import jwt_required, current_user
from app.core.extensions import db
from app.modules.study.models import Lesson, Sentence, SentenceSet
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

# --- Legacy Compatibility & Miscellaneous ---

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

@study_api_bp.route('/vocab/scan-status/<int:lesson_id>', methods=['GET'])
@jwt_required()
def get_scan_status(lesson_id):
    from app.modules.study.models import SentenceToken
    # Just a placeholder for now to satisfy frontend
    has_tokens = False 
    return jsonify({'has_tokens': has_tokens, 'lesson_id': lesson_id})

@study_api_bp.route('/score-pronunciation', methods=['POST'])
@jwt_required()
def score_pronunciation():
    data = request.get_json() or {}
    original = data.get('original_text', '')
    spoken = data.get('spoken_text', '')
    lang = data.get('lang_code', 'en')
    sentence_id = data.get('sentence_id')
    lesson_id = data.get('lesson_id')
    
    # This is a simplified call to the engagement interface for now
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
    """Proxy translation requests through server to avoid CORS/IP blocks."""
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

@study_api_bp.route('/vocab/analyze', methods=['POST'])
@jwt_required()
def analyze_vocab():
    """Compatibility route for vocabulary analysis."""
    data = request.get_json() or {}
    text = data.get('text', '')
    lang = data.get('lang', 'ja')
    
    from app.modules.study.services import vocab_service
    results = vocab_service.analyze_japanese_text(text)
    return jsonify(results)

@study_api_bp.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "PodLearn Study", "version": "2.0.0"}), 200
