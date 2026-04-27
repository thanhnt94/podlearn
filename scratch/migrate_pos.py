import sqlite3
import os

db_path = r'c:\Code\Ecosystem\Storage\database\PodLearn.db'

conn = sqlite3.connect(db_path)
cursor = conn.cursor()
try:
    cursor.execute("ALTER TABLE sentence_tokens ADD COLUMN pos VARCHAR(50);")
    conn.commit()
    print("Successfully added pos column.")
except Exception as e:
    print(f"Error (maybe column already exists): {e}")
conn.close()
