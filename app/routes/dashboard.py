"""Dashboard routes — lesson library management."""

from flask import Blueprint, render_template, request, redirect, url_for, flash, jsonify
from flask_login import login_required, current_user
from datetime import datetime, timezone

from ..extensions import db
from ..models.video import Video
from ..models.lesson import Lesson
from ..services.youtube_service import extract_video_id, fetch_video_info
from ..models.sentence import Sentence, SentenceSet

dashboard_bp = Blueprint('dashboard', __name__)


from ..models.note import Note
from sqlalchemy import func, cast, Date
from datetime import timedelta

@dashboard_bp.route('/')
def landing():
    """Public landing page."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
    return render_template('landing.html')


@dashboard_bp.route('/import')
@login_required
def import_page():
    """Dedicated import page with dual tracks."""
    return render_template('import.html')


@dashboard_bp.route('/dashboard')
@login_required
def index():
    lessons = (
        Lesson.query
        .filter_by(user_id=current_user.id)
        .order_by(Lesson.last_accessed.desc() if hasattr(Lesson, 'last_accessed') else Lesson.created_at.desc())
        .all()
    )

    # 1. Overview Stats (Podcast Track)
    total_seconds = db.session.query(func.sum(Lesson.time_spent)).filter(Lesson.user_id == current_user.id).scalar() or 0
    total_h = total_seconds // 3600
    total_m = (total_seconds % 3600) // 60
    total_s = total_seconds % 60
    total_time_formatted = f"{total_h}h {total_m}m {total_s}s" if total_h > 0 else (f"{total_m}m {total_s}s" if total_m > 0 else f"{total_s}s")
    
    completed_count = Lesson.query.filter_by(user_id=current_user.id, is_completed=True).count()
    total_lessons = Lesson.query.filter_by(user_id=current_user.id).count()
    total_notes = db.session.query(func.count(Note.id)).join(Lesson).filter(Lesson.user_id == current_user.id).scalar() or 0

    # 2. Overview Stats (Sentence Track)
    from ..models.shadowing import ShadowingHistory
    total_sentences = db.session.query(func.count(Sentence.id)).filter(Sentence.user_id == current_user.id).scalar() or 0
    shadow_stats = db.session.query(
        func.count(ShadowingHistory.id).label('attempts'),
        func.max(ShadowingHistory.accuracy_score).label('best')
    ).filter(ShadowingHistory.user_id == current_user.id).first()
    
    total_attempts = shadow_stats.attempts or 0
    best_score = shadow_stats.best or 0

    # 3. Activity Chart (Last 7 Days - Dual Series)
    today = datetime.now(timezone.utc).date()
    days = [today - timedelta(days=i) for i in range(6, -1, -1)]
    chart_labels = [d.strftime('%a') for d in days]
    
    notes_data = []
    sentences_data = []
    
    for d in days:
        # Notes (Podcast)
        n_count = db.session.query(func.count(Note.id)).join(Lesson).filter(
            Lesson.user_id == current_user.id,
            cast(Note.created_at, Date) == d
        ).scalar() or 0
        notes_data.append(n_count)
        
        # Sentences (Reflexive)
        s_count = db.session.query(func.count(Sentence.id)).filter(
            Sentence.user_id == current_user.id,
            cast(Sentence.created_at, Date) == d
        ).scalar() or 0
        sentences_data.append(s_count)

    # 4. Sentence Sets (Decks)
    sets = SentenceSet.query.filter_by(user_id=current_user.id).order_by(SentenceSet.updated_at.desc()).all()

    return render_template('dashboard.html', 
                           lessons=lessons,
                           sets=sets,
                           current_streak=current_user.current_streak,
                           longest_streak=current_user.longest_streak,
                           total_time_formatted=total_time_formatted,
                           completed_count=completed_count,
                           total_lessons=total_lessons,
                           total_notes=total_notes,
                           total_sentences=total_sentences,
                           total_attempts=total_attempts,
                           best_score=best_score,
                           chart_labels=chart_labels,
                           notes_data=notes_data,
                           sentences_data=sentences_data)


@dashboard_bp.route('/sets/<int:set_id>', endpoint='set_details_legacy')
@dashboard_bp.route('/sets/<string:mode>/<int:set_id>', endpoint='set_details')
@login_required
def set_details(set_id, mode=None):
    """View and manage sentences within a specific deck with type-aware context."""
    s_set = SentenceSet.query.filter_by(id=set_id, user_id=current_user.id).first_or_404()
    
    # URL Integrity: Redirect to canonical mode-specific URL if accessing via generic or wrong type
    mode_map = {
        'mastery_grammar': 'grammar',
        'mastery_vocab': 'vocab',
        'mastery_sentence': 'sentence'
    }
    expected_mode = mode_map.get(s_set.set_type, 'sentence')
    
    # URL Integrity: Redirect to canonical mode-specific URL if path is legacy or mismatched
    if mode != expected_mode:
        return redirect(url_for('dashboard.set_details', set_id=set_id, mode=expected_mode))

    sentences = s_set.sentences.order_by(Sentence.created_at.desc()).all()
    return render_template('set_details.html', s_set=s_set, sentences=sentences)



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
        from ..utils.background_tasks import run_in_background
        run_in_background(process_video_metadata, video.id)

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


@dashboard_bp.route('/add-sentence', methods=['POST'])
@login_required
def add_sentence():
    original = request.form.get('original_text', '').strip()
    translation = request.form.get('translated_text', '').strip()
    set_id = request.form.get('set_id')

    if not original:
        flash('Please enter the original sentence text.', 'error')
        return redirect(request.referrer or url_for('dashboard.index'))

    sentence = Sentence(
        user_id=current_user.id,
        set_id=int(set_id) if set_id else None,
        original_text=original,
        translated_text=translation
    )
    
    # Fallback to Personal Set if no set_id provided (data integrity)
    if not sentence.set_id:
        default_set = SentenceSet.query.filter_by(user_id=current_user.id).first()
        if default_set:
            sentence.set_id = default_set.id
        else:
            # Create a default set if none exists
            default_set = SentenceSet(user_id=current_user.id, title="Bộ học tập cá nhân")
            db.session.add(default_set)
            db.session.flush()
            sentence.set_id = default_set.id

    db.session.add(sentence)
    db.session.commit()

    flash('New sentence pattern added successfully.', 'success')
    return redirect(request.referrer or url_for('dashboard.index'))


@dashboard_bp.route('/delete-sentence/<int:sentence_id>', methods=['POST'])
@login_required
def delete_sentence(sentence_id):
    sentence = Sentence.query.filter_by(
        id=sentence_id,
        user_id=current_user.id
    ).first_or_404()

    db.session.delete(sentence)
    db.session.commit()

    flash('Sentence removed.', 'info')
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
