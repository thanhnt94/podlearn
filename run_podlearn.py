"""AuraFlow entry point."""

from app import create_app

app = create_app()

# Ensure all database tables are created and seed default admin
with app.app_context():
    from app.extensions import db
    from app.models import User, AppSetting, Sentence, ShadowingHistory, Video
    import os
    
    # 1. Create database directory if it doesn't exist
    db_path = "c:\\Code\\Ecosystem\\Storage\\database"
    if not os.path.exists(db_path):
        os.makedirs(db_path)
        print(f"Created directory: {db_path}")

    # 2. Create tables
    db.create_all()
    
    # 2. Seed Admin if not exists
    # Check by both username and email to prevent IntegrityError
    admin_by_user = User.query.filter_by(username='admin').first()
    admin_by_email = User.query.filter_by(email='admin@AuraFlow.local').first()
    
    target_admin = admin_by_user or admin_by_email

    if not target_admin:
        print("Seeding default admin user (admin/admin)...")
        admin = User(
            username='admin', 
            email='admin@AuraFlow.local', 
            is_admin=True
        )
        admin.set_password('admin')
        db.session.add(admin)
        db.session.commit()
        print("Admin user created successfully.")
    else:
        # Ensure the existing user is marked as admin
        if not target_admin.is_admin:
            target_admin.is_admin = True
            db.session.commit()
            print(f"Existing user '{target_admin.username}' promoted to Admin.")
        else:
            print(f"Admin user already exists ({target_admin.username}).")

    print("Database ready.")

if __name__ == '__main__':
    app.run(debug=True, port=5020)
