from .models import Video
from .exceptions import VideoNotFoundError
from app.core.database import SessionLocal

def get_video_by_id(video_id):
    with SessionLocal() as db:
        video = db.get(Video, video_id)
        if not video:
            raise VideoNotFoundError(f"Video {video_id} not found")
        db.expunge_all()
        return video

