import sys
import os
# Make sure we can import 'app' from current directory
sys.path.append(r'c:\Code\PodLearn\podlearn')
from app import create_app
from app.extensions import db
from app.models.subtitle import SubtitleTrack
from app.models.video import Video

app = create_app()
with app.app_context():
    tracks = SubtitleTrack.query.all()
    print(f"Total Subtitle Tracks: {len(tracks)}")
    for t in tracks:
        print(f"ID: {t.id}, VideoID: {t.video_id}, Lang: {t.language_code}, Lines: {len(t.content_json) if t.content_json else 0}")
    
    videos = Video.query.all()
    print(f"Total Videos: {len(videos)}")
    for v in videos:
        print(f"V-ID: {v.id}, YT-ID: {v.youtube_id}, Title: {v.title}")
