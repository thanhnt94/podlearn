from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from app.core.extensions import db

class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(100))
    avatar_url = db.Column(db.String(255))
    role = db.Column(db.String(20), default='free') # free, vip, admin
    
    central_auth_id = db.Column(db.String(36), unique=True, index=True, nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Global User Preferences (JSON)
    preferences_json = db.Column(db.Text, default='{}')

    # Gamification & Thống kê
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    last_study_date = db.Column(db.Date)
    total_exp = db.Column(db.Integer, default=0)
    current_level = db.Column(db.Integer, default=1)
    streak_freezes = db.Column(db.Integer, default=0)
    total_listening_seconds = db.Column(db.Integer, default=0)
    total_shadowing_count = db.Column(db.Integer, default=0)

    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_vip(self):
        return self.role in ['vip', 'admin']

    @property
    def is_at_least_vip(self):
        return self.is_vip

    # Add required properties for JWT integration if necessary (though JWT usually just needs identity)
    # is_active, get_id, etc. are for Flask-Login, so we can remove them if they were used.
    # User model doesn't explicitly define them here, they came from UserMixin.

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:
        return f'<User {self.username}>'
