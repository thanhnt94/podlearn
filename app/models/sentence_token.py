from ..extensions import db
from datetime import datetime

class SentenceToken(db.Model):
    __tablename__ = 'sentence_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False)
    line_index = db.Column(db.Integer, nullable=False)
    token = db.Column(db.String(255), nullable=False)        # Surface form (displayed text, e.g. 食べた)
    lemma_override = db.Column(db.String(255), nullable=True) # Dictionary form override (e.g. 食べる)
    order_index = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Unique constraint to avoid collisions on the same POSITION
    __table_args__ = (db.UniqueConstraint('lesson_id', 'line_index', 'order_index', name='_lesson_line_order_uc'),)

    def to_dict(self):
        return {
            "id": self.id,
            "lesson_id": self.lesson_id,
            "line_index": self.line_index,
            "token": self.token,
            "lemma_override": self.lemma_override,
            "order_index": self.order_index
        }
