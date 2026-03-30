"""Authentication routes — Login, Register, Logout."""

from flask import Blueprint, render_template, redirect, url_for, flash, request
from flask_login import login_user, logout_user, login_required, current_user

from ..extensions import db
from ..models.user import User

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')


@auth_bp.route('/register', methods=['GET', 'POST'])
def register():
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
    if auth_provider == 'central' and request.endpoint == 'auth.login':
        return redirect(url_for('auth_center.login', **request.args))

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
