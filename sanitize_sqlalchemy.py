from app import create_app
from app.extensions import db
from app.models.sentence import Sentence
from app.models.grammar import Grammar
from sqlalchemy import text

def sanitize_sqlalchemy():
    app = create_app()
    with app.app_context():
        print("--- Sanitizing via SQLAlchemy Context ---")
        
        # 1. Sentences
        sentences = Sentence.query.all()
        s_count = 0
        for s in sentences:
            if s.detailed_analysis == "" or s.detailed_analysis == " ":
                s.detailed_analysis = {}
                s_count += 1
        
        # 2. Grammar
        grammars = Grammar.query.all()
        g_count = 0
        for g in grammars:
            changed = False
            for attr in ['formation', 'signal_words', 'examples', 'points_to_note', 'similar_patterns']:
                val = getattr(g, attr)
                if val == "" or val == " ":
                    setattr(g, attr, None)
                    changed = True
            if changed:
                g_count += 1
        
        db.session.commit()
        print(f"Fixed {s_count} sentences and {g_count} grammar records.")

if __name__ == "__main__":
    sanitize_sqlalchemy()
