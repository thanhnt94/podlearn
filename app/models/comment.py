from datetime import datetime, timezone
from ..extensions import db

class Comment(db.Model):
    __tablename__ = 'comments'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)
    
    # EdTech Feature: Trạng thái thời gian trong video
    video_timestamp = db.Column(db.Float, nullable=True)
    
    # Thread Reply / Nested Comments
    parent_id = db.Column(db.Integer, db.ForeignKey('comments.id'), nullable=True)
    
    likes_count = db.Column(db.Integer, default=0)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationship cho Reply Thread
    replies = db.relationship('Comment', backref=db.backref('parent', remote_side=[id]), lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<Comment {self.id} user={self.user_id} video={self.video_id}>'
