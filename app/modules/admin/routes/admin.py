import os
from flask import Blueprint, send_from_directory, current_app

admin_bp = Blueprint('admin', __name__, url_prefix='/admin')

@admin_bp.route('/')
@admin_bp.route('/<path:path>')
def studio_root(path=None):
    """Serve the modern Vite-based Admin Studio."""
    return send_from_directory(current_app.static_folder, 'admin.html')
