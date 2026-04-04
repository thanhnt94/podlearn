import json
from app import create_app
from app.extensions import db
from app.models.vocabulary import Vocabulary
from app.models.grammar import Grammar
from app.models.sentence import Sentence, SentenceSet
from app.models.user import User

def seed():
    app = create_app()
    with app.app_context():
        # 1. Get/Create Admin User
        admin = User.query.filter_by(is_admin=True).first()
        if not admin:
            print("No admin user found. Creating one...")
            admin = User(username='admin_seed', email='seed@AuraFlow.local', is_admin=True)
            admin.set_password('admin')
            db.session.add(admin)
            db.session.commit()

        # 2. Create a default Sentence Set
        s_set = SentenceSet.query.filter_by(user_id=admin.id, title="Deep Analysis Examples").first()
        if not s_set:
            s_set = SentenceSet(user_id=admin.id, title="Deep Analysis Examples", description="Hệ thống ví dụ cho Chế độ Phân tích Chuyên sâu")
            db.session.add(s_set)
            db.session.commit()

        # 3. Create Vocabulary
        v1 = Vocabulary.query.filter_by(word="練習").first()
        if not v1:
            v1 = Vocabulary(
                word="練習",
                reading="れんしゅう",
                meaning="Luyện tập",
                kanji_breakdown="練 (Luyện - rèn luyện) + 習 (Tập - học tập)",
                mnemonic="Rèn luyện thói quen học tập hàng ngày.",
                collocations=["毎日練習する", "ピアノの練習"],
                jlpt_level="N5"
            )
            db.session.add(v1)

        v2 = Vocabulary.query.filter_by(word="話せる").first()
        if not v2:
            v2 = Vocabulary(
                word="話せる",
                reading="はなせる",
                meaning="Có thể nói",
                kanji_breakdown="Thể khả năng của 話す (Hàn - Nói)",
                mnemonic="Nói chuyện bằng miệng.",
                collocations=["日本語が話せる"],
                jlpt_level="N4"
            )
            db.session.add(v2)

        # 4. Create Grammar
        g1 = Grammar.query.filter_by(pattern="~ようになる").first()
        if not g1:
            g1 = Grammar(
                pattern="~ようになる",
                formation="V-dictionary form + ようになる",
                meaning="Trở nên..., thay đổi trạng thái sang...",
                nuance="Diễn tả sự thay đổi từ trạng thái không thể sang có thể, hoặc từ không làm sang có làm một thói quen nào đó.",
                jlpt_level="N4"
            )
            db.session.add(g1)

        db.session.commit()

        # 5. Create Sentence and Link
        s1_text = "毎日練習すれば、日本語が話せるようになります。"
        s1 = Sentence.query.filter_by(original_text=s1_text).first()
        if not s1:
            s1 = Sentence(
                user_id=admin.id,
                set_id=s_set.id,
                original_text=s1_text,
                translated_text="Nếu luyện tập mỗi ngày, bạn sẽ có thể nói được tiếng Nhật.",
                analysis_note="Câu này kết hợp thể điều kiện (すれば) và cấu trúc biến đổi trạng thái (ようになる).",
                detailed_analysis={
                    "linguistic_analysis": {
                        "grammar_focus": {
                            "pattern": "~ようになる",
                            "meaning": "Trở nên có thể làm gì đó"
                        }
                    }
                }
            )
            db.session.add(s1)
            db.session.flush()

            # Linking Many-to-Many
            if v1: s1.vocabularies.append(v1)
            if v2: s1.vocabularies.append(v2)
            if g1: s1.grammars.append(g1)
            
            db.session.commit()
            print(f"Added and linked sentence: {s1_text}")
        else:
            print("Example sentence already exists.")

if __name__ == "__main__":
    seed()
    print("✅ Seeding completed successfully.")
