
import sqlite3, os

db_path = '../Storage/database/PodLearn.db'
if not os.path.isabs(db_path):
    db_path = os.path.abspath(os.path.join(os.getcwd(), db_path))

conn = sqlite3.connect(db_path)
cursor = conn.cursor()

try:
    # 1. Check existing columns
    cursor.execute("PRAGMA table_info(video_dictionaries)")
    cols = [c[1] for c in cursor.fetchall()]
    
    # 2. Rename old table
    cursor.execute("ALTER TABLE video_dictionaries RENAME TO _old_video_dictionaries")
    
    # 3. Create new table with nullable lesson_id
    cursor.execute("""
        CREATE TABLE video_dictionaries (
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
    
    # 4. Copy data back
    # Build the column list that exists in the old table
    existing_cols = []
    if 'id' in cols: existing_cols.append('id')
    if 'lesson_id' in cols: existing_cols.append('lesson_id')
    if 'name' in cols: existing_cols.append('name')
    if 'is_active' in cols: existing_cols.append('is_active')
    if 'created_at' in cols: existing_cols.append('created_at')
    
    col_str = ", ".join(existing_cols)
    cursor.execute(f"INSERT INTO video_dictionaries ({col_str}) SELECT {col_str} FROM _old_video_dictionaries")
    
    # 5. Drop old table
    cursor.execute("DROP TABLE _old_video_dictionaries")
    
    conn.commit()
    print("Table recreated successfully.")
except Exception as e:
    conn.rollback()
    print(f"Recreate failed: {e}")

conn.close()
