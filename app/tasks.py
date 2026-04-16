
import logging
from .extensions import db
from .models.video import Video
from .services.youtube_service import fetch_video_info
from .services.subtitle_service import get_subtitle_track

logger = logging.getLogger(__name__)

def process_video_metadata(video_id_int: int):
    """Background task to fetch YouTube metadata and initial subtitles."""
    video = db.session.get(Video, video_id_int)
    if not video:
        return {"error": "Video not found"}

    try:
        video.status = 'processing'
        db.session.commit()

        # 1. Fetch metadata (title, duration, etc.)
        info = fetch_video_info(video.youtube_id)
        if info:
            video.title = info.title
            video.thumbnail_url = info.thumbnail_url
            video.duration_seconds = info.duration_seconds
            video.channel_title = info.channel_title
            video.channel_id = info.channel_id
            video.description = info.description
            db.session.commit()
        else:
            video.status = 'failed'
            db.session.commit()
            return {"error": "Failed to fetch metadata"}

        # Mark as completed
        video.status = 'completed'
        db.session.commit()
        return {"status": "success", "video_id": video.id}

    except Exception as e:
        logger.error(f"Error processing video {video_id_int}: {e}")
        video.status = 'failed'
        db.session.commit()
        return {"error": str(e)}
