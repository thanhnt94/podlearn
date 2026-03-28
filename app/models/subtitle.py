from datetime import datetime, timezone

from ..extensions import db


class SubtitleTrack(db.Model):
    """One language track for one video. Cached after first fetch."""
    __tablename__ = 'subtitle_tracks'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    language_code = db.Column(db.String(10), nullable=False)
    is_auto_generated = db.Column(db.Boolean, default=False)
    fetched_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    # Uploader Info
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploader_name = db.Column(db.String(50), default="Bot")
    content_json = db.Column(db.JSON, nullable=True)
    note = db.Column(db.String(255), nullable=True)

    # Unique constraint: one track per language per video
    __table_args__ = (
        db.UniqueConstraint('video_id', 'language_code', name='uq_video_lang'),
    )

    # Relationships
    video = db.relationship('Video', back_populates='subtitle_tracks')
    uploader = db.relationship('User')
    # Relationships
    video = db.relationship('Video', back_populates='subtitle_tracks')
    uploader = db.relationship('User')

    def __repr__(self) -> str:
        return f'<SubtitleTrack {self.language_code} for video_id={self.video_id}>'
