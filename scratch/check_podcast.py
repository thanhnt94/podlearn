import sqlite3
import os

db_path = r'c:\Code\Ecosystem\PodLearn\dictionaries\database\mazii_offline.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

term = 'ポッドキャスト'
cursor.execute("SELECT word, reading FROM dictionary WHERE word LIKE ?", (f"%{term}%",))
rows = cursor.fetchall()
print(f"Results for {term}: {rows}")

conn.close()
