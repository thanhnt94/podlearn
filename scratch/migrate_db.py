
import sqlite3, os

db_path = '../Storage/database/PodLearn.db'
if not os.path.isabs(db_path):
    db_path = os.path.abspath(os.path.join(os.getcwd(), db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    cursor.execute("ALTER TABLE video_dictionaries ADD COLUMN language_code VARCHAR(10) DEFAULT 'ja'")
    cursor.execute("ALTER TABLE video_dictionaries ADD COLUMN target_language_code VARCHAR(10) DEFAULT 'vi'")
    conn.commit()
    print("Migration successful.")
except Exception as e:
    print(f"Migration failed or already applied: {e}")

conn.close()
