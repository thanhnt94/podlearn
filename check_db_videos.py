import sqlite3
import os

def check_videos():
    db_path = '../Storage/database/PodLearn.db'
    if not os.path.exists(db_path):
        print("DB not found")
        return
        
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT youtube_id, title FROM videos ORDER BY id DESC LIMIT 5")
    rows = cursor.fetchall()
    for r in rows:
        try:
            print(f"ID: {r[0]} | Title: {r[1]}")
        except:
            print(f"ID: {r[0]} | Title: (encoding error)")
    conn.close()

if __name__ == '__main__':
    check_videos()
