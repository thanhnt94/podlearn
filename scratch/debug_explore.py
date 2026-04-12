from app import create_app
from app.models.video import Video
from app.models.lesson import Lesson

app = create_app()
with app.app_context():
    print("--- EXPLORE DATA DIAGNOSTIC ---")
    
    total_videos = Video.query.count()
    public_videos = Video.query.filter_by(visibility='public').all()
    private_videos = Video.query.filter_by(visibility='private').all()
    
    print(f"Total Videos in DB: {total_videos}")
    print(f"Public Videos: {len(public_videos)}")
    print(f"Private Videos: {len(private_videos)}")
    
    for v in public_videos[:5]:
        print(f"  - Public Video: {v.title} (ID: {v.id})")
        
    print("--- DIAGNOSTIC COMPLETE ---")
