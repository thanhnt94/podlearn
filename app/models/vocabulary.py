from ..extensions import db

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

    def __repr__(self):
        return f'<Vocabulary {self.id}: {self.word}>'
