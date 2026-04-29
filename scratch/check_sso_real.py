import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/PodLearn.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT key, value FROM app_settings WHERE key IN ('AUTH_PROVIDER', 'CENTRAL_AUTH_SERVER_ADDRESS')")
        results = cursor.fetchall()
        if not results:
            print("No SSO settings found in database.")
        for key, value in results:
            print(f"{key}: {value}")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
