from datetime import datetime, timezone
from ..extensions import db


class SentenceSet(db.Model):
    """
    Groups individual sentences/patterns into 'Decks' or 'Sets'.
    Each set belongs to a specific user.
    """
    __tablename__ = 'sentence_sets'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text)
    set_type = db.Column(db.String(50), default='mastery_sentence')  # mastery_sentence, mastery_grammar, mastery_vocab
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('sentence_sets', lazy='dynamic'))
    sentences = db.relationship('Sentence', backref='sentence_set', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<SentenceSet {self.id}: {self.title}>'


# Association tables for Many-to-Many relationships
sentence_vocab_table = db.Table(
    'sentence_vocab_association',
    db.Column('sentence_id', db.Integer, db.ForeignKey('sentences.id'), primary_key=True),
    db.Column('vocabulary_id', db.Integer, db.ForeignKey('vocabulary.id'), primary_key=True)
)

sentence_grammar_table = db.Table(
    'sentence_grammar_association',
    db.Column('sentence_id', db.Integer, db.ForeignKey('sentences.id'), primary_key=True),
    db.Column('grammar_id', db.Integer, db.ForeignKey('grammar.id'), primary_key=True)
)


class Sentence(db.Model):
    """
    Stores individual sentences or patterns for focused learning.
    Must belong to a SentenceSet.
    """
    __tablename__ = 'sentences'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    set_id = db.Column(db.Integer, db.ForeignKey('sentence_sets.id'), nullable=False, index=True)
    
    original_text = db.Column(db.Text, nullable=False)
    translated_text = db.Column(db.Text)
    audio_url = db.Column(db.String(500))
    
    # Optional link to source video
    source_video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=True, index=True)
    start_time = db.Column(db.Float, nullable=True)
    end_time = db.Column(db.Float, nullable=True)

    # Detailed linguistic analysis (grammar, vocabulary, etc.)
    detailed_analysis = db.Column(db.JSON)
    analysis_note = db.Column(db.Text)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    user = db.relationship('User', backref=db.backref('sentences', lazy='dynamic'))
    video = db.relationship('Video', backref=db.backref('sentences', lazy='dynamic'))
    
    # Deep Analysis Relationships
    vocabularies = db.relationship(
        'Vocabulary', 
        secondary=sentence_vocab_table, 
        backref=db.backref('sentences', lazy='dynamic')
    )
    grammars = db.relationship(
        'Grammar', 
        secondary=sentence_grammar_table, 
        backref=db.backref('sentences', lazy='dynamic')
    )

    def __repr__(self):
        return f'<Sentence {self.id}: {self.original_text[:20]}...>'
