"""API routes — AJAX endpoints for subtitles, notes, etc."""

import os
import tempfile
import webvtt
import re
from datetime import datetime, timezone, date, timedelta

from werkzeug.utils import secure_filename

from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from ..extensions import db, csrf

import logging
import yt_dlp
from deep_translator import GoogleTranslator

logger = logging.getLogger(__name__)


from ..services import subtitle_service, shadowing_service, audio_service, vocab_service
from ..models.user import User
from ..models.lesson import Lesson
from ..models.video import Video
from ..models.note import Note
from ..models.subtitle import SubtitleTrack
from ..models.playlist import Playlist
from ..models.badge import Badge, UserBadge
from ..models.notification import Notification
from ..models.shadowing import ShadowingHistory
from ..models.sentence import Sentence, SentenceSet
from ..models.glossary import VideoGlossary, VocabEditHistory
from ..models.sentence_token import SentenceToken
from ..services.subtitle_service import (
    get_subtitle_track, 
    get_lines_as_dicts, 
    get_available_subs_from_youtube,
    download_and_parse_youtube_sub,
    parse_uploaded_subtitle
)
from ..services.youtube_service import extract_video_id
from ..services.shadowing_service import evaluate_pronunciation
from ..services.lesson_service import update_study_progress_and_streak
from ..services.audio_service import generate_bilingual_audio, generate_text_audio
from ..services.sentence_service import import_sentence_from_raw_json

api_bp = Blueprint('api', __name__)

@api_bp.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "service": "PodLearn", "version": "1.0.0"}), 200




@api_bp.route('/score-pronunciation', methods=['POST'])
@login_required
def score_pronunciation():
    data = request.get_json() or {}
    original = data.get('original_text', '')
    spoken = data.get('spoken_text', '')
    lang = data.get('lang_code', 'en')
    
    sentence_id = data.get('sentence_id')
    lesson_id = data.get('lesson_id')
    start_time = data.get('start_time')
    end_time = data.get('end_time')

    result = evaluate_pronunciation(
        user_id=current_user.id,
        lesson_id=lesson_id,
        original_text=original,
        spoken_text=spoken,
        lang=lang,
        start_time=start_time,
        end_time=end_time,
        sentence_id=sentence_id
    )

    return jsonify(result)


@api_bp.route('/lesson/<int:lesson_id>/shadowing-stats', methods=['GET'])
@login_required
def get_shadowing_stats(lesson_id):
    """Fetch summarized shadowing stats for each subtitle line in a lesson."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    # Group by start_time and calculate count and average score
    from sqlalchemy import func
    stats = db.session.query(
        ShadowingHistory.start_time,
        func.count(ShadowingHistory.id).label('attempt_count'),
        func.avg(ShadowingHistory.accuracy_score).label('avg_score'),
        func.max(ShadowingHistory.accuracy_score).label('best_score')
    ).filter(
        ShadowingHistory.lesson_id == lesson_id
    ).group_by(
        ShadowingHistory.start_time
    ).all()

    results = {}
    for s in stats:
        results[str(round(float(s.start_time), 3))] = {
            'count': s.attempt_count,
            'avg': int(s.avg_score),
            'best': s.best_score
        }

    return jsonify({'stats': results})

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

    # Call service to update progress and streaks
    result = update_study_progress_and_streak(current_user, lesson, seconds)

    return jsonify({
        'success': True, 
        'current_streak': result['current_streak'],
        'longest_streak': result['longest_streak']
    })


# --- Gamification & Notifications ---

@api_bp.route('/notifications', methods=['GET'])
@login_required
def get_notifications():
    """Fetch unread notifications for the current user."""
    notifs = Notification.query.filter_by(user_id=current_user.id).order_by(Notification.created_at.desc()).limit(20).all()
    return jsonify([{
        'id': n.id,
        'type': n.type,
        'title': n.title,
        'message': n.message,
        'is_read': n.is_read,
        'created_at': n.created_at.isoformat(),
        'link_url': n.link_url
    } for n in notifs])

@api_bp.route('/notifications/<int:notif_id>/read', methods=['POST'])
@login_required
def mark_notification_read(notif_id):
    """Mark a notification as read."""
    notif = Notification.query.filter_by(id=notif_id, user_id=current_user.id).first_or_404()
    notif.is_read = True
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/gamification/badges', methods=['GET'])
@login_required
def get_badges():
    """Get all badges with status (locked/unlocked) for current user."""
    all_badges = Badge.query.all()
    earned_ids = {ub.badge_id for ub in current_user.badges_earned}
    
    badges_data = []
    for b in all_badges:
        earned_at = None
        if b.id in earned_ids:
            ub = UserBadge.query.filter_by(user_id=current_user.id, badge_id=b.id).first()
            earned_at = ub.earned_at.isoformat() if ub else None
            
        # Hide secret badges unless earned
        if b.is_hidden and not earned_at:
            continue
            
        badges_data.append({
            'id': b.id,
            'name': b.name,
            'description': b.description,
            'icon_name': b.icon_name,
            'category': b.category,
            'threshold': b.threshold,
            'requirement_type': b.requirement_type,
            'is_earned': earned_at is not None,
            'earned_at': earned_at
        })
    return jsonify({'badges': badges_data})

# --- User Preferences (Templates) ---

@api_bp.route('/user/preferences', methods=['GET'])
@login_required
def get_preferences():
    """Retrieve the user's global styling preferences."""
    try:
        import json
        prefs = json.loads(current_user.preferences_json or '{}')
        return jsonify(prefs)
    except:
        return jsonify({})

@api_bp.route('/user/preferences', methods=['POST'])
@login_required
def save_preferences():
    """Save current player settings as the user's global defaults."""
    data = request.get_json() or {}
    import json
    current_user.preferences_json = json.dumps(data)
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/gamification/check-badges', methods=['POST'])
@login_required
def check_badges():
    """Manual trigger to check and award badges (e.g. after a session)."""
    from ..services.gamification_service import GamificationService
    newly_earned = GamificationService.check_and_award_badges(current_user)
    
    return jsonify({
        'new_badges': [{
            'id': b.id,
            'name': b.name,
            'description': b.description,
            'icon_name': b.icon_name
        } for b in newly_earned]
    })


# --- Playlist (Sets) Endpoints ---

@api_bp.route('/playlists', methods=['GET'])
@login_required
def get_playlists():
    """List all playlists (sets) of the current user."""
    playlists = Playlist.query.filter_by(owner_id=current_user.id).order_by(Playlist.created_at.desc()).all()
    return jsonify({
        'playlists': [{
            'id': p.id,
            'name': p.name,
            'description': p.description,
            'video_count': len(p.videos),
            'created_at': p.created_at.isoformat()
        } for p in playlists]
    })

@api_bp.route('/playlists', methods=['POST'])
@login_required
def create_playlist():
    """Create a new playlist (set)."""
    data = request.get_json() or {}
    name = data.get('name', '').strip()
    if not name:
        return jsonify({'error': 'Name is required'}), 400
        
    playlist = Playlist(name=name, description=data.get('description'), owner_id=current_user.id)
    db.session.add(playlist)
    db.session.commit()
    
    return jsonify({
        'success': True,
        'playlist': {
            'id': playlist.id,
            'name': playlist.name,
            'description': playlist.description
        }
    })

@api_bp.route('/playlists/<int:playlist_id>', methods=['DELETE'])
@login_required
def delete_playlist(playlist_id):
    """Delete a playlist."""
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=current_user.id).first_or_404()
    db.session.delete(playlist)
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/playlists/<int:playlist_id>/videos', methods=['POST'])
@login_required
def add_video_to_playlist(playlist_id):
    """Add a video (or lesson's video) to a playlist."""
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    video_id = data.get('video_id')
    
    video = Video.query.get_or_404(video_id)
    if video not in playlist.videos:
        playlist.videos.append(video)
        db.session.commit()
        
    return jsonify({'success': True})

@api_bp.route('/playlists/<int:playlist_id>/videos/<int:video_id>', methods=['DELETE'])
@login_required
def remove_video_from_playlist(playlist_id, video_id):
    """Remove a video from a playlist."""
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=current_user.id).first_or_404()
    video = Video.query.get_or_404(video_id)
    
    if video in playlist.videos:
        playlist.videos.remove(video)
        db.session.commit()
        
    return jsonify({'success': True})

@api_bp.route('/playlists/<int:playlist_id>/details', methods=['GET'])
@login_required
def get_playlist_details(playlist_id):
    """Get videos inside a specific playlist."""
    playlist = Playlist.query.filter_by(id=playlist_id, owner_id=current_user.id).first_or_404()
    
    videos_data = []
    for v in playlist.videos:
        # We need to find the user's lesson for this video or use a dummy lesson-like structure
        lesson = Lesson.query.filter_by(user_id=current_user.id, video_id=v.id).first()
        videos_data.append({
            'id': lesson.id if lesson else None,
            'video_id': v.id,
            'video': {
                'id': v.id,
                'title': v.title,
                'channel_title': v.channel_title,
                'thumbnail_url': v.thumbnail_url,
                'duration_seconds': v.duration_seconds or 1,
            }
        })
        
    return jsonify({
        'playlist': {
            'id': playlist.id,
            'name': playlist.name,
            'description': playlist.description
        },
        'videos': videos_data
    })


@api_bp.route('/dashboard/init', methods=['GET'])
@login_required
def get_dashboard_init():
    """Unified endpoint to initialize the modern React dashboard."""
    print(f"DEBUG: Initializing Dashboard for User ID: {current_user.id}")
    # 1. My Lessons (with progress)
    lessons = Lesson.query.filter_by(user_id=current_user.id).order_by(Lesson.last_accessed.desc()).all()
    print(f"DEBUG: Found {len(lessons)} lessons for user.")
    lessons_data = []
    for l in lessons:
        # Lockout logic for Free users
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
    from ..models.subtitle import SubtitleTrack # If needed for filtering
    public_videos = Video.query.filter_by(visibility='public').limit(24).all()
    discovery_data = []
    for v in public_videos:
        discovery_data.append({
            'id': v.id,
            'video': {
                'id': v.id,
                'title': v.title,
                'thumbnail_url': v.thumbnail_url,
                'duration_seconds': v.duration_seconds or 1,
                'owner_name': v.owner.username if v.owner else "System",
                'visibility': v.visibility
            },
            'time_spent': 0,
            'is_completed': False,
            'last_accessed': None
        })

    # 3. Pending Invites
    from ..models.share import ShareRequest
    pending_shares = ShareRequest.query.filter_by(receiver_id=current_user.id, status='pending').all()
    notif_data = [{
        'id': s.id,
        'sender_name': s.sender.username,
        'video_title': s.video.title,
        'created_at': s.created_at.isoformat()
    } for s in pending_shares]

    # 4. Global Stats
    from ..services.lesson_service import get_user_stats
    stats = get_user_stats(current_user.id)

    # 5. Sentence Sets (Mastery Decks)
    from ..models.sentence import SentenceSet, Sentence
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

    return jsonify({
        'lessons': lessons_data,
        'community_videos': discovery_data,
        'notifications': notif_data,
        'sets': sets_data,
        'stats': {
            'current_streak': stats.get('current_streak', 0),
            'longest_streak': stats.get('longest_streak', 0),
            'completed_count': stats.get('completed_count', 0),
            'total_lessons': len(lessons_data),
            'total_time_seconds': stats.get('total_time_seconds', 0)
        }
    })

@api_bp.route('/vocab/analyze', methods=['POST'])
@login_required
def analyze_vocab():
    """
    Analyzes a sentence and returns tokens.
    PRIORITY:
    1. Check SentenceToken table for manual segmentation by user.
    2. If missing, use Sudachi (vocab_service) for auto segmentation.
    """
    try:
        data = request.json
        text = data.get('text', '')
        priority = data.get('priority', 'mazii_online')
        lesson_id = data.get('lesson_id')
        line_index = data.get('line_index')

        if not text:
            return jsonify([])

        # Attempt to get manual tokens if coordinates are provided
        custom_tokens = []
        if lesson_id is not None and line_index is not None:
            db_tokens = SentenceToken.query.filter_by(
                lesson_id=lesson_id, 
                line_index=line_index
            ).order_by(SentenceToken.order_index.asc()).all()
            if db_tokens:
                custom_tokens = [t.token for t in db_tokens]

        if custom_tokens:
            # Enriched from offline dicts using the manual tokens
            results = vocab_service.get_definitions_for_terms(custom_tokens, priority=priority)
            # Map back to the expected 'analyzed' format for frontend
            formatted = []
            for r in results:
                formatted.append({
                    "original": r['word'],
                    "lemma": r['word'],
                    "reading": r['reading'],
                    "pos": "manual",
                    "meanings": r['definition'].split('\n') if r['definition'] else [],
                    "source": r['source']
                })
            return jsonify(formatted)

        # Fallback to automatic segmentation
        results = vocab_service.analyze_japanese_text(
            text, 
            priority=priority if priority != 'edit_segments' else 'mazii_offline', 
            strict=False, # DISABLING STRICT: Show all tokens even if not in dict
            include_all=False # Respect user preference: Skip particles/punctuation
        )
        return jsonify(results)
    except Exception as e:
        logger.error(f"[VOCAB ERROR] Analysis failed for text '{text[:20]}...': {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/tokens/save', methods=['POST'])
@login_required
def save_custom_tokens():
    """
    Saves a custom list of tokens (segmentation) for a specific line.
    Accepts tokens as either plain strings or objects {surface, lemma_override}.
    """
    try:
        data = request.json
        lesson_id = data.get('lesson_id')
        line_index = data.get('line_index')
        tokens = data.get('tokens', []) 

        if lesson_id is None or line_index is None:
            return jsonify({"error": "Missing coordinates"}), 400

        # Remove existing for this line
        SentenceToken.query.filter_by(lesson_id=lesson_id, line_index=line_index).delete()
        
        # Add new ones with sequence index
        for i, t in enumerate(tokens):
            # Support both plain strings and {surface, lemma_override} objects
            if isinstance(t, dict):
                surface = (t.get('surface') or '').strip()
                lemma = (t.get('lemma_override') or '').strip() or None
            else:
                surface = t.strip()
                lemma = None
            
            if not surface: continue
            st = SentenceToken(
                lesson_id=lesson_id, 
                line_index=line_index, 
                token=surface,
                lemma_override=lemma,
                order_index=i
            )
            db.session.add(st)
        
        db.session.commit()
        return jsonify({"status": "success", "message": "Tokens saved"})
    except Exception as e:
        logger.error(f"[VOCAB ERROR] Token save failed: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/scan-status/<int:lesson_id>', methods=['GET'])
@login_required
def get_scan_status(lesson_id):
    from ..models.sentence_token import SentenceToken
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    has_tokens = SentenceToken.query.filter_by(lesson_id=lesson_id).first() is not None
    return jsonify({
        'has_tokens': has_tokens,
        'lesson_id': lesson_id
    })
@login_required
def clear_custom_tokens():
    """
    Reset segmentation to default for a line.
    """
    try:
        data = request.json
        lesson_id = data.get('lesson_id')
        line_index = data.get('line_index')
        
        SentenceToken.query.filter_by(lesson_id=lesson_id, line_index=line_index).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "Reset to default"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/tokens/clear-all', methods=['DELETE'])
@login_required
def clear_all_custom_tokens():
    """
    Remove ALL custom segmentations for a lesson.
    """
    try:
        data = request.json
        lesson_id = data.get('lesson_id')
        
        if not lesson_id:
            return jsonify({"error": "Missing lesson_id"}), 400

        SentenceToken.query.filter_by(lesson_id=lesson_id).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "All segmentations reset to default"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500



@api_bp.route('/vocab/sync-batch', methods=['POST'])
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

@api_bp.route('/vocab/list/<int:lesson_id>', methods=['GET'])
def get_vocab_list(lesson_id):
    """
    Fetches the vocabulary list for a lesson and enriches it 
    with real-time definitions from offline DBs.
    """
    try:
        priority = request.args.get('priority', 'mazii_offline')
        
        # 1. Get unique terms recorded for this lesson, sorted by frequency
        items = VideoGlossary.query.filter_by(lesson_id=lesson_id).order_by(VideoGlossary.frequency.desc()).all()
        terms_map = {it.term: it.frequency for it in items}
        terms = list(terms_map.keys())
        
        if not terms:
            return jsonify({"vocab": [], "source": "none"})

        # 2. Enrich with definitions from offline DBs
        enriched_results = vocab_service.get_definitions_for_terms(terms, priority=priority)
        
        # Map to expected frontend format, but FILTER OUT items with no definition
        vocab_list = []
        for i, item in enumerate(enriched_results):
            if not item['definition'] or item['definition'] == 'No definition found offline.':
                continue
                
            vocab_list.append({
                "item_id": i,
                "term": item['word'],
                "reading": item['reading'],
                "definition": item['definition'],
                "source": item['source'],
                "frequency": terms_map.get(item['word'], 1)
            })

        return jsonify({
            "vocab": vocab_list,
            "source": priority 
        })
    except Exception as e:
        logger.error(f"[VOCAB ERROR] List fetch failed: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/manual-add', methods=['POST'])
def manual_add_vocab():
    """
    Manually add a term to a lesson's glossary mapping.
    """
    try:
        data = request.json
        lesson_id = data.get('lesson_id')
        term = data.get('term', '').strip()
        
        if not lesson_id or not term:
            return jsonify({"error": "Missing data"}), 400
            
        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return jsonify({"error": "Lesson not found"}), 404
            
        # Check if already exists
        existing = VideoGlossary.query.filter_by(lesson_id=lesson_id, term=term).first()
        if not existing:
            item = VideoGlossary(
                lesson_id=lesson_id,
                video_id=lesson.video_id,
                term=term,
                definition="[MANUAL_ENTRY]",
                source="manual"
            )
            db.session.add(item)
            db.session.commit()
            return jsonify({"status": "success", "message": "Term added"})
            
        return jsonify({"status": "exists", "message": "Term already in glossary"})
    except Exception as e:
        logger.error(f"[VOCAB ERROR] Manual add failed: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/remove', methods=['DELETE'])
def remove_vocab_item():
    """
    Removes a term mapping from a lesson's glossary.
    """
    try:
        data = request.json
        lesson_id = data.get('lesson_id')
        term = data.get('term')
        
        if not lesson_id or not term:
            return jsonify({"error": "Missing data"}), 400
            
        VideoGlossary.query.filter_by(lesson_id=lesson_id, term=term).delete()
        db.session.commit()
        return jsonify({"status": "success", "message": "Term removed"})
    except Exception as e:
        logger.error(f"[VOCAB ERROR] Remove failed: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/add', methods=['POST'])
@login_required
def add_vocab_item():
    data = request.get_json()
    print(f"DEBUG VOCAB ADD: {data}") # THE TRUTH
    lesson_id = data.get('lesson_id')
    term = data.get('term')
    reading = data.get('reading', '')
    definition = data.get('definition', '')
    example = data.get('example', '')
    timestamp = data.get('timestamp', 0)
    
    if not lesson_id or not term:
        return jsonify({'success': False, 'error': 'Missing data'}), 400
        
    lesson = Lesson.query.get_or_404(lesson_id)
    from ..models.sentence import Sentence, SentenceSet
    from ..models.note import Note
    
    # 1. Add to Learning Notes (as requested by user)
    note_content = f"**{term}**"
    if reading:
        note_content += f" [{reading}]"
    note_content += f"\n{definition}"
    
    new_note = Note(
        lesson_id=lesson.id,
        user_id=current_user.id,
        timestamp=float(timestamp),
        content=note_content
    )
    db.session.add(new_note)
    
    # 2. Find or create a default flashcard set for this user
    vocab_set = SentenceSet.query.filter_by(user_id=current_user.id, set_type='mastery_vocab').first()
    if not vocab_set:
        vocab_set = SentenceSet(
            user_id=current_user.id,
            title="My Vocabulary",
            set_type='mastery_vocab',
            visibility='private'
        )
        db.session.add(vocab_set)
        db.session.flush()
        
    # 3. Check if already exists in flashcards
    existing = Sentence.query.filter_by(
        user_id=current_user.id,
        set_id=vocab_set.id,
        original_text=term,
        source_video_id=lesson.video_id
    ).first()
    
    if not existing:
        new_item = Sentence(
            user_id=current_user.id,
            set_id=vocab_set.id,
            original_text=term,
            translated_text=definition,
            source_video_id=lesson.video_id,
            detailed_analysis={'original': example, 'reading': reading}
        )
        db.session.add(new_item)
        db.session.commit()
        return jsonify({'success': True, 'id': new_item.id, 'note_id': new_note.id})
    
    db.session.commit()
    return jsonify({'success': True, 'id': existing.id, 'note_id': new_note.id, 'message': 'Added to notes (Already in flashcards)'})

@api_bp.route('/notes/<int:note_id>', methods=['PATCH'])
@login_required
def update_note(note_id):
    """Update textual content of a lesson note."""
    note = Note.query.filter_by(id=note_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    new_content = data.get('content', '').strip()
    
    if not new_content:
        return jsonify({'success': False, 'error': 'Content cannot be empty'}), 400
        
    note.content = new_content
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/vocab/glossary/<int:video_id>', methods=['GET'])
@login_required
def get_shared_glossary(video_id):
    """Fetch the collaborative wiki glossary for this video."""
    items = VideoGlossary.query.filter_by(video_id=video_id).all()
    results = {}
    for item in items:
        results[item.term] = {
            'id': item.id,
            'definition': item.definition,
            'reading': item.reading,
            'updated_by': item.updater.username if item.updater else 'System',
            'updated_at': item.updated_at.isoformat()
        }
    return jsonify(results)

@api_bp.route('/vocab/update-wiki', methods=['POST'])
@login_required
def update_shared_glossary():
    """Collaborative update: Adds history and updates current best definition."""
    data = request.get_json()
    video_id = data.get('video_id')
    term = data.get('term')
    new_def = data.get('definition')
    reading = data.get('reading', '')
    
    if not all([video_id, term, new_def]):
        return jsonify({'success': False, 'error': 'Missing fields'}), 400
        
    # 1. Check if it exists
    item = VideoGlossary.query.filter_by(video_id=video_id, term=term).first()
    old_def = None
    
    if item:
        old_def = item.definition
        item.definition = new_def
        item.reading = reading or item.reading
        item.last_updated_by = current_user.id
    else:
        item = VideoGlossary(
            video_id=video_id,
            term=term,
            reading=reading,
            definition=new_def,
            last_updated_by=current_user.id
        )
        db.session.add(item)
    
    db.session.flush() # Get ID for history
    
    # 2. Add to History
    history = VocabEditHistory(
        glossary_id=item.id,
        user_id=current_user.id,
        old_definition=old_def,
        new_definition=new_def,
        change_reason=data.get('reason', 'Community contribution')
    )
    db.session.add(history)
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'item': {
            'term': term,
            'definition': new_def,
            'updated_by': current_user.username
        }
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

@api_bp.route('/status/<string:resource_type>/<int:resource_id>', methods=['GET'])
@login_required
def get_resource_status(resource_type, resource_id):
    """
    Unified polling endpoint for background tasks.
    Supports 'video' and 'subtitle'.
    """
    if resource_type == 'video':
        res = Video.query.get(resource_id)
    elif resource_type == 'subtitle':
        res = SubtitleTrack.query.get(resource_id)
    else:
        return jsonify({'error': 'Invalid resource type'}), 400

    if not res:
        return jsonify({'error': 'Resource not found'}), 404

    return jsonify({
        'id': res.id,
        'type': resource_type,
        'status': getattr(res, 'status', 'unknown')
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
            'id': t.id,
            'language_code': t.language_code,
            'is_auto_generated': t.is_auto_generated,
            'uploader_name': t.uploader_name or "Unknown",
            'uploader_id': t.uploader_id,
            'fetched_at': t.fetched_at.isoformat() if hasattr(t, 'fetched_at') and t.fetched_at else None,
            'line_count': len(t.content_json) if t.content_json else 0,
            'note': t.note
        })
    return jsonify({'subtitles': results})

@api_bp.route('/subtitles/<int:sub_id>', methods=['DELETE'])
@login_required
def delete_subtitle(sub_id):
    """Delete a subtitle track from the DB."""
    track = SubtitleTrack.query.get_or_404(sub_id)
    
    # Optional: Only allow downloader or admin? 
    # For now, if you are studying the lesson, you can manage its video tracks.
    db.session.delete(track)
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/youtube/subtitles-list/<video_id>', methods=['GET'])
@login_required
def get_youtube_subs_list(video_id):
    """Fetch available subtitle languages from YouTube using service."""
    result = get_available_subs_from_youtube(video_id)
    if 'error' in result:
        status_code = 429 if result['error'] == '429' else 400
        return jsonify(result), status_code
    return jsonify(result)


@api_bp.route('/youtube/subtitles-download/<int:lesson_id>', methods=['POST'])
@login_required
def download_youtube_sub(lesson_id):
    """Download subtitle from YouTube, parse, and save to DB."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}
    lang_code = data.get('lang_code')
    is_auto = data.get('is_auto', False)
    
    if not lang_code:
        return jsonify({'error': 'lang_code is required'}), 400

    result = download_and_parse_youtube_sub(lesson.video.youtube_id, lang_code, is_auto)
    if 'error' in result:
        status_code = 429 if result['error'] == '429' else 400
        return jsonify(result), status_code

    parsed_lines = result['lines']
    
    # Always create a new track for the user who fetched it
    track = SubtitleTrack(
        video_id=lesson.video.id, 
        language_code=lang_code,
        content_json=parsed_lines,
        is_auto_generated=is_auto,
        uploader_id=current_user.id,
        uploader_name=current_user.username,
        fetched_at=datetime.now(timezone.utc)
    )
    db.session.add(track)
    db.session.commit()
    
    return jsonify({
        'success': True, 
        'track_id': track.id,
        'line_count': len(parsed_lines)
    })





@api_bp.route('/subtitles/fetch/<int:lesson_id>', methods=['GET', 'POST'])
@login_required
def fetch_subtitles(lesson_id):
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    # Support both GET (params) and POST (JSON)
    if request.method == 'POST':
        data = request.get_json(silent=True) or {}
    else:
        data = request.args
    track_id = data.get('track_id')
    lang_code = (data.get('language_code') or '').strip()
    if track_id:
        track = SubtitleTrack.query.get(track_id)
    elif lang_code:
        # Fallback to most recent for that language
        track = SubtitleTrack.query.filter_by(video_id=lesson.video.id, language_code=lang_code)\
                             .order_by(SubtitleTrack.fetched_at.desc()).first()
    else:
        # Ultimate fallback: Most recent track of ANY language for this video
        track = SubtitleTrack.query.filter_by(video_id=lesson.video.id)\
                             .order_by(SubtitleTrack.fetched_at.desc()).first()

    # Always get available tracks for dropdowns
    all_tracks = SubtitleTrack.query.filter_by(video_id=lesson.video.id).all()
    available_tracks = [{
        'id': t.id,
        'language_code': t.language_code,
        'uploader_name': t.uploader_name if t.uploader_id else 'YouTube'
    } for t in all_tracks]

    response_data = {
        'lesson_id': lesson.id,
        'lesson_title': lesson.video.title,
        'video_id': lesson.video.youtube_id,
        'available_tracks': available_tracks,
        'settings_json': lesson.settings_json,
        'is_completed': lesson.is_completed,
        'total_time_spent': lesson.time_spent,
        'metadata': {
            'original_lang': lesson.original_lang_code or lesson.video.language_code,
            'target_lang': lesson.target_lang_code,
            's1_track_id': lesson.s1_track_id,
            's2_track_id': lesson.s2_track_id,
            's3_track_id': lesson.s3_track_id
        },
        'lines': []
    }

    if track:
        # Membership lockout check
        if current_user.role == 'free' and (lesson.time_spent or 0) >= 600:
            return jsonify({
                'error': 'Video locked',
                'message': 'Giới hạn 10 phút học cho thành viên Miễn phí đã hết. Vui lòng nâng cấp VIP để tiếp tục học video này.',
                'is_locked': True
            }), 403

        # Compatibility fix: Ensure 'end' is present for all lines
        lines = []
        for line in track.content_json:
            if 'end' not in line and 'duration' in line:
                line['end'] = round(line['start'] + line['duration'], 3)
            elif 'end' not in line:
                line['end'] = line['start'] + 2.0 # Fallback
            lines.append(line)
            
        response_data.update({
            'track_id': track.id,
            'language_code': track.language_code, 
            'lines': lines
        })

    return jsonify(response_data)

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
        
        result = parse_uploaded_subtitle(temp_path, ext)
        if 'error' in result:
            return jsonify(result), 400

        parsed_lines = result['lines']

        # Always create a new track record
        track = SubtitleTrack(
            video_id=lesson.video.id, 
            language_code=lang_code,
            content_json=parsed_lines,
            uploader_id=current_user.id,
            uploader_name=uploader_name,
            note=note,
            fetched_at=datetime.now(timezone.utc)
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

    # Specific Track IDs
    lesson.s1_track_id = data.get('s1_track_id')
    lesson.s2_track_id = data.get('s2_track_id')
    lesson.s3_track_id = data.get('s3_track_id')
    
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

@api_bp.route('/lesson/<int:lesson_id>/complete', methods=['POST'])
@login_required
def complete_lesson(lesson_id):
    """Mark a lesson as completed."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    lesson.is_completed = True
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

@api_bp.route('/sentences/import-json', methods=['POST'])
@login_required
def import_sentence():
    """Import a sentence pattern from a raw JSON analysis string."""
    data = request.get_json() or {}
    json_data = data.get('json_data')
    set_id = data.get('set_id')
    source_video_id = data.get('source_video_id')

    if not json_data:
        return jsonify({'error': 'json_data is required'}), 400
    if not set_id:
        return jsonify({'error': 'set_id is required'}), 400

    result = import_sentence_from_raw_json(
        json_string=json_data,
        user_id=current_user.id,
        set_id=set_id,
        source_video_id=source_video_id
    )

    if not result.get('success'):
        return jsonify(result), 400

    return jsonify(result)

@api_bp.route('/video/import', methods=['POST'])
@login_required
def import_video():
    """AJAX-based video import and lesson creation. 
    ENFORCES SINGLETON: Only one Video record per YouTube ID across the system.
    """
    data = request.get_json() or {}
    url = data.get('youtube_url', '').strip()
    language_code = data.get('language_code', 'en')

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    # Permission check: Only VIP and Admin can import videos
    if not current_user.is_at_least_vip:
        return jsonify({
            'error': 'Unauthorized', 
            'message': 'Chỉ thành viên VIP mới có quyền thêm video mới vào hệ thống.'
        }), 403

    video_id_str = extract_video_id(url)
    if not video_id_str:
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    # 1. Global Singleton Check: Find ANY video with this YouTube ID
    video = Video.query.filter_by(youtube_id=video_id_str).first()

    if not video:
        # First time this video enters the system: System Owned
        video = Video(
            youtube_id=video_id_str, 
            title="Processing...", 
            status='pending', 
            owner_id=None, 
            visibility='private',
            language_code=language_code
        )
        db.session.add(video)
        db.session.commit()
        
        # Trigger background metadata processing
        from ..tasks import process_video_metadata
        from ..utils.background_tasks import run_in_background
        run_in_background(process_video_metadata, video.id)
        message = 'Video imported and added to library.'
    else:
        message = f'Video "{video.title}" added to your library.'

    # 2. Lesson Creation: One private learning instance per user
    existing_lesson = Lesson.query.filter_by(user_id=current_user.id, video_id=video.id).first()
    if not existing_lesson:
        lesson = Lesson(user_id=current_user.id, video_id=video.id)
        db.session.add(lesson)
        db.session.commit()
    else:
        return jsonify({'success': False, 'error': 'This video is already in your library.'}), 400

    return jsonify({
        'success': True,
        'video_id': video.id,
        'title': video.title,
        'message': message
    })

@api_bp.route('/lesson/<int:lesson_id>', methods=['DELETE'])
@login_required
def delete_lesson(lesson_id):
    """Remove a video from the user's private library (deletes the Lesson)."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    # Cascade deletes Notes, etc. via SQLAlchemy relationship 'all, delete-orphan'
    db.session.delete(lesson)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Lesson removed from your library.'})

@api_bp.route('/video/<int:video_id>', methods=['DELETE'])
@login_required
def delete_video_global(video_id):
    """ADMIN ONLY: Completely remove a video and all associated user lessons/data."""
    if not current_user.is_admin:
        return jsonify({'error': 'Unauthorized. Admin role required.'}), 403
        
    video = Video.query.get_or_404(video_id)
    
    # Hard Delete: All Lessons, Subtitles, Comments, etc. will be removed via cascade
    db.session.delete(video)
    db.session.commit()
    return jsonify({'success': True, 'message': f'Global video "{video.title}" and all associated data deleted.'})

@api_bp.route('/video/<int:video_id>/publish', methods=['POST'])
@login_required
def request_publish(video_id):
    """Suggest this video for the public gallery (reviewed by Admin)."""
    video = Video.query.get_or_404(video_id)
    if video.visibility == 'private':
        video.visibility = 'pending_public'
        db.session.commit()
    return jsonify({'success': True, 'message': 'Video submitted for admin approval.'})

@api_bp.route('/video/<int:video_id>/join', methods=['POST'])
@login_required
def join_public_video(video_id):
    """User adds a public video to their private library."""
    video = Video.query.filter_by(id=video_id, visibility='public').first_or_404()
    
    # Check if lesson already exists
    existing = Lesson.query.filter_by(user_id=current_user.id, video_id=video.id).first()
    if existing:
        return jsonify({'success': False, 'error': 'Video already in your library.'}), 400
        
    lesson = Lesson(user_id=current_user.id, video_id=video.id)
    db.session.add(lesson)
    db.session.commit()
    
    return jsonify({'success': True, 'message': f"Video '{video.title}' added to your library."})

@api_bp.route('/sentences/<int:sentence_id>/audio', methods=['POST'])
@login_required
def get_sentence_audio(sentence_id):
    """Bilingual TTS audio generation with server-side caching."""
    from flask import current_app
    sentence = Sentence.query.filter_by(id=sentence_id, user_id=current_user.id).first_or_404()

    # Caching check
    if sentence.audio_url:
        full_path = os.path.join(current_app.static_folder, sentence.audio_url.lstrip('/static/'))
        if os.path.exists(full_path):
            return jsonify({'success': True, 'audio_url': sentence.audio_url, 'cached': True})

    # Generation logic
    try:
        # Pass config if present in metadata
        analysis = sentence.detailed_analysis or {}
        config = analysis.get('metadata', {})
        
        generated_url = generate_bilingual_audio(
            sentence_id=sentence.id,
            original_text=sentence.original_text,
            translated_text=sentence.translated_text,
            config_json=config
        )

        # Update DB
        sentence.audio_url = generated_url
        db.session.commit()

        return jsonify({'success': True, 'audio_url': generated_url, 'cached': False})
    except Exception as e:
        print(f"[API ERROR] TTS Generation failed for sentence {sentence_id}: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@api_bp.route('/tts', methods=['POST'])
@login_required
def tts_anonymous():
    """Generic TTS endpoint for arbitrary text snippets (e.g. grammar examples)."""
    try:
        data = request.get_json() or {}
        text = data.get('text', '').strip()
        lang = data.get('lang', 'ja')

        if not text:
            return jsonify({'success': False, 'error': 'text is required'}), 400

        audio_url = generate_text_audio(text, lang=lang)
        return jsonify({'success': True, 'audio_url': audio_url})
    except Exception as e:
        print(f"[API ERROR] Anonymous TTS failed: {str(e)}")
        return jsonify({'error': str(e), 'success': False}), 500

@api_bp.route('/sentences/<int:sentence_id>/shadowing-stats', methods=['GET'])
@login_required
def get_sentence_shadowing_stats(sentence_id):
    """Retrieve learning statistics for a specific sentence pattern."""
    from sqlalchemy import func
    from ..models.shadowing import ShadowingHistory
    
    stats = db.session.query(
        func.count(ShadowingHistory.id).label('attempt_count'),
        func.avg(ShadowingHistory.accuracy_score).label('avg_score'),
        func.max(ShadowingHistory.accuracy_score).label('best_score')
    ).filter(
        ShadowingHistory.sentence_id == sentence_id,
        ShadowingHistory.user_id == current_user.id
    ).first()

    return jsonify({
        'attempts': stats.attempt_count or 0,
        'avg_score': int(stats.avg_score) if stats.avg_score else 0,
        'best_score': stats.best_score or 0
    })

@api_bp.route('/sentences/<int:sentence_id>/shadowing-history', methods=['GET'])
@login_required
def get_sentence_shadowing_history(sentence_id):
    """Fetch individual shadowing attempts for a sentence."""
    history = ShadowingHistory.query.filter_by(
        sentence_id=sentence_id,
        user_id=current_user.id
    ).order_by(ShadowingHistory.created_at.desc()).limit(10).all()

    results = []
    for h in history:
        results.append({
            'spoken_text': h.spoken_text,
            'score': h.accuracy_score,
            'created_at': h.created_at.strftime('%Y-%m-%d %H:%M:%S')
        })

    return jsonify({'history': results})


# ── SENTENCE SET CRUD ──────────────────────────────────────────

@api_bp.route('/sets/create', methods=['POST'])
@login_required
def create_set():
    """Create a new thematic sentence collection."""
    data = request.get_json() or {}
    title = data.get('title', '').strip()
    description = data.get('description', '').strip()
    set_type = data.get('set_type', 'mastery_sentence').strip()

    if not title:
        return jsonify({'success': False, 'error': 'Title is required'}), 400

    # Strict validation of set_type
    valid_types = ['mastery_sentence', 'mastery_grammar', 'mastery_vocab']
    if set_type not in valid_types:
        set_type = 'mastery_sentence' # Fallback

    new_set = SentenceSet(
        user_id=current_user.id,
        title=title,
        description=description,
        set_type=set_type
    )
    db.session.add(new_set)
    db.session.commit()

    return jsonify({
        'success': True,
        'set': {
            'id': new_set.id,
            'title': new_set.title,
            'description': new_set.description,
            'set_type': new_set.set_type
        }
    })

@api_bp.route('/sets/<int:set_id>/join', methods=['POST'])
@login_required
def join_public_set(set_id):
    """User clones a public sentence set (deck) into their own library."""
    original_set = SentenceSet.query.filter_by(id=set_id, visibility='public').first_or_404()
    
    # 1. Create a new set for the current user
    new_set = SentenceSet(
        user_id=current_user.id,
        title=f"{original_set.title} (Clone)",
        description=original_set.description,
        set_type=original_set.set_type,
        visibility='private'
    )
    db.session.add(new_set)
    db.session.flush() # Get new_set.id
    
    # 2. Clone all sentences
    original_sentences = original_set.sentences.all()
    for s in original_sentences:
        new_sent = Sentence(
            user_id=current_user.id,
            set_id=new_set.id,
            original_text=s.original_text,
            translated_text=s.translated_text,
            audio_url=s.audio_url,
            source_video_id=s.source_video_id,
            detailed_analysis=s.detailed_analysis,
            analysis_note=s.analysis_note
        )
        db.session.add(new_sent)
    
    db.session.commit()
    return jsonify({
        'success': True, 
        'message': f"Bộ bài '{original_set.title}' đã được thêm vào thư viện của bạn.",
        'new_set_id': new_set.id
    })


# ── SENTENCE MANAGEMENT ────────────────────────────────────────

@api_bp.route('/sentences', methods=['POST'])
@login_required
def create_sentence_api():
    """Create a new sentence record via JSON, supporting specialized tracks."""
    data = request.json or {}
    set_id = data.get('set_id')
    detailed_analysis = data.get('detailed_analysis') or {}
    if not isinstance(detailed_analysis, dict) and isinstance(detailed_analysis, str):
        try: detailed_analysis = json.loads(detailed_analysis)
        except: detailed_analysis = {}
    elif not isinstance(detailed_analysis, dict):
        detailed_analysis = {}

    source_video_id = data.get('source_video_id')

    if not set_id:
        return jsonify({'success': False, 'error': 'Target Set ID is required'}), 400

    s_set = SentenceSet.query.filter_by(id=set_id, user_id=current_user.id).first_or_404()

    # Reuse the import service as it handles all the track-aware logic
    result = import_sentence_from_raw_json(
        json_string=detailed_analysis,
        user_id=current_user.id,
        set_id=set_id,
        source_video_id=source_video_id,
        track_mode=s_set.set_type
    )
    return jsonify(result)

@api_bp.route('/sentences/import-json', methods=['POST'])
@login_required
def import_json_sentence():
    """Route to import a sentence from raw JSON analysis, now requires set_id."""
    data = request.get_json() or {}
    json_data = data.get('json_data')
    set_id = data.get('set_id')
    source_video_id = data.get('source_video_id')

    if not json_data:
        return jsonify({'success': False, 'error': 'JSON data is required'}), 400
    if not set_id:
        return jsonify({'success': False, 'error': 'Target Set ID is required'}), 400

    # Ensure the set belongs to the user
    s_set = SentenceSet.query.filter_by(id=set_id, user_id=current_user.id).first_or_404()

    result = import_sentence_from_raw_json(
        json_string=json_data,
        user_id=current_user.id,
        set_id=set_id,
        source_video_id=source_video_id,
        track_mode=s_set.set_type
    )
    return jsonify(result)

@api_bp.route('/sentences/<int:sentence_id>', methods=['DELETE'])
@login_required
def delete_sentence_api(sentence_id):
    """Individual sentence deletion."""
    sentence = Sentence.query.filter_by(id=sentence_id, user_id=current_user.id).first_or_404()
    db.session.delete(sentence)
    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/sentences/<int:sentence_id>', methods=['PATCH'])
@login_required
def update_sentence(sentence_id):
    """Update sentence text or analysis."""
    sentence = Sentence.query.filter_by(id=sentence_id, user_id=current_user.id).first_or_404()
    data = request.get_json() or {}

    if 'original_text' in data:
        sentence.original_text = data['original_text']
    if 'translated_text' in data:
        sentence.translated_text = data['translated_text']
    if 'detailed_analysis' in data:
        # Expecting a full dictionary here, ensure it's not an empty string
        analysis = data['detailed_analysis']
        if not analysis or analysis == "":
             analysis = {}
        sentence.detailed_analysis = analysis

    db.session.commit()
    return jsonify({'success': True})

@api_bp.route('/ai/insights/<string:video_id>/analyze', methods=['GET', 'POST'])
@csrf.exempt
@login_required
def generate_ai_insights(video_id):
    from flask import request
    from sqlalchemy import func
    from ..models.video import Video
    
    # Dual lookup: try primary key first, then youtube_id (case-insensitive)
    video = None
    if video_id.isdigit():
        video = Video.query.get(int(video_id))
    if not video:
        video = Video.query.filter(func.lower(Video.youtube_id) == video_id.lower()).first()
        
    print(f"DEBUG: Analyze requested for {video_id}. Found Video: {video.id if video else 'None'}")
    
    if not video:
        return jsonify({"error": f"Video {video_id} not found"}), 404
    
    from ..models.ai_insight import AIInsightTrack
    from ..services.ai_service import start_background_analysis
    from flask import current_app

    # Verify transcript existence
    first_track = video.subtitle_tracks.first()
    if not first_track:
        return jsonify({"error": "Video must have at least one subtitle track before generating AI insights."}), 400
        
    # Check if a track is already processing
    existing_processing = AIInsightTrack.query.filter_by(video_id=video.id, status='processing').first()
    if existing_processing:
        return jsonify({"message": "Analysis already in progress", "track_id": existing_processing.id}), 202

    # Get transcript lines from the first available track
    transcript_lines = first_track.content_json
    
    # Spawn background thread
    start_background_analysis(current_app._get_current_object(), video.id, transcript_lines, lang='vi')
    
    return jsonify({"message": "AI analysis started in background"}), 202

@api_bp.route('/ai/insights/<string:video_id>')
@login_required
def get_ai_insights(video_id):
    from ..models.ai_insight import AIInsightTrack, AIInsightItem
    from ..models.video import Video
    from sqlalchemy import func
    
    # Dual lookup: try primary key first, then youtube_id (case-insensitive)
    video = None
    if video_id.isdigit():
        video = Video.query.get(int(video_id))
    if not video:
        video = Video.query.filter(func.lower(Video.youtube_id) == video_id.lower()).first()

    if not video:
        print(f"DEBUG: Get insights failed - Video {video_id} not found")
        return jsonify({"status": "empty", "insights": []})

    # Get the latest track (regardless of status for polling)
    track = AIInsightTrack.query.filter_by(video_id=video.id).order_by(AIInsightTrack.created_at.desc()).first()

    if not track:
        return jsonify({
            "status": "empty",
            "insights": [], 
            "message": "No AI insights found for this video."
        })
        
    items = AIInsightItem.query.filter_by(track_id=track.id).all()
    
    insight_list = [{
        "index": it.subtitle_index,
        "start": it.start_time,
        "end": it.end_time,
        "short": it.short_explanation,
        "grammar": it.grammar_analysis,
        "nuance": it.nuance_style,
        "context": it.context_notes,
        "vocabulary": (it.data_json or {}).get('key_vocabulary', ''),
        "similar": (it.data_json or {}).get('similar_sentences', ''),
        "culture": (it.data_json or {}).get('cultural_context', ''),
        "hack": (it.data_json or {}).get('memory_hack', ''),
        "mistakes": (it.data_json or {}).get('common_mistakes', '')
    } for it in items]
    
    return jsonify({
        "track_id": track.id,
        "status": track.status,
        "processed_lines": track.processed_lines,
        "total_lines": track.total_lines,
        "overall_summary": track.overall_summary,
        "model": track.model_name,
        "language": track.language_code,
        "insights": insight_list
    })

@api_bp.route('/ai/insights/<string:video_id>/line/<int:line_index>', methods=['POST'])
@csrf.exempt
@login_required
def analyze_ai_line(video_id, line_index):
    from ..models.video import Video
    from ..models.ai_insight import AIInsightTrack
    from ..services.ai_service import analyze_single_line
    from sqlalchemy import func
    
    # Dual lookup
    video = None
    if video_id.isdigit():
        video = Video.query.get(int(video_id))
    if not video:
        video = Video.query.filter(func.lower(Video.youtube_id) == video_id.lower()).first()
    
    if not video:
        return jsonify({"error": "Video not found"}), 404
        
    # Get text for this index
    first_track = video.subtitle_tracks.filter_by(language_code='vi').first()
    if not first_track:
        first_track = video.subtitle_tracks.first()
    if not first_track:
        return jsonify({"error": "No transcript available."}), 400

    # Auto-create track if it doesn't exist
    track = AIInsightTrack.query.filter_by(video_id=video.id).order_by(AIInsightTrack.created_at.desc()).first()
    if not track:
        track = AIInsightTrack(
            video_id=video.id,
            language_code='vi',
            status='completed',
            total_lines=len(first_track.content_json)
        )
        db.session.add(track)
        db.session.commit()
        
    transcript = first_track.content_json
    if line_index < 0 or line_index >= len(transcript):
        return jsonify({"error": "Invalid line index."}), 400
        
    line_data = transcript[line_index]
    line_text = line_data.get('text', '')
    start_time = line_data.get('start', 0)
    end_time = line_data.get('end', 0)
    
    # Call service
    result = analyze_single_line(track.id, line_index, line_text, start_time=start_time, end_time=end_time, target_lang='vi')
    
    if result:
        return jsonify({
            "success": True,
            "insight": {
                "index": line_index,
                "short": result.get('short_explanation', ''),
                "grammar": result.get('grammar_analysis', ''),
                "vocabulary": result.get('key_vocabulary', ''),
                "nuance": result.get('nuance_style', ''),
                "similar": result.get('similar_sentences', ''),
                "culture": result.get('cultural_context', ''),
                "hack": result.get('memory_hack', ''),
                "mistakes": result.get('common_mistakes', '')
            }
        })
        return jsonify({"error": "AI analysis failed."}), 500

@api_bp.route('/video/analyze-sentence', methods=['POST'])
@login_required
def analyze_sentence_api():
    """Analyze a Japanese sentence to split into words with reading/furigana."""
    data = request.get_json() or {}
    text = data.get('text', '').strip()
    lang = data.get('lang', 'ja')
    lesson_id = data.get('lesson_id')
    active_line_index = data.get('active_line_index')

    if not text:
        return jsonify({'words': []})

    if lang == 'ja':
        from ..services.vocab_service import analyze_japanese_text, get_definitions_for_terms
        from ..models.sentence_token import SentenceToken

        # 1. Try to get saved tokens first
        db_tokens = []
        if lesson_id is not None:
            db_tokens = SentenceToken.query.filter_by(
                lesson_id=lesson_id, 
                line_index=active_line_index
            ).order_by(SentenceToken.order_index.asc()).all()

        if db_tokens:
            from ..services.vocab_service import katakana_to_hiragana
            # Use lemma_override for dictionary lookup when available
            lookup_terms = [t.lemma_override or t.token for t in db_tokens]
            results = get_definitions_for_terms(lookup_terms, priority='mazii_offline')
            formatted = []
            for i, r in enumerate(results):
                db_token = db_tokens[i]
                surface = db_token.token  # Always display the surface form
                lemma = db_token.lemma_override  # The linked dictionary form
                
                is_skip = lemma and lemma.strip().lower() == 'skip'
                
                furigana = None
                if not is_skip and r.get('reading') and r['reading'] != surface:
                    furigana = katakana_to_hiragana(r['reading'])

                # If user manually typed 'skip', treat it as a meaningless particle so frontend dims it.
                pos_val = '助詞' if is_skip else (getattr(db_token, 'pos', None) or "manual")

                formatted.append({
                    "surface": surface,
                    "original": surface,
                    "lemma": lemma or surface,
                    "lemma_override": lemma,
                    "reading": "" if is_skip else r.get('reading', ''),
                    "furigana": furigana,
                    "pos": pos_val,
                    "meanings": [] if is_skip else (r.get('meanings', []) if isinstance(r.get('meanings'), list) else [r.get('definition', '')]),
                    "source": 'none' if is_skip else r.get('source', '')
                })
            return jsonify({'words': formatted, 'is_manual': True})

        # Fetch custom vocab for priority segmentation
        from ..models.glossary import VideoGlossary
        custom_vocab_records = VideoGlossary.query.filter_by(lesson_id=lesson_id).all() if lesson_id else []
        custom_vocab_set = {v.term for v in custom_vocab_records} if custom_vocab_records else None

        # 2. Fallback to automatic segmentation
        words = analyze_japanese_text(text, priority='mazii_offline', include_all=True, custom_vocab=custom_vocab_set)
        return jsonify({'words': words, 'is_manual': False})
    else:
        # Fallback for other languages: simple space-based splitting for now
        words = [{"surface": w, "reading": None} for w in text.split()]
        return jsonify({'words': words})
@api_bp.route('/vocab/generate-all', methods=['POST'])
@login_required
def generate_all_vocab():
    """Scan the entire lesson and save verified tokens for all lines."""
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    priority = data.get('priority', 'mazii_offline')

    if not lesson_id:
        return jsonify({"error": "Missing lesson_id"}), 400

    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    # Get the primary track (usually S1 or S2)
    track_id = lesson.s1_track_id or lesson.s2_track_id
    if not track_id:
        return jsonify({"error": "No subtitle track selected for this lesson."}), 400
        
    from ..services.subtitle_service import get_lines_as_dicts
    from ..services.vocab_service import analyze_japanese_text
    from ..models.sentence_token import SentenceToken
    from ..models.subtitle import SubtitleTrack
    from ..models.glossary import VideoGlossary

    track = SubtitleTrack.query.get(track_id)
    if not track:
        return jsonify({"error": "Subtitle track not found."}), 404
        
    lines = get_lines_as_dicts(track)
    
    custom_vocab_records = VideoGlossary.query.filter_by(lesson_id=lesson_id).all()
    custom_vocab_set = {v.term for v in custom_vocab_records} if custom_vocab_records else None
    
    # 1. Clear existing tokens to start fresh
    SentenceToken.query.filter_by(lesson_id=lesson_id).delete()
    
    # 2. Analyze and save for each line
    new_tokens = []
    for idx, line in enumerate(lines):
        text = line.get('text', '').strip()
        if not text:
            continue
            
        try:
            words = analyze_japanese_text(text, priority=priority, include_all=True, custom_vocab=custom_vocab_set)
            for order, w in enumerate(words):
                surface = w['surface']
                lemma = w.get('lemma', surface)
                # Only store lemma_override if it differs from surface
                lemma_val = lemma if lemma != surface else None
                new_tokens.append(SentenceToken(
                    lesson_id=lesson_id,
                    line_index=idx,
                    token=surface,
                    lemma_override=lemma_val,
                    pos=w.get('pos'),
                    order_index=order
                ))
        except Exception as e:
            logger.error(f"Failed to analyze line {idx}: {e}")
            continue
            
    if new_tokens:
        db.session.bulk_save_objects(new_tokens)
        db.session.commit()
    
    return jsonify({"success": True, "count": len(new_tokens)})

@api_bp.route('/vocab/tokens/clear-all', methods=['DELETE'])
@login_required
def clear_all_tokens():
    """Remove all manual segmentation for a lesson."""
    data = request.get_json() or {}
    lesson_id = data.get('lesson_id')
    if not lesson_id:
        return jsonify({"error": "Missing lesson_id"}), 400
    
    from ..models.sentence_token import SentenceToken
    SentenceToken.query.filter_by(lesson_id=lesson_id).delete()
    db.session.commit()
    return jsonify({"success": True})
