import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/PodLearn.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Update CENTRAL_AUTH_SERVER_ADDRESS to the correct sub-domain
        cursor.execute("UPDATE app_settings SET value = '\"https://auth.mindstack.click\"' WHERE key = 'CENTRAL_AUTH_SERVER_ADDRESS'")
        
        # Revert Secret to match the original setup if it was changed
        cursor.execute("DELETE FROM app_settings WHERE key = 'CENTRAL_AUTH_CLIENT_SECRET'")
        
        conn.commit()
        print("Settings reverted to match server configuration (https://auth.mindstack.click).")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
