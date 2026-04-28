module_metadata = {
    "name": "Engagement",
    "icon": "Zap",
    "key": "engagement"
}

def setup_module(app):
    from .routes.api import bp as api_bp
    from .routes.community import bp as community_bp
    app.register_blueprint(api_bp, url_prefix='/api/engagement')
    app.register_blueprint(community_bp, url_prefix='/api/community')
