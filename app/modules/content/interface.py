def get_video(video_id):
    from .services.video_service import get_video_by_id
    return get_video_by_id(video_id)
