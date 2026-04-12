import sqlite3
import os

paths = [
    r'C:\Code\Ecosystem\Storage\database\javidict.db',
    r'C:\Code\Ecosystem\Storage\database\suge.db',
    r'C:\Code\Ecosystem\Storage\database\mazii_offline.db',
    r'C:\Code\Ecosystem\PodLearn\Storage\database\jamdict.db'
]

for p in paths:
    if not os.path.exists(p):
        print(f"--- FOLDER MISSING: {p} ---")
        continue
    
    print(f"--- ANALYZING: {os.path.basename(p)} ---")
    conn = sqlite3.connect(p)
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = [t[0] for t in cursor.fetchall()]
    
    for table in tables:
        cursor.execute(f"PRAGMA table_info('{table}')")
        cols = [c[1] for c in cursor.fetchall()]
        print(f"  Table: {table} -> Columns: {cols}")
    conn.close()
