from datetime import datetime, timezone
from ..extensions import db

class AIInsightTrack(db.Model):
    """
    A collection of AI-generated insights for a specific video and language.
    Acts as a parallel subtitle track.
    """
    __tablename__ = 'ai_insight_tracks'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    language_code = db.Column(db.String(10), nullable=False, default='vi')
    
    engine = db.Column(db.String(50), default='gemini') # gemini, openai, etc.
    model_name = db.Column(db.String(100)) # e.g. gemini-1.5-pro
    
    status = db.Column(db.String(20), default='pending') # pending, processing, completed, failed
    processed_lines = db.Column(db.Integer, default=0)
    total_lines = db.Column(db.Integer, default=0)
    overall_summary = db.Column(db.Text, nullable=True) # Overall video summary
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    video = db.relationship('Video', backref=db.backref('ai_tracks', lazy='dynamic', cascade='all, delete-orphan'))
    insights = db.relationship('AIInsightItem', backref='track', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f'<AIInsightTrack {self.language_code} for video={self.video_id}>'

class AIInsightItem(db.Model):
    """
    Detailed linguistic and contextual analysis for a single sentence.
    """
    __tablename__ = 'ai_insight_items'

    id = db.Column(db.Integer, primary_key=True)
    track_id = db.Column(db.Integer, db.ForeignKey('ai_insight_tracks.id'), nullable=False, index=True)
    
    # Matches the index of the subtitle line in the original track
    subtitle_index = db.Column(db.Integer, nullable=False)
    
    # Timestamp info (cached for fast sub rendering)
    start_time = db.Column(db.Float, nullable=False)
    end_time = db.Column(db.Float, nullable=False)

    # Content
    short_explanation = db.Column(db.String(500)) # Used for subtitle overlay
    grammar_analysis = db.Column(db.Text)        # Detailed breakdown
    nuance_style = db.Column(db.Text)            # Formal vs Spoken etc.
    context_notes = db.Column(db.Text)           # Situational context
    
    # Extra metadata if needed
    data_json = db.Column(db.JSON, nullable=True)

    def __repr__(self) -> str:
        return f'<AIInsightItem idx={self.subtitle_index} for track={self.track_id}>'
