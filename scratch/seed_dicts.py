
import os
from app import create_app
from app.core.extensions import db
from app.modules.study.models import VideoDictionary

def seed_dictionaries():
    app = create_app()
    with app.app_context():
        # 1. Rename offline files
        db_dir = 'dictionaries/database'
        rename_map = {
            'jamdict.db': '[ja-en] jamdict.db',
            'javidict.db': '[ja-vi] javidict.db',
            'mazii_offline.db': '[ja-vi] mazii_offline.db',
            'suge.db': '[ja-vi] suge.db'
        }
        
        for old, new in rename_map.items():
            old_path = os.path.join(db_dir, old)
            new_path = os.path.join(db_dir, new)
            if os.path.exists(old_path) and not os.path.exists(new_path):
                os.rename(old_path, new_path)
                print(f"Renamed {old} to {new}")

        # 2. Seed system dictionaries (JSON based, starting with 1. for priority)
        pairs = [
            ('ja', 'vi', '1. Japanese-Vietnamese'),
            ('ja', 'en', '1. Japanese-English'),
            ('cn', 'vi', '1. Chinese-Vietnamese'),
            ('en', 'vi', '1. English-Vietnamese'),
        ]
        
        for src, target, name in pairs:
            # Check if exists
            existing = VideoDictionary.query.filter_by(name=name, language_code=src, target_language_code=target, lesson_id=None).first()
            if not existing:
                new_dict = VideoDictionary(
                    name=name,
                    language_code=src,
                    target_language_code=target,
                    lesson_id=None,
                    is_active=True
                )
                db.session.add(new_dict)
                print(f"Created system dictionary: {name}")
        
        db.session.commit()
        print("Seeding complete.")

if __name__ == '__main__':
    seed_dictionaries()
