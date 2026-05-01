import sys
import os
sys.path.append(os.getcwd())

from app import create_app
from app.core.extensions import db
from sqlalchemy import text

app = create_app()
with app.app_context():
    print("Checking for missing columns in sentence_tokens...")
    engine = db.engine
    with engine.connect() as conn:
        # Check existing columns
        result = conn.execute(text("PRAGMA table_info(sentence_tokens)"))
        columns = [row[1] for row in result]
        
        needed = {
            "reading": "TEXT",
            "meaning": "TEXT",
            "extra_data": "JSON"
        }
        
        for col, col_type in needed.items():
            if col not in columns:
                print(f"Adding column {col}...")
                try:
                    conn.execute(text(f"ALTER TABLE sentence_tokens ADD COLUMN {col} {col_type}"))
                    conn.commit()
                    print(f"Column {col} added successfully.")
                except Exception as e:
                    print(f"Error adding {col}: {e}")
            else:
                print(f"Column {col} already exists.")
    
    print("Database sync completed.")
