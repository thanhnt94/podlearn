import os
import sys
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '.')))
from app import create_app
from app.core.extensions import db
from app.modules.identity.models import User

def reset_admin():
    app = create_app()
    with app.app_context():
        admin = User.query.filter_by(username='admin').first()
        if admin:
            print("Resetting admin password...")
            admin.set_password('admin')
            db.session.commit()
            print("Admin password reset to 'admin'.")
        else:
            print("Admin user not found.")

if __name__ == "__main__":
    reset_admin()
