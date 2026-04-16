from datetime import datetime, timezone
from ..extensions import db

# Association Table for Many-to-Many relationship between Videos and Playlists
playlist_items = db.Table('playlist_items',
    db.Column('playlist_id', db.Integer, db.ForeignKey('playlists.id', ondelete='CASCADE'), primary_key=True),
    db.Column('video_id', db.Integer, db.ForeignKey('videos.id', ondelete='CASCADE'), primary_key=True),
    db.Column('added_at', db.DateTime, default=lambda: datetime.now(timezone.utc))
)

class Playlist(db.Model):
    """A collection of videos grouped by a user (Sets)."""
    __tablename__ = 'playlists'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    owner = db.relationship('User', backref='playlists')
    videos = db.relationship('Video', secondary=playlist_items, back_populates='playlists')

    def __repr__(self):
        return f'<Playlist {self.name} by User {self.owner_id}>'
