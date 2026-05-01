module_metadata = {
    "name": "Content",
    "icon": "Video",
    "key": "content"
}

def setup_module(app):
    from .routes.api import content_api
    app.register_blueprint(content_api)
