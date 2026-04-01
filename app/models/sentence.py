from datetime import datetime, timezone
from ..extensions import db


class Sentence(db.Model):
    """
    Stores individual sentences or patterns for focused learning.
    Can be extracted from a video or added manually.
    """
    __tablename__ = 'sentences'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    original_text = db.Column(db.Text, nullable=False)
    translated_text = db.Column(db.Text)
    audio_url = db.Column(db.String(500))  # Link to sample audio file
    
    # Optional link to source video
    source_video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=True, index=True)
    start_time = db.Column(db.Float, nullable=True)
    end_time = db.Column(db.Float, nullable=True)

    # Detailed linguistic analysis (grammar, vocabulary, etc.)
    detailed_analysis = db.Column(db.JSON)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('sentences', lazy='dynamic'))
    video = db.relationship('Video', backref=db.backref('sentences', lazy='dynamic'))

    def __repr__(self):
        return f'<Sentence {self.id}: {self.original_text[:20]}...>'
