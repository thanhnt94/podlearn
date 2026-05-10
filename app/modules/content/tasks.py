from celery import shared_task
import logging
from app.core.database import SessionLocal

logger = logging.getLogger(__name__)

@shared_task(queue='podlearn_tasks')
def fetch_youtube_subtitle_background(track_id: int, youtube_id: str, language_code: str, is_auto: bool = False):
    from app.modules.content.services.subtitle_service import download_and_parse_youtube_sub
    from .models import SubtitleTrack
    
    with SessionLocal() as db:
        track = db.get(SubtitleTrack, track_id)
        if not track:
            logger.error(f"SubtitleTrack {track_id} not found.")
            return {"status": "error", "message": "Track not found in DB"}
            
        track.status = "processing"
        db.commit()
        
        try:
            res = download_and_parse_youtube_sub(youtube_id, language_code, is_auto=is_auto)
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
                
            db.commit()
            return {"status": track.status, "lines_count": len(entries) if entries else 0}
        except Exception as e:
            db.rollback()
            track.status = "failed"
            track.note = str(e)
            db.commit()
            return {"status": "error", "message": str(e)}

@shared_task(queue='podlearn_tasks')
def process_video_metadata(video_id_int: int):
    """Background task to fetch YouTube metadata and initial subtitles."""
    from .models import Video
    from .services.youtube_service import fetch_video_info
    
    with SessionLocal() as db:
        video = db.get(Video, video_id_int)
        if not video:
            logger.error(f"Task failed: Video ID {video_id_int} not found in database.")
            return {"error": "Video not found"}

        try:
            logger.info(f"Starting metadata processing for video {video_id_int} (YT: {video.youtube_id})")
            video.status = 'processing'
            db.commit()

            # 1. Fetch metadata (title, duration, etc.)
            logger.info(f"Fetching info from YouTube for {video.youtube_id}...")
            info = fetch_video_info(video.youtube_id)
            if info:
                logger.info(f"Successfully fetched info: {info.title}")
                video.title = info.title
                video.thumbnail_url = info.thumbnail_url
                video.duration_seconds = info.duration_seconds
                video.channel_title = info.channel_title
                video.channel_id = info.channel_id
                video.description = info.description
                db.commit()
            else:
                logger.error(f"Failed to fetch metadata for {video.youtube_id}")
                video.status = 'failed'
                db.commit()
                return {"error": "Failed to fetch metadata"}

            # Mark as completed
            video.status = 'completed'
            db.commit()
            logger.info(f"Video {video_id_int} processing COMPLETED.")
            return {"status": "success", "video_id": video.id}

        except Exception as e:
            logger.exception(f"Unexpected error processing video {video_id_int}: {e}")
            video.status = 'failed'
            db.commit()
            return {"error": str(e)}

