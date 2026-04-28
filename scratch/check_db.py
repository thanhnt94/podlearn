import sqlite3
import os

db_path = r'c:\Code\Ecosystem\PodLearn\dictionaries\database\mazii_offline.db'
if not os.path.exists(db_path):
    print(f"File not found: {db_path}")
else:
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    print(f"Tables: {tables}")
    for table in tables:
        t_name = table[0]
        cursor.execute(f"PRAGMA table_info({t_name});")
        print(f"Schema for {t_name}: {cursor.fetchall()}")
    
    # Try a sample query
    cursor.execute(f"SELECT * FROM {tables[0][0]} LIMIT 1;")
    print(f"Sample row from {tables[0][0]}: {cursor.fetchone()}")
    conn.close()
