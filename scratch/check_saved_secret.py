import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/PodLearn.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT key, value FROM app_settings WHERE key = 'CENTRAL_AUTH_CLIENT_SECRET'")
        result = cursor.fetchone()
        if result:
            print(f"Secret in DB: {result[1]}")
        else:
            print("Secret not found in DB settings.")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
