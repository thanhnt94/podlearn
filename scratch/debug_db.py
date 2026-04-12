from app import create_app
from app.models.lesson import Lesson
from app.models.user import User
from app.models.video import Video

app = create_app()
with app.app_context():
    print("--- PODLEARN DATABASE DIAGNOSTIC ---")
    
    users = User.query.all()
    print(f"Total Users: {len(users)}")
    for u in users:
        u_lessons = Lesson.query.filter_by(user_id=u.id).all()
        print(f"User: {u.username} (ID: {u.id}) - Lessons: {len(u_lessons)}")
        for l in u_lessons:
            print(f"  - Lesson ID: {l.id}, Video: {l.video.title if l.video else 'MISSING VIDEO'}")
            
    orphaned_lessons = Lesson.query.filter(Lesson.user_id == None).all()
    if orphaned_lessons:
        print(f"CRITICAL: Found {len(orphaned_lessons)} orphaned lessons (no user_id)!")
    
    public_videos = Video.query.filter_by(visibility='public').all()
    print(f"Public Videos (Explore): {len(public_videos)}")
    
    print("--- DIAGNOSTIC COMPLETE ---")
