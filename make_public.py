import sys
import os

from app.core.database import SessionLocal
from app.modules.content.models import Video

def run():
    print("Bulk updating existing videos to 'public'...")
    with SessionLocal() as db:
        videos = db.query(Video).filter(Video.visibility != 'public').all()
        count = 0
        for v in videos:
            v.visibility = 'public'
            count += 1
        db.commit()
        print(f"Successfully updated {count} videos to public.")

if __name__ == '__main__':
    run()
