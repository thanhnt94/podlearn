from datetime import datetime, timezone

from ..extensions import db


class ShareRequest(db.Model):
    """A request from one user to share a video workspace with another user."""
    __tablename__ = 'share_requests'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    sender_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    receiver_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    status = db.Column(db.String(20), default='pending') # pending, accepted, rejected
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    video = db.relationship('Video', backref=db.backref('share_requests', lazy='dynamic', cascade='all, delete-orphan'))
    sender = db.relationship('User', foreign_keys=[sender_id], backref=db.backref('sent_shares', cascade='all, delete-orphan'))
    receiver = db.relationship('User', foreign_keys=[receiver_id], backref=db.backref('received_shares', cascade='all, delete-orphan'))

    def __repr__(self) -> str:
        return f'<ShareRequest {self.sender_id}->{self.receiver_id} for video_id={self.video_id}>'
