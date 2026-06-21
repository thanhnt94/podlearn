import sqlite3
import os

db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'Storage', 'database', 'PodLearn.db'))

def migrate():
    print(f"Connecting to {db_path}")
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Check if category column exists
    cursor.execute("PRAGMA table_info(videos)")
    columns = [col[1] for col in cursor.fetchall()]
    
    if 'category' not in columns:
        print("Adding category column to videos table...")
        cursor.execute("ALTER TABLE videos ADD COLUMN category VARCHAR(50) DEFAULT 'podcast'")
        conn.commit()
        print("Migration successful.")
    else:
        print("Column 'category' already exists.")
        
    conn.close()

if __name__ == '__main__':
    migrate()
