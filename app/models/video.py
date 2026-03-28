from datetime import datetime, timezone

from ..extensions import db


class Video(db.Model):
    """Globally shared video record — one per YouTube video ID."""
    __tablename__ = 'videos'

    id = db.Column(db.Integer, primary_key=True)
    youtube_id = db.Column(db.String(20), unique=True, nullable=False, index=True)
    title = db.Column(db.String(500), nullable=False)
    thumbnail_url = db.Column(db.String(500))
    duration_seconds = db.Column(db.Integer)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    subtitle_tracks = db.relationship('SubtitleTrack', back_populates='video',
                                      lazy='dynamic', cascade='all, delete-orphan')
    lessons = db.relationship('Lesson', back_populates='video', lazy='dynamic')

    def __repr__(self) -> str:
        return f'<Video {self.youtube_id}>'
