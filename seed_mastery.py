from app import create_app
from app.extensions import db
from app.models.vocabulary import Vocabulary
from app.models.grammar import Grammar
from app.models.sentence import Sentence, SentenceSet
from app.models.user import User

def seed_mastery():
    app = create_app()
    with app.app_context():
        try:
            # 1. Get/Create Admin User
            admin = User.query.filter_by(is_admin=True).first()
            if not admin:
                print("Creating admin user for seeding...")
                admin = User(username='admin', email='admin@AuraFlow.local', is_admin=True)
                admin.set_password('admin')
                db.session.add(admin)
                db.session.commit()

            # 2. Create Mastery Sentence Set
            s_set = SentenceSet.query.filter_by(user_id=admin.id, title="Mastery Deep Analysis").first()
            if not s_set:
                s_set = SentenceSet(user_id=admin.id, title="Mastery Deep Analysis", description="Dữ liệu mẫu cho Chế độ Phân tích Chuyên sâu")
                db.session.add(s_set)
                db.session.commit()

            # 3. Create Vocabulary
            v1 = Vocabulary(
                word="勉強", reading="べんきょう", meaning="Học tập",
                kanji_breakdown="勉 (Miễn - cố gắng) + 強 (Cường - mạnh mẽ)",
                mnemonic="Phải 'Cố gắng' và 'Mạnh mẽ' thì mới có thể 'Học tập' tốt.",
                jlpt_level="N5"
            )
            v2 = Vocabulary(
                word="絶対", reading="ぜったい", meaning="Tuyệt đối",
                kanji_breakdown="絶 (Tuyệt - tuyệt vời) + 対 (Đối - đối ứng)",
                jlpt_level="N4"
            )
            v3 = Vocabulary(
                word="合格", reading="ごうかく", meaning="Thi đỗ",
                kanji_breakdown="合 (Hợp - phù hợp) + 格 (Cách - tiêu chuẩn)",
                jlpt_level="N4"
            )
            db.session.add_all([v1, v2, v3])

            # 4. Create Grammar
            g1 = Grammar(
                pattern="〜に違いない", 
                formation="V-plain / A-i / A-na / N + に違いない",
                meaning="Chắc chắn là..., không thể sai được...",
                nuance="Dùng để khẳng định một dự đoán mang tính chủ quan nhưng có căn cứ mạnh mẽ.",
                jlpt_level="N3"
            )
            g2 = Grammar(
                pattern="〜ために",
                formation="V-plain (non-past) / N + の + ために",
                meaning="Để làm gì đó / Vì cái gì đó",
                nuance="Chỉ mục đích rõ ràng hoặc nguyên nhân/lợi ích cho một đối tượng nào đó.",
                jlpt_level="N4"
            )
            db.session.add_all([g1, g2])
            db.session.flush()

            # 5. Create Sentences and Link
            s1_text = "毎日勉強したから、絶対合格するに違いない。"
            s1 = Sentence(
                user_id=admin.id, set_id=s_set.id,
                original_text=s1_text,
                translated_text="Vì đã học mỗi ngày nên chắc chắn là sẽ thi đỗ.",
                analysis_note="Câu kết lập luận logic dựa trên nỗ lực trong quá khứ."
            )
            s1.vocabularies.append(v1)
            s1.vocabularies.append(v2)
            s1.vocabularies.append(v3)
            s1.grammars.append(g1)

            s2_text = "家族のために、頑張ります。"
            s2 = Sentence(
                user_id=admin.id, set_id=s_set.id,
                original_text=s2_text,
                translated_text="Tôi sẽ cố gắng vì gia đình.",
                analysis_note="Câu nói phổ biến thể hiện động lực từ người thân."
            )
            s2.grammars.append(g2)

            db.session.add_all([s1, s2])
            db.session.commit()
            print("Seed data created successfully!")

        except Exception as e:
            db.session.rollback()
            print(f"Error seeding data: {str(e)}")

if __name__ == "__main__":
    seed_mastery()
