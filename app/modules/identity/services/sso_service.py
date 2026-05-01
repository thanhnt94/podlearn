from flask import current_app, session
from app.core.extensions import db
from app.modules.identity.models import User
from app.modules.engagement.models import AppSetting
from app.core.utils.sso_helper import EcosystemAuth

class SSOService:
    """
    Modernized SSOService for PodLearn using the Power Pairing helper.
    """

    @staticmethod
    def get_client():
        # Central Auth Settings (usually in .env or settings table)
        server_url = AppSetting.get('CENTRAL_AUTH_SERVER_ADDRESS', 'http://127.0.0.1:5000')
        client_id = AppSetting.get('CENTRAL_AUTH_CLIENT_ID', 'podlearn-v1')
        client_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET', 'podlearn_secret_123')
        
        return EcosystemAuth(
            server_url=server_url, 
            client_id=client_id, 
            client_secret=client_secret
        )

    @staticmethod
    def handle_callback(code):
        """Standardized callback handling using EcosystemAuth helper."""
        sso = SSOService.get_client()
        result = sso.handle_callback(code)

        if not result['success']:
            current_app.logger.error(f"SSO Callback failed: {result.get('error')}")
            return None

        user_payload = result['user']
        tokens = result['tokens']

        # Store tokens for downstream usage (like Global Logout notification)
        session['sso_access_token'] = tokens['access_token']
        if 'refresh_token' in tokens:
            session['sso_refresh_token'] = tokens['refresh_token']

        return SSOService.provision_user(user_payload)

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

