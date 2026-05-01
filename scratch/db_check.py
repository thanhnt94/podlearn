import sys
import os
sys.path.append(os.getcwd())
from app import create_app
from app.core.extensions import db
from app.modules.identity.models import User
from app.modules.study.models import Lesson
from app.modules.content.models import Video

app = create_app()
with app.app_context():
    users = User.query.all()
    print(f"Total Users: {len(users)}")
    for u in users:
        lessons = Lesson.query.filter_by(user_id=u.id).all()
        if len(lessons) > 0:
            print(f"User: {u.username} (ID: {u.id}) - Lessons: {len(lessons)}")
            for l in lessons:
                print(f"  - Lesson ID: {l.id}, Video ID: {l.video_id}")
    
    videos = Video.query.all()
    print(f"\nTotal Videos: {len(videos)}")
    for v in videos:
        print(f"  - Video ID: {v.id}, Visibility: {v.visibility}")
