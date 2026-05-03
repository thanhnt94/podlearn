# 📚 Mẫu Prompt AI: Tạo Từ Điển (Video Glossary) cho PodLearn

Mẫu prompt này giúp AI tạo ra file JSON từ điển để bạn nạp vào hệ thống. Hệ thống sẽ ưu tiên dùng các định nghĩa này thay vì từ điển mặc định.

---

## 🎯 Mục tiêu
Tạo một file JSON chứa định nghĩa chi tiết cho các từ vựng. Bạn có thể paste từng đoạn nhỏ vào hệ thống mà không lo lỗi định dạng.

## 📝 Mẫu Prompt Tạo Từ Điển

**Hãy copy đoạn dưới đây:**

```text
Bạn là một biên tập viên từ điển chuyên nghiệp. Hãy giúp tôi tạo một bộ từ điển (Glossary) dạng JSON cho các từ vựng sau đây.

DANH SÁCH TỪ:
[DÁN DANH SÁCH TỪ HOẶC NỘI DUNG SRT ĐÃ BĂM VÀO ĐÂY]

YÊU CẦU ĐỊNH DẠNG JSON:
1. Trả về một mảng JSON các đối tượng (hoặc từng đối tượng đơn lẻ).
2. Mỗi đối tượng phải có các trường:
   - "term": Từ gốc (Lemma) - Phải trùng khớp với từ trong ngoặc vuông [] của file SRT.
   - "reading": Cách đọc (Hiragana).
   - "meaning": Nghĩa tiếng Việt ngắn gọn, dễ hiểu.
   - "kanji_viet": Âm Hán Việt (nếu có).
   - "lang": Mã ngôn ngữ (ví dụ: "ja", "en").

VÍ DỤ KẾT QUẢ:
[
  {
    "term": "感じる",
    "reading": "かんじる",
    "meaning": "Cảm thấy, cảm nhận",
    "kanji_viet": "CẢM",
    "lang": "ja"
  }
]

CHÚ Ý: 
- Chỉ trả về mã JSON, không giải thích gì thêm.
- Với tính từ đuôi na, không thêm "da" vào trường "term".
- Bỏ qua các từ đã được đánh dấu là [skip].
- Nếu danh sách dài, bạn có thể chia nhỏ để tôi paste dần vào hệ thống.
```

---

## 🚀 Cách sử dụng "Nạp Từng Chút Một"

1.  **Paste trực tiếp**: Bạn không cần tạo file. Chỉ cần copy đoạn JSON AI vừa trả về.
2.  **Không sợ lỗi dấu ngoặc**: Nếu bạn lỡ copy thiếu dấu `[` hoặc `]`, hệ thống sẽ tự động sửa lỗi và nạp các từ đúng định dạng.
3.  **Cập nhật liên tục**: Bạn có thể paste thêm JSON mới bất cứ lúc nào. Hệ thống sẽ tự động thêm từ mới hoặc cập nhật nghĩa cho từ cũ trong bộ từ điển của bài học.

**Lưu ý**: Hệ thống sẽ ưu tiên dùng "Main Glossary" của bài học để tra cứu trước khi dùng từ điển tổng quát.
