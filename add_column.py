from app import create_app
from app.extensions import db
from sqlalchemy import text

def add_column():
    app = create_app()
    with app.app_context():
        try:
            db.session.execute(text("ALTER TABLE sentence_sets ADD COLUMN set_type VARCHAR(50) DEFAULT 'spotlight'"))
            db.session.commit()
            print("Successfully added 'set_type' column to sentence_sets table.")
        except Exception as e:
            print(f"Error or column already exists: {str(e)}")

if __name__ == "__main__":
    add_column()
