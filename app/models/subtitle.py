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
    note = db.Column(db.String(255), nullable=True)

    # Unique constraint: one track per language per video
    __table_args__ = (
        db.UniqueConstraint('video_id', 'language_code', name='uq_video_lang'),
    )

    # Relationships
    video = db.relationship('Video', back_populates='subtitle_tracks')
    uploader = db.relationship('User')
    lines = db.relationship('SubtitleLine', back_populates='track',
                            lazy='dynamic', cascade='all, delete-orphan',
                            order_by='SubtitleLine.line_index')

    def __repr__(self) -> str:
        return f'<SubtitleTrack {self.language_code} for video_id={self.video_id}>'


class SubtitleLine(db.Model):
    """A single timed line within a subtitle track."""
    __tablename__ = 'subtitle_lines'

    id = db.Column(db.Integer, primary_key=True)
    track_id = db.Column(db.Integer, db.ForeignKey('subtitle_tracks.id'), nullable=False, index=True)
    line_index = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.Float, nullable=False)
    duration = db.Column(db.Float, nullable=False)
    content = db.Column(db.Text, nullable=False)

    # Relationships
    track = db.relationship('SubtitleTrack', back_populates='lines')

    def __repr__(self) -> str:
        return f'<SubtitleLine #{self.line_index} @ {self.start_time}s>'
