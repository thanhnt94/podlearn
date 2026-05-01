module_metadata = {
    "name": "Engagement",
    "icon": "Zap",
    "key": "engagement"
}

def setup_module(app):
    from .routes.community import community_bp
    from .routes.dashboard import dashboard_bp
    from .routes.share_routes import share_bp
    from .routes.api import engagement_api
    
    app.register_blueprint(community_bp, url_prefix='/api/community')
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(share_bp)
    app.register_blueprint(engagement_api, url_prefix='/api/engagement')
    
    # Register signal listeners
    from . import events
