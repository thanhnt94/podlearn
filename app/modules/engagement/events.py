from app.core.database import SessionLocal
from app.modules.engagement.services.streak_service import StreakService
from app.modules.engagement.services.gamification_service import GamificationService
from app.modules.engagement.models import ActivityLog, ShadowingHistory
from app.modules.identity.models import User
import logging

logger = logging.getLogger(__name__)

def handle_study_time_tracked(user_id: int, seconds: int, activity_type: str = 'LISTEN_PODCAST', metric_value: int = 0, reference_id: int = None):
    with SessionLocal() as db:
        user = db.query(User).get(user_id)
        if user:
            logger.info(f"[EVENT] Recording activity for user {user_id}: {activity_type} ({seconds}s)")
            
            # Record Activity Log
            log = ActivityLog(
                user_id=user_id,
                activity_type=activity_type,
                duration_seconds=seconds,
                metric_value=metric_value,
                reference_id=reference_id
            )
            db.add(log)
            
            # Update user totals
            if activity_type == 'LISTEN_PODCAST':
                user.total_listening_seconds = (user.total_listening_seconds or 0) + seconds
            elif activity_type == 'SHADOWING_PRACTICE':
                user.total_shadowing_count = (user.total_shadowing_count or 0) + metric_value
            
            # Update streak logic
            StreakService.update_streak(user_id)
            
            # Check for badges
            GamificationService.check_and_award_badges(user)
            db.commit()

def handle_lesson_completed(user_id: int, lesson_id: int):
    with SessionLocal() as db:
        user = db.query(User).get(user_id)
        if user:
            logger.info(f"[EVENT] Lesson completed for user {user_id}")
            GamificationService.check_and_award_badges(user)
            db.commit()

def handle_shadowing_completed(user_id: int, video_id: int, lesson_id: int, sentence_id: int, original_text: str, spoken_text: str, accuracy_score: int, start_time: float = 0.0, end_time: float = 0.0):
    with SessionLocal() as db:
        history = ShadowingHistory(
            user_id=user_id,
            video_id=video_id,
            lesson_id=lesson_id,
            sentence_id=sentence_id,
            start_time=start_time,
            end_time=end_time,
            original_text=original_text,
            spoken_text=spoken_text,
            accuracy_score=accuracy_score
        )
        db.add(history)
        
        user = db.query(User).get(user_id)
        if user:
            GamificationService.check_and_award_badges(user)
        db.commit()
        logger.info(f"[EVENT] Shadowing history saved for user {user_id}")
