from datetime import datetime, date, timedelta, timezone
from app.core.extensions import db
from app.modules.identity.models import User
from app.modules.engagement.models import ActivityLog
from sqlalchemy import func
from ..exceptions import EngagementError

STREAK_FREEZE_COST = 500 # EXP cost to buy a freeze

class StreakService:
    @staticmethod
    def buy_streak_freeze(user_id):
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

    @staticmethod
    def update_streak(user_id):
        """
        Updates the user's streak based on their activity.
        Ensures a minimum threshold of 5 minutes (300 seconds) of activity today.
        """
        user = User.query.get(user_id)
        if not user:
            return
            
        today = datetime.now(timezone.utc).date()
        if user.last_study_date == today:
            return
            
        # Calculate total duration accumulated today
        today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
        total_duration = db.session.query(func.sum(ActivityLog.duration_seconds)).filter(
            ActivityLog.user_id == user_id,
            ActivityLog.created_at >= today_start
        ).scalar() or 0
        
        if total_duration < 300:
            return # Threshold not met yet
            
        yesterday = today - timedelta(days=1)
        
        if user.last_study_date == yesterday:
            user.current_streak = (user.current_streak or 0) + 1
        else:
            # Check for streak freeze logic
            if getattr(user, 'streak_freezes', 0) > 0:
                user.streak_freezes -= 1
                user.current_streak = (user.current_streak or 0) + 1 # Maintain/Resume streak
            else:
                user.current_streak = 1
        
        user.last_study_date = today
        if user.current_streak > (user.longest_streak or 0):
            user.longest_streak = user.current_streak
            
        db.session.commit()
