from .models import Video
from .exceptions import VideoNotFoundError
from app.core.extensions import db

def get_video_by_id(video_id):
    video = Video.query.get(video_id)
    if not video:
        raise VideoNotFoundError(f"Video {video_id} not found")
    return video

