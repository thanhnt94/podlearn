from ..extensions import db

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

    def __repr__(self):
        return f'<Grammar {self.id}: {self.pattern}>'
