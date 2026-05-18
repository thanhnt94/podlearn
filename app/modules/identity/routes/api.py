from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import timedelta

from app.core.database import get_db
from app.core.security import create_access_token, create_refresh_token, get_current_user
from app.modules.identity.models import User
from app.modules.identity.schemas import UserSchema, UserLogin, UserRegister
from app.core.config import settings

router = APIRouter(prefix="/api/identity", tags=["Identity"])

@router.get('/config')
def get_auth_config(db: Session = Depends(get_db)):
    """Returns public auth configuration for the frontend."""
    from app.modules.sso_module.service import SSOService
    sso_cfg = SSOService.get_config(db)
    sso_enabled = sso_cfg.is_enabled
    
    server_url = sso_cfg.server_url.rstrip('/') if sso_cfg.server_url else "http://localhost:5000"
    client_id = sso_cfg.client_id or "podlearn-v1"
    
    base_url = "http://localhost:5020"  # PodLearn Port 5020
    redirect_uri = f"{base_url}/auth-center/callback"
    jump_url = (
        f"{server_url}/api/auth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&response_type=code"
    ) if sso_enabled else None

    return {
        "auth_provider": "central" if sso_enabled else "local",
        "sso_enabled": sso_enabled,
        "jump_url": jump_url
    }

# ── Local Auth ────────────────────────────────────────────────

@router.post('/register', status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    """Register a new user (Local)."""
    from app.modules.sso_module.service import SSOService
    sso_cfg = SSOService.get_config(db)
    if sso_cfg.is_enabled:
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
        # Enforce SSO backdoor policy if SSO is enabled!
        from app.modules.sso_module.service import SSOService
        sso_cfg = SSOService.get_config(db)
        if sso_cfg.is_enabled:
            if not login_data.is_backdoor:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Security Alert: SSO is active. Please log in using the Central Single Sign-On service."
                )
            else:
                if user.role != 'admin':
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Security Alert: SSO is active. Local backdoor access is strictly restricted to Administrators."
                    )

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
def logout(db: Session = Depends(get_db)):
    """Clear session and return SSO redirect if enabled."""
    from app.modules.sso_module.service import SSOService
    sso_cfg = SSOService.get_config(db)
    if sso_cfg.is_enabled:
        server_url = sso_cfg.server_url.rstrip('/') if sso_cfg.server_url else "http://localhost:5000"
        client_id = sso_cfg.client_id or "podlearn-v1"
        return {
            "status": "success",
            "redirect_url": f"{server_url}/auth/logout?client_id={client_id}"
        }
    return {"status": "success", "message": "Logged out successfully"}

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

# ── SSO (Central Auth) ──

@router.get('/sso/login')
def sso_login():
    """Legacy route for backward compatibility."""
    return RedirectResponse(url="/login")

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
