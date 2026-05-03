"""AuraFlow — Flask Application Factory (Pure Headless API)."""

import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

from .core.config import config_by_name
from .core.extensions import db, migrate # Removed csrf

def create_app(config_name: str | None = None) -> Flask:
    """Create and configure the Flask application."""
    load_dotenv()

    if config_name is None:
        config_name = os.environ.get('FLASK_ENV', 'development')

    base_dir = os.path.abspath(os.path.dirname(__file__))
    dist_folder = os.path.join(base_dir, 'core', 'static', 'dist')

    # Headless + SPA Configuration
    app = Flask(__name__, 
                static_folder=dist_folder, 
                static_url_path='/static/dist')
                
    app.config.from_object(config_by_name[config_name])
    
    # ENSURE CSRF IS DISABLED FOR HEADLESS JWT
    app.config['WTF_CSRF_ENABLED'] = False

    # ── JWT Configuration ─────────────────────────────────────
    app.config["JWT_SECRET_KEY"] = app.config.get("SECRET_KEY", "podlearn-jwt-secret-888")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = 3600 * 24 
    jwt = JWTManager(app)
    
    # ── Extensions & Security ─────────────────────────────────
    CORS(app, supports_credentials=True)
    db.init_app(app)
    migrate.init_app(app, db)
    # csrf.init_app(app) # Completely disabled for pure API architecture

    from .core.celery_app import celery_init_app
    celery_init_app(app)

    # ── Global Error Handler ──────────────────────────────────
    @app.errorhandler(Exception)
    def handle_exception(e):
        from werkzeug.exceptions import HTTPException
        code = 500
        message = str(e)
        if isinstance(e, HTTPException):
            code = e.code
            message = e.description
        
        # Simple JSON response for all errors
        return jsonify({
            "status": "error",
            "code": code,
            "message": message
        }), code

    # JWT User Lookup
    from app.modules.identity.models import User
    @jwt.user_lookup_loader
    def user_lookup_callback(_jwt_header, jwt_data):
        identity = jwt_data["sub"]
        return db.session.get(User, identity)

    # ── Module Initialization ─────────────────────────────────
    from .modules.identity import setup_module as setup_identity
    from .modules.content import setup_module as setup_content
    from .modules.study import setup_module as setup_study
    from .modules.engagement import setup_module as setup_engagement
    from .modules.admin import setup_module as setup_admin
    
    setup_content(app)
    setup_study(app)
    setup_engagement(app)
    setup_admin(app)
    
    # setup_identity should be LAST because its SSO initialization triggers DB queries 
    # that require all other models (like Video) to be already mapped.
    setup_identity(app)

    # ── Database Migration (Auto-fix) ──────────────────────────
    with app.app_context():
        try:
            from app.modules.study.migrations.db_fix import migrate_flashcards
            db_uri = app.config.get('SQLALCHEMY_DATABASE_URI', '')
            if 'sqlite' in db_uri:
                # Extract path from sqlite:///...
                db_path = db_uri.split('///')[-1]
                # If path is relative, make it absolute relative to instance/root
                if not os.path.isabs(db_path):
                    # In this project, relative paths are usually relative to the root or app dir
                    # But we'll trust the URI for now
                    pass
                migrate_flashcards(db_path)
        except Exception as e:
            app.logger.error(f"Auto-migration failed: {e}")

    # ── SPA Bridge (Catch-all) ─────────────────────────────────
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_spa(path):
        """Serve the production SPA assets."""
        if path.startswith('api/') or path.startswith('media/'):
            return jsonify({"status": "error", "code": 404, "message": "API not found"}), 404
            
        full_path = os.path.join(app.static_folder, path)
        if path and os.path.exists(full_path) and os.path.isfile(full_path):
            return send_from_directory(app.static_folder, path)
            
        if path.startswith('static/dist/'):
            file_path = path.replace('static/dist/', '')
            return send_from_directory(app.static_folder, file_path)

        if path == 'admin' or path.startswith('admin/'):
            return send_from_directory(app.static_folder, 'admin.html')

        return send_from_directory(app.static_folder, 'index.html')

    return app
