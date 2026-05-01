from datetime import datetime, timezone
from app.core.extensions import db


# --- From vocabulary.py ---

class Vocabulary(db.Model):
    """
    Stores individual vocabulary and kanji data for deep linguistic analysis.
    """
    __tablename__ = 'vocabulary'

    id = db.Column(db.Integer, primary_key=True)
    word = db.Column(db.String(255), nullable=False, index=True)
    reading = db.Column(db.String(255))
    meaning = db.Column(db.String(500))
    
    # Detailed analysis
    kanji_breakdown = db.Column(db.Text)
    mnemonic = db.Column(db.Text)
    
    # Store as JSON (list of strings or objects)
    collocations = db.Column(db.JSON)
    jlpt_level = db.Column(db.String(10))

    # Export Tracking
    is_exported = db.Column(db.Boolean, default=False, index=True)
    exported_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<Vocabulary {self.id}: {self.word}>'

# --- From sentence.py ---


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
    visibility = db.Column(db.String(20), default='private') # private, pending_public, public
    
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Export Tracking
    is_exported = db.Column(db.Boolean, default=False, index=True)
    exported_at = db.Column(db.DateTime, nullable=True)

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

    # SRS (Spaced Repetition System) Metadata
    next_review_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    ease_factor = db.Column(db.Float, default=2.5)  # Multiplier for interval growth
    interval_days = db.Column(db.Integer, default=0) # Consecutive days until next review
    mastery_level = db.Column(db.Integer, default=0) # Stages of memorization (e.g. 0-5)

    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Export Tracking
    is_exported = db.Column(db.Boolean, default=False, index=True)
    exported_at = db.Column(db.DateTime, nullable=True)

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

    # Composite Index for performance
    __table_args__ = (
        db.Index('idx_sentence_review', 'next_review_at', 'user_id'),
    )

    def __repr__(self):
        return f'<Sentence {self.id}: {self.original_text[:20]}...>'

# --- From grammar.py ---

class Grammar(db.Model):
    """
    Stores grammar patterns and usage context for deep linguistic analysis.
    """
    __tablename__ = 'grammar'

    id = db.Column(db.Integer, primary_key=True)
    pattern = db.Column(db.String(255), nullable=False, index=True)
    formation = db.Column(db.JSON)
    meaning = db.Column(db.String(500))
    
    # New JLPT-focused fields (JSON Refactor)
    signal_words = db.Column(db.JSON)      # Stores [{"word": "...", "meaning": "..."}]
    examples = db.Column(db.JSON)          # Stores [{"japanese": "...", "vietnamese": "..."}]
    nuance = db.Column(db.Text)            # Sắc thái ý nghĩa
    points_to_note = db.Column(db.JSON)    # Refactored: List of strings ["Note 1", "Note 2"]
    similar_patterns = db.Column(db.JSON)  # Refactored: List of objects [{"pattern": "...", "difference": "..."}]
    
    jlpt_level = db.Column(db.String(10))
    tags = db.Column(db.String(255))       # Phân loại (chuỗi cách nhau bằng dấu phẩy)

    # Export Tracking
    is_exported = db.Column(db.Boolean, default=False, index=True)
    exported_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f'<Grammar {self.id}: {self.pattern}>'

# --- From ai_insight.py ---

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

# --- From glossary.py ---

class VideoGlossary(db.Model):
    """
    Shared community glossary for a specific video.
    Definitions here override the generic JMDict meanings.
    """
    __tablename__ = 'video_glossaries'

    id = db.Column(db.Integer, primary_key=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=True) # Now optional
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True, index=True)
    
    # The term being defined (usually the lemma/dictionary form)
    term = db.Column(db.String(255), nullable=False, index=True)
    reading = db.Column(db.String(255))
    
    # Current "Wiki" definition
    definition = db.Column(db.Text, nullable=False)
    
    # Track the source of the definition (mazii or jamdict)
    source = db.Column(db.String(20), default='jamdict')
    
    # Frequency: Number of times this term appears in the lesson/video
    frequency = db.Column(db.Integer, default=1)
    
    # Metadata
    last_updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Relationships
    video = db.relationship('Video', backref=db.backref('glossary_items', lazy='dynamic'))
    updater = db.relationship('User', backref='wiki_edits')
    
    # Unique constraint: One definition per term per lesson (if lesson exists) or video
    __table_args__ = (db.UniqueConstraint('lesson_id', 'term', name='_lesson_term_uc'),)

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

# --- From sentence_token.py ---

class SentenceToken(db.Model):
    __tablename__ = 'sentence_tokens'
    
    id = db.Column(db.Integer, primary_key=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False)
    line_index = db.Column(db.Integer, nullable=False)
    token = db.Column(db.String(255), nullable=False)        # Surface form (displayed text, e.g. 食べた)
    lemma_override = db.Column(db.String(255), nullable=True) # Dictionary form override (e.g. 食べる)
    pos = db.Column(db.String(50), nullable=True)             # Part of speech (e.g. 助詞) to maintain styling
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

# --- From lesson.py ---



class Lesson(db.Model):
    """A user's saved video — links a user to a video with their language choices."""
    __tablename__ = 'lessons'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    video_id = db.Column(db.Integer, db.ForeignKey('videos.id'), nullable=False, index=True)
    original_lang_code = db.Column(db.String(10))
    target_lang_code = db.Column(db.String(10))
    third_lang_code = db.Column(db.String(10))

    # Precise Track Selection
    s1_track_id = db.Column(db.Integer, db.ForeignKey('subtitle_tracks.id'), nullable=True)
    s2_track_id = db.Column(db.Integer, db.ForeignKey('subtitle_tracks.id'), nullable=True)
    s3_track_id = db.Column(db.Integer, db.ForeignKey('subtitle_tracks.id'), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Progress Tracking
    is_completed = db.Column(db.Boolean, default=False)
    time_spent = db.Column(db.Integer, default=0) # Total seconds spent studying this lesson

    # Visual Options for Notes
    note_appear_before = db.Column(db.Float, default=2.0) # Seconds before timestamp
    note_duration = db.Column(db.Float, default=5.0)      # Total display duration

    # Shadowing Options
    shadowing_extra_time = db.Column(db.Float, default=2.0) # Additional seconds after sentence
    shadowing_hide_subs = db.Column(db.Boolean, default=False) # Hide subs during pause



    
    # Store UI settings as JSON string: {"sub_size": "24px", "sub_color": "#fff", "sub_pos": "bottom", ...}
    settings_json = db.Column(db.Text, default='{}')

    # Unique constraint: one lesson per user per video
    __table_args__ = (
        db.UniqueConstraint('user_id', 'video_id', name='uq_user_video'),
    )

    # Relationships
    user = db.relationship('User', backref=db.backref('lessons', lazy='dynamic'))
    video = db.relationship('Video', backref=db.backref('lessons', lazy='dynamic'))
    notes = db.relationship('Note', back_populates='lesson', lazy='dynamic',
                            cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f'<Lesson user={self.user_id} video={self.video_id}>'

# --- From note.py ---



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

    # Export Tracking
    is_exported = db.Column(db.Boolean, default=False, index=True)
    exported_at = db.Column(db.DateTime, nullable=True)

    # Relationships
    user = db.relationship('User', backref=db.backref('notes', lazy='dynamic'))
    lesson = db.relationship('Lesson', back_populates='notes')

    def __repr__(self) -> str:
        return f'<Note @{self.timestamp}s lesson={self.lesson_id}>'

