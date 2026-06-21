from app.core.database import SessionLocal
from app.modules.study.models import Lesson
from app.modules.content.models import Video
from sqlalchemy.orm import joinedload

def test():
    with SessionLocal() as db:
        try:
            # test 1
            lessons = db.query(Lesson).options(joinedload(Lesson.video).joinedload(Video.owner)).limit(1).all()
            print("Test 1 successful:", lessons)
        except Exception as e:
            print("Test 1 failed:", e)

if __name__ == '__main__':
    test()
