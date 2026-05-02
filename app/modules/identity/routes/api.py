from flask import Blueprint, jsonify, request, current_app, redirect, url_for
from flask_jwt_extended import (
    create_access_token, 
    create_refresh_token, 
    jwt_required, 
    get_jwt_identity, 
    current_user,
    verify_jwt_in_request
)
from app.core.extensions import db
from app.modules.identity.models import User
from app.modules.identity.services.sso_service import SSOService
from app.modules.identity.schemas import UserSchema
from app.modules.engagement import interface as engagement_interface

identity_api = Blueprint('identity_api', __name__, url_prefix='/api/identity')
sso_bridge = Blueprint('sso_bridge', __name__)
user_schema = UserSchema()

@identity_api.route('/config', methods=['GET'])
def get_auth_config():
    """Returns public auth configuration for the frontend."""
    auth_provider = engagement_interface.get_app_setting_dto('AUTH_PROVIDER', 'local')
    return jsonify({
        "auth_provider": auth_provider,
        "sso_enabled": auth_provider == 'central'
    })

# ── Local Auth ────────────────────────────────────────────────

@identity_api.route('/register', methods=['POST'])
def register():
    """Register a new user (Local)."""
    if engagement_interface.get_app_setting_dto('AUTH_PROVIDER') == 'central':
        return jsonify({"status": "error", "message": "Registration is handled by Central Auth."}), 403

    data = request.get_json() or {}
    username = data.get('username', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not username or not email or not password:
        return jsonify({"status": "error", "message": "Missing required fields"}), 400

    if User.query.filter_by(username=username).first() or User.query.filter_by(email=email).first():
        return jsonify({"status": "error", "message": "Username or Email already exists"}), 400

    user = User(username=username, email=email)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return jsonify({
        "status": "success", 
        "message": "User registered successfully",
        "user": user_schema.dump(user)
    }), 201

@identity_api.route('/login', methods=['POST'])
def login():
    """Login and receive JWT tokens."""
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    user = User.query.filter_by(username=username).first()

    if user and user.check_password(password):
        access_token = create_access_token(identity=str(user.id))
        refresh_token = create_refresh_token(identity=str(user.id))
        return jsonify({
            "status": "success",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": user_schema.dump(user)
        })
    
    return jsonify({"status": "error", "message": "Invalid credentials"}), 401

@identity_api.route('/logout', methods=['POST', 'GET'])
def logout():
    """Bypass JWT for logout to help stuck users."""
    return jsonify({"status": "success", "message": "Logged out successfully (Please clear client tokens)"}), 200

@identity_api.route('/me', methods=['GET'])
def get_me():
    """Get current user information (Graceful fallback)."""
    try:
        verify_jwt_in_request()
        return jsonify({
            "status": "success",
            "logged_in": True,
            "user": user_schema.dump(current_user)
        })
    except:
        return jsonify({
            "status": "success",
            "logged_in": False,
            "user": None
        }), 200

# ── SSO (Central Auth) ────────────────────────────────────────

def on_sso_user_provision(user_payload, tokens):
    """Callback for ecosystem_sso to handle JIT provisioning."""
    return SSOService.provision_user(user_payload)

def on_sso_login_success(user, tokens):
    """Callback for ecosystem_sso to handle frontend redirect."""
    from flask_jwt_extended import create_access_token, create_refresh_token
    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))
    
    frontend_url = current_app.config.get('FRONTEND_URL', request.host_url.rstrip('/'))
    return redirect(f"{frontend_url}/auth/callback#access_token={access_token}&refresh_token={refresh_token}")

# Create and register the modular SSO blueprint
sso_bridge, sso_auth = SSOService.get_modular_bp(on_sso_user_provision, on_sso_login_success)

@identity_api.route('/sso/login')
def sso_login():
    """Legacy route for backward compatibility."""
    return redirect(url_for('ecosystem_sso.login'))

@identity_api.route('/profile', methods=['PATCH'])
@jwt_required()
def update_profile():
    """Update user profile."""
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    new_password = data.get('new_password', '')

    if email and email != current_user.email:
        if User.query.filter_by(email=email).first():
            return jsonify({"status": "error", "message": "Email already taken"}), 400
        current_user.email = email

    if new_password:
        if len(new_password) < 6:
            return jsonify({"status": "error", "message": "Password too short"}), 400
        current_user.set_password(new_password)

    db.session.commit()
    return jsonify({"status": "success", "message": "Profile updated", "user": user_schema.dump(current_user)})
