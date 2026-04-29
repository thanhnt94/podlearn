from datetime import datetime, timezone
from app.extensions import db

playlist_items = db.Table('playlist_items',
    db.Column('playlist_id', db.Integer, db.ForeignKey('playlists.id', ondelete='CASCADE'), primary_key=True),
    db.Column('video_id', db.Integer, db.ForeignKey('videos.id', ondelete='CASCADE'), primary_key=True),
    db.Column('added_at', db.DateTime, default=lambda: datetime.now(timezone.utc))
)

class Playlist(db.Model):
    __tablename__ = 'playlists'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    owner = db.relationship('User', backref='playlists')
    videos = db.relationship('Video', secondary=playlist_items, back_populates='playlists')

class VideoCollaborator(db.Model):
    __tablename__ = 'video_collaborators'
    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = db.Column(db.String(20), default='editor') # editor, manager
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    user = db.relationship('User', backref='video_collaborations')
    __table_args__ = (db.UniqueConstraint('video_id', 'user_id', name='_video_user_collaborator_uc'),)

class Video(db.Model):
    __tablename__ = 'videos'

    id = db.Column(db.Integer, primary_key=True)
    youtube_id = db.Column(db.String(20), nullable=False, index=True)
    owner_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    visibility = db.Column(db.String(20), default='private') 

    title = db.Column(db.String(500), nullable=False)
    channel_title = db.Column(db.String(255))
    channel_id = db.Column(db.String(100))
    description = db.Column(db.Text)
    
    thumbnail_url = db.Column(db.String(500))
    duration_seconds = db.Column(db.Integer)
    language_code = db.Column(db.String(10), default='en')
    status = db.Column(db.String(20), default='pending')
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Curated content by managers
    curated_overview = db.Column(db.Text, nullable=True)
    curated_grammar = db.Column(db.Text, nullable=True)
    curated_vocabulary = db.Column(db.Text, nullable=True)

    owner = db.relationship('User', backref='uploaded_videos')
    playlists = db.relationship('Playlist', secondary=playlist_items, back_populates='videos')
    subtitle_tracks = db.relationship('SubtitleTrack', back_populates='video', lazy='dynamic', cascade='all, delete-orphan')
    collaborators = db.relationship('VideoCollaborator', backref='video', lazy='dynamic', cascade='all, delete-orphan')

class SubtitleTrack(db.Model):
    __tablename__ = 'subtitle_tracks'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    language_code = db.Column(db.String(10), nullable=False)
    is_auto_generated = db.Column(db.Boolean, default=False)
    status = db.Column(db.String(20), default='pending')
    fetched_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    
    uploader_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    uploader_name = db.Column(db.String(50), default="Bot")
    name = db.Column(db.String(100), nullable=True) # e.g. "Bản dịch của Thanh"
    is_original = db.Column(db.Boolean, default=False) 
    status = db.Column(db.String(20), default='pending') # pending, translating, completed, error
    progress = db.Column(db.Integer, default=0)
    total_lines = db.Column(db.Integer, default=0)
    content_json = db.Column(db.JSON, nullable=True)
    note = db.Column(db.String(255), nullable=True)

    video = db.relationship('Video', back_populates='subtitle_tracks')
    uploader = db.relationship('User')
