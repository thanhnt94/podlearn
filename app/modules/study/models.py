from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey, Table, Boolean, JSON, Float, Index, UniqueConstraint
from sqlalchemy.orm import relationship, backref
from app.core.database import Base


# --- From vocabulary.py ---

class Vocabulary(Base):
    """
    Stores individual vocabulary and kanji data for deep linguistic analysis.
    """
    __tablename__ = 'vocabulary'

    id = Column(Integer, primary_key=True)
    word = Column(String(255), nullable=False, index=True)
    reading = Column(String(255))
    meaning = Column(String(500))
    
    # Detailed analysis
    kanji_breakdown = Column(Text)
    mnemonic = Column(Text)
    
    # Store as JSON (list of strings or objects)
    collocations = Column(JSON)
    jlpt_level = Column(String(10))

    # Export Tracking
    is_exported = Column(Boolean, default=False, index=True)
    exported_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f'<Vocabulary {self.id}: {self.word}>'

# --- From sentence.py ---


class SentenceSet(Base):
    """
    Groups individual sentences/patterns into 'Decks' or 'Sets'.
    Each set belongs to a specific user.
    """
    __tablename__ = 'sentence_sets'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    set_type = Column(String(50), default='mastery_sentence')  # mastery_sentence, mastery_grammar, mastery_vocab
    visibility = Column(String(20), default='private') # private, pending_public, public
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Export Tracking
    is_exported = Column(Boolean, default=False, index=True)
    exported_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship('User', backref=backref('sentence_sets', lazy='dynamic'))
    sentences = relationship('Sentence', backref='sentence_set', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self):
        return f'<SentenceSet {self.id}: {self.title}>'


# Association tables for Many-to-Many relationships
sentence_vocab_table = Table(
    'sentence_vocab_association', Base.metadata,
    Column('sentence_id', Integer, ForeignKey('sentences.id'), primary_key=True),
    Column('vocabulary_id', Integer, ForeignKey('vocabulary.id'), primary_key=True)
)

sentence_grammar_table = Table(
    'sentence_grammar_association', Base.metadata,
    Column('sentence_id', Integer, ForeignKey('sentences.id'), primary_key=True),
    Column('grammar_id', Integer, ForeignKey('grammar.id'), primary_key=True)
)


class Sentence(Base):
    """
    Stores individual sentences or patterns for focused learning.
    Must belong to a SentenceSet.
    """
    __tablename__ = 'sentences'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    set_id = Column(Integer, ForeignKey('sentence_sets.id'), nullable=False, index=True)
    
    original_text = Column(Text, nullable=False)
    translated_text = Column(Text)
    audio_url = Column(String(500))
    
    # Optional link to source video
    source_video_id = Column(Integer, ForeignKey('videos.id'), nullable=True, index=True)
    start_time = Column(Float, nullable=True)
    end_time = Column(Float, nullable=True)

    # Detailed linguistic analysis (grammar, vocabulary, etc.)
    detailed_analysis = Column(JSON)
    analysis_note = Column(Text)

    # SRS (Spaced Repetition System) Metadata
    next_review_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), index=True)
    ease_factor = Column(Float, default=2.5)  # Multiplier for interval growth
    interval_days = Column(Integer, default=0) # Consecutive days until next review
    mastery_level = Column(Integer, default=0) # Stages of memorization (e.g. 0-5)

    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    # Export Tracking
    is_exported = Column(Boolean, default=False, index=True)
    exported_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship('User', backref=backref('sentences', lazy='dynamic'))
    video = relationship('Video', backref=backref('sentences', lazy='dynamic'))
    
    # Deep Analysis Relationships
    vocabularies = relationship(
        'Vocabulary', 
        secondary=sentence_vocab_table, 
        backref=backref('sentences', lazy='dynamic')
    )
    grammars = relationship(
        'Grammar', 
        secondary=sentence_grammar_table, 
        backref=backref('sentences', lazy='dynamic')
    )

    # Composite Index for performance
    __table_args__ = (
        Index('idx_sentence_review', 'next_review_at', 'user_id'),
    )

    def __repr__(self):
        return f'<Sentence {self.id}: {self.original_text[:20]}...>'

# --- From grammar.py ---

class Grammar(Base):
    """
    Stores grammar patterns and usage context for deep linguistic analysis.
    """
    __tablename__ = 'grammar'

    id = Column(Integer, primary_key=True)
    pattern = Column(String(255), nullable=False, index=True)
    formation = Column(JSON)
    meaning = Column(String(500))
    
    # New JLPT-focused fields (JSON Refactor)
    signal_words = Column(JSON)      # Stores [{"word": "...", "meaning": "..."}]
    examples = Column(JSON)          # Stores [{"japanese": "...", "vietnamese": "..."}]
    nuance = Column(Text)            # Sắc thái ý nghĩa
    points_to_note = Column(JSON)    # Refactored: List of strings ["Note 1", "Note 2"]
    similar_patterns = Column(JSON)  # Refactored: List of objects [{"pattern": "...", "difference": "..."}]
    
    jlpt_level = Column(String(10))
    tags = Column(String(255))       # Phân loại (chuỗi cách nhau bằng dấu phẩy)

    # Export Tracking
    is_exported = Column(Boolean, default=False, index=True)
    exported_at = Column(DateTime, nullable=True)

    def __repr__(self):
        return f'<Grammar {self.id}: {self.pattern}>'

# --- From ai_insight.py ---

class AIInsightTrack(Base):
    """
    A collection of AI-generated insights for a specific video and language.
    Acts as a parallel subtitle track.
    """
    __tablename__ = 'ai_insight_tracks'

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False, index=True)
    language_code = Column(String(10), nullable=False, default='vi')
    
    engine = Column(String(50), default='gemini') # gemini, openai, etc.
    model_name = Column(String(100)) # e.g. gemini-1.5-pro
    
    status = Column(String(20), default='pending') # pending, processing, completed, failed
    processed_lines = Column(Integer, default=0)
    total_lines = Column(Integer, default=0)
    overall_summary = Column(Text, nullable=True) # Overall video summary
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    video = relationship('Video', backref=backref('ai_tracks', lazy='dynamic', cascade='all, delete-orphan'))
    insights = relationship('AIInsightItem', backref='track', lazy='dynamic', cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f'<AIInsightTrack {self.language_code} for video={self.video_id}>'

class AIInsightItem(Base):
    """
    Detailed linguistic and contextual analysis for a single sentence.
    """
    __tablename__ = 'ai_insight_items'

    id = Column(Integer, primary_key=True)
    track_id = Column(Integer, ForeignKey('ai_insight_tracks.id'), nullable=False, index=True)
    
    # Matches the index of the subtitle line in the original track
    subtitle_index = Column(Integer, nullable=False)
    
    # Timestamp info (cached for fast sub rendering)
    start_time = Column(Float, nullable=False)
    end_time = Column(Float, nullable=False)

    # Content
    short_explanation = Column(String(500)) # Used for subtitle overlay
    grammar_analysis = Column(Text)        # Detailed breakdown
    nuance_style = Column(Text)            # Formal vs Spoken etc.
    context_notes = Column(Text)           # Situational context
    
    # Extra metadata if needed
    data_json = Column(JSON, nullable=True)

    def __repr__(self) -> str:
        return f'<AIInsightItem idx={self.subtitle_index} for track={self.track_id}>'

# --- From glossary.py ---

class VideoDictionary(Base):
    """
    Groups glossary items into a named dictionary.
    Can be tied to a lesson (Video Glossary) or be a Global System Dictionary (lesson_id=None).
    """
    __tablename__ = 'video_dictionaries'
    id = Column(Integer, primary_key=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id', ondelete='CASCADE'), nullable=True) # Optional for global
    name = Column(String(100), nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    
    # New fields for global/language pairing
    language_code = Column(String(10), default='ja') # Source lang
    target_language_code = Column(String(10), default='vi') # Destination lang

    # Relationships
    glossary_items = relationship('VideoGlossary', backref='dictionary', lazy='dynamic', cascade='all, delete-orphan')

class VideoGlossary(Base):
    """
    Flashcard mastery items (formerly shared community glossary).
    Simplified to Front and Back structure for interactive learning.
    """
    __tablename__ = 'video_glossaries'

    id = Column(Integer, primary_key=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id'), nullable=True, index=True)
    dictionary_id = Column(Integer, ForeignKey('video_dictionaries.id', ondelete='CASCADE'), nullable=True)
    
    # Front of the card (usually the word/sentence)
    front = Column(String(255), nullable=False, index=True)
    # Hidden part of the card (reading + meaning etc.)
    back = Column(Text, nullable=False)

    # Legacy fields (kept for migration/compatibility)
    reading = Column(String(255))
    source = Column(String(20), default='manual')
    
    # Frequency: Number of times this term appears in the lesson/video
    frequency = Column(Integer, default=1)
    
    # Metadata
    last_updated_by = Column(Integer, ForeignKey('users.id'))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # New fields for flexibility
    language_code = Column(String(10), default='ja') # Source lang
    target_language_code = Column(String(10), default='vi') # Destination lang
    extra_data = Column(JSON, nullable=True) 

    # Relationships
    video = relationship('Video', backref=backref('glossary_items', lazy='dynamic'))
    updater = relationship('User', backref='wiki_edits')
    
    # Unique constraint
    __table_args__ = (
        UniqueConstraint('dictionary_id', 'front', name='_dictionary_front_uc'),
        UniqueConstraint('lesson_id', 'front', name='_lesson_front_uc'),
    )

    def to_dict(self):
        return {
            "id": self.id,
            "front": self.front,
            "back": self.back,
            "reading": self.reading,
            "source": self.source,
            "extra_data": self.extra_data or {}
        }

    def __repr__(self):
        return f'<VideoGlossary {self.term} in Video {self.video_id}>'

class VocabEditHistory(Base):
    """
    Audit log for community glossary edits (Wikipedia style).
    """
    __tablename__ = 'vocab_edit_histories'

    id = Column(Integer, primary_key=True)
    glossary_id = Column(Integer, ForeignKey('video_glossaries.id'), nullable=False)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False)
    
    old_definition = Column(Text)
    new_definition = Column(Text)
    
    change_reason = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Relationships
    glossary = relationship('VideoGlossary', backref=backref('history', lazy='dynamic', order_by='VocabEditHistory.created_at.desc()'))
    user = relationship('User', backref='vocab_history_entries')

    def __repr__(self):
        return f'<VocabEditHistory {self.id} for {self.glossary_id}>'

# --- From sentence_token.py ---

class SentenceToken(Base):
    __tablename__ = 'sentence_tokens'
    
    id = Column(Integer, primary_key=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False)
    line_index = Column(Integer, nullable=False)
    token = Column(String(255), nullable=False)        # Surface form (displayed text, e.g. 食べた)
    lemma_override = Column(String(255), nullable=True) # Dictionary form override (e.g. 食べる)
    pos = Column(String(50), nullable=True)             # Part of speech (e.g. 助詞) to maintain styling
    reading = Column(String(255), nullable=True)        # Pronunciation (e.g. たべた)
    meaning = Column(String(500), nullable=True)        # Translation (e.g. ate)
    extra_data = Column(JSON, nullable=True)            # Flexible AI data (e.g. {"kanji_viet": "THỰC"})
    order_index = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Unique constraint to avoid collisions on the same POSITION
    __table_args__ = (UniqueConstraint('lesson_id', 'line_index', 'order_index', name='_lesson_line_order_uc'),)

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



class Lesson(Base):
    """A user's saved video — links a user to a video with their language choices."""
    __tablename__ = 'lessons'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    video_id = Column(Integer, ForeignKey('videos.id'), nullable=False, index=True)
    original_lang_code = Column(String(10))
    target_lang_code = Column(String(10))
    third_lang_code = Column(String(10))

    # Precise Track Selection
    s1_track_id = Column(Integer, ForeignKey('subtitle_tracks.id'), nullable=True)
    s2_track_id = Column(Integer, ForeignKey('subtitle_tracks.id'), nullable=True)
    s3_track_id = Column(Integer, ForeignKey('subtitle_tracks.id'), nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    last_accessed = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    
    # Progress Tracking
    is_completed = Column(Boolean, default=False)
    time_spent = Column(Integer, default=0) # Total seconds spent studying this lesson
    # Visual Options for Notes
    note_appear_before = Column(Float, default=2.0) # Seconds before timestamp
    note_duration = Column(Float, default=5.0)      # Total display duration

    # Shadowing Options
    shadowing_extra_time = Column(Float, default=2.0) # Additional seconds after sentence
    shadowing_hide_subs = Column(Boolean, default=False) # Hide subs during pause

    # Store UI settings as JSON string: {"sub_size": "24px", "sub_color": "#fff", "sub_pos": "bottom", ...}
    settings_json = Column(Text, default='{}')

    # Unique constraint: one lesson per user per video
    __table_args__ = (
        UniqueConstraint('user_id', 'video_id', name='uq_user_video'),
    )

    # Relationships
    user = relationship('User', backref=backref('lessons', lazy='dynamic'))
    video = relationship('Video', backref=backref('lessons', lazy='dynamic'))
    notes = relationship('Note', back_populates='lesson', lazy='dynamic',
                            cascade='all, delete-orphan')

    def __repr__(self) -> str:
        return f'<Lesson user={self.user_id} video={self.video_id}>'

# --- From note.py ---



class Note(Base):
    """A timestamped note attached to a lesson."""
    __tablename__ = 'notes'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey('users.id'), nullable=False, index=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id'), nullable=False, index=True)
    timestamp = Column(Float, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                           onupdate=lambda: datetime.now(timezone.utc))

    # Export Tracking
    is_exported = Column(Boolean, default=False, index=True)
    exported_at = Column(DateTime, nullable=True)

    # Relationships
    user = relationship('User', backref=backref('notes', lazy='dynamic'))
    lesson = relationship('Lesson', back_populates='notes')

    def __repr__(self) -> str:
        return f'<Note @{self.timestamp}s lesson={self.lesson_id}>'

class LessonWordStatus(Base):
    """
    Tracks word-specific settings (skip/use) at the lesson level.
    Ensures global synchronization for a lemma across all instances in a lesson.
    """
    __tablename__ = 'lesson_word_statuses'
    
    id = Column(Integer, primary_key=True)
    lesson_id = Column(Integer, ForeignKey('lessons.id', ondelete='CASCADE'), nullable=False, index=True)
    lemma = Column(String(255), nullable=False, index=True)
    status = Column(String(20), default='use') # 'use', 'skip'
    
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint('lesson_id', 'lemma', name='_lesson_lemma_status_uc'),
    )

    def __repr__(self) -> str:
        return f'<LessonWordStatus {self.lemma} for lesson={self.lesson_id}: {self.status}>'

