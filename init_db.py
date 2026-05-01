import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))
from app import create_app
from app.core.extensions import db
from app.modules.identity.models import User

def init_and_seed():
    app = create_app()
    with app.app_context():
        print("Initializing database tables...")
        db.create_all()
        
        print("Creating admin user...")
        admin = User(
            username='admin',
            email='admin@example.com',
            role='admin'
        )
        admin.set_password('admin')
        db.session.add(admin)
        db.session.commit()
        print("Database initialized and admin user created (admin/admin).")

if __name__ == "__main__":
    init_and_seed()
