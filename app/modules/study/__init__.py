module_metadata = {
    "name": "Study",
    "icon": "BookOpen",
    "key": "study"
}

def setup_module(app):
    from .routes.api import api_bp
    from .routes.practice import practice_bp
    from .routes.tracking import tracking_bp
    
    app.register_blueprint(api_bp, url_prefix='/api/study')
    app.register_blueprint(practice_bp, url_prefix='/practice')
    app.register_blueprint(tracking_bp, url_prefix='/api/tracking')
