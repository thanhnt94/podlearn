"""AuraFlow — Flask Application Factory."""

import os
import time
from flask import Flask, jsonify, render_template
from flask_login import login_required
from dotenv import load_dotenv

from .config import config_by_name
from .extensions import db, migrate, login_manager, csrf


def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    load_dotenv()

    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    app = Flask(__name__)
    app.config.from_object(config_by_name[config_name])

    # ── Initialise extensions ──────────────────────────────────
    db.init_app(app)
    migrate.init_app(app, db)
    csrf.init_app(app)
    login_manager.init_app(app)

    # ── Register Jinja Filters ─────────────────────────────────
    from .utils.jinja_filters import parse_bbcode
    app.jinja_env.filters['bbcode'] = parse_bbcode

    
    # Removed celery_init_app(app)

    # ── Initialize Storage Provider ────────────────────────────
    from .services.storage_service import LocalStorageProvider, S3StorageProvider
    from . import extensions
    from flask import send_from_directory
    
    if app.config.get('STORAGE_TYPE') == 's3':
        extensions.storage = S3StorageProvider(
            bucket_name=app.config.get('S3_BUCKET'),
            access_key=app.config.get('S3_ACCESS_KEY'),
            secret_key=app.config.get('S3_SECRET_KEY'),
            region=app.config.get('S3_REGION')
        )
    else:
        # Use MEDIA_FOLDER from configuration
        media_folder = app.config.get('MEDIA_FOLDER')
        extensions.storage = LocalStorageProvider(base_folder=media_folder)
        
        # Add dynamic route to serve media if it's NOT in static
        @app.route('/media/<path:filename>')
        def serve_media(filename):
            return send_from_directory(media_folder, filename)

    # ── Register blueprints ────────────────────────────────────
    from .routes.auth import auth_bp
    from .routes.dashboard import dashboard_bp
    from .routes.player import player_bp
    from .routes.api import api_bp
    from .routes.admin import admin_bp
    from .routes.auth_center import auth_center_bp
    from .routes.practice import practice_bp
    from .routes.import_handler import import_bp
    from .routes.share_routes import share_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_center_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(player_bp, url_prefix='/player')
    app.register_blueprint(practice_bp, url_prefix='/practice')
    app.register_blueprint(import_bp)
    app.register_blueprint(share_bp)

    @app.route('/api/health')
    def api_health():
        """Public endpoint for CentralAuth health checks."""
        return jsonify({"status": "online", "service": "AuraFlow"})

    # ── ECOSYSTEM SYNC API ─────────────────────────────────────
    @app.route('/api/sso-internal/user-list', methods=['POST'])
    def internal_user_list():
        """
        Standard Internal API for CentralAuth User Synchronization.
        Protected by Client Secret verification.
        """
        from flask import request, jsonify
        secret_header = request.headers.get('X-Client-Secret')
        configured_secret = app.config.get('CENTRAL_AUTH_CLIENT_SECRET')

        if not secret_header or secret_header != configured_secret:
            return jsonify({"error": "Unauthorized"}), 401

        from .models import User
        users = User.query.all()
        
        user_list = []
        for user in users:
            user_list.append({
                "username": user.username,
                "email": user.email,
                "full_name": getattr(user, 'full_name', user.username),
                "central_auth_id": user.central_auth_id
            })
            
        return jsonify({"users": user_list}), 200

    @app.route('/api/sso-internal/link-user', methods=['POST'])
    def internal_link_user():
        """Update a user's central_auth_id for ecosystem linking. Supports Admin Push-Back."""
        from flask import request, jsonify
        secret_header = request.headers.get('X-Client-Secret')
        configured_secret = app.config.get('CENTRAL_AUTH_CLIENT_SECRET')

        if not secret_header or secret_header != configured_secret:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json()
        email = data.get('email')
        ca_id = data.get('central_auth_id')
        username = data.get('username')
        full_name = data.get('full_name')
        is_admin_sync = data.get('is_admin_sync', False)
        
        if not ca_id:
            return jsonify({"error": "Missing central_auth_id"}), 400

        from .models.user import User
        target_user = None

        # 1. Admin Push-back logic
        if is_admin_sync:
            # Target local ID 1
            target_user = User.query.get(1)
            if target_user:
                # Collision Handling: If email or username is already taken by ANOTHER user
                if email:
                    other_with_email = User.query.filter(User.email == email, User.id != 1).first()
                    if other_with_email:
                        app.logger.warning(f"Sync Conflict: Email {email} taken by User {other_with_email.id}. Renaming existing user.")
                        other_with_email.email = f"{email}_old_{int(time.time())}"
                
                if username:
                    other_with_username = User.query.filter(User.username == username, User.id != 1).first()
                    if other_with_username:
                        app.logger.warning(f"Sync Conflict: Username {username} taken by User {other_with_username.id}. Renaming existing user.")
                        other_with_username.username = f"{username}_old_{int(time.time())}"
                
                if ca_id:
                    other_with_ca = User.query.filter(User.central_auth_id == ca_id, User.id != 1).first()
                    if other_with_ca:
                        app.logger.warning(f"Sync Conflict: CA ID {ca_id} taken by User {other_with_ca.id}. Detaching existing user.")
                        other_with_ca.central_auth_id = None

                if target_user.central_auth_id and target_user.central_auth_id != ca_id:
                    # Log conflict but proceed for admin takeover if explicitly requested
                    app.logger.warning(f"Admin takeover: Overwriting central_auth_id {target_user.central_auth_id} with {ca_id} for local ID 1")
                
                # Perform Push-back (Overwrite local admin identity)
                target_user.username = username or target_user.username
                target_user.email = email or target_user.email
                if hasattr(target_user, 'full_name'):
                    target_user.full_name = full_name or target_user.full_name
                target_user.central_auth_id = ca_id
                db.session.commit()
                return jsonify({"status": "success", "message": f"Admin identity pushed back to local ID 1 ({target_user.username})"}), 200

        # 2. Standard linking logic
        if not target_user:
            target_user = User.query.filter_by(email=email).first()
        
        if not target_user and not is_admin_sync:
            # Try finding by username as fallback
            target_user = User.query.filter_by(username=username).first()

        if target_user:
            target_user.central_auth_id = ca_id
            if username: target_user.username = username
            if full_name and hasattr(target_user, 'full_name'):
                target_user.full_name = full_name
            db.session.commit()
            return jsonify({"status": "success", "message": f"User {target_user.username} linked to CentralAuth ID {ca_id}"}), 200
        
        return jsonify({"error": "User not found for linking"}), 404

    @app.route('/api/sso-internal/delete-user', methods=['POST'])
    def internal_delete_user():
        """Delete a user from this app's database."""
        from flask import request, jsonify
        secret_header = request.headers.get('X-Client-Secret')
        configured_secret = app.config.get('CENTRAL_AUTH_CLIENT_SECRET')

        if not secret_header or secret_header != configured_secret:
            return jsonify({"error": "Unauthorized"}), 401

        data = request.get_json()
        email = data.get('email')
        username = data.get('username')
        
        from .models import User
        user = None
        if email and email != "null":
            user = User.query.filter_by(email=email).first()
        if not user and username and username != "null":
            user = User.query.filter_by(username=username).first()
            
        if not user:
            return jsonify({"error": f"User {username or email} not found"}), 404
        
        db.session.delete(user)
        db.session.commit()
        return jsonify({"status": "ok", "message": f"Deleted {user.username}"}), 200

    # Ensure CSRF exemption
    csrf.exempt(api_bp)
    csrf.exempt(internal_user_list)
    csrf.exempt(internal_link_user)
    csrf.exempt(internal_delete_user)

    # ── MODERN SPA ENTRY POINT ────────────────────────────────
    # This serves the React SPA at the root / for authenticated users.
    # We use a catch-all for any path that isn't handled by specific blueprints.
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def root(path):
        from flask_login import current_user
        from flask import redirect, url_for, render_template

        # If it's an API route or another specific route, Flask's discovery
        # logic will prioritize the specific blueprint-registered routes first.
        # This catch-all serves as the "default" for UI navigation.

        if current_user.is_authenticated:
            # Serve the modern SPA entry point
            return render_template('app_modern.html')
        
        # Public Landing Page handling
        if not path or path == 'index':
            return render_template('landing.html')
            
        # Fallback to login for any other non-authenticated attempt at UI routes
        return redirect(url_for('auth.login'))

    # ── User loader for Flask-Login ────────────────────────────
    from .models import User

    @login_manager.user_loader
    def load_user(user_id):
        return db.session.get(User, int(user_id))

    # ── CLI commands ───────────────────────────────────────────
    import click

    @app.cli.command('seed-admin')
    def seed_admin():
        """Create the default admin/admin account."""
        existing = User.query.filter_by(username='admin').first()
        if existing:
            existing.is_admin = True
            db.session.commit()
            click.echo('Admin user already exists. Updated to is_admin=True')
            return
        admin = User(username='admin', email='admin@AuraFlow.local', is_admin=True)
        admin.set_password('admin')
        db.session.add(admin)
        db.session.commit()
        click.echo('Admin user created successfully.')

        click.echo('✅ Admin user created (admin/admin)')

    return app
