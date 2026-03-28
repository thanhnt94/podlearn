from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_required, current_user
from functools import wraps
from ..extensions import db
from ..models.user import User
from ..models.video import Video
from ..models.lesson import Lesson
from ..models.note import Note
from ..models.subtitle import SubtitleTrack

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not getattr(current_user, 'is_admin', False):
            flash('Admin access required.', 'error')
            return redirect(url_for('dashboard.index'))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/')
@login_required
@admin_required
def dashboard():
    # Basic statistics
    stats = {
        'users_count': User.query.count(),
        'videos_count': Video.query.count(),
        'lessons_count': Lesson.query.count(),
        'notes_count': Note.query.count(),
        'subtitles_count': SubtitleTrack.query.count()
    }
    
    # Recent users
    recent_users = User.query.order_by(User.created_at.desc()).limit(5).all()
    
    # Recent videos
    recent_videos = Video.query.order_by(Video.created_at.desc()).limit(5).all()
    
    return render_template('admin/dashboard.html', stats=stats, recent_users=recent_users, recent_videos=recent_videos)

@admin_bp.route('/users')
@login_required
@admin_required
def users():
    users_list = User.query.order_by(User.created_at.desc()).all()
    return render_template('admin/users.html', users=users_list)

@admin_bp.route('/videos')
@login_required
@admin_required
def videos():
    videos_list = Video.query.order_by(Video.created_at.desc()).all()
    return render_template('admin/videos.html', videos=videos_list)

@admin_bp.route('/subtitles')
@login_required
@admin_required
def subtitles():
    tracks = SubtitleTrack.query.order_by(SubtitleTrack.fetched_at.desc()).all()
    return render_template('admin/subtitles.html', tracks=tracks)

@admin_bp.route('/subtitle/delete/<int:track_id>', methods=['POST'])
@login_required
@admin_required
def delete_subtitle(track_id):
    track = SubtitleTrack.query.get_or_404(track_id)
    db.session.delete(track)
    db.session.commit()
    flash('Subtitle track deleted successfully.', 'success')
    return redirect(url_for('admin.subtitles'))

@admin_bp.route('/video/delete/<int:video_id>', methods=['POST'])
@login_required
@admin_required
def delete_video(video_id):
    video = Video.query.get_or_404(video_id)
    db.session.delete(video)
    db.session.commit()
    flash(f'Video {video.title} deleted successfully.', 'success')
    return redirect(url_for('admin.videos'))

@admin_bp.route('/user/toggle-admin/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def toggle_admin(user_id):
    if user_id == current_user.id:
        flash('You cannot toggle your own admin status!', 'error')
        return redirect(url_for('admin.users'))
        
    user = User.query.get_or_404(user_id)
    user.is_admin = not user.is_admin
    db.session.commit()
    flash(f'Admin status updated for {user.username}.', 'success')
    return redirect(url_for('admin.users'))
