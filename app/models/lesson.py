from datetime import datetime, timezone

from ..extensions import db


class Lesson(db.Model):
    """A user's saved video — links a user to a video with their language choices."""
    __tablename__ = 'lessons'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    original_lang_code = db.Column(db.String(10))
    target_lang_code = db.Column(db.String(10))
    third_lang_code = db.Column(db.String(10))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Progress Tracking
    is_completed = db.Column(db.Boolean, default=False)
    time_spent = db.Column(db.Integer, default=0) # Total seconds spent studying this lesson

    # Visual Options for Notes
    note_appear_before = db.Column(db.Float, default=2.0) # Seconds before timestamp
    note_duration = db.Column(db.Float, default=5.0)      # Total display duration


    
    # Store UI settings as JSON string: {"sub_size": "24px", "sub_color": "#fff", "sub_pos": "bottom", ...}
    settings_json = db.Column(db.Text, default='{}')

    # Unique constraint: one lesson per user per video
    __table_args__ = (
        db.UniqueConstraint('user_id', 'video_id', name='uq_user_video'),
    )

    # Relationships
    user = db.relationship('User', back_populates='lessons')
    video = db.relationship('Video', back_populates='lessons')
    notes = db.relationship('Note', back_populates='lesson', lazy='dynamic',
                            cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f'<Lesson user={self.user_id} video={self.video_id}>'
