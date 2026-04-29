import sqlite3
import os

db_path = 'c:/Code/Ecosystem/Storage/database/CentralAuth.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT client_id, name, redirect_uri, backchannel_logout_uri FROM clients WHERE client_id = 'podlearn-v1'")
        result = cursor.fetchone()
        if result:
            print(f"ID: {result[0]}")
            print(f"Name: {result[1]}")
            print(f"Redirect: {result[2]}")
            print(f"Backchannel: {result[3]}")
        else:
            print("Client podlearn-v1 not found.")
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
