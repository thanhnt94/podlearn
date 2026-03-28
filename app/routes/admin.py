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

@admin_bp.route('/user/create', methods=['POST'])
@login_required
@admin_required
def create_user():
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    is_admin = request.form.get('is_admin') == 'on'

    if not username or not email or not password:
        flash('Username, email, and password are required.', 'error')
        return redirect(url_for('admin.users'))

    if User.query.filter_by(username=username).first():
        flash('Username already exists.', 'error')
        return redirect(url_for('admin.users'))

    user = User(username=username, email=email, is_admin=is_admin)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()
    
    flash(f'User {username} created successfully.', 'success')
    return redirect(url_for('admin.users'))

@admin_bp.route('/video/delete/<int:video_id>', methods=['POST'])

@login_required
@admin_required
def delete_video(video_id):
    video = Video.query.get_or_404(video_id)
    db.session.delete(video)
    db.session.commit()
    flash(f'Video {video.title} deleted successfully.', 'success')
    return redirect(url_for('admin.videos'))

@admin_bp.route('/user/edit/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def edit_user(user_id):
    user = User.query.get_or_404(user_id)
    username = request.form.get('username')
    email = request.form.get('email')
    password = request.form.get('password')
    is_admin = request.form.get('is_admin') == 'on'

    if not username or not email:
        flash('Username and email are required.', 'error')
        return redirect(url_for('admin.users'))

    # Check for username conflict (if username changed)
    if username != user.username:
        if User.query.filter_by(username=username).first():
            flash('Username already exists.', 'error')
            return redirect(url_for('admin.users'))

    user.username = username
    user.email = email
    user.is_admin = is_admin
    
    if password: # only change password if provided
        user.set_password(password)
        
    db.session.commit()
    flash(f'User {username} updated successfully.', 'success')
    return redirect(url_for('admin.users'))

@admin_bp.route('/user/delete/<int:user_id>', methods=['POST'])
@login_required
@admin_required
def delete_user(user_id):
    if user_id == current_user.id:
        flash('You cannot delete your own account!', 'error')
        return redirect(url_for('admin.users'))
        
    user = User.query.get_or_404(user_id)
    username = user.username
    db.session.delete(user)
    db.session.commit()
    flash(f'User {username} deleted successfully.', 'success')
    return redirect(url_for('admin.users'))

