from datetime import datetime, timezone

from ..extensions import db


class Note(db.Model):
    """A timestamped note attached to a lesson."""
    __tablename__ = 'notes'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False, index=True)
    timestamp = db.Column(db.Float, nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', back_populates='notes')
    lesson = db.relationship('Lesson', back_populates='notes')

    def __repr__(self) -> str:
        return f'<Note @{self.timestamp}s lesson={self.lesson_id}>'
