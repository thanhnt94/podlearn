from flask import current_app, session
from ..extensions import db
from ..models.user import User
from ..models.setting import AppSetting
from .central_auth_client import CentralAuthClient

class SSOService:
    """
    Dedicated service for managing CentralAuth SSO integration in PodLearn.
    Handles user provisioning and token validation.
    """

    @staticmethod
    def get_client():
        api_url = AppSetting.get('CENTRAL_AUTH_API_URL')
        web_url = AppSetting.get('CENTRAL_SSO_WEB_URL', api_url)
        client_id = AppSetting.get('CENTRAL_AUTH_CLIENT_ID')
        client_secret = AppSetting.get('CENTRAL_AUTH_CLIENT_SECRET')
        return CentralAuthClient(api_url=api_url, web_url=web_url, client_id=client_id, client_secret=client_secret)

    @staticmethod
    def handle_callback(code):
        """Exchange the authorization code for tokens and sync the local user."""
        client = SSOService.get_client()
        
        # 1. Exchange code for tokens (V2)
        token_data = client.exchange_code_for_token(code)
        if not token_data or 'access_token' not in token_data:
            current_app.logger.error("SSO Code exchange failed: Access token missing.")
            return None
            
        access_token = token_data['access_token']
        refresh_token = token_data.get('refresh_token')
        
        # 2. Verify token and get user payload
        user_payload = client.verify_token(access_token)
        if not user_payload:
            return None
            
        # 3. Store tokens in session
        session['sso_access_token'] = access_token
        if refresh_token:
            session['sso_refresh_token'] = refresh_token
            
        # 4. Provision local shadow user
        return SSOService.provision_user(user_payload)

    @staticmethod
    def provision_user(user_payload):
        """JIT Provisioning: Sync CentralAuth user into PodLearn database."""
        central_id = user_payload.get('id')
        email = user_payload.get('email')
        username = user_payload.get('username') or email.split('@')[0]
        
        # 1. Lookup by central_id or email
        user = User.query.filter((User.email == email)).first()
        
        if user:
            # Sync existing user
            user.email = email
            user.username = username
            db.session.commit()
            return user
        else:
            # Create new Shadow Record
            user = User(
                username=username,
                email=email,
                is_admin=False # Default to standard user
            )
            # Set a random password for local record safety
            import uuid
            user.set_password(str(uuid.uuid4()))
            
            db.session.add(user)
            db.session.commit()
            return user
