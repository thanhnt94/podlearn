from datetime import datetime, timezone, date, timedelta
from app.core.database import SessionLocal

def update_study_progress_and_streak(db, user, lesson, seconds_added):
    """
    Update time spent on a lesson and handle Streak logic for the user.
    """
    # 1. Update Lesson stats
    lesson.time_spent += int(seconds_added)
    lesson.last_accessed = datetime.now(timezone.utc)

    # 2. Gamification: Study Streak
    today = date.today()
    
    if seconds_added > 0: # Only count if they actually studied
        if user.last_study_date is None:
            # First time ever
            user.current_streak = 1
            user.last_study_date = today
        else:
            if user.last_study_date == today:
                # Already studied today, do nothing to streak
                pass
            elif user.last_study_date == today - timedelta(days=1):
                # Studied yesterday! Increase streak
                user.current_streak += 1
                user.last_study_date = today
            else:
                # Gap in study, reset streak to 1
                user.current_streak = 1
                user.last_study_date = today
        
        # Update longest streak
        cur = user.current_streak or 0
        lng = user.longest_streak or 0
        if cur > lng:
            user.longest_streak = cur

    db.commit()
    return {
        'current_streak': user.current_streak or 0,
        'longest_streak': user.longest_streak or 0
    }

def get_user_stats(user_id):
    """
    Get study statistics for a specific user.
    """
    from app.modules.identity.models import User
    from app.modules.study.models import Lesson
    
    with SessionLocal() as db:
        user = db.get(User, user_id)
        if not user:
            return {}
        
        completed_count = db.query(Lesson).filter_by(user_id=user_id, is_completed=True).count()
        total_lessons = db.query(Lesson).filter_by(user_id=user_id).count()
        
        return {
            'current_streak': user.current_streak or 0,
            'longest_streak': user.longest_streak or 0,
            'completed_count': completed_count,
            'total_lessons': total_lessons
        }
