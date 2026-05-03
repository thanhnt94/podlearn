import os
import sqlite3
import logging

logger = logging.getLogger(__name__)

def migrate_flashcards(db_path):
    """
    Manually migrate video_glossaries table to the new Front/Back structure.
    Renames 'term' to 'front' and 'definition' to 'back'.
    """
    if not os.path.exists(db_path):
        logger.warning(f"Database not found at {db_path}, skipping migration.")
        return

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # Check current columns
        cursor.execute("PRAGMA table_info(video_glossaries)")
        columns = [row[1] for row in cursor.fetchall()]
        
        if 'front' in columns and 'back' in columns:
            logger.info("Database already migrated to Front/Back structure.")
            return

        print("Migrating Flashcard database to Front/Back structure...")
        
        # 1. Start Transaction
        cursor.execute("BEGIN TRANSACTION")
        
        # 2. Rename Columns (Requires SQLite 3.25.0+)
        # If this fails, we fall back to a manual copy approach
        try:
            if 'term' in columns and 'front' not in columns:
                cursor.execute("ALTER TABLE video_glossaries RENAME COLUMN term TO front")
            if 'definition' in columns and 'back' not in columns:
                cursor.execute("ALTER TABLE video_glossaries RENAME COLUMN definition TO back")
            
            # Update unique constraints if needed? 
            # SQLite doesn't automatically rename constraints in older versions, 
            # but usually it's fine for simple name changes.
            
        except sqlite3.OperationalError as e:
            print(f" [!] RENAME COLUMN failed, attempting manual migration: {e}")
            # Manual approach: Create new table, copy data, drop old, rename new
            # For simplicity in this script, we'll try to just ADD columns if RENAME failed
            if 'front' not in columns:
                cursor.execute("ALTER TABLE video_glossaries ADD COLUMN front TEXT")
                cursor.execute("UPDATE video_glossaries SET front = term")
            if 'back' not in columns:
                cursor.execute("ALTER TABLE video_glossaries ADD COLUMN back TEXT")
                cursor.execute("UPDATE video_glossaries SET back = definition")
        
        cursor.execute("COMMIT")
        print(" Database migration successful.")
        
    except Exception as e:
        cursor.execute("ROLLBACK")
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
