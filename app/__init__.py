"""AuraFlow — Flask Application Factory."""

import os
from flask import Flask
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

    
    # Removed celery_init_app(app)

    # ── Initialize Storage Provider ────────────────────────────
    from .services.storage_service import LocalStorageProvider, S3StorageProvider
    from . import extensions
    
    if app.config.get('STORAGE_TYPE') == 's3':
        extensions.storage = S3StorageProvider(
            bucket_name=app.config.get('S3_BUCKET'),
            access_key=app.config.get('S3_ACCESS_KEY'),
            secret_key=app.config.get('S3_SECRET_KEY'),
            region=app.config.get('S3_REGION')
        )
    else:
        extensions.storage = LocalStorageProvider(static_folder=app.static_folder)

    # ── Register blueprints ────────────────────────────────────
    from .routes.auth import auth_bp
    from .routes.dashboard import dashboard_bp
    from .routes.player import player_bp
    from .routes.api import api_bp
    from .routes.admin import admin_bp
    from .routes.auth_center import auth_center_bp
    from .routes.practice import practice_bp
    from .routes.import_handler import import_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(auth_center_bp)
    app.register_blueprint(api_bp, url_prefix='/api')
    app.register_blueprint(player_bp, url_prefix='/player')
    app.register_blueprint(practice_bp, url_prefix='/practice')
    app.register_blueprint(import_bp)

    # ── ECOSYSTEM HEALTH CHECK ─────────────────────────────────
    from flask import jsonify
    @app.route('/api/health')
    def api_health():
        """Public endpoint for CentralAuth health checks."""
        return jsonify({"status": "online", "service": "AuraFlow"})

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
