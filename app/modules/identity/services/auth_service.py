from app.modules.identity.models import User
from ..exceptions import InvalidCredentialsError
from app.core.database import SessionLocal

def authenticate(username_or_email, password):
    with SessionLocal() as db:
        user = db.query(User).filter((User.username == username_or_email) | (User.email == username_or_email)).first()
        if not user or not user.check_password(password):
            raise InvalidCredentialsError("Invalid username or password")
        
        # We need to refresh/expunge if we want to use the object outside the session
        # but for authenticate it's usually used for immediate token generation.
        db.expunge_all() 
        return user

