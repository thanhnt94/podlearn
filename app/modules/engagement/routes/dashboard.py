"""Dashboard routes — lesson library management."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_jwt_extended import jwt_required, current_user
from datetime import datetime, timezone

from app.core.extensions import db
from app.modules.content import interface as content_interface
from app.modules.study import interface as study_interface
from app.modules.engagement import interface as engagement_interface

dashboard_bp = Blueprint('dashboard', __name__,
                        template_folder='../templates',
                        static_folder='../static')
from sqlalchemy import func, cast, Date
from datetime import timedelta

@dashboard_bp.route('/dashboard')
@jwt_required()
def index():
    """Main library and discovery dashboard."""
    # 1. Fetch user lessons and enrich with video info
    lessons_dto = study_interface.get_user_lessons_dto(current_user.id)
    lessons = []
    for l in lessons_dto:
        video = content_interface.get_video_dto(l['video_id'])
        if video:
            l['video'] = video
            lessons.append(l)

    # 2. Fetch pending shares
    pending_shares = engagement_interface.get_pending_shares_dto(current_user.id)

    # 3. Fetch public videos for discovery
    discovery_raw = content_interface.get_public_videos_dto()
    public_videos = []
    for v in discovery_raw:
        public_videos.append({
            'id': v['id'],
            'video': v,
            'time_spent': 0,
            'is_completed': False,
            'last_accessed': None
        })

    # 4. Preparation for template helpers
    user_lesson_video_ids = {l['video_id'] for l in lessons}
    video_lesson_map = {l['video_id']: l['id'] for l in lessons}

    # 5. Fetch statistics for charts & hydration
    # Real stats from engagement module
    full_stats = engagement_interface.get_user_stats_dto(current_user.id)
    
    # Old chart logic (legacy support)
    stats_map = engagement_interface.get_daily_stats_dto(current_user.id)
    chart_labels = sorted(stats_map.keys())
    notes_data = [stats_map[d]['listening_seconds'] // 60 for d in chart_labels]
    sentences_data = [stats_map[d]['shadowing_count'] for d in chart_labels]

    total_time_formatted = f"{full_stats['total_listening_seconds'] // 3600}h {(full_stats['total_listening_seconds'] % 3600) // 60}m"
    total_notes = full_stats['total_shadowing_count']

    # 6. Fetch Notifications for Hydration
    real_notifs = engagement_interface.get_user_notifications_dto(current_user.id)
    notifications_data = real_notifs + [{
        'id': f"share_{s['id']}",
        'type': 'invite',
        'title': f"Invite from {s['sender_name']}",
        'message': f"Wants to share: {s['video_title']}",
        'is_read': False,
        'created_at': s['created_at'],
        'link_url': f"/share/{s['id']}"
    } for s in pending_shares]

    return render_template('engagement/dashboard.html',
                           lessons=lessons,
                           total_lessons=len(lessons),
                           completed_count=full_stats['completed_count'],
                           current_streak=full_stats['current_streak'],
                           full_stats=full_stats,
                           notifications=notifications_data,
                           pending_shares=pending_shares,
                           community_videos=public_videos,
                           user_lesson_video_ids=user_lesson_video_ids,
                           video_lesson_map=video_lesson_map,
                           chart_labels=chart_labels,
                           notes_data=notes_data,
                           sentences_data=sentences_data,
                           total_time_formatted=total_time_formatted,
                           total_notes=total_notes,
                           active_step='library')


@dashboard_bp.route('/sets/<int:set_id>', endpoint='set_details_legacy')
@dashboard_bp.route('/sets/<string:mode>/<int:set_id>', endpoint='set_details')
@jwt_required()
def set_details(set_id, mode=None):
    """View and manage sentences within a specific deck with type-aware context."""
    s_set = study_interface.get_sentence_set_dto(set_id, current_user.id)
    if not s_set:
        return "Set not found", 404
    
    # URL Integrity: Redirect to canonical mode-specific URL if accessing via generic or wrong type
    mode_map = {
        'mastery_grammar': 'grammar',
        'mastery_vocab': 'vocab',
        'mastery_sentence': 'sentence'
    }
    expected_mode = mode_map.get(s_set['set_type'], 'sentence')
    
    if mode != expected_mode:
        return redirect(url_for('dashboard.set_details', set_id=set_id, mode=expected_mode))

    page = request.args.get('page', 1, type=int)
    pagination_dto = study_interface.get_sentences_paginated_dto(set_id, current_user.id, page, 24)
    sentences = pagination_dto['items']
    
    # We pass the DTO to the template. 
    # Note: If the template uses pagination object methods, we might need a dummy class or just update the template.
    return render_template('engagement/set_details.html', s_set=s_set, sentences=sentences, pagination=pagination_dto)



@dashboard_bp.route('/add-lesson', methods=['POST'])
@jwt_required()
def add_lesson():
    url = request.form.get('youtube_url', '').strip()

    if not url:
        flash('Please enter a YouTube URL.', 'error')
        return redirect(url_for('dashboard.index'))

    # Extract video ID (Service call - still allowed if it's a domain-agnostic utility, 
    # but here it's in content. We should ideally move it to a utility or content_interface)
    from app.modules.content.services.youtube_service import extract_video_id
    video_id_str = extract_video_id(url)
    if not video_id_str:
        flash('Invalid YouTube URL. Please paste a valid link.', 'error')
        return redirect(url_for('dashboard.index'))

    # Check if THIS USER already has a video with this youtube_id via interface
    video = content_interface.get_video_by_youtube_id_dto(video_id_str, current_user.id)

    if not video:
        # Create a new private video via interface
        video = content_interface.create_private_video(video_id_str, current_user.id)
        
        # Trigger background task
        from app.modules.content.tasks import process_video_metadata
        from app.core.utils.background_tasks import run_in_background
        run_in_background(process_video_metadata, video['id'])

    # Check if user already has this lesson via interface
    existing = study_interface.get_lesson_by_video_user_dto(current_user.id, video['id'])

    if existing:
        flash('This video is already in your library.', 'info')
        return redirect(url_for('dashboard.index'))

    # Create lesson via interface
    study_interface.create_lesson(current_user.id, video['id'])

    flash(f'Fetching: {video_id_str}. This might take a few seconds.', 'info')
    return redirect(url_for('dashboard.index'))


@dashboard_bp.route('/delete-lesson/<int:lesson_id>', methods=['POST'])
@jwt_required()
def delete_lesson(lesson_id):
    # Use interface to get title first if needed, or just delete
    # For flash message, we might need a way to get the title
    lesson = study_interface.get_lesson_dto(lesson_id)
    if not lesson:
        flash('Lesson not found.', 'error')
        return redirect(url_for('dashboard.index'))
        
    video = content_interface.get_video_dto(lesson['video_id'])
    title = video['title'] if video else "Unknown"
    
    success = study_interface.delete_lesson(lesson_id, current_user.id)
    if success:
        flash(f'Removed: {title}', 'info')
    else:
        flash('Failed to remove lesson.', 'error')
        
    return redirect(url_for('dashboard.index'))


@dashboard_bp.route('/add-sentence', methods=['POST'])
@jwt_required()
def add_sentence():
    original = request.form.get('original_text', '').strip()
    translation = request.form.get('translated_text', '').strip()
    set_id = request.form.get('set_id')

    if not original:
        flash('Please enter the original sentence text.', 'error')
        return redirect(request.referrer or url_for('dashboard.index'))

    set_id_int = int(set_id) if set_id else None
    study_interface.create_sentence(current_user.id, set_id_int, original, translation)

    flash('New sentence pattern added successfully.', 'success')
    return redirect(request.referrer or url_for('dashboard.index'))


@dashboard_bp.route('/delete-sentence/<int:sentence_id>', methods=['POST'])
@jwt_required()
def delete_sentence(sentence_id):
    success = study_interface.delete_sentence(sentence_id, current_user.id)
    if success:
        flash('Sentence removed.', 'info')
    else:
        flash('Failed to remove sentence.', 'error')

    return redirect(url_for('dashboard.index'))


def _format_duration(seconds: int | None) -> str:
    """Format seconds into HH:MM:SS or MM:SS."""
    if not seconds:
        return '--:--'
    h, remainder = divmod(seconds, 3600)
    m, s = divmod(remainder, 60)
    if h > 0:
        return f'{h}:{m:02d}:{s:02d}'
    return f'{m}:{s:02d}'


# Make helper available in templates
@dashboard_bp.app_template_filter('duration')
def duration_filter(seconds):
    return _format_duration(seconds)


