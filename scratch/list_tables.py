import sqlite3
import os

db_path = 'c:/Code/Ecosystem/PodLearn/app.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print("Tables in database:")
        for t in tables:
            print(f"- {t[0]}")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
