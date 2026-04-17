"""Hands-Free V2 API Routes — Audio Podcast Generation & Serving."""

import os
import logging
from flask import Blueprint, request, jsonify
from flask_login import login_required, current_user

logger = logging.getLogger(__name__)

handsfree_bp = Blueprint('handsfree', __name__)


@handsfree_bp.route('/generate', methods=['POST'])
@login_required
def generate_handsfree():
    """Start generating a hands-free podcast audio file.
    
    Expects JSON:
    {
        "video_id": "abc123",
        "lesson_id": 1,
        "track_source": "s2",  // which track to use for TTS
        "lang": "vi"           // target language
    }
    """
    from ..services.handsfree_service import (
        start_generation_task, _get_cache_key, _get_storage_dir, handsfree_tasks
    )
    from ..models.subtitle import SubtitleTrack
    from ..models.lesson import Lesson
    
    data = request.get_json() or {}
    video_id = data.get('video_id')
    lesson_id = data.get('lesson_id')
    track_source = data.get('track_source', 's2')
    lang = data.get('lang', 'vi')
    
    if not video_id or not lesson_id:
        return jsonify({'error': 'video_id and lesson_id are required'}), 400

    # Check cache first
    storage_dir = _get_storage_dir()
    cache_key = _get_cache_key(video_id, 'handsfree', lang)
    cached_mp3 = os.path.join(storage_dir, f"{cache_key}.mp3")
    cached_timeline = os.path.join(storage_dir, f"{cache_key}.json")
    
    if os.path.exists(cached_mp3) and os.path.exists(cached_timeline):
        import json
        with open(cached_timeline, 'r', encoding='utf-8') as f:
            timeline_data = json.load(f)
        return jsonify({
            'status': 'completed',
            'audio_url': f"/media/handsfree/{cache_key}.mp3",
            'timeline': timeline_data['timeline'],
            'total_duration': timeline_data['total_duration']
        })

    # Load subtitle data
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first()
    if not lesson:
        return jsonify({'error': 'Lesson not found'}), 404

    # Track IDs are direct columns on the Lesson model
    track_id_map = {
        's1': lesson.s1_track_id,
        's2': lesson.s2_track_id,
        's3': lesson.s3_track_id,
    }
    
    s1_track_id = track_id_map.get('s1')
    
    # Load S1 (original) subtitle lines
    s1_lines = []
    if s1_track_id:
        s1_track = SubtitleTrack.query.get(s1_track_id)
        if s1_track and s1_track.content_json:
            s1_lines = s1_track.content_json if isinstance(s1_track.content_json, list) else []
    
    # Load translation track lines
    translation_track_id = track_id_map.get(track_source)
    translation_lines = []
    if translation_track_id:
        trans_track = SubtitleTrack.query.get(translation_track_id)
        if trans_track and trans_track.content_json:
            translation_lines = trans_track.content_json if isinstance(trans_track.content_json, list) else []
            # Auto-detect language from track metadata if possible
            if trans_track.language_code:
                lang = trans_track.language_code.split('-')[0]
    
    if not s1_lines:
        return jsonify({'error': 'No original subtitles found (S1)'}), 400

    # Start background task
    task_id = start_generation_task(video_id, s1_lines, translation_lines, lang)
    
    return jsonify({
        'status': 'processing',
        'task_id': task_id,
        'total_lines': len(s1_lines)
    })


@handsfree_bp.route('/status/<task_id>', methods=['GET'])
@login_required
def get_status(task_id):
    """Poll the status of a generation task."""
    from ..services.handsfree_service import handsfree_tasks
    
    task = handsfree_tasks.get(task_id)
    if not task:
        return jsonify({'error': 'Task not found'}), 404
    
    response = {
        'status': task['status'],
        'step': task.get('step', 'unknown'),
        'progress': task.get('progress', 0),
    }
    
    if task['status'] == 'completed' and task.get('result'):
        response['audio_url'] = task['result']['audio_url']
        response['timeline'] = task['result']['timeline']
        response['total_duration'] = task['result']['total_duration']
        # Clean up task after delivery
        # (keep it for a bit for re-polling)
    
    if task['status'] == 'failed':
        response['error'] = task.get('error', 'Unknown error')
    
    return jsonify(response)


@handsfree_bp.route('/cached/<video_id>', methods=['GET'])
@login_required
def check_cache(video_id):
    """Check if a cached handsfree audio exists for this video."""
    from ..services.handsfree_service import _get_cache_key, _get_storage_dir
    
    lang = request.args.get('lang', 'vi')
    cache_key = _get_cache_key(video_id, 'handsfree', lang)
    storage_dir = _get_storage_dir()
    
    cached_mp3 = os.path.join(storage_dir, f"{cache_key}.mp3")
    cached_timeline = os.path.join(storage_dir, f"{cache_key}.json")
    
    if os.path.exists(cached_mp3) and os.path.exists(cached_timeline):
        import json
        with open(cached_timeline, 'r', encoding='utf-8') as f:
            timeline_data = json.load(f)
        return jsonify({
            'cached': True,
            'audio_url': f"/media/handsfree/{cache_key}.mp3",
            'timeline': timeline_data['timeline'],
            'total_duration': timeline_data['total_duration']
        })
    
    return jsonify({'cached': False})


@handsfree_bp.route('/original/<video_id>', methods=['GET'])
@login_required
def get_original(video_id):
    """Get the original audio URL for the video."""
    from ..services.handsfree_service import get_original_audio_info
    
    info = get_original_audio_info(video_id)
    if not info:
        return jsonify({'error': 'Failed to fetch original audio'}), 500
        
    return jsonify(info)
