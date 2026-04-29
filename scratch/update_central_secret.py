import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/CentralAuth.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # Update PodLearn secret
        cursor.execute("""
            UPDATE clients 
            SET client_secret = 'podlearn_ecosystem_2026'
            WHERE client_id = 'podlearn-v1'
        """)
        conn.commit()
        print("PodLearn Secret updated in CentralAuth.")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
