module_metadata = {
    "name": "Admin",
    "icon": "Shield",
    "key": "admin"
}

def setup_module(app):
    from .routes.admin import admin_bp
    from .routes.admin_api import admin_api_bp
    from .routes.import_handler import import_bp
    
    app.register_blueprint(admin_bp)
    app.register_blueprint(admin_api_bp)
    app.register_blueprint(import_bp)
