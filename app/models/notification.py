from datetime import datetime, timezone
from ..extensions import db

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
