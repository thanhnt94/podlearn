import sqlite3
import os
import json

db_path = 'c:/Code/Ecosystem/Storage/database/PodLearn.db'
if not os.path.exists(db_path):
    print(f"Database not found at {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        # 1. Ensure table exists (it should, but just in case)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS app_settings (
                key VARCHAR(100) PRIMARY KEY,
                value JSON NOT NULL,
                category VARCHAR(50),
                data_type VARCHAR(50),
                description TEXT,
                updated_at DATETIME
            )
        """)
        
        # 2. Set AUTH_PROVIDER to 'central'
        cursor.execute("INSERT OR REPLACE INTO app_settings (key, value, category) VALUES (?, ?, ?)", 
                       ('AUTH_PROVIDER', '"central"', 'auth'))
        
        # 3. Set CENTRAL_AUTH_SERVER_ADDRESS to 'https://mindstack.click'
        cursor.execute("INSERT OR REPLACE INTO app_settings (key, value, category) VALUES (?, ?, ?)", 
                       ('CENTRAL_AUTH_SERVER_ADDRESS', '"https://mindstack.click"', 'auth'))
        
        conn.commit()
        print("SSO Settings updated successfully.")
        
    except Exception as e:
        print(f"Error: {e}")
    conn.close()
