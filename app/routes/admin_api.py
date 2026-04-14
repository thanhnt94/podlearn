from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from functools import wraps
from ..extensions import db
from ..models.user import User
from ..models.video import Video
from ..models.lesson import Lesson
from ..models.subtitle import SubtitleTrack
from ..models.setting import AppSetting
import time

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/api/admin')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not getattr(current_user, 'is_admin', False):
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

@admin_api_bp.route('/stats')
@login_required
@admin_required
def get_stats():
    """Aggregate statistics for the modern dashboard."""
    stats = {
        'users_count': User.query.count(),
        'videos_count': Video.query.count(),
        'lessons_count': Lesson.query.count(),
        'subtitles_count': SubtitleTrack.query.count(),
        # Add basic growth data if needed later
    }
    return jsonify(stats)

@admin_api_bp.route('/users')
@login_required
@admin_required
def list_users():
    """List all users with basic info."""
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify([{
        'id': u.id,
        'username': u.username,
        'email': u.email,
        'is_admin': getattr(u, 'is_admin', False),
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'central_auth_id': getattr(u, 'central_auth_id', None)
    } for u in users])

@admin_api_bp.route('/settings')
@login_required
@admin_required
def get_settings():
    """Fetch AI and Auth settings."""
    return jsonify({
        'GEMINI_API_KEY': AppSetting.get('GEMINI_API_KEY', ''),
        'GEMINI_MODEL': AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash'),
        'AUTH_PROVIDER': AppSetting.get('AUTH_PROVIDER', 'local'),
        'CENTRAL_AUTH_SERVER_ADDRESS': AppSetting.get('CENTRAL_AUTH_SERVER_ADDRESS', ''),
        'CENTRAL_AUTH_CLIENT_ID': AppSetting.get('CENTRAL_AUTH_CLIENT_ID', ''),
    })

@admin_api_bp.route('/settings/gemini', methods=['POST'])
@login_required
@admin_required
def save_gemini_settings():
    data = request.get_json()
    api_key = data.get('api_key')
    model = data.get('model')
    
    if api_key is not None:
        AppSetting.set('GEMINI_API_KEY', api_key, category='ai')
    if model:
        AppSetting.set('GEMINI_MODEL', model, category='ai')
        
    return jsonify({'success': True, 'message': 'Đã cập nhật cấu hình Gemini.'})

@admin_api_bp.route('/settings/gemini/models')
@login_required
@admin_required
def get_gemini_models():
    from ..services.ai_service import list_available_models
    models = list_available_models()
    return jsonify({'success': True, 'models': models})

@admin_api_bp.route('/video/<int:video_id>/ai-analyze', methods=['POST'])
@login_required
@admin_required
def trigger_ai_analysis(video_id):
    from ..services.ai_service import generate_full_video_analysis
    
    video = Video.query.get_or_404(video_id)
    # Get the Japanese track (assuming priority for analysis)
    track = SubtitleTrack.query.filter_by(video_id=video_id, language_code='ja').first()
    if not track:
        return jsonify({'success': False, 'message': 'Không tìm thấy phụ đề tiếng Nhật để phân tích.'}), 404
        
    content = track.content_json
    if not content:
        return jsonify({'success': False, 'message': 'Dữ liệu phụ đề trống.'}), 400
        
    model_name = AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash')
    success = generate_full_video_analysis(video_id, content, model_name=model_name)
    
    if success:
        return jsonify({'success': True, 'message': 'Đã hoàn thành phân tích AI cho video này.'})
    else:
        return jsonify({'success': False, 'message': 'Quá trình phân tích AI thất bại.'}), 500

@admin_api_bp.route('/test-auth', methods=['POST'])
@login_required
@admin_required
def test_auth_connection():
    import requests
    data = request.get_json()
    base_url = data.get('base_url', '').rstrip('/')
    client_id = data.get('client_id', '')
    client_secret = data.get('client_secret', '')

    try:
        discovery_response = requests.get(f"{base_url}/api/auth/discovery", timeout=5)
        if discovery_response.status_code != 200:
            return jsonify({'success': False, 'message': 'Không thể kết nối tới Discovery endpoint.'}), 400
        
        discovery_data = discovery_response.json()
        
        # Save config
        AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', base_url, category='auth')
        AppSetting.set('CENTRAL_AUTH_CLIENT_ID', client_id, category='auth')
        AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', client_secret, category='auth')
        
        return jsonify({'success': True, 'message': 'Kết nối thành công!', 'discovery': discovery_data})
    except Exception as e:
        return jsonify({'success': False, 'message': f'Lỗi: {str(e)}'}), 500

@admin_api_bp.route('/toggle-sso', methods=['POST'])
@login_required
@admin_required
def toggle_sso():
    data = request.get_json()
    enabled = data.get('enabled', False)
    new_provider = 'central' if enabled else 'local'
    AppSetting.set('AUTH_PROVIDER', new_provider, category='auth')
    return jsonify({'success': True, 'message': f'Đã chuyển sang: {new_provider}'})

@admin_api_bp.route('/videos')
@login_required
@admin_required
def list_videos():
    """List videos, including pending approvals."""
    videos = Video.query.order_by(Video.created_at.desc()).all()
    return jsonify([{
        'id': v.id,
        'title': v.title,
        'visibility': v.visibility,
        'created_at': v.created_at.isoformat() if v.created_at else None,
        'uploader_id': v.uploader_id
    } for v in videos])

@admin_api_bp.route('/pending-videos')
@login_required
@admin_required
def pending_videos():
    videos_list = Video.query.filter_by(visibility='pending_public').order_by(Video.created_at.desc()).all()
    return jsonify([{
        'id': v.id,
        'title': v.title,
        'created_at': v.created_at.isoformat() if v.created_at else None
    } for v in videos_list])

@admin_api_bp.route('/video/<int:video_id>/approve-public', methods=['POST'])
@login_required
@admin_required
def approve_public_video(video_id):
    video = Video.query.get_or_404(video_id)
    video.visibility = 'public'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Video {video.title} is now public!'})

@admin_api_bp.route('/video/<int:video_id>/reject-public', methods=['POST'])
@login_required
@admin_required
def reject_public_video(video_id):
    video = Video.query.get_or_404(video_id)
    video.visibility = 'private'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Video {video.title} public request rejected.'})
