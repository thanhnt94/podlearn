from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Boolean, JSON, Float
from sqlalchemy.orm import relationship, backref
from app.core.database import Base
from typing import Any

# --- From activity_log.py ---

class ActivityLog(Base):
    __tablename__ = 'user_activity_logs'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # 'LISTEN_PODCAST', 'SHADOWING', 'ADD_COMMENT', 'SAVE_VOCAB'
    activity_type = Column(String(50), nullable=False) 
    
    duration_seconds = Column(Integer, default=0)
    metric_value = Column(Integer, default=0) # Tracks occurrences like shadowing counts
    exp_earned = Column(Integer, default=0)
    reference_id = Column(Integer, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<ActivityLog {self.activity_type} user={self.user_id} exp={self.exp_earned}>'

# --- From badge.py ---

class Badge(Base):
    """Badge definitions with requirements to unlock."""
    __tablename__ = 'badges'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=False)
    icon_name = Column(String(50), nullable=False) # e.g. 'Shield', 'Flame'
    category = Column(String(50), default='general') # 'streak', 'shadowing', 'time'
    
    # Requirement Logic
    requirement_type = Column(String(50), nullable=False) # 'streak_days', 'shadow_count', 'total_hours'
    threshold = Column(Integer, nullable=False)
    
    is_hidden = Column(Boolean, default=False) # Some badges remain secret until earned
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Badge {self.name} category={self.category}>'


class UserBadge(Base):
    """Many-to-Many relationship between User and Badge with the timestamp."""
    __tablename__ = 'user_badges'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    badge_id = Column(Integer, ForeignKey('badges.id'), nullable=False, index=True)
    earned_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship('User', backref=backref('badges_earned', lazy='dynamic', cascade='all, delete-orphan'))
    badge = relationship('Badge', backref=backref('earned_by_users', lazy='dynamic', cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<UserBadge user={self.user_id} badge={self.badge_id}>'

# --- From notification.py ---

class Notification(Base):
    """System-generated notifications for users (Achievements, Reminders, Sharing)."""
    __tablename__ = 'notifications'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    
    # Types: 'ACHIEVEMENT', 'STREAK_REMINDER', 'SYSTEM', 'SHARE_INVITE'
    type = Column(String(50), nullable=False) 
    
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    
    is_read = Column(Boolean, default=False)
    
    # Optional link to related entity (e.g. video_id or badge_id)
    link_url = Column(String(255))
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Notification {self.type} for user={self.user_id}>'

# --- From shadowing.py ---


class ShadowingHistory(Base):
    """
    Records each shadowing attempt by a user.
    Linked to a specific sentence in a video via start_time and end_time.
    """
    __tablename__ = 'shadowing_history'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=True, index=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id'), nullable=True, index=True)
    sentence_id = Column(Integer, ForeignKey('sentences.id'), nullable=True, index=True)
    
    # Sentence identification (legacy for video-based tracking)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)
    original_text = Column(Text)
    
    # Results
    accuracy_score = Column(Integer, nullable=False) # 0-100
    spoken_text = Column(Text)
    
    # Audio & Tracking
    user_audio_url = Column(String(500), nullable=True)
    duration_seconds = Column(Integer, default=0)
    
    # AI Standby
    ai_score = Column(Float, nullable=True)
    ai_feedback = Column(JSON, nullable=True)
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = relationship('User', backref=backref('shadowing_history', lazy='dynamic'))
    video = relationship('Video', backref=backref('shadowing_history', lazy='dynamic'))
    lesson = relationship('Lesson', backref=backref('shadowing_history', lazy='dynamic'))
    sentence = relationship('Sentence', backref=backref('shadowing_history', lazy='dynamic'))

    def __repr__(self):
        return f'<ShadowingHistory user={self.user_id} score={self.accuracy_score} time={self.start_time}>'

# --- From comment.py ---

class Comment(Base):
    __tablename__ = 'comments'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False, index=True)
    content = Column(Text, nullable=False)
    
    # EdTech Feature: Trạng thái thời gian trong video
    video_timestamp = Column(Float, nullable=True)
    
    # Thread Reply / Nested Comments
    parent_id = Column(Integer, ForeignKey('comments.id'), nullable=True)
    
    likes_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = relationship('User', backref=backref('comments', lazy='dynamic'))
    video = relationship('Video', backref=backref('comments', lazy='dynamic'))

    # Relationship cho Reply Thread
    replies = relationship('Comment', backref=backref('parent', remote_side=[id]), lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Comment {self.id} user={self.user_id} video={self.video_id}>'

# --- From share.py ---

class ShareRequest(Base):
    """A request from one user to share a video workspace with another user."""
    __tablename__ = 'share_requests'

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False, index=True)
    sender_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    receiver_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    status = Column(String(20), default='pending') # pending, accepted, rejected
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    video = relationship('Video', backref=backref('share_requests', lazy='dynamic', cascade='all, delete-orphan'))
    sender = relationship('User', foreign_keys=[sender_id], backref=backref('sent_shares', cascade='all, delete-orphan'))
    receiver = relationship('User', foreign_keys=[receiver_id], backref=backref('received_shares', cascade='all, delete-orphan'))

    def __repr__(self) -> str:
        return f'<ShareRequest {self.sender_id}->{self.receiver_id} for video_id={self.video_id}>'

# --- From setting.py ---

class AppSetting(Base):
    """
    Dynamic application settings stored in the database.
    Allows changing system behavior (like SSO toggle) without code changes.
    """
    __tablename__ = 'app_settings'

    key = Column(String(100), primary_key=True)
    value = Column(JSON, nullable=False)
    category = Column(String(50), default='general')
    data_type = Column(String(50), default='string') # string, bool, int, json
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @staticmethod
    def get(key: str, default: Any = None):
        from app.core.database import SessionLocal
        with SessionLocal() as db:
            setting = db.query(AppSetting).filter_by(key=key).first()
            if setting:
                return setting.value
            return default

    @staticmethod
    def set(key: str, value: Any, category: str = 'general', data_type: str = 'string', description: str = None):
        from app.core.database import SessionLocal
        with SessionLocal() as db:
            setting = db.query(AppSetting).filter_by(key=key).first()
            if not setting:
                setting = AppSetting(key=key)
                db.add(setting)
            
            setting.value = value
            setting.category = category
            if data_type:
                setting.data_type = data_type
            if description:
                setting.description = description
            
            db.commit()
            return setting
