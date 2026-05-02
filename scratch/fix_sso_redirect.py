import sqlite3

db_path = r'c:\Code\Ecosystem\Storage\database\CentralAuth.db'
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

new_uri = 'https://podlearn.mindstack.click/auth-center/callback'
client_id = 'podlearn-v1'

cursor.execute("UPDATE clients SET redirect_uri = ? WHERE client_id = ?", (new_uri, client_id))
conn.commit()

print(f"Successfully updated redirect_uri for {client_id} to {new_uri}")
conn.close()
