from flask import Blueprint, render_template, abort
from flask_login import login_required, current_user
from app.modules.study.models import Lesson
from app.modules.content.models import SubtitleTrack

player_bp = Blueprint('player', __name__)


@player_bp.route('/lesson/<int:lesson_id>')
@player_bp.route('/lesson/syncstudio/<int:lesson_id>')
@login_required
def view(lesson_id):
    """Serve the modern SPA for the lesson player route."""
    lesson = Lesson.query.filter_by(id=lesson_id, user_id=current_user.id).first_or_404()
    
    # Get available tracks for initial hydration
    all_tracks = SubtitleTrack.query.filter_by(video_id=lesson.video.id).all()
    available_tracks = [{
        'id': t.id,
        'language_code': t.language_code,
        'uploader_name': t.uploader_name if t.uploader_id else 'YouTube'
    } for t in all_tracks]

    lesson_data = {
        'lesson_id': lesson.id,
        'video_id': lesson.video.youtube_id,
        'lesson_title': lesson.video.title,
        'available_tracks': available_tracks,
        'settings_json': lesson.settings_json,
        'total_time_spent': lesson.time_spent,
        'metadata': {
            'original_lang': lesson.original_lang_code,
            'target_lang': lesson.target_lang_code,
            's1_track_id': lesson.s1_track_id,
            's2_track_id': lesson.s2_track_id,
            's3_track_id': lesson.s3_track_id
        }
    }
    
    return render_template('app_modern.html', lesson=lesson_data)
