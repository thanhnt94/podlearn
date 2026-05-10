from datetime import datetime, timezone
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import Column, Integer, String, DateTime, Date, Text
from app.core.database import Base

class User(Base):
    __tablename__ = 'users'

    id = Column(Integer, primary_key=True)
    username = Column(String(80), unique=True, nullable=False, index=True)
    email = Column(String(120), unique=True, nullable=False, index=True)
    password_hash = Column(String(256), nullable=False)
    full_name = Column(String(100))
    avatar_url = Column(String(255))
    role = Column(String(20), default='free') # free, vip, admin
    
    central_auth_id = Column(String(36), unique=True, index=True, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Global User Preferences (JSON)
    preferences_json = Column(Text, default='{}')

    # Gamification & Thống kê
    current_streak = Column(Integer, default=0)
    longest_streak = Column(Integer, default=0)
    last_study_date = Column(Date)
    total_exp = Column(Integer, default=0)
    current_level = Column(Integer, default=1)
    streak_freezes = Column(Integer, default=0)
    total_listening_seconds = Column(Integer, default=0)
    total_shadowing_count = Column(Integer, default=0)

    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_vip(self):
        return self.role in ['vip', 'admin']

    @property
    def is_at_least_vip(self):
        return self.is_vip

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def __repr__(self) -> str:
        return f'<User {self.username}>'
