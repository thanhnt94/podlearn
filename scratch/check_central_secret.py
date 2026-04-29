import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/CentralAuth.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT client_id, client_secret FROM clients WHERE client_id = 'podlearn-v1'")
        result = cursor.fetchone()
        if result:
            print(f"Client ID: {result[0]}")
            print(f"Client Secret: {result[1]}")
        else:
            print("Client podlearn-v1 not found in CentralAuth.")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
