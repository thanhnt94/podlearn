from .services.streak_service import update_streak
from .services.gamification_service import sync_all_users_scores

def extend_user_streak(user_id):
    return update_streak(user_id)

def sync_scores():
    return sync_all_users_scores()
