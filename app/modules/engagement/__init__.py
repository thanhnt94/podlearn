module_metadata = {
    "name": "Engagement",
    "icon": "Zap",
    "key": "engagement"
}

def setup_module(app):
    from .routes.api import engagement_api_bp, gamification_api_bp, shares_api_bp
    
    app.register_blueprint(engagement_api_bp, url_prefix='/api/engagement')
    app.register_blueprint(gamification_api_bp, url_prefix='/api/gamification')
    app.register_blueprint(shares_api_bp, url_prefix='/api/shares')
    
    # Register signal listeners
    from . import events
