"""Authentication routes — Login, Register, Logout."""

from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user
import requests
import logging
from flask import current_app

from ..extensions import db
from ..models.user import User

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

def is_sso_alive():
    """Circuit Breaker: Check if Central Auth server is reachable."""
    try:
        sso_url = current_app.config.get('CENTRAL_AUTH_SERVER_ADDRESS', 'http://localhost:5000')
        response = requests.get(f"{sso_url}/api/health", timeout=1.5)
        return response.status_code == 200
    except (requests.RequestException, Exception):
        return False


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
    from ..models.setting import AppSetting
    if AppSetting.get('AUTH_PROVIDER') == 'central':
        flash('Cổng đăng ký nội bộ hiện đang đóng. Vui lòng đăng ký qua hệ thống Central Auth.', 'error')
        return redirect(url_for('auth.login'))

    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        email = request.form.get('email', '').strip().lower()
        password = request.form.get('password', '')
        confirm = request.form.get('confirm_password', '')

        # Validation
        errors = []
        if not username or len(username) < 3:
            errors.append('Username must be at least 3 characters.')
        if not email or '@' not in email:
            errors.append('Please enter a valid email.')
        if len(password) < 6:
            errors.append('Password must be at least 6 characters.')
        if password != confirm:
            errors.append('Passwords do not match.')
        if User.query.filter_by(username=username).first():
            errors.append('Username already taken.')
        if User.query.filter_by(email=email).first():
            errors.append('Email already registered.')

        if errors:
            for e in errors:
                flash(e, 'error')
            return render_template('auth/register.html', username=username, email=email)

        user = User(username=username, email=email)
        user.set_password(password)
        db.session.add(user)
        db.session.commit()

        flash('Account created! Please log in.', 'success')
        return redirect(url_for('auth.login'))

    return render_template('auth/register.html')


@auth_bp.route('/login', methods=['GET', 'POST'])
def login():
    from ..models.setting import AppSetting
    auth_provider = AppSetting.get('AUTH_PROVIDER', 'local')
    
    # Bridge: Redirect to SSO if provider is set to central
    if auth_provider == 'central' and request.method == 'GET':
        if is_sso_alive():
            return redirect(url_for('auth_center.login', **request.args))
        else:
            logging.warning("Central Auth is down. Falling back to local login.")
            flash('Hệ thống Central Auth đang gián đoạn, tự động kích hoạt đăng nhập nội bộ.', 'warning')

    if current_user.is_authenticated:
        return redirect(url_for('dashboard.index'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(username=username).first()

        if user is None or not user.check_password(password):
            flash('Invalid username or password.', 'error')
            return render_template('auth/login.html', username=username)

        login_user(user, remember=True)
        next_page = request.args.get('next')
        return redirect(next_page or url_for('dashboard.index'))

    return render_template('auth/login.html')


@auth_bp.route('/admin-login', methods=['GET', 'POST'])
def admin_login():
    """Emergency local-only login for administrators (SSO Bypass)."""
    if current_user.is_authenticated and getattr(current_user, 'is_admin', False):
        return redirect(url_for('admin.dashboard'))

    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '')

        user = User.query.filter_by(username=username).first()

        if user is None or not user.check_password(password) or not getattr(user, 'is_admin', False):
            flash('Invalid local admin credentials.', 'error')
            return render_template('auth/login.html', username=username, emergency=True)

        login_user(user, remember=True)
        return redirect(url_for('admin.dashboard'))

    return render_template('auth/login.html', emergency=True)


@auth_bp.route('/logout')
@login_required
def logout():
    from ..models.setting import AppSetting
    auth_provider = AppSetting.get('AUTH_PROVIDER', 'local')
    
    if auth_provider == 'central':
        return redirect(url_for('auth_center.logout'))
        
    logout_user()
    flash('You have been logged out.', 'info')
    return redirect(url_for('auth.login'))


@auth_bp.route('/profile', methods=['GET', 'POST'])
@login_required
def profile():
    from ..models.setting import AppSetting
    auth_provider = AppSetting.get('AUTH_PROVIDER', 'local')
    
    if auth_provider == 'central':
        # Redirect to SSO profile management if Central Auth is active
        sso_url = current_app.config.get('CENTRAL_AUTH_SERVER_ADDRESS', 'http://localhost:5000')
        # In standardized ecosystem settings, profile/settings is usually at /profile or /settings
        return redirect(f"{sso_url}/profile")

    if request.method == 'POST':
        email = request.form.get('email', '').strip().lower()
        new_password = request.form.get('new_password', '')
        confirm_password = request.form.get('confirm_password', '')

        # Basic email update
        if email and email != current_user.email:
            if User.query.filter_by(email=email).first():
                flash('Email already registered by another user.', 'error')
            else:
                current_user.email = email
                flash('Email updated successfully.', 'success')

        # Password update flow
        if new_password:
            if len(new_password) < 6:
                flash('Password must be at least 6 characters.', 'error')
            elif new_password != confirm_password:
                flash('Passwords do not match.', 'error')
            else:
                current_user.set_password(new_password)
                flash('Password changed successfully.', 'success')

        db.session.commit()
        return redirect(url_for('auth.profile'))

    return render_template('auth/profile.html', user=current_user)
