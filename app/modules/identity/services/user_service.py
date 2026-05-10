from app.modules.identity.models import User
from ..exceptions import UserNotFoundError
from app.core.database import SessionLocal

def get_user_by_id(user_id):
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user:
            raise UserNotFoundError(f"User {user_id} not found")
        db.expunge_all()
        return user

