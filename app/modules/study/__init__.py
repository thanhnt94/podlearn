module_metadata = {
    "name": "Study",
    "icon": "BookOpen",
    "key": "study"
}

def setup_module(app):
    from .routes.api import study_api_bp, tracking_api_bp
    
    app.register_blueprint(study_api_bp, url_prefix='/api/study')
    app.register_blueprint(tracking_api_bp, url_prefix='/api/tracking')
