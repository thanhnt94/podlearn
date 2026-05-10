from celery import shared_task
import logging
from datetime import datetime, timezone, date, timedelta

from app.core.database import SessionLocal
from .models import AIInsightTrack, Sentence, Lesson
from app.modules.identity.models import User
from app.modules.engagement.events import handle_study_time_tracked, handle_lesson_completed

logger = logging.getLogger(__name__)

@shared_task(queue='podlearn_tasks')
def generate_tts_background(sentence_id: int):
    # This task will call the TTS service logic
    from app.modules.content.services.tts_service import GoogleTTSProvider
    with SessionLocal() as db:
        try:
            sentence = db.query(Sentence).get(sentence_id)
            if not sentence or sentence.audio_url:
                return
                
            provider = GoogleTTSProvider()
            # Logic here...
        except Exception as e:
            logger.error(f"TTS generation failed for {sentence_id}: {e}")

@shared_task(queue='podlearn_tasks')
def batch_generate_ai_insights_task():
    """
    Cronjob task to automatically generate AI insights for pending tracks.
    """
    from app.modules.content.services.ai_service import AIService
    
    with SessionLocal() as db:
        # Process up to 5 pending tracks per batch
        pending_tracks = db.query(AIInsightTrack).filter_by(status='pending').limit(5).all()
        for track in pending_tracks:
            try:
                logger.info(f"Batch generating AI insight for track {track.id}")
                AIService.generate_insights(track.id)
                track.status = 'completed'
            except Exception as e:
                logger.error(f"Failed AI batch generation for track {track.id}: {e}")
                track.status = 'failed'
            
            db.commit()

def run_process_tracking_data(user_id: int, lesson_id: int, listening_seconds: int, shadowing_count: int, shadowing_seconds: int):
    """Internal logic for processing tracking data, shared between Celery and BackgroundTasks."""
    # 1. Update Lesson Stats (Local to Study module)
    with SessionLocal() as db:
        try:
            if lesson_id:
                lesson = db.query(Lesson).get(lesson_id)
                if lesson and lesson.user_id == user_id:
                    lesson.time_spent = (lesson.time_spent or 0) + listening_seconds
                    db.commit()
        except Exception as e:
            logger.error(f"Failed to update lesson stats: {e}")

    # 2. Trigger Cross-Module Events
    if listening_seconds > 0:
        handle_study_time_tracked(
            user_id=user_id, 
            seconds=listening_seconds, 
            activity_type='LISTEN_PODCAST', 
            reference_id=lesson_id
        )
        
    if shadowing_count > 0:
        handle_study_time_tracked(
            user_id=user_id, 
            seconds=shadowing_seconds, 
            activity_type='SHADOWING_PRACTICE', 
            metric_value=shadowing_count, 
            reference_id=lesson_id
        )

@shared_task(queue='podlearn_tasks')
def process_tracking_data_task(user_id: int, lesson_id: int, listening_seconds: int, shadowing_count: int, shadowing_seconds: int):
    run_process_tracking_data(user_id, lesson_id, listening_seconds, shadowing_count, shadowing_seconds)
