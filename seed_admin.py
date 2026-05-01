import os
import sys

# Add the project root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))

from app import create_app
from app.core.extensions import db
from app.modules.identity.models import User

def seed_admin():
    app = create_app()
    with app.app_context():
        # Check if admin already exists
        if User.query.filter_by(username='admin').first():
            print("Admin user already exists.")
            return

        print("Creating admin user...")
        admin = User(
            username='admin',
            email='admin@example.com',
            role='admin'
        )
        admin.set_password('admin')
        db.session.add(admin)
        db.session.commit()
        print("Admin user created successfully (admin/admin).")

if __name__ == "__main__":
    seed_admin()
