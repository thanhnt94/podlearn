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
        lessons_data.append({
            'id': l.id,
            'time_spent': l.time_spent or 0,
            'is_completed': l.is_completed,
            'last_accessed': l.last_accessed.isoformat() if l.last_accessed else None,
            'video': {
                'id': l.video.id,
                'title': l.video.title,
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
            # Enriched from offline dicts using the manual tokens (Strict filtering enabled)
            results = vocab_service.get_definitions_for_terms(custom_tokens, priority=priority, strict=True)
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
            if not t.strip(): continue
            st = SentenceToken(
                lesson_id=lesson_id, 
                line_index=line_index, 
                token=t.strip(),
                order_index=i
            )
            db.session.add(st)
        
        db.session.commit()
        return jsonify({"status": "success", "message": "Tokens saved"})
    except Exception as e:
        logger.error(f"[VOCAB ERROR] Token save failed: {e}")
        return jsonify({"error": str(e)}), 500

@api_bp.route('/vocab/tokens/clear', methods=['DELETE'])
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

@api_bp.route('/vocab/generate-all', methods=['POST'])
def generate_all_vocab():
    try:
        data = request.get_json(force=True, silent=True) or {}
        lesson_id = data.get('lesson_id')
        priority = data.get('priority', 'mazii_online') 
        
        if not lesson_id:
            return jsonify({"error": "Missing lesson_id"}), 400
            
        track = SubtitleTrack.query.filter_by(lesson_id=lesson_id).first()
        if not track:
            return jsonify({"error": "No subtitles found"}), 404
            
        content = json.loads(track.content)
        texts = [line.get('text', '') for line in content]
        
        results = vocab_service.analyze_batch_japanese(texts, priority=priority)
        
        lesson = Lesson.query.get(lesson_id)
        video_id = lesson.video_id if lesson else None
        
        for res in results:
            item = VideoGlossary(
                lesson_id=lesson_id,
                video_id=video_id,
                term=res['lemma'],
                reading=res['reading'],
                definition=", ".join(res['meanings']),
                source=res['source']
            )
            db.session.add(item)
            
        db.session.commit()
        return jsonify({"status": "success", "count": len(results), "source": priority})
    except Exception as e:
        logger.error(f"[VOCAB ERROR] Batch generation failed: {e}")
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
        
        # 1. Get unique terms recorded for this lesson
        items = VideoGlossary.query.filter_by(lesson_id=lesson_id).all()
        terms = [it.term for it in items]
        
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
                "source": item['source']
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
        'uploader_name': t.uploader_name or 'System'
    } for t in all_tracks]

    response_data = {
        'lesson_id': lesson.id,
        'lesson_title': lesson.video.title,
        'video_id': lesson.video.youtube_id,
        'available_tracks': available_tracks,
        'settings_json': lesson.settings_json,
        'is_completed': lesson.is_completed,
        'metadata': {
            'original_lang': lesson.original_lang_code,
            'target_lang': lesson.target_lang_code,
            's1_track_id': lesson.s1_track_id,
            's2_track_id': lesson.s2_track_id,
            's3_track_id': lesson.s3_track_id
        },
        'lines': []
    }

    if track:
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
    """AJAX-based video import and lesson creation."""
    data = request.get_json() or {}
    url = data.get('youtube_url', '').strip()

    if not url:
        return jsonify({'error': 'URL is required'}), 400

    video_id_str = extract_video_id(url)
    if not video_id_str:
        return jsonify({'error': 'Invalid YouTube URL'}), 400

    # Only match videos owned by this user
    video = Video.query.filter_by(youtube_id=video_id_str, owner_id=current_user.id).first()

    if not video:
        video = Video(youtube_id=video_id_str, title="Processing...", status='pending', owner_id=current_user.id, visibility='private')
        db.session.add(video)
        db.session.commit()
        # Trigger background task
        from ..tasks import process_video_metadata
        from ..utils.background_tasks import run_in_background
        run_in_background(process_video_metadata, video.id)

    # Check if lesson exists, create if not
    existing = Lesson.query.filter_by(user_id=current_user.id, video_id=video.id).first()
    if not existing:
        lesson = Lesson(user_id=current_user.id, video_id=video.id)
        db.session.add(lesson)
        db.session.commit()

    return jsonify({
        'success': True,
        'video_id': video.id,
        'title': video.title,
        'message': 'Video imported and added to library.'
    })

@api_bp.route('/video/<int:video_id>/publish', methods=['POST'])
@login_required
def request_publish(video_id):
    """Owner submits their video for public review by an admin."""
    video = Video.query.filter_by(id=video_id, owner_id=current_user.id).first_or_404()
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
