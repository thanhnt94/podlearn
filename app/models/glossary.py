from datetime import datetime, timezone
from ..extensions import db

class VideoGlossary(db.Model):
    """
    Shared community glossary for a specific video.
    Definitions here override the generic JMDict meanings.
    """
    __tablename__ = 'video_glossaries'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False)
    
    # The term being defined (usually the lemma/dictionary form)
    term = db.Column(db.String(255), nullable=False, index=True)
    reading = db.Column(db.String(255))
    
    # Current "Wiki" definition
    definition = db.Column(db.Text, nullable=False)
    
    # Metadata
    last_updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    video = db.relationship('Video', backref=db.backref('glossary_items', lazy='dynamic'))
    updater = db.relationship('User', backref='wiki_edits')
    
    # Unique constraint: One definition per term per video
    __table_args__ = (db.UniqueConstraint('video_id', 'term', name='_video_term_uc'),)

    def __repr__(self):
        return f'<VideoGlossary {self.term} in Video {self.video_id}>'

class VocabEditHistory(db.Model):
    """
    Audit log for community glossary edits (Wikipedia style).
    """
    __tablename__ = 'vocab_edit_histories'

    id = db.Column(db.Integer, primary_key=True)
    glossary_id = db.Column(db.Integer, db.ForeignKey('video_glossaries.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    old_definition = db.Column(db.Text)
    new_definition = db.Column(db.Text)
    
    change_reason = db.Column(db.String(500))
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    glossary = db.relationship('VideoGlossary', backref=db.backref('history', lazy='dynamic', order_by='VocabEditHistory.created_at.desc()'))
    user = db.relationship('User', backref='vocab_history_entries')

    def __repr__(self):
        return f'<VocabEditHistory {self.id} for {self.glossary_id}>'
