from app.modules.study.signals import study_time_tracked, lesson_completed, shadowing_completed
from app.modules.engagement.services.streak_service import StreakService
from app.modules.engagement.services.gamification_service import GamificationService
from app.modules.engagement.models import ActivityLog, ShadowingHistory
from app.modules.identity.models import User
from app.core.extensions import db

@study_time_tracked.connect
def on_study_time_tracked(sender, **kwargs):
    user_id = kwargs.get('user_id')
    seconds = kwargs.get('seconds_added', 0)
    activity_type = kwargs.get('activity_type', 'LISTEN_PODCAST')
    metric_value = kwargs.get('metric_value', 0)
    
    user = User.query.get(user_id)
    if user:
        print(f"[EVENT] Recording activity for user {user_id}: {activity_type} ({seconds}s)")
        
        # Record Activity Log
        log = ActivityLog(
            user_id=user_id,
            activity_type=activity_type,
            duration_seconds=seconds,
            metric_value=metric_value
        )
        db.session.add(log)
        
        # Update user totals (these should probably be in identity.interface or events too, but keeping for now)
        if activity_type == 'LISTEN_PODCAST':
            user.total_listening_seconds = (user.total_listening_seconds or 0) + seconds
        elif activity_type == 'SHADOWING_PRACTICE':
            user.total_shadowing_count = (user.total_shadowing_count or 0) + metric_value
        
        # Update streak logic
        StreakService.update_streak(user_id)
        
        # Check for badges
        GamificationService.check_and_award_badges(user)
        db.session.commit()

@lesson_completed.connect
def on_lesson_completed(sender, **kwargs):
    user_id = kwargs.get('user_id')
    user = User.query.get(user_id)
    if user:
        print(f"[EVENT] Lesson completed for user {user_id}")
        GamificationService.check_and_award_badges(user)
        db.session.commit()

@shadowing_completed.connect
def on_shadowing_completed(sender, **kwargs):
    user_id = kwargs.get('user_id')
    history = ShadowingHistory(
        user_id=user_id,
        video_id=kwargs.get('video_id'),
        lesson_id=kwargs.get('lesson_id'),
        sentence_id=kwargs.get('sentence_id'),
        start_time=kwargs.get('start_time', 0.0),
        end_time=kwargs.get('end_time', 0.0),
        original_text=kwargs.get('original_text', ''),
        spoken_text=kwargs.get('spoken_text', ''),
        accuracy_score=kwargs.get('accuracy_score', 0)
    )
    db.session.add(history)
    
    user = User.query.get(user_id)
    if user:
        GamificationService.check_and_award_badges(user)
    db.session.commit()
    print(f"[EVENT] Shadowing history saved for user {user_id}")
