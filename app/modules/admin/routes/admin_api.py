from flask import Blueprint, jsonify, request, current_app
from flask_jwt_extended import jwt_required, current_user
from functools import wraps
from app.core.extensions import db
from app.modules.identity.models import User
from app.modules.content.models import Video
from app.modules.study.models import Lesson
from app.modules.content.models import SubtitleTrack
from app.modules.engagement.models import AppSetting
import time
import requests
from app.core.utils.sso_helper import EcosystemAuth
from app.core.utils.auth_decorators import admin_required, vip_required

admin_api_bp = Blueprint('admin_api', __name__, 
                        url_prefix='/api/admin',
                        template_folder='../templates',
                        static_folder='../static')




@admin_api_bp.route('/stats')
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
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
@jwt_required()
@admin_required
def get_settings():
    """Fetch AI and Auth settings."""
    return jsonify({
        'GEMINI_API_KEY': AppSetting.get('GEMINI_API_KEY', ''),
        'GEMINI_MODEL': AppSetting.get('GEMINI_MODEL', 'gemini-2.0-flash'),
        'AUTH_PROVIDER': AppSetting.get('AUTH_PROVIDER', 'local'),
        'CENTRAL_AUTH_SERVER_ADDRESS': AppSetting.get('CENTRAL_AUTH_SERVER_ADDRESS', ''),
        'CENTRAL_AUTH_CLIENT_ID': AppSetting.get('CENTRAL_AUTH_CLIENT_ID', ''),
        'CENTRAL_AUTH_CLIENT_SECRET': AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    })

@admin_api_bp.route('/settings/gemini', methods=['POST'])
@jwt_required()
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
@jwt_required()
@admin_required
def get_gemini_models():
    from app.modules.content.services.ai_service import list_available_models
    models = list_available_models()
    return jsonify({'success': True, 'models': models})

@admin_api_bp.route('/video/<int:video_id>/ai-analyze', methods=['POST'])
@jwt_required()
@admin_required
def trigger_ai_analysis(video_id):
    from app.modules.content.services.ai_service import generate_full_video_analysis
    
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
@jwt_required()
@admin_required
def test_auth_connection():
    import requests
    data = request.get_json()
    base_url = data.get('base_url', '').strip().rstrip('/')
    
    # Auto-prepend scheme if missing
    if base_url and not base_url.startswith(('http://', 'https://')):
        base_url = f"https://{base_url}"
        
    client_id = str(data.get('client_id', '')).strip().strip('"').strip("'")
    client_secret = str(data.get('client_secret', '')).strip().strip('"').strip("'")

    # If secret is literally just dots or stars and we have a saved secret, 
    # then it's a UI mask and we should use the DB value.
    # Otherwise, use what the user typed.
    current_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    if not client_secret or client_secret.count('.') > 5 or client_secret.count('*') > 5:
        if current_secret:
            print(f"[AUTH_TEST] Using SAVED secret from DB (Input was empty or masked)")
            client_secret = current_secret
    
    print(f"[AUTH_TEST] FINAL -> URL: {base_url}, ID: |{client_id}|, Secret Len: {len(client_secret)}", flush=True)

    # 1. ALWAYS SAVE SETTINGS FIRST
    AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', base_url, category='auth')
    AppSetting.set('CENTRAL_AUTH_CLIENT_ID', client_id, category='auth')
    if client_secret:
        AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', client_secret, category='auth')

    try:
        # 2. Discovery Check (Server up?)
        discovery_response = requests.get(f"{base_url}/api/auth/discovery", timeout=5)
        if discovery_response.status_code != 200:
            return jsonify({'success': False, 'message': 'Không thể kết nối tới Discovery endpoint của Central Auth.'}), 400
        
        # Use the provided secret for validation
        validation_secret = client_secret if client_secret else current_secret
        
        auth_helper = EcosystemAuth(base_url, client_id, validation_secret)
        validation = auth_helper.validate_client()
        
        if not validation.get('success'):
            err_msg = validation.get('error', 'Unknown Error')
            print(f"[AUTH_TEST] Handshake FAILED: {err_msg}")
            return jsonify({"success": False, "message": f"Bắt tay thất bại: {err_msg}"}), 401
            
        return jsonify({
            'success': True, 
            'message': f'Kết nối thành công! Đã xác thực client: {validation.get("client_name")}', 
            'discovery': discovery_response.json()
        })
    except Exception as e:
        return jsonify({'success': False, 'message': f'Lỗi hệ thống: {str(e)}'}), 500

@admin_api_bp.route('/ecosystem-sync', methods=['POST'])
def ecosystem_sync_webhook():
    """Incoming sync from CentralAuth Hub."""
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "message": "Missing data"}), 400
        
    hub_secret = data.get('hub_secret')
    # Verify using current saved secret OR the system's master SECRET_KEY
    current_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', '')
    master_key = current_app.config.get('SECRET_KEY')
    
    if not hub_secret or (hub_secret != current_secret and hub_secret != master_key):
        return jsonify({"success": False, "message": "Unauthorized Hub Sync"}), 401
        
    # 1. Update settings
    if 'server_address' in data:
        val = str(data['server_address']).strip().strip('"').strip("'")
        AppSetting.set('CENTRAL_AUTH_SERVER_ADDRESS', val, category='auth')
    if 'client_id' in data:
        val = str(data['client_id']).strip().strip('"').strip("'")
        AppSetting.set('CENTRAL_AUTH_CLIENT_ID', val, category='auth')
    if 'client_secret' in data:
        val = str(data['client_secret']).strip().strip('"').strip("'")
        AppSetting.set('CENTRAL_AUTH_CLIENT_SECRET', val, category='auth')

    # 2. Update Users (Bulk Provisioning)
    users_data = data.get('users', [])
    if users_data:
        from app.modules.identity.models import User
        sync_count = 0
        for u_info in users_data:
            # Check if user already exists by email OR username
            user = User.query.filter(
                (User.email == u_info['email']) | 
                (User.username == u_info['username'])
            ).first()
            
            if not user:
                # Create new shadow user
                user = User(
                    username=u_info['username'],
                    email=u_info['email'],
                    full_name=u_info.get('full_name', ''),
                    role=u_info.get('role', 'free')
                )
                import uuid
                user.set_password(str(uuid.uuid4()))
                db.session.add(user)
                sync_count += 1
            else:
                # Update existing user info if Hub is master, 
                # but keep local identity if there's a conflict
                if user.email == u_info['email']:
                    user.username = u_info['username']
                user.full_name = u_info.get('full_name', user.full_name)
        
        if sync_count > 0:
            db.session.commit()
            return jsonify({"success": True, "message": f"Ecosystem Sync Successful. Provisioned {sync_count} users."})
        
    return jsonify({"success": True, "message": "Ecosystem Sync Successful (Settings only)"})

@admin_api_bp.route('/toggle-sso', methods=['POST'])
@jwt_required()
@admin_required
def toggle_sso():
    data = request.get_json()
    enabled = data.get('enabled', False)
    new_provider = 'central' if enabled else 'local'
    AppSetting.set('AUTH_PROVIDER', new_provider, category='auth')
    return jsonify({'success': True, 'message': f'Đã chuyển sang: {new_provider}'})

@admin_api_bp.route('/videos')
@jwt_required()
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
@jwt_required()
@admin_required
def pending_videos():
    videos_list = Video.query.filter_by(visibility='pending_public').order_by(Video.created_at.desc()).all()
    return jsonify([{
        'id': v.id,
        'title': v.title,
        'created_at': v.created_at.isoformat() if v.created_at else None
    } for v in videos_list])

@admin_api_bp.route('/video/<int:video_id>/approve-public', methods=['POST'])
@jwt_required()
@admin_required
def approve_public_video(video_id):
    """Confirm a video is high quality and allow it in the public community gallery."""
    video = Video.query.get_or_404(video_id)
    video.visibility = 'public'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Video "{video.title}" is now public!'})

@admin_api_bp.route('/video/<int:video_id>/reject-public', methods=['POST'])
@jwt_required()
@admin_required
def reject_public_video(video_id):
    """Reject a public request, keeping the video private to those who added it."""
    video = Video.query.get_or_404(video_id)
    video.visibility = 'private'
    db.session.commit()
    return jsonify({'success': True, 'message': f'Video "{video.title}" request rejected (set to private).'})

@admin_api_bp.route('/video/<int:video_id>/visibility', methods=['POST'])
@jwt_required()
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



