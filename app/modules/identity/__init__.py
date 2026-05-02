module_metadata = {
    "name": "Identity",
    "icon": "Users",
    "key": "identity"
}

def setup_module(app):
    from .routes.api import identity_api, setup_sso
    app.register_blueprint(identity_api)
    setup_sso(app)
