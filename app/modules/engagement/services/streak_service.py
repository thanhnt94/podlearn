from datetime import datetime, date, timedelta, timezone
from app.extensions import db
from app.modules.identity.models import User
from ..exceptions import EngagementError

STREAK_FREEZE_COST = 500 # EXP cost to buy a freeze

def buy_streak_freeze(user_id):
    """
    Allows a user to buy a 'Streak Freeze' using their EXP.
    This would typically be stored as an item in the user's inventory or a specific field.
    For now, we'll implement the logic to check EXP and deduct it.
    """
    user = User.query.get(user_id)
    if not user:
        raise EngagementError("User not found")
        
    if user.total_exp < STREAK_FREEZE_COST:
        raise EngagementError(f"Insufficient EXP. Need {STREAK_FREEZE_COST}, have {user.total_exp}")
        
    user.total_exp -= STREAK_FREEZE_COST
    user.streak_freezes += 1
    
    db.session.commit()
    return {
        "message": "Streak Freeze purchased!", 
        "remaining_exp": user.total_exp,
        "total_freezes": user.streak_freezes
    }

def update_streak(user_id):
    """
    Updates the user's streak based on their activity.
    """
    user = User.query.get(user_id)
    if not user:
        return
        
    today = date.today()
    if user.last_study_date == today:
        return
        
    if user.last_study_date == today - timedelta(days=1):
        user.current_streak += 1
    else:
        # Check for streak freeze logic
        if user.streak_freezes > 0:
            user.streak_freezes -= 1
            user.current_streak += 1 # Maintain streak
            # In a production app, you might want to log that a freeze was used
        else:
            user.current_streak = 1
        
    user.last_study_date = today
    if user.current_streak > user.longest_streak:
        user.longest_streak = user.current_streak
        
    db.session.commit()
