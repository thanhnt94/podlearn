import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/CentralAuth.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Update PodLearn URIs to the real domain
        cursor.execute("""
            UPDATE clients 
            SET redirect_uri = 'https://podlearn.mindstack.click/auth-center/callback',
                backchannel_logout_uri = 'https://podlearn.mindstack.click/auth-center/webhook/backchannel-logout'
            WHERE client_id = 'podlearn-v1'
        """)
        conn.commit()
        print("PodLearn URIs updated in CentralAuth.")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
