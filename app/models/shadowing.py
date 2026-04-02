from datetime import datetime, timezone
from ..extensions import db


class ShadowingHistory(db.Model):
    """
    Records each shadowing attempt by a user.
    Linked to a specific sentence in a video via start_time and end_time.
    """
    __tablename__ = 'shadowing_history'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=True, index=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True, index=True)
    sentence_id = db.Column(db.Integer, db.ForeignKey('sentences.id'), nullable=True, index=True)
    
    # Sentence identification (legacy for video-based tracking)
    start_time = db.Column(db.Float, nullable=False)
    end_time = db.Column(db.Float, nullable=False)
    original_text = db.Column(db.Text)
    
    # Results
    accuracy_score = db.Column(db.Integer, nullable=False) # 0-100
    spoken_text = db.Column(db.Text)
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('shadowing_history', lazy='dynamic'))
    video = db.relationship('Video', backref=db.backref('shadowing_history', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('shadowing_history', lazy='dynamic'))
    sentence = db.relationship('Sentence', backref=db.backref('shadowing_history', lazy='dynamic'))

    def __repr__(self):
        return f'<ShadowingHistory user={self.user_id} score={self.accuracy_score} time={self.start_time}>'
