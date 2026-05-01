from app.modules.identity.models import User
from typing import Dict, Any, Optional

def get_user_dto(user_id: int) -> Optional[Dict[str, Any]]:
    """Fetches user data and returns it as a domain-agnostic DTO."""
    user = User.query.get(user_id)
    if not user:
        return None
    
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "role": user.role,
        "full_name": getattr(user, 'full_name', user.username),
        "preferences": user.preferences_json
    }

def get_user_by_email_dto(email: str) -> Optional[Dict[str, Any]]:
    user = User.query.filter_by(email=email).first()
    if not user:
        return None
    return get_user_dto(user.id)

def get_user_by_username_dto(username: str) -> Optional[Dict[str, Any]]:
    user = User.query.filter_by(username=username).first()
    if not user:
        return None
    return get_user_dto(user.id)
