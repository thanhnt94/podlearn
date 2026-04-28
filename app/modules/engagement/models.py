from datetime import datetime, timezone
from app.extensions import db


# --- From activity_log.py ---

class ActivityLog(db.Model):
    __tablename__ = 'user_activity_logs'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    # 'LISTEN_PODCAST', 'SHADOWING', 'ADD_COMMENT', 'SAVE_VOCAB'
    activity_type = db.Column(db.String(50), nullable=False) 
    
    duration_seconds = db.Column(db.Integer, default=0)
    metric_value = db.Column(db.Integer, default=0) # Tracks occurrences like shadowing counts
    exp_earned = db.Column(db.Integer, default=0)
    reference_id = db.Column(db.Integer, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<ActivityLog {self.activity_type} user={self.user_id} exp={self.exp_earned}>'

# --- From badge.py ---

class Badge(db.Model):
    """Badge definitions with requirements to unlock."""
    __tablename__ = 'badges'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon_name = db.Column(db.String(50), nullable=False) # e.g. 'Shield', 'Flame'
    category = db.Column(db.String(50), default='general') # 'streak', 'shadowing', 'time'
    
    # Requirement Logic
    requirement_type = db.Column(db.String(50), nullable=False) # 'streak_days', 'shadow_count', 'total_hours'
    threshold = db.Column(db.Integer, nullable=False)
    
    is_hidden = db.Column(db.Boolean, default=False) # Some badges remain secret until earned
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Badge {self.name} category={self.category}>'


class UserBadge(db.Model):
    """Many-to-Many relationship between User and Badge with the timestamp."""
    __tablename__ = 'user_badges'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False, index=True)
    earned_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('badges_earned', lazy='dynamic', cascade='all, delete-orphan'))
    badge = db.relationship('Badge', backref=db.backref('earned_by_users', lazy='dynamic', cascade='all, delete-orphan'))

    def __repr__(self):
        return f'<UserBadge user={self.user_id} badge={self.badge_id}>'

# --- From notification.py ---

class Notification(db.Model):
    """System-generated notifications for users (Achievements, Reminders, Sharing)."""
    __tablename__ = 'notifications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    
    # Types: 'ACHIEVEMENT', 'STREAK_REMINDER', 'SYSTEM', 'SHARE_INVITE'
    type = db.Column(db.String(50), nullable=False) 
    
    title = db.Column(db.String(200), nullable=False)
    message = db.Column(db.Text, nullable=False)
    
    is_read = db.Column(db.Boolean, default=False)
    
    # Optional link to related entity (e.g. video_id or badge_id)
    link_url = db.Column(db.String(255))
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self):
        return f'<Notification {self.type} for user={self.user_id}>'

# --- From shadowing.py ---


class ShadowingHistory(db.Model):
    """
    Records each shadowing attempt by a user.
    Linked to a specific sentence in a video via start_time and end_time.
    """
    __tablename__ = 'shadowing_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=True, index=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True, index=True)
    sentence_id = db.Column(db.Integer, db.ForeignKey('sentences.id'), nullable=True, index=True)
    
    # Sentence identification (legacy for video-based tracking)
    start_time = db.Column(db.Float, nullable=False)
    end_time = db.Column(db.Float, nullable=False)
    original_text = db.Column(db.Text)
    
    # Results
    accuracy_score = db.Column(db.Integer, nullable=False) # 0-100
    spoken_text = db.Column(db.Text)
    
    # Audio & Tracking
    user_audio_url = db.Column(db.String(500), nullable=True)
    duration_seconds = db.Column(db.Integer, default=0)
    
    # AI Standby
    ai_score = db.Column(db.Float, nullable=True)
    ai_feedback = db.Column(db.JSON, nullable=True)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('shadowing_history', lazy='dynamic'))
    video = db.relationship('Video', backref=db.backref('shadowing_history', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('shadowing_history', lazy='dynamic'))
    sentence = db.relationship('Sentence', backref=db.backref('shadowing_history', lazy='dynamic'))

    def __repr__(self):
        return f'<ShadowingHistory user={self.user_id} score={self.accuracy_score} time={self.start_time}>'

# --- From comment.py ---

class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    
    # EdTech Feature: Trạng thái thời gian trong video
    video_timestamp = db.Column(db.Float, nullable=True)
    
    # Thread Reply / Nested Comments
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    likes_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Relationships
    user = db.relationship('User', backref=db.backref('comments', lazy='dynamic'))
    video = db.relationship('Video', backref=db.backref('comments', lazy='dynamic'))

    # Relationship cho Reply Thread
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Comment {self.id} user={self.user_id} video={self.video_id}>'

# --- From share.py ---



class ShareRequest(db.Model):
    """A request from one user to share a video workspace with another user."""
    __tablename__ = 'share_requests'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    status = db.Column(db.String(20), default='pending') # pending, accepted, rejected
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    video = db.relationship('Video', backref=db.backref('share_requests', lazy='dynamic', cascade='all, delete-orphan'))
    sender = db.relationship('User', foreign_keys=[sender_id], backref=db.backref('sent_shares', cascade='all, delete-orphan'))
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref=db.backref('received_shares', cascade='all, delete-orphan'))

    def __repr__(self) -> str:
        return f'<ShareRequest {self.sender_id}->{self.receiver_id} for video_id={self.video_id}>'

# --- From setting.py ---
import json

class AppSetting(db.Model):
    """
    Dynamic application settings stored in the database.
    Allows changing system behavior (like SSO toggle) without code changes.
    """
    __tablename__ = 'app_settings'

    key = db.Column(db.String(100), primary_key=True)
    value = db.Column(db.JSON, nullable=False)
    category = db.Column(db.String(50), default='general')
    data_type = db.Column(db.String(50), default='string') # string, bool, int, json
    description = db.Column(db.Text, nullable=True)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    @staticmethod
    def get(key, default=None):
        setting = AppSetting.query.get(key)
        if not setting:
            return default
        return setting.value

    @staticmethod
    def set(key, value, category='general', data_type='string', description=None):
        setting = AppSetting.query.get(key)
        if not setting:
            setting = AppSetting(key=key, category=category, data_type=data_type, description=description)
            db.session.add(setting)
        
        setting.value = value
        if description:
            setting.description = description
        db.session.commit()
        return setting
