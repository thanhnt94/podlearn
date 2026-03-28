"""PodLearn — Flask Application Factory."""

import os
from flask import Flask
from dotenv import load_dotenv

from .config import config_by_name
from .extensions import db, migrate, login_manager


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
    login_manager.init_app(app)
    
    from .extensions import celery_init_app
    celery_init_app(app)

    # ── Register blueprints ────────────────────────────────────
    from .routes.auth import auth_bp
    from .routes.dashboard import dashboard_bp
    from .routes.player import player_bp
    from .routes.api import api_bp

    app.register_blueprint(auth_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(player_bp)
    app.register_blueprint(api_bp, url_prefix='/api')

    # ── User loader for Flask-Login ────────────────────────────
    from .models.user import User

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
            click.echo('Admin user already exists.')
            return
        admin = User(username='admin', email='admin@podlearn.local')
        admin.set_password('admin')
        db.session.add(admin)
        db.session.commit()
        click.echo('✅ Admin user created (admin/admin)')

    return app
