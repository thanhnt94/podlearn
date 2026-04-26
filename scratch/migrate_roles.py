import sys
import os

# Add the project root to sys.path
project_root = r'c:\Code\Ecosystem\PodLearn'
if project_root not in sys.path:
    sys.path.append(project_root)

from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()
with app.app_context():
    # Find users with 'pro' or 'moderator' role
    old_users = User.query.filter(User.role.in_(['pro', 'moderator'])).all()
    print(f"Found {len(old_users)} users with legacy roles.")
    
    for user in old_users:
        print(f"Migrating {user.username}: {user.role} -> vip")
        user.role = 'vip'
    
    db.session.commit()
    print("Migration complete.")
