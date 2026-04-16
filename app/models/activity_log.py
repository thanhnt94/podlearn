from datetime import datetime, timezone
from ..extensions import db

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
