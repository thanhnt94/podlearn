from flask import current_app, session
from app.core.extensions import db
from app.modules.identity.models import User
from app.modules.engagement.models import AppSetting
from app.core.utils.sso_helper import EcosystemAuth

class SSOService:
    """
    Modernized SSOService for PodLearn using the modular Ecosystem SSO.
    """

    @staticmethod
    def get_modular_bp(app, provision_callback, success_callback):
        # Path to the shared module
        import sys
        import os
        shared_path = os.path.abspath(os.path.join(app.root_path, '..', '..', 'shared_files'))
        if shared_path not in sys.path:
            sys.path.append(shared_path)
        
        from ecosystem_sso import create_sso_blueprint
        
        with app.app_context():
            server_url = AppSetting.get('CENTRAL_AUTH_SERVER_ADDRESS', 'http://127.0.0.1:5000')
            client_id = AppSetting.get('CENTRAL_AUTH_CLIENT_ID', 'podlearn-v1')
            client_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', 'podlearn_secret_123')
        
        return create_sso_blueprint(
            server_url=server_url,
            client_id=client_id,
            client_secret=client_secret,
            on_user_provision=provision_callback,
            login_success_redirect_fn=success_callback
        )

    @staticmethod
    def provision_user(user_payload):
        """
        Standardized JIT Provisioning.
        Uses the Central Auth 'id' (UUID) mapped to local 'central_auth_id'.
        """
        central_id = user_payload.get('id') # This is the standardized UUID
        email = user_payload.get('email')
        username = user_payload.get('username') or email.split('@')[0]
        full_name = user_payload.get('full_name', username)
        
        # 1. Lookup by central_auth_id (Best Practice for Ecosystem consistency)
        user = User.query.filter_by(central_auth_id=central_id).first()
        
        # 2. Fallback to Email (for migrating existing local users)
        if not user:
            user = User.query.filter_by(email=email).first()
            if user:
                # Link this local user to the Central Auth identity
                user.central_auth_id = central_id
        
        # 3. Fallback to Username (To prevent UNIQUE constraint errors)
        if not user:
            user = User.query.filter_by(username=username).first()
            if user:
                # Link this local user to the Central Auth identity
                user.central_auth_id = central_id
                # Also sync email if the local one was different/placeholder
                if not user.email or '@' not in user.email:
                    user.email = email
        
        if user:
            # Sync Profile Info
            user.email = email
            user.username = username
            user.full_name = full_name
            # Sync password hash to allow local login fallback
            if user_payload.get('password_hash'):
                user.password_hash = user_payload.get('password_hash')
            db.session.commit()
            return user
        else:
            # Create new Shadow Record
            user = User(
                central_auth_id=central_id, # Link UUID
                username=username,
                email=email,
                full_name=full_name,
                role='user' # Default role in PodLearn
            )
            # Sync password hash from SSO if available
            if user_payload.get('password_hash'):
                user.password_hash = user_payload.get('password_hash')
            else:
                # Set a random password for local record safety as fallback
                import uuid
                user.set_password(str(uuid.uuid4()))
            
            db.session.add(user)
            db.session.commit()
            return user

