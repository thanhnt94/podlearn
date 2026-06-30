from fastapi import APIRouter, Depends, Request, Response, HTTPException
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.config import settings
from .service import SSOService
from fastapi.responses import RedirectResponse
from typing import Optional
import logging
import os

logger = logging.getLogger(__name__)

router = APIRouter(tags=["SSO Integration"])

# Standard login redirect
@router.get("/login")
def sso_login_redirect(request: Request, db: Session = Depends(get_db)):
    """Force redirect to CentralAuth if SSO is enabled and no backdoor parameter is present."""
    config = SSOService.get_config(db)
    is_backdoor = request.query_params.get("backdoor")
    error = request.query_params.get("error")
    
    if config.is_enabled and not is_backdoor and not error:
        # Check if SSO server is alive
        import requests
        try:
            requests.head(config.server_url, timeout=1.0)
            # SSO active & no backdoor -> Redirect to CentralAuth SSO jump endpoint
            jump_url = f"{config.server_url.rstrip('/')}/api/auth/jump/{config.client_id}"
            return RedirectResponse(url=jump_url, status_code=303)
        except requests.RequestException:
            logger.warning(f"SSO Server {config.server_url} is unreachable. Falling back to local login.")
            pass # Fallback to local login

    
    # Otherwise, serve the SPA index.html so React Router handles the route
    base_dir = os.path.abspath(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
    dist_folder = os.path.join(base_dir, 'core', 'static', 'dist')
    index_path = os.path.join(dist_folder, "index.html")
    if os.path.exists(index_path):
        from fastapi.responses import FileResponse
        return FileResponse(index_path)
    
    return RedirectResponse(url="/")

# Standard configuration APIs
@router.get("/api/sso/config")
def get_sso_config(db: Session = Depends(get_db)):
    """API for the sub-project's Admin Panel to show current settings."""
    config = SSOService.get_config(db)
    result = config.to_dict()
    
    if result.get("is_enabled") and result.get("server_url"):
        import requests
        try:
            requests.head(result["server_url"], timeout=1.0)
        except requests.RequestException:
            logger.warning(f"SSO Server {result['server_url']} is unreachable. Disabling SSO in frontend.")
            result["is_enabled"] = False
            
    return result

@router.post("/api/sso/config")
def update_sso_config(data: dict, db: Session = Depends(get_db)):
    """API for the sub-project's Admin Panel to toggle SSO and update settings."""
    config = SSOService.get_config(db)
    config.is_enabled = data.get("is_enabled", config.is_enabled)
    config.server_url = data.get("server_url", config.server_url)
    config.client_id = data.get("client_id", config.client_id)
    config.client_secret = data.get("client_secret", config.client_secret)
    db.commit()
    return {"success": True, "config": config.to_dict()}

# Standard callback for CentralAuth
@router.get("/auth-center/callback")
async def sso_callback(request: Request, response: Response, code: Optional[str] = None, db: Session = Depends(get_db)):
    """Standardized callback for CentralAuth."""
    if not code:
        logger.error("SSO callback called without code parameter")
        return RedirectResponse(url="/login?backdoor=1&error=Missing+authorization+code", status_code=303)
    
    try:
        user_data, error = await SSOService.verify_sso_code(db, code)
    except Exception as e:
        logger.error(f"SSO verification exception: {e}")
        return RedirectResponse(url="/login?backdoor=1&error=SSO+service+error", status_code=303)
        
    if error:
        logger.error(f"SSO verification error: {error}")
        return RedirectResponse(url=f"/login?backdoor=1&error={error}", status_code=303)
    
    if not user_data:
        return RedirectResponse(url="/login?backdoor=1&error=No+user+data+returned", status_code=303)
    
    from app.modules.identity.models import User
    
    sso_id = str(user_data.get("id"))
    username = user_data.get("username")
    email = user_data.get("email")
    password_hash = user_data.get("password_hash")
    
    # 1. Try to find by central_auth_id
    user = db.query(User).filter(User.central_auth_id == sso_id).first()
    
    if not user:
        # 2. Try to find by email
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.central_auth_id = sso_id
        else:
            # 3. Create new shadow record user
            user = User(
                username=username,
                email=email,
                full_name=username,
                central_auth_id=sso_id,
                role='free' # default role
            )
            # Werkzeug checks will use password_hash if synced, but generate a fallback local password too
            import uuid
            user.set_password(str(uuid.uuid4()))
            db.add(user)
    
    # Sync password hash from CentralAuth
    if password_hash:
        user.password_hash = password_hash
        
    db.commit()
    db.refresh(user)
    
    logger.info(f"SSO login success for user: {user.username} (id={user.id})")
    
    # Generate local JWT session tokens
    from app.core.security import create_access_token, create_refresh_token
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    # Redirect to modern React frontend callback url with JWT tokens in fragment
    frontend_url = settings.FRONTEND_URL or f"{request.url.scheme}://{request.url.netloc}"
    callback_redirect_url = f"{frontend_url}/auth/callback#access_token={access_token}&refresh_token={refresh_token}"
    if 'mindstack.click' in callback_redirect_url:
        callback_redirect_url = callback_redirect_url.replace('http://', 'https://')
        
    res = RedirectResponse(url=callback_redirect_url, status_code=303)
    from app.modules.sso_module.cookie_signer import sign_cookie
    signed_id = sign_cookie(str(user.id), settings.SECRET_KEY)
    res.set_cookie(key="user_id", value=signed_id, httponly=True, path="/", samesite="lax", max_age=1800)
    return res

# Global Logout Endpoint
@router.get("/logout")
def logout(request: Request, db: Session = Depends(get_db)):
    """Logs the user out of the local cookie session and CentralAuth SSO globally."""
    config = SSOService.get_config(db)
    local_only = request.query_params.get("local_only") == "1"
    
    if config.is_enabled and not local_only:
        # Logout globally from CentralAuth
        ca_logout_url = f"{config.server_url.rstrip('/')}/api/auth/logout"
        res = RedirectResponse(url=ca_logout_url, status_code=303)
    else:
        res = RedirectResponse(url="/login", status_code=303)
        
    res.delete_cookie("user_id", path="/")
    return res

from pydantic import BaseModel

class HandshakeRequest(BaseModel):
    client_id: str
    client_secret: str

@router.post("/api/admin/sso/handshake")
def sso_handshake(req: HandshakeRequest, db: Session = Depends(get_db)):
    """Dynamic DB discovery endpoint for CentralAuth Hub."""
    config = SSOService.get_config(db)
    
    # Fallback to config settings if DB values aren't set
    from app.core.config import settings
    expected_client_id = config.client_id or settings.CENTRAL_AUTH_CLIENT_ID
    expected_client_secret = config.client_secret or settings.CENTRAL_AUTH_CLIENT_SECRET
    
    if expected_client_id != req.client_id:
        raise HTTPException(status_code=401, detail="Client ID mismatch")
        
    if expected_client_secret != req.client_secret:
        raise HTTPException(status_code=401, detail="Client Secret mismatch")
        
    # Get absolute DB path
    db_url = settings.DATABASE_URL
    import os
    # SQLite prefix cleanup
    db_path = db_url.split("///")[-1] if "///" in db_url else db_url
    if not os.path.isabs(db_path):
        project_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        db_path = os.path.abspath(os.path.join(project_root, db_path))
        
    return {
        "success": True,
        "db_path": db_path
    }
