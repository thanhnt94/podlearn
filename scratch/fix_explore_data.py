from app import create_app
from app.models.video import Video
from app import db

app = create_app()
with app.app_context():
    count = Video.query.update({Video.visibility: 'public'})
    db.session.commit()
    print(f"DEBUG_FIX: {count} videos updated to public.")
