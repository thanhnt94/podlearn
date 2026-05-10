from fastapi import Depends, HTTPException, status
from app.core.security import get_current_user
from app.modules.identity.models import User

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_admin", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user

async def require_vip(current_user: User = Depends(get_current_user)) -> User:
    if not getattr(current_user, "is_at_least_vip", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="VIP access required"
        )
    return current_user
