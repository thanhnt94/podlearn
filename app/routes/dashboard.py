"""Dashboard routes — lesson library management."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timezone

from ..extensions import db
from ..models.video import Video
from ..models.lesson import Lesson
from ..services.youtube_service import extract_video_id, fetch_video_info

dashboard_bp = Blueprint('dashboard', __name__)


@dashboard_bp.route('/')
@login_required
def index():
    lessons = (
        Lesson.query
        .filter_by(user_id=current_user.id)
        .order_by(Lesson.created_at.desc())
        .all()
    )
    return render_template('dashboard.html', lessons=lessons)


@dashboard_bp.route('/add-lesson', methods=['POST'])
@login_required
def add_lesson():
    url = request.form.get('youtube_url', '').strip()

    if not url:
        flash('Please enter a YouTube URL.', 'error')
        return redirect(url_for('dashboard.index'))

    # Extract video ID
    video_id_str = extract_video_id(url)
    if not video_id_str:
        flash('Invalid YouTube URL. Please paste a valid link.', 'error')
        return redirect(url_for('dashboard.index'))

    # Check if video already exists in DB
    video = Video.query.filter_by(youtube_id=video_id_str).first()

    if not video:
        # Fetch metadata from YouTube
        info = fetch_video_info(video_id_str)
        if not info:
            flash('Could not fetch video info. The video may be private or unavailable.', 'error')
            return redirect(url_for('dashboard.index'))

        video = Video(
            youtube_id=info.youtube_id,
            title=info.title,
            thumbnail_url=info.thumbnail_url,
            duration_seconds=info.duration_seconds,
        )
        db.session.add(video)
        db.session.flush()

    # Check if user already has this lesson
    existing = Lesson.query.filter_by(
        user_id=current_user.id,
        video_id=video.id
    ).first()

    if existing:
        flash('This video is already in your library.', 'info')
        return redirect(url_for('dashboard.index'))

    # Create lesson
    lesson = Lesson(
        user_id=current_user.id,
        video_id=video.id,
    )
    db.session.add(lesson)
    db.session.commit()

    flash(f'Added: {video.title}', 'success')
    return redirect(url_for('dashboard.index'))


@dashboard_bp.route('/delete-lesson/<int:lesson_id>', methods=['POST'])
@login_required
def delete_lesson(lesson_id):
    lesson = Lesson.query.filter_by(
        id=lesson_id,
        user_id=current_user.id
    ).first_or_404()

    title = lesson.video.title
    db.session.delete(lesson)
    db.session.commit()

    flash(f'Removed: {title}', 'info')
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
