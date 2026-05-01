import sqlite3
import os

db_path = r"c:\Code\Ecosystem\Storage\database\PodLearn.db"
print(f"Connecting to {db_path}")

try:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE videos ADD COLUMN curated_sections JSON;")
    conn.commit()
    print("Column curated_sections added successfully.")
except sqlite3.OperationalError as e:
    if "duplicate column name" in str(e).lower():
        print("Column curated_sections already exists.")
    else:
        print(f"Error: {e}")
except Exception as e:
    print(f"Error: {e}")
finally:
    if 'conn' in locals():
        conn.close()
