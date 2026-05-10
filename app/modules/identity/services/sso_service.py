from sqlalchemy.orm import Session
from app.modules.identity.models import User
from app.modules.engagement.models import AppSetting
from app.core.database import SessionLocal

class SSOService:
    """
    Modernized SSOService for PodLearn using the modular Ecosystem SSO.
    """

    @staticmethod
    def get_modular_router(provision_callback, success_callback):
        # Import directly from the local project utility
        from app.core.utils.ecosystem_sso import create_sso_router
        
        # We need a db session to get settings
        with SessionLocal() as db:
            server_url = db.query(AppSetting).filter_by(key='CENTRAL_AUTH_SERVER_ADDRESS').first()
            server_url = server_url.value if server_url else 'http://127.0.0.1:5000'
            
            client_id = db.query(AppSetting).filter_by(key='CENTRAL_AUTH_CLIENT_ID').first()
            client_id = client_id.value if client_id else 'podlearn-v1'
            
            client_secret = db.query(AppSetting).filter_by(key='CENTRAL_AUTH_CLIENT_SECRET').first()
            client_secret = client_secret.value if client_secret else 'podlearn_secret_123'
        
        return create_sso_router(
            server_url=server_url,
            client_id=client_id,
            client_secret=client_secret,
            on_user_provision=provision_callback,
            login_success_redirect_fn=success_callback
        )

    @staticmethod
    async def provision_user(user_payload: dict) -> User:
        """
        Standardized JIT Provisioning.
        """
        central_id = user_payload.get('id')
        email = user_payload.get('email')
        username = user_payload.get('username') or email.split('@')[0]
        full_name = user_payload.get('full_name', username)
        
        with SessionLocal() as db:
            # 1. Lookup by central_auth_id
            user = db.query(User).filter_by(central_auth_id=central_id).first()
            
            # 2. Fallback to Email
            if not user:
                user = db.query(User).filter_by(email=email).first()
                if user:
                    user.central_auth_id = central_id
            
            # 3. Fallback to Username
            if not user:
                user = db.query(User).filter_by(username=username).first()
                if user:
                    user.central_auth_id = central_id
                    if not user.email or '@' not in user.email:
                        user.email = email
            
            if user:
                # Sync Profile Info
                user.email = email
                user.username = username
                user.full_name = full_name
                if user_payload.get('password_hash'):
                    user.password_hash = user_payload.get('password_hash')
                db.commit()
                db.refresh(user)
                return user
            else:
                # Create new Shadow Record
                user = User(
                    central_auth_id=central_id,
                    username=username,
                    email=email,
                    full_name=full_name,
                    role='user'
                )
                if user_payload.get('password_hash'):
                    user.password_hash = user_payload.get('password_hash')
                else:
                    import uuid
                    user.set_password(str(uuid.uuid4()))
                
                db.add(user)
                db.commit()
                db.refresh(user)
                return user

