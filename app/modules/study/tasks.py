from celery import shared_task
from app.core.extensions import db
from .models import AIInsightTrack, Sentence
import logging

logger = logging.getLogger(__name__)

@shared_task(queue='podlearn_tasks')
def generate_tts_background(sentence_id: int):
    # This task will call the TTS service logic
    from app.modules.content.services.tts_service import GoogleTTSProvider
    try:
        sentence = Sentence.query.get(sentence_id)
        if not sentence or sentence.audio_url:
            return
            
        provider = GoogleTTSProvider()
        # This is pseudo-code for calling the provider, as actual logic might differ.
        # Assuming the tts_service provides a generate function:
        # audio_url = provider.synthesize(sentence.original_text, language="ja")
        # sentence.audio_url = audio_url
        # db.session.commit()
    except Exception as e:
        logger.error(f"TTS generation failed for {sentence_id}: {e}")

@shared_task(queue='podlearn_tasks')
def batch_generate_ai_insights():
    """
    Cronjob task to automatically generate AI insights for pending tracks.
    """
    from app.modules.content.services.ai_service import AIService
    
    # Process up to 5 pending tracks per batch
    pending_tracks = AIInsightTrack.query.filter_by(status='pending').limit(5).all()
    for track in pending_tracks:
        try:
            logger.info(f"Batch generating AI insight for track {track.id}")
            AIService.generate_insights(track.id)
            track.status = 'completed'
        except Exception as e:
            logger.error(f"Failed AI batch generation for track {track.id}: {e}")
            track.status = 'failed'
        
        db.session.commit()

@shared_task(queue='podlearn_tasks')
def process_tracking_data(user_id: int, lesson_id: int, listening_seconds: int, shadowing_count: int, shadowing_seconds: int):
    """
    Asynchronously process tracking data to avoid API bottlenecks.
    Updates lesson progress, user stats, activity logs, and streaks.
    """
    from app.modules.identity.models import User
    from app.modules.study.models import Lesson
    from app.modules.engagement.models import ActivityLog
    from datetime import datetime, timezone, date, timedelta
    
    try:
        user = User.query.get(user_id)
        if not user:
            return
            
        # 1. Update Lesson Stats
        if lesson_id:
            lesson = Lesson.query.get(lesson_id)
            if lesson and lesson.user_id == user_id:
                lesson.time_spent = (lesson.time_spent or 0) + listening_seconds
        
        # 2. Update User Global Stats
        user.total_listening_seconds = (user.total_listening_seconds or 0) + listening_seconds
        user.total_shadowing_count = (user.total_shadowing_count or 0) + shadowing_count
        
        # 3. Handle Streak & Last Study Date
        today = date.today()
        if user.last_study_date != today:
            # If studied yesterday, increment streak. If missed more than a day, reset.
            yesterday = today - timedelta(days=1)
            if user.last_study_date == yesterday:
                user.current_streak = (user.current_streak or 0) + 1
            else:
                user.current_streak = 1
            user.last_study_date = today
            if (user.current_streak or 0) > (user.longest_streak or 0):
                user.longest_streak = user.current_streak

        # 4. Record Activity Logs
        if listening_seconds > 0:
            log = ActivityLog(
                user_id=user_id,
                activity_type='LISTEN_PODCAST',
                duration_seconds=listening_seconds,
                reference_id=lesson_id
            )
            db.session.add(log)
            
        if shadowing_count > 0:
            log = ActivityLog(
                user_id=user_id,
                activity_type='SHADOWING_PRACTICE',
                duration_seconds=shadowing_seconds,
                metric_value=shadowing_count,
                reference_id=lesson_id
            )
            db.session.add(log)
            
        db.session.commit()
        
        # 5. Check for Badges (Async trigger)
        from app.modules.engagement.services.gamification_service import GamificationService
        GamificationService.check_and_award_badges(user)
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to process tracking data for user {user_id}: {e}")
