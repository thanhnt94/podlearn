from flask import Blueprint, redirect, url_for, request, flash, current_app, session
from flask_login import login_user, logout_user, current_user
from ..services.sso_service import SSOService
from ..models.setting import AppSetting
import requests

auth_center_bp = Blueprint('auth_center', __name__, url_prefix='/auth-center')

@auth_center_bp.route('/login')
def login():
    """Initiates the SSO Login Flow."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
        
    client = SSOService.get_client()
    if client.check_health():
        callback_url = url_for('auth_center.callback', _external=True)
        return redirect(client.get_login_url(callback_url))
    else:
        flash('Central Auth server is unreachable. Please login locally.', 'warning')
        return redirect(url_for('auth.login'))

@auth_center_bp.route('/callback')
def callback():
    """V2 Callback: Receives auth code and exchanges it for tokens."""
    code = request.args.get('code')
    if not code:
        flash('Xác thực SSO thất bại: Không tìm thấy mã xác thực (code).', 'danger')
        return redirect(url_for('auth.login'))
        
    user = SSOService.handle_callback(code)
    if user:
        login_user(user)
        flash('Đăng nhập qua SSO thành công!', 'success')
        return redirect(url_for('dashboard.index'))
    else:
        flash('Xác thực token SSO thất bại hoặc không thể đồng bộ tài khoản.', 'danger')
        return redirect(url_for('auth.login'))

@auth_center_bp.route('/logout')
def logout():
    """Handles Global Logout across the ecosystem."""
    # 1. Clear local session
    logout_user()
    session.clear()
    
    # 2. Redirect to CentralAuth Logout
    client = SSOService.get_client()
    return redirect(f"{client.web_url}/api/auth/logout")

@auth_center_bp.route('/webhook/backchannel-logout', methods=['POST'])
def backchannel_logout():
    """Triggered by CentralAuth to invalidate a session remotely."""
    # To be implemented for full Single Sign-Out support
    return "OK", 200

@auth_center_bp.route('/internal/user-list', methods=['POST'])
def internal_user_list():
    """
    Internal API for CentralAuth to scan and sync users.
    Protected by Client Secret verification from AppSettings.
    """
    from ..models.user import User
    from ..models.setting import AppSetting
    
    secret_header = request.headers.get('X-Client-Secret')
    configured_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET')

    if not secret_header or secret_header != configured_secret:
        return jsonify({"error": "Unauthorized"}), 401

    users = User.query.all()
    user_list = []
    for user in users:
        user_list.append({
            "username": user.username,
            "email": user.email,
            "full_name": user.username, # PodLearn doesn't have full_name
            "central_auth_id": user.central_auth_id
        })
        
    return jsonify({"users": user_list}), 200
