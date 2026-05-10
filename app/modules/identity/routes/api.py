from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, get_current_user
from app.modules.identity.models import User
from app.modules.identity.schemas import UserSchema, UserLogin, UserRegister
from app.modules.identity.services.sso_service import SSOService
from app.modules.engagement import interface as engagement_interface
from app.core.config import settings

router = APIRouter(prefix="/api/identity", tags=["Identity"])

@router.get('/config')
def get_auth_config(db: Session = Depends(get_db)):
    """Returns public auth configuration for the frontend."""
    auth_provider = engagement_interface.get_app_setting_dto('AUTH_PROVIDER', 'local')
    return {
        "auth_provider": auth_provider,
        "sso_enabled": auth_provider == 'central'
    }

# ── Local Auth ────────────────────────────────────────────────

@router.post('/register', status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """Register a new user (Local)."""
    if engagement_interface.get_app_setting_dto('AUTH_PROVIDER') == 'central':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is handled by Central Auth."
        )

    if db.query(User).filter(User.username == user_in.username).first() or \
       db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username or Email already exists"
        )

    user = User(username=user_in.username, email=str(user_in.email), full_name=user_in.full_name)
    user.set_password(user_in.password)
    db.add(user)
    db.commit()
    db.refresh(user)

    return {
        "status": "success", 
        "message": "User registered successfully",
        "user": UserSchema.model_validate(user)
    }

@router.post('/login')
def login(login_data: UserLogin, db: Session = Depends(get_db)):
    """Login and receive JWT tokens."""
    user = db.query(User).filter(User.username == login_data.username).first()

    if user and user.check_password(login_data.password):
        from datetime import timedelta
        expires_delta = timedelta(days=30) if login_data.remember_me else None
        
        access_token = create_access_token(data={"sub": str(user.id)}, expires_delta=expires_delta)
        refresh_token = create_refresh_token(data={"sub": str(user.id)})
        return {
            "status": "success",
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": UserSchema.model_validate(user)
        }
    
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid credentials"
    )

@router.post('/logout')
def logout():
    """Bypass JWT for logout to help stuck users."""
    return {"status": "success", "message": "Logged out successfully (Please clear client tokens)"}

@router.get('/me')
async def get_me(request: Request, db: Session = Depends(get_db)):
    """Get current user information (Graceful fallback)."""
    from jose import jwt, JWTError
    from app.core.security import ALGORITHM
    
    auth_header = request.headers.get("Authorization")
    if not auth_header or not auth_header.startswith("Bearer "):
        return {
            "status": "success",
            "logged_in": False,
            "user": None
        }
    
    token = auth_header.split(" ")[1]
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise JWTError()
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise JWTError()
            
        return {
            "status": "success",
            "logged_in": True,
            "user": UserSchema.model_validate(user)
        }
    except JWTError:
        return {
            "status": "success",
            "logged_in": False,
            "user": None
        }

# ── SSO (Central Auth) ────────────────────────────────────────

async def on_sso_user_provision(user_payload, tokens):
    """Callback for ecosystem_sso to handle JIT provisioning."""
    return await SSOService.provision_user(user_payload)

async def on_sso_login_success(request, user, tokens):
    """Callback for ecosystem_sso to handle frontend redirect."""
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Get frontend URL from settings or host
    frontend_url = settings.FRONTEND_URL or f"{request.url.scheme}://{request.url.netloc}"
    return RedirectResponse(url=f"{frontend_url}/auth/callback#access_token={access_token}&refresh_token={refresh_token}")

def setup_sso(app):
    """Initialize SSO bridge."""
    router_sso, _ = SSOService.get_modular_router(on_sso_user_provision, on_sso_login_success)
    app.include_router(router_sso)
    return router_sso

@router.get('/sso/login')
def sso_login():
    """Legacy route for backward compatibility."""
    return RedirectResponse(url="/auth-center/login")

@router.patch('/profile')
def update_profile(data: dict, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Update user profile."""
    email = data.get('email', '').strip().lower()
    new_password = data.get('new_password', '')

    if email and email != current_user.email:
        if db.query(User).filter(User.email == email).first():
            raise HTTPException(status_code=400, detail="Email already taken")
        current_user.email = email

    if new_password:
        if len(new_password) < 6:
            raise HTTPException(status_code=400, detail="Password too short")
        current_user.set_password(new_password)

    db.commit()
    db.refresh(current_user)
    return {"status": "success", "message": "Profile updated", "user": UserSchema.model_validate(current_user)}
