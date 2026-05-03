import os
import sqlite3
import logging

logger = logging.getLogger(__name__)

def migrate_flashcards(db_path):
    """
    Manually migrate video_glossaries table to the new Front/Back structure.
    Ensures all necessary columns exist.
    """
    if not os.path.exists(db_path):
        logger.warning(f"Database not found at {db_path}, skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # 0. Ensure video_dictionaries table exists
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS video_dictionaries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                lesson_id INTEGER,
                name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT 1,
                created_at DATETIME,
                language_code VARCHAR(10) DEFAULT 'ja',
                target_language_code VARCHAR(10) DEFAULT 'vi',
                FOREIGN KEY(lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
            )
        """)

        # 1. Check current columns in video_glossaries
        cursor.execute("PRAGMA table_info(video_glossaries)")
        columns = [row[1] for row in cursor.fetchall()]
        
        # 2. Add/Rename columns
        print("Checking VideoGlossary columns...")
        
        # Rename term -> front if term exists
        if 'term' in columns and 'front' not in columns:
            try:
                cursor.execute("ALTER TABLE video_glossaries RENAME COLUMN term TO front")
                print(" Renamed term to front")
            except:
                cursor.execute("ALTER TABLE video_glossaries ADD COLUMN front TEXT")
                cursor.execute("UPDATE video_glossaries SET front = term")
                print(" Added front column and copied from term")

        # Rename definition -> back if definition exists
        if 'definition' in columns and 'back' not in columns:
            try:
                cursor.execute("ALTER TABLE video_glossaries RENAME COLUMN definition TO back")
                print(" Renamed definition to back")
            except:
                cursor.execute("ALTER TABLE video_glossaries ADD COLUMN back TEXT")
                cursor.execute("UPDATE video_glossaries SET back = definition")
                print(" Added back column and copied from definition")

        # Ensure essential columns exist
        missing_columns = {
            'front': 'TEXT',
            'back': 'TEXT',
            'dictionary_id': 'INTEGER',
            'reading': 'VARCHAR(255)',
            'source': 'VARCHAR(20)',
            'frequency': 'INTEGER',
            'last_updated_by': 'INTEGER',
            'updated_at': 'DATETIME',
            'language_code': 'VARCHAR(10)',
            'target_language_code': 'VARCHAR(10)',
            'extra_data': 'JSON'
        }

        for col, col_type in missing_columns.items():
            if col not in columns and col != 'front' and col != 'back': # already handled rename above
                cursor.execute(f"ALTER TABLE video_glossaries ADD COLUMN {col} {col_type}")
                print(f" Added missing column: {col}")

        conn.commit()
        print(" Database migration successful.")
        
    except Exception as e:
        conn.rollback()
        print(f" [!] Database migration failed: {e}")
        logger.error(f"Migration error: {e}")
    finally:
        conn.close()

if __name__ == "__main__":
    # Test path
    base_dir = os.path.dirname(os.path.abspath(__file__))
    # Path from app/modules/study/migrations to root/../Storage/database/podlearn.db
    # migrations -> study -> modules -> app -> PodLearn -> root (Ecosystem)
    db_path = os.path.abspath(os.path.join(base_dir, '..', '..', '..', '..', '..', 'Storage', 'database', 'podlearn.db'))
    migrate_flashcards(db_path)
