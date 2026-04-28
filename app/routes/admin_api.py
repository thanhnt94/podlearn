from flask import Blueprint, jsonify, request
from flask_login import login_required, current_user
from functools import wraps
from ..extensions import db
from app.modules.identity.models import User
from app.modules.content.models import Video
from app.modules.study.models import Lesson
from app.modules.content.models import SubtitleTrack
from app.modules.engagement.models import AppSetting
import time

admin_api_bp = Blueprint('admin_api', __name__, url_prefix='/api/admin')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_admin:
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

def vip_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not current_user.is_at_least_vip:
            return jsonify({"error": "VIP access required"}), 403
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
        'full_name': u.full_name,
        'role': u.role,
        'is_admin': u.is_admin,
        'created_at': u.created_at.isoformat() if u.created_at else None,
        'central_auth_id': getattr(u, 'central_auth_id', None)
    } for u in users])

@admin_api_bp.route('/users', methods=['POST'])
@login_required
@admin_required
def create_user():
    """Create a new local user."""
    data = request.get_json()
    username = data.get('username')
    email = data.get('email')
    full_name = data.get('full_name')
    password = data.get('password')
    role = data.get('role', 'free')

    if not username or not email or not password:
        return jsonify({"error": "Missing required fields"}), 400

    if User.query.filter((User.username == username) | (User.email == email)).first():
        return jsonify({"error": "Username or Email already exists"}), 400

    user = User(username=username, email=email, full_name=full_name, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "success": True,
        "message": f"User {username} created successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }), 201

@admin_api_bp.route('/users/<int:user_id>', methods=['PUT', 'PATCH'])
@login_required
@admin_required
def update_user(user_id):
    """Full update for a user's profile."""
    data = request.get_json()
    user = User.query.get_or_404(user_id)
    
    # 1. Identity updates
    username = data.get('username')
    email = data.get('email')
    full_name = data.get('full_name')
    role = data.get('role')
    password = data.get('password')

    if username and username != user.username:
        if User.query.filter_by(username=username).first():
            return jsonify({"error": "Username already taken"}), 400
        user.username = username
        
    if email and email != user.email:
        if User.query.filter_by(email=email).first():
            return jsonify({"error": "Email already registered"}), 400
        user.email = email
        
    if full_name is not None:
        user.full_name = full_name
        
    if role:
        if role not in ['free', 'vip', 'admin']:
            return jsonify({"error": "Invalid role. Use: free, vip, admin"}), 400
        user.role = role
        
    if password:
        user.set_password(password)
        
    db.session.commit()
    return jsonify({"success": True, "message": f"User {user.username} updated successfully"})

@admin_api_bp.route('/users/<int:user_id>', methods=['DELETE'])
@login_required
@admin_required
def delete_user(user_id):
    """Delete a user."""
    if user_id == current_user.id:
        return jsonify({"error": "Cannot delete yourself"}), 400
        
    user = User.query.get_or_404(user_id)
    db.session.delete(user)
    db.session.commit()
    return jsonify({"success": True, "message": f"User {user.username} deleted"})

@admin_api_bp.route('/settings')
@login_required
@admin_required
def get_settings():
    """Fetch AI and Auth settings."""
    secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    masked_secret = f"{secret[:4]}...{secret[-4:]}" if len(secret) > 8 else "********" if secret else ""
    
    return jsonify({
        'GEMINI_API_KEY': AppSetting.get('GEMINI_API_KEY', ''),
        'GEMINI_MODEL': AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash'),
        'AUTH_PROVIDER': AppSetting.get('AUTH_PROVIDER', 'local'),
        'CENTRAL_AUTH_SERVER_ADDRESS': AppSetting.get('CENTRAL_AUTH_SERVER_ADDRESS', ''),
        'CENTRAL_AUTH_CLIENT_ID': AppSetting.get('CENTRAL_AUTH_CLIENT_ID', ''),
        'CENTRAL_AUTH_CLIENT_SECRET': masked_secret
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
    from ..modules.content.services.ai_service import list_available_models
    models = list_available_models()
    return jsonify({'success': True, 'models': models})

@admin_api_bp.route('/video/<int:video_id>/ai-analyze', methods=['POST'])
@login_required
@admin_required
def trigger_ai_analysis(video_id):
    from ..modules.content.services.ai_service import generate_full_video_analysis
    
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

    # If the user didn't change the secret (it's the masked version or '(Unchanged)'),
    # we don't want to save the mask.
    current_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    if client_secret == '(Unchanged)' or (client_secret and '*' in client_secret and len(client_secret) < 15):
        client_secret = current_secret

    try:
        # 1. Discovery Check (Server up?)
        discovery_response = requests.get(f"{base_url}/api/auth/discovery", timeout=5)
        if discovery_response.status_code != 200:
            return jsonify({'success': False, 'message': 'Không thể kết nối tới Discovery endpoint của Central Auth.'}), 400
        
        # 2. Credential Handshake (Official Validation)
        validate_url = f"{base_url}/api/auth/validate-client"
        v_res = requests.post(validate_url, json={
            "client_id": client_id,
            "client_secret": client_secret
        }, timeout=5)
        
        v_data = v_res.json()
        if not v_res.ok or not v_data.get('success'):
            error_msg = v_data.get('error', 'Client ID hoặc Secret không hợp lệ.')
            return jsonify({'success': False, 'message': f'Bắt tay thất bại: {error_msg}'}), 401
            
        # 3. Save Config ONLY if handshake succeeded
        AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', base_url, category='auth')
        AppSetting.set('CENTRAL_AUTH_CLIENT_ID', client_id, category='auth')
        if client_secret and client_secret != current_secret:
            AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', client_secret, category='auth')
        
        return jsonify({
            'success': True, 
            'message': f'Kết nối thành công! Đã xác thực client: {v_data.get("client_name")}', 
            'discovery': discovery_response.json()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Lỗi hệ thống: {str(e)}'}), 500

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
    """Confirm a video is high quality and allow it in the public community gallery."""
    video = Video.query.get_or_404(video_id)
    video.visibility = 'public'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Video "{video.title}" is now public!'})

@admin_api_bp.route('/video/<int:video_id>/reject-public', methods=['POST'])
@login_required
@admin_required
def reject_public_video(video_id):
    """Reject a public request, keeping the video private to those who added it."""
    video = Video.query.get_or_404(video_id)
    video.visibility = 'private'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Video "{video.title}" request rejected (set to private).'})

@admin_api_bp.route('/video/<int:video_id>/visibility', methods=['POST'])
@login_required
@admin_required
def set_video_visibility(video_id):
    """Directly toggle visibility (private/public/pending_public)."""
    data = request.get_json() or {}
    visibility = data.get('visibility')
    
    if visibility not in ['private', 'public', 'pending_public']:
        return jsonify({'error': 'Invalid visibility status'}), 400
        
    video = Video.query.get_or_404(video_id)
    video.visibility = visibility
    db.session.commit()
    return jsonify({'success': True, 'visibility': video.visibility})
