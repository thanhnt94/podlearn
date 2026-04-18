from flask import Blueprint, redirect, url_for, request, flash, current_app, session
from flask_login import login_user, logout_user, current_user
from ..services.sso_service import SSOService

auth_center_bp = Blueprint('auth_center', __name__, url_prefix='/auth-center')

@auth_center_bp.route('/login')
def login():
    """Initiates the modernized Power Pairing Login Flow."""
    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))
        
    sso = SSOService.get_client()
    callback_url = url_for('auth_center.callback', _external=True)
    
    # Simple, clean redirect to Central Auth
    return redirect(sso.get_login_url(callback_url))

@auth_center_bp.route('/callback')
def callback():
    """Handle the return from Central Auth with an authorization code."""
    code = request.args.get('code')
    if not code:
        flash('Xác thực SSO thất bại: Không tìm thấy mã xác thực.', 'danger')
        return redirect(url_for('auth.login'))
        
    user = SSOService.handle_callback(code)
    if user:
        login_user(user)
        flash('Chào mừng bạn quay lại với hệ thống PodLearn!', 'success')
        return redirect(url_for('dashboard.index'))
    else:
        flash('Đã xảy ra lỗi khi đồng bộ tài khoản từ Central Auth.', 'danger')
        return redirect(url_for('auth.login'))

@auth_center_bp.route('/logout')
def logout():
    """Handles Clean Session Termination."""
    logout_user()
    session.clear()
    
    sso = SSOService.get_client()
    # Redirect to Central Auth logout with a return_to back to our login page
    # This ensures a "Round Trip" logout that clears everything and lands correctly.
    login_url = url_for('auth.login', _external=True)
    return redirect(sso.get_logout_url(return_to=login_url))
