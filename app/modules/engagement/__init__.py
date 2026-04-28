def setup_module(app):
    from .routes.api import bp as api_bp
    app.register_blueprint(api_bp, url_prefix='/api/engagement')
