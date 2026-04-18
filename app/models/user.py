from datetime import datetime, timezone
from flask_login import UserMixin
from werkzeug.security import generate_password_hash, check_password_hash

from ..extensions import db


class User(UserMixin, db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    full_name = db.Column(db.String(100))
    avatar_url = db.Column(db.String(255))
    role = db.Column(db.String(20), default='free') # free, user, moderator, admin
    
    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_at_least_moderator(self):
        return self.role in ['moderator', 'admin']
    central_auth_id = db.Column(db.String(36), unique=True, index=True, nullable=True) # UUID from CentralAuth
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Gamification
    current_streak = db.Column(db.Integer, default=0)
    longest_streak = db.Column(db.Integer, default=0)
    last_study_date = db.Column(db.Date)
    
    # Gamification & Thống kê EdTech
    total_exp = db.Column(db.Integer, default=0)
    current_level = db.Column(db.Integer, default=1)
    total_listening_seconds = db.Column(db.Integer, default=0)
    total_shadowing_count = db.Column(db.Integer, default=0)
    
    # Global User Preferences (JSON)
    # Stores default styles: {"s1": {...}, "s2": {...}, "syncOffset": 0, ...}
    preferences_json = db.Column(db.Text, default='{}')



    # Relationships
    lessons = db.relationship('Lesson', back_populates='user', lazy='dynamic',
                              cascade='all, delete-orphan')
    notes = db.relationship('Note', back_populates='user', lazy='dynamic',
                            cascade='all, delete-orphan')
    comments = db.relationship('Comment', backref='user', lazy='dynamic', cascade='all, delete-orphan')
    activity_logs = db.relationship('ActivityLog', backref='user', lazy='dynamic', cascade='all, delete-orphan')

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:
        return f'<User {self.username}>'
