from app.modules.identity.models import User
from ..exceptions import InvalidCredentialsError, UserNotFoundError
from app.core.extensions import db

def authenticate(username_or_email, password):
    user = User.query.filter((User.username == username_or_email) | (User.email == username_or_email)).first()
    if not user or not user.check_password(password):
        raise InvalidCredentialsError("Invalid username or password")
    return user

