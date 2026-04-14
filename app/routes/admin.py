from flask import Blueprint, render_template, redirect, url_for, request
from flask_login import login_required, current_user
from functools import wraps

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not current_user.is_authenticated or not getattr(current_user, 'is_admin', False):
            # Enforce local admin login (SSO Bypass)
            return redirect(url_for('auth.admin_login', next=request.url))
        return f(*args, **kwargs)
    return decorated_function

@admin_bp.route('/')
@admin_bp.route('/<path:path>')
@login_required
@admin_required
def studio_root(path=None):
    """Serve the modern Vite-based Admin Studio."""
    return render_template('admin_studio.html')
