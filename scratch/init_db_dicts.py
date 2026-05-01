from app import create_app
from app.core.extensions import db

app = create_app()
with app.app_context():
    print("Creating all tables including new VideoDictionary...")
    db.create_all()
    print("Done.")
