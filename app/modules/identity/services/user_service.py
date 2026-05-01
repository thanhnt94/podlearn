from app.modules.identity.models import User
from ..exceptions import UserNotFoundError
from app.core.extensions import db

def get_user_by_id(user_id):
    user = User.query.get(user_id)
    if not user:
        raise UserNotFoundError(f"User {user_id} not found")
    return user

