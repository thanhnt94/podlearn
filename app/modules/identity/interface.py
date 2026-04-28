from .services.user_service import get_user_by_id

def get_user(user_id):
    return get_user_by_id(user_id)
