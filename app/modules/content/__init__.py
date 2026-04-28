module_metadata = {
    "name": "Content",
    "icon": "Video",
    "key": "content"
}

def setup_module(app):
    from .routes.api import bp as api_bp
    from .routes.subtitles import bp as subtitle_bp
    app.register_blueprint(api_bp, url_prefix='/api/content')
    app.register_blueprint(subtitle_bp, url_prefix='/api/subtitles')
