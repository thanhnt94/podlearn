from celery import shared_task
from app.extensions import db
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
