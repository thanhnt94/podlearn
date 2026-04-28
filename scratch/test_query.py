import sqlite3
import os
import json

db_path = r'c:\Code\Ecosystem\PodLearn\dictionaries\database\mazii_offline.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

term = '今回'
cursor.execute("SELECT reading, meanings_json FROM dictionary WHERE word = ?", (term,))
row = cursor.fetchone()
if row:
    print(f"Found {term}: {row[0]}")
    # print(row[1]) # avoid unicode print error
else:
    print(f"NOT Found {term}")

# Check first 5 words
cursor.execute("SELECT word FROM dictionary LIMIT 5")
print(f"First 5 words: {cursor.fetchall()}")

conn.close()
