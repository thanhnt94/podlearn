from ..extensions import db

class Grammar(db.Model):
    """
    Stores grammar patterns and usage context for deep linguistic analysis.
    """
    __tablename__ = 'grammar'

    id = db.Column(db.Integer, primary_key=True)
    pattern = db.Column(db.String(255), nullable=False, index=True)
    formation = db.Column(db.String(500))
    meaning = db.Column(db.String(500))
    
    # New JLPT-focused fields
    signal_words = db.Column(db.Text)      # Các phó từ/từ hô ứng nhận biết
    canonical_example = db.Column(db.Text) # Một ví dụ đinh (kinh điển nhất)
    nuance = db.Column(db.Text)            # Sắc thái ý nghĩa
    points_to_note = db.Column(db.Text)    # Các lưu ý ngoại lệ
    similar_patterns = db.Column(db.Text)  # Phân biệt với ngữ pháp khác
    
    jlpt_level = db.Column(db.String(10))
    tags = db.Column(db.String(255))       # Phân loại (chuỗi cách nhau bằng dấu phẩy)

    def __repr__(self):
        return f'<Grammar {self.id}: {self.pattern}>'
