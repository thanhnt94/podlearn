from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Table, Boolean, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.core.database import Base

playlist_items = Table('playlist_items', Base.metadata,
    Column('playlist_id', Integer, ForeignKey('playlists.id', ondelete='CASCADE'), primary_key=True),
    Column('video_id', Integer, ForeignKey('videos.id', ondelete='CASCADE'), primary_key=True),
    Column('added_at', DateTime, default=lambda: datetime.now(timezone.utc))
)

class Playlist(Base):
    __tablename__ = 'playlists'

    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    owner = relationship('User', backref='playlists')
    videos = relationship('Video', secondary=playlist_items, back_populates='playlists')

class VideoCollaborator(Base):
    __tablename__ = 'video_collaborators'
    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id', ondelete='CASCADE'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    role = Column(String(20), default='editor') # editor, manager
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    user = relationship('User', backref='video_collaborations')
    __table_args__ = (UniqueConstraint('video_id', 'user_id', name='_video_user_collaborator_uc'),)

class Video(Base):
    __tablename__ = 'videos'

    id = Column(Integer, primary_key=True)
    youtube_id = Column(String(20), nullable=False, index=True)
    owner_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    visibility = Column(String(20), default='private') 

    title = Column(String(500), nullable=False)
    channel_title = Column(String(255))
    channel_id = Column(String(100))
    description = Column(Text)
    
    thumbnail_url = Column(String(500))
    duration_seconds = Column(Integer)
    language_code = Column(String(10), default='en')
    status = Column(String(20), default='pending')
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Curated content by managers
    curated_overview = Column(Text, nullable=True)
    curated_grammar = Column(Text, nullable=True)
    curated_vocabulary = Column(Text, nullable=True)
    
    # Dynamic sections: [{"id": "...", "title": "...", "content": "..."}, ...]
    curated_sections = Column(JSON, nullable=True)
    
    @property
    def available_languages(self):
        """Helper for DTOs and Pydantic schemas."""
        return sorted(list(set([t.language_code.upper() for t in self.subtitle_tracks])))

    owner = relationship('User', backref='uploaded_videos')
    playlists = relationship('Playlist', secondary=playlist_items, back_populates='videos')
    subtitle_tracks = relationship('SubtitleTrack', back_populates='video', lazy='dynamic', cascade='all, delete-orphan')
    collaborators = relationship('VideoCollaborator', backref='video', lazy='dynamic', cascade='all, delete-orphan')

class SubtitleTrack(Base):
    __tablename__ = 'subtitle_tracks'

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False, index=True)
    language_code = Column(String(10), nullable=False)
    is_auto_generated = Column(Boolean, default=False)
    status = Column(String(20), default='pending')
    fetched_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    uploader_id = Column(Integer, ForeignKey('users.id'), nullable=True)
    uploader_name = Column(String(50), default="Bot")
    name = Column(String(100), nullable=True) # e.g. "Bản dịch của Thanh"
    is_original = Column(Boolean, default=False) 
    progress = Column(Integer, default=0)
    total_lines = Column(Integer, default=0)
    content_json = Column(JSON, nullable=True)
    note = Column(String(255), nullable=True)

    video = relationship('Video', back_populates='subtitle_tracks')
    uploader = relationship('User')

