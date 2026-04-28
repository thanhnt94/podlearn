from celery import shared_task
from app.extensions import db
from .models import SubtitleTrack
import logging

logger = logging.getLogger(__name__)

@shared_task(queue='podlearn_tasks')
def fetch_youtube_subtitle_background(video_id_db: int, youtube_id: str, language_code: str):
    from app.services.subtitle_service import download_and_parse_youtube_sub
    
    track = SubtitleTrack.query.filter_by(video_id=video_id_db, language_code=language_code).first()
    if not track:
        return {"status": "error", "message": "Track not found in DB"}
        
    track.status = "processing"
    db.session.commit()
    
    try:
        res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=True)
        if res.get('error'):
            # Fallback to manual
            res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=False)
            
        entries = res.get('lines')
        if entries:
            track.content_json = entries
            track.status = "completed"
        else:
            track.status = "failed"
            track.note = res.get("message", "No lines extracted")
            
        db.session.commit()
        return {"status": track.status, "lines_count": len(entries) if entries else 0}
    except Exception as e:
        db.session.rollback()
        track.status = "failed"
        track.note = str(e)
        db.session.commit()
        return {"status": "error", "message": str(e)}
