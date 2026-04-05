import sqlite3
import os

# Database path for PodLearn (relative to the app root)
DB_PATH = '../Storage/database/PodLearn.db'

def migrate():
    # Construct absolute path to be sure
    abs_db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), DB_PATH))
    
    if not os.path.exists(abs_db_path):
        print(f"Error: Database not found at {abs_db_path}")
        return

    try:
        conn = sqlite3.connect(abs_db_path)
        cursor = conn.cursor()

        # Check if column already exists
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]

        if 'central_auth_id' not in columns:
            print("Adding 'central_auth_id' column to 'users' table...")
            cursor.execute("ALTER TABLE users ADD COLUMN central_auth_id VARCHAR(36)")
            # Add index
            cursor.execute("CREATE INDEX IF NOT EXISTS ix_users_central_auth_id ON users (central_auth_id)")
            conn.commit()
            print(f"Migration successful: 'central_auth_id' added to PodLearn at {abs_db_path}.")
        else:
            print("Column 'central_auth_id' already exists in PodLearn.")

        conn.close()
    except Exception as e:
        print(f"Migration failed: {e}")

if __name__ == '__main__':
    migrate()
