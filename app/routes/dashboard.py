"""Dashboard routes — lesson library management."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timezone

from ..extensions import db
from ..models.video import Video
from ..models.lesson import Lesson
from ..services.youtube_service import extract_video_id, fetch_video_info

dashboard_bp = Blueprint('dashboard', __name__)


from ..models.note import Note
from sqlalchemy import func, cast, Date
from datetime import timedelta

@dashboard_bp.route('/')
@login_required
def index():
    lessons = (
        Lesson.query
        .filter_by(user_id=current_user.id)
        .order_by(Lesson.last_accessed.desc() if hasattr(Lesson, 'last_accessed') else Lesson.created_at.desc())
        .all()
    )

    # 1. Overview Stats
    total_seconds = db.session.query(func.sum(Lesson.time_spent)).filter(Lesson.user_id == current_user.id).scalar() or 0
    
    # Calculate Detailed Components
    total_h = total_seconds // 3600
    total_m = (total_seconds % 3600) // 60
    total_s = total_seconds % 60
    
    total_time_formatted = f"{total_h}h {total_m}m {total_s}s"
    if total_h == 0:
        total_time_formatted = f"{total_m}m {total_s}s"
        if total_m == 0:
             total_time_formatted = f"{total_s}s"

    
    completed_count = Lesson.query.filter_by(user_id=current_user.id, is_completed=True).count()
    
    total_notes = db.session.query(func.count(Note.id)).join(Lesson).filter(Lesson.user_id == current_user.id).scalar() or 0

    # 2. Activity Chart (Last 7 Days)
    # We'll use Note creation date as a proxy for activity if lesson time tracking is new
    # or just use today's vs yesterday's etc.
    today = datetime.now(timezone.utc).date()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    
    chart_labels = [d.strftime('%a') for d in days]
    chart_values = []
    
    for d in days:
        # Count notes created on this day
        count = db.session.query(func.count(Note.id)).join(Lesson).filter(
            Lesson.user_id == current_user.id,
            cast(Note.created_at, Date) == d
        ).scalar() or 0
        chart_values.append(count)

    return render_template('dashboard.html', 
                           lessons=lessons,
                           current_streak=current_user.current_streak,
                           longest_streak=current_user.longest_streak,
                           total_time_formatted=total_time_formatted,
                           completed_count=completed_count,
                           total_notes=total_notes,
                           chart_labels=chart_labels,
                           chart_values=chart_values)



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
        # Create a "pending" entry immediately
        video = Video(
            youtube_id=video_id_str,
            title="Processing...",
            status='pending'
        )
        db.session.add(video)
        db.session.commit()
        
        # Trigger background task
        from ..tasks import process_video_metadata
        process_video_metadata.delay(video.id)

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

    flash(f'Fetching: {video_id_str}. This might take a few seconds.', 'info')
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
