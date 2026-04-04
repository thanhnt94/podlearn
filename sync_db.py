from app import create_app
from app.extensions import db

def update_db():
    app = create_app()
    with app.app_context():
        db.create_all()
        print("Database schema synchronization completed.")

if __name__ == "__main__":
    update_db()
