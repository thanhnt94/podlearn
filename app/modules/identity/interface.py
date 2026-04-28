from .services.user_service import get_user_by_id, get_user_by_email
from .services.auth_service import authenticate

def get_user(user_id):
    return get_user_by_id(user_id)

def get_user_by_email_address(email):
    return get_user_by_email(email)

def login_user(email, password):
    return authenticate(email, password)
