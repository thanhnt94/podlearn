from app import create_app
from app.extensions import db
from app.models.vocabulary import Vocabulary
from app.models.grammar import Grammar
from app.models.sentence import Sentence, SentenceSet
from app.models.user import User

def seed_comprehensive():
    app = create_app()
    with app.app_context():
        try:
            # 1. Get/Create Admin User
            admin = User.query.filter_by(is_admin=True).first()
            if not admin:
                admin = User(username='admin', email='admin@AuraFlow.local', is_admin=True)
                admin.set_password('admin')
                db.session.add(admin)
                db.session.commit()

            # --- 2. MASTER GRAMMAR TRACK ---
            g_set = SentenceSet.query.filter_by(user_id=admin.id, title="[MASTERY] Ngữ pháp chuyên sâu").first()
            if g_set: db.session.delete(g_set)
            g_set = SentenceSet(user_id=admin.id, title="[MASTERY] Ngữ pháp chuyên sâu", 
                               description="Luyện tập các cấu trúc ngữ pháp N3-N2 quan trọng.",
                               set_type="mastery_grammar")
            db.session.add(g_set)
            db.session.commit() # Commit to get ID
            g_set = SentenceSet.query.filter_by(user_id=admin.id, title="[MASTERY] Ngữ pháp chuyên sâu").first()

            grammars = [
                Grammar(pattern="〜に違いない", formation="V-plain / A-i / A-na / N + に違いない", 
                        meaning="Chắc chắn là...", nuance="Khẳng định mang tính chủ quan nhưng có căn cứ mạnh.", jlpt_level="N3"),
                Grammar(pattern="〜ものの", formation="V-plain / A-i / A-na / N + ものの", 
                        meaning="Mặc dù... nhưng...", nuance="Diễn tả sự đối lập giữa lý thuyết và thực tế.", jlpt_level="N2"),
                Grammar(pattern="〜からには", formation="V-plain / N + である + からには", 
                        meaning="Một khi đã... thì phải...", nuance="Thể hiện quyết tâm hoặc trách nhiệm tất yếu.", jlpt_level="N2"),
                Grammar(pattern="〜ほど", formation="V-plain / A-i / A-na / N + ほど", 
                        meaning="Đến mức... / Càng... càng...", nuance="Diễn tả mức độ hoặc sự thay đổi tỷ lệ thuận.", jlpt_level="N3"),
                Grammar(pattern="〜わけではない", formation="V-plain / A-i / A-na (na) / N (no) + わけではない", 
                        meaning="Không hẳn là... / Không có nghĩa là...", nuance="Phủ định một phần hoặc một suy luận logic.", jlpt_level="N3")
            ]
            db.session.add_all(grammars)
            db.session.flush()

            g_sentences = [
                ("彼は犯人に違いない。", "Anh ta chắc chắn là thủ phạm.", 0),
                ("練習はしたものの、本番で緊張してしまった。", "Mặc dù đã luyện tập nhưng tôi vẫn bị run khi diễn thật.", 1),
                ("約束したからには hay thực hiện.", "Một khi đã hứa thì phải thực hiện.", 2),
                ("死ぬほど疲れた。", "Mệt muốn chết (mệt đến mức chết).", 3),
                ("嫌いなわけではないが、食べる気にならない。", "Không hẳn là ghét nhưng tôi không muốn ăn.", 4)
            ]
            for text, trans, idx in g_sentences:
                s = Sentence(user_id=admin.id, set_id=g_set.id, original_text=text, translated_text=trans)
                s.grammars.append(grammars[idx])
                db.session.add(s)


            # --- 3. MASTER VOCABULARY TRACK ---
            v_set = SentenceSet.query.filter_by(user_id=admin.id, title="[MASTERY] Từ vựng trọng tâm").first()
            if v_set: db.session.delete(v_set)
            v_set = SentenceSet(user_id=admin.id, title="[MASTERY] Từ vựng trọng tâm", 
                               description="Phân tích Hán tự và mẹo nhớ cho từ vựng thông dụng.",
                               set_type="mastery_vocab")
            db.session.add(v_set)
            db.session.commit()
            v_set = SentenceSet.query.filter_by(user_id=admin.id, title="[MASTERY] Từ vựng trọng tâm").first()

            vocabs = [
                Vocabulary(word="準備", reading="じゅんび", meaning="Chuẩn bị", kanji_breakdown="準 (Chuẩn - tiêu chuẩn) + 備 (Bị - trang bị)", mnemonic="Trang bị theo tiêu chuẩn để sẵn sàng.", jlpt_level="N4"),
                Vocabulary(word="経験", reading="けいけん", meaning="Kinh nghiệm", kanji_breakdown="経 (Kinh - trải qua) + 験 (Nghiệm - kiểm tra)", mnemonic="Trải qua các bài kiểm tra thực tế để có kiến thức.", jlpt_level="N3"),
                Vocabulary(word="練習", reading="れんしゅう", meaning="Luyện tập", kanji_breakdown="練 (Luyện - rèn luyện) + 習 (Tập - học tập)", mnemonic="Rèn luyện thói quen học tập mỗi ngày.", jlpt_level="N4"),
                Vocabulary(word="成功", reading="せいこう", meaning="Thành công", kanji_breakdown="成 (Thành - trở thành) + 功 (Công - công trạng)", mnemonic="Đạt được thành tích to lớn.", jlpt_level="N3"),
                Vocabulary(word="失敗", reading="しっぱい", meaning="Thất bại", kanji_breakdown="失 (Thất - đánh mất) + 敗 (Bại - thua cuộc)", mnemonic="Để thua và đánh mất cơ hội.", jlpt_level="N4")
            ]
            db.session.add_all(vocabs)
            db.session.flush()

            v_sentences = [
                ("旅行の準備はできましたか。", "Bạn đã chuẩn bị cho chuyến đi chưa?", 0),
                ("海外で働くのはいい経験になる。", "Làm việc ở nước ngoài sẽ là một kinh nghiệm tốt.", 1),
                ("毎日ピアノを練習する。", "Luyện tập piano mỗi ngày.", 2),
                ("ついに実験に成功した。", "Cuối cùng cuộc thí nghiệm đã thành công.", 3),
                ("失敗を恐れてはいけない。", "Không được sợ hãi thất bại.", 4)
            ]
            for text, trans, idx in v_sentences:
                s = Sentence(user_id=admin.id, set_id=v_set.id, original_text=text, translated_text=trans)
                s.vocabularies.append(vocabs[idx])
                db.session.add(s)

            # --- 4. MASTER SENTENCE TRACK ---
            s_set = SentenceSet.query.filter_by(user_id=admin.id, title="[MASTERY] Mẫu câu phân tích").first()
            if s_set: db.session.delete(s_set)
            s_set = SentenceSet(user_id=admin.id, title="[MASTERY] Mẫu câu phân tích", 
                               description="Phân tích các mẫu câu phức hợp trong văn cảnh.",
                               set_type="mastery_sentence")
            db.session.add(s_set)
            db.session.commit()
            s_set = SentenceSet.query.filter_by(user_id=admin.id, title="[MASTERY] Mẫu câu phân tích").first()

            s_items = [
                ("日本語を勉強すればするほど、難しさがわかる。", "Càng học tiếng Nhật, càng thấy nó khó.", "Cấu trúc ~ば~ほど diễn tả sự thay đổi tỷ lệ thuận."),
                ("天気がいいからといって、遊びに行ってばかりはいられない。", "Dẫu cho thời tiết đẹp thì cũng không thể chỉ mải đi chơi được.", "Sự kết hợp giữa ~からといって (dẫu nói là) và ~ばかりはいられない (không thể chỉ mãi)."),
                ("明日が試験であるからには、今夜は徹夜で勉強するしかない。", "Một khi ngày mai đã là kỳ thi thì đêm nay chỉ còn cách thức trắng mà học.", "Sử dụng ~からには để nhấn mạnh trách nhiệm tất yếu.")
            ]
            for text, trans, note in s_items:
                s = Sentence(user_id=admin.id, set_id=s_set.id, original_text=text, translated_text=trans, analysis_note=note)
                db.session.add(s)

            db.session.commit()
            print("Comprehensive Mastery Data seeded successfully!")

        except Exception as e:
            db.session.rollback()
            print(f"Error seeding comprehensive data: {str(e)}")

if __name__ == "__main__":
    seed_comprehensive()
