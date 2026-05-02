module_metadata = {
    "name": "Identity",
    "icon": "Users",
    "key": "identity"
}

def setup_module(app):
    from .routes.api import identity_api, sso_bridge
    app.register_blueprint(identity_api)
    app.register_blueprint(sso_bridge)
