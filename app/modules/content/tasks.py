from celery import shared_task
from app.extensions import db
from .models import SubtitleTrack
import logging

logger = logging.getLogger(__name__)

@shared_task(queue='podlearn_tasks')
def fetch_youtube_subtitle_background(video_id_db: int, youtube_id: str, language_code: str):
    from app.modules.content.services.subtitle_service import download_and_parse_youtube_sub
    
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
@shared_task(queue='podlearn_tasks')
def process_video_metadata(video_id_int: int):
    """Background task to fetch YouTube metadata and initial subtitles."""
    from .models import Video
    from .services.youtube_service import fetch_video_info
    from .services.subtitle_service import get_subtitle_track
    
    video = db.session.get(Video, video_id_int)
    if not video:
        logger.error(f"Task failed: Video ID {video_id_int} not found in database.")
        return {"error": "Video not found"}

    try:
        logger.info(f"Starting metadata processing for video {video_id_int} (YT: {video.youtube_id})")
        video.status = 'processing'
        db.session.commit()

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
            db.session.commit()
        else:
            logger.error(f"Failed to fetch metadata for {video.youtube_id}")
            video.status = 'failed'
            db.session.commit()
            return {"error": "Failed to fetch metadata"}

        # 2. Fetch initial subtitles
        logger.info(f"Fetching initial subtitles for language {video.language_code}...")
        track = get_subtitle_track(video.id, video.youtube_id, video.language_code)
        if track:
            logger.info(f"Subtitles fetched: {track.name}")
        else:
            logger.warning(f"No subtitles found for {video.language_code}")

        # Mark as completed
        video.status = 'completed'
        db.session.commit()
        logger.info(f"Video {video_id_int} processing COMPLETED.")
        return {"status": "success", "video_id": video.id}

    except Exception as e:
        logger.exception(f"Unexpected error processing video {video_id_int}: {e}")
        video.status = 'failed'
        db.session.commit()
        return {"error": str(e)}
