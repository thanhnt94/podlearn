from datetime import datetime, timezone

from ..extensions import db


class Video(db.Model):
    """A user's private/public instance of a YouTube video."""
    __tablename__ = 'videos'

    id = db.Column(db.Integer, primary_key=True)
    # unique=True REMOVED: Multiple users can import the same YouTube video into private workspaces.
    youtube_id = db.Column(db.String(20), nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True) # Set to nullable temporarily for SQLite migration fallback
    visibility = db.Column(db.String(20), default='private') # private, pending_public, public

    title = db.Column(db.String(500), nullable=False)
    thumbnail_url = db.Column(db.String(500))
    duration_seconds = db.Column(db.Integer)
    status = db.Column(db.String(20), default='pending')  # pending, processing, completed, failed
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    owner = db.relationship('User', backref='uploaded_videos')

    # Relationships
    subtitle_tracks = db.relationship('SubtitleTrack', back_populates='video',
                                      lazy='dynamic', cascade='all, delete-orphan')
    lessons = db.relationship('Lesson', back_populates='video', lazy='dynamic')

    def __repr__(self) -> str:
        return f'<Video {self.youtube_id}>'
