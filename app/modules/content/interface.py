from .services.ai_service import analyze_single_line, generate_video_summary
from .services.youtube_service import get_video_metadata

def get_video_info(video_url):
    return get_video_metadata(video_url)

def get_ai_insight(track_id, index, text):
    return analyze_single_line(track_id, index, text)

def get_summary(transcript):
    return generate_video_summary(transcript)
