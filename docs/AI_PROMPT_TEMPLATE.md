# 🤖 Mẫu Prompt AI cho PodLearn (Quy tắc Băm Sub SRT Siết Chặt)

Tài liệu này chứa mẫu Prompt được thiết kế cực kỳ chi tiết để AI tạo ra file SRT chuẩn nhất, giúp bạn học từ vựng tập trung và không bị rối.

---

## 📝 Prompt Phân Tích & Băm Từ Siêu Chuẩn

**Mục tiêu:** Tạo file .srt băm nhỏ bằng `|`, gán từ gốc `[]` và loại bỏ các từ rác bằng `[skip]`.

### 🚩 QUY TẮC BẮT BUỘC (PHẢI TUÂN THỦ):

1.  **Từ gốc (Lemma)**:
    *   **Động từ/Tính từ đuôi i**: Đưa về dạng nguyên mẫu (ví dụ: `感じる`, `楽しい`).
    *   **Tính từ đuôi na**: **KHÔNG** được thêm `だ` vào cuối (ví dụ: `きれい [きれい]`, không được để `きれい [きれいだ]`).
2.  **Danh sách từ phải [skip] (Bỏ qua)**:
    *   **Trợ từ vô nghĩa**: `を`, `で`, `に`, `は`, `が`, `も`, `と`, `へ`... (ví dụ: `で [skip]`).
    *   **Đuôi lịch sự**: `ます`, `です`, `でした`, `でしょう`... nếu đứng riêng lẻ hoặc là phần bổ trợ không mang nghĩa gốc.
    *   **Dấu câu**: `、`, `。`, `！`, `？`, `「`, `」`... -> `[skip]`.
    *   **Tên riêng & Tiếng nước ngoài**: Tên người, địa danh, hoặc từ không phải tiếng Nhật -> `[skip]`.
3.  **Dấu phân cách**: Dùng `|` để tách các từ/cụm từ.

### Mẫu Prompt (Hãy copy đoạn này):
```text
Bạn là một chuyên gia ngôn ngữ học tiếng Nhật. Hãy phân tích và băm nhỏ file phụ đề SRT sau đây theo quy tắc nghiêm ngặt:

YÊU CẦU:
1. Giữ nguyên cấu trúc thời gian của file SRT.
2. Băm nhỏ mỗi câu bằng dấu gạch đứng `|`.
3. Đưa động từ/tính từ về dạng từ điển trong ngoặc vuông `[]`. Riêng tính từ đuôi na KHÔNG được thêm "da".
4. Gán nhãn "[skip]" cho: Trợ từ (wo, de, ni, wa...), Đuôi lịch sự (masu, desu), Dấu câu, Tên riêng, và các từ ngoại ngữ.
5. Đảm bảo file trả về vẫn là định dạng SRT.

VÍ DỤ MẪU:
Gốc: 日本で生きてきた田中さんは、とてもきれいです。
Kết quả: 日本 | で [skip] | 生きてきた [生きる] | 田中 [skip] | さん [skip] | は [skip] | 、 [skip] | とても | きれい | です [skip] | 。 [skip]

NỘI DUNG CẦN XỬ LÝ:
[DÁN NỘI DUNG FILE SRT VÀO ĐÂY]
```

---

## 💡 Lưu ý cho người dùng:
- Khi AI trả về, bạn chỉ cần nạp vào máy.
- Các từ có `[skip]` sẽ mờ đi, giúp bạn chỉ tập trung vào các từ "xịn" (động từ, tính từ, danh từ quan trọng).
- Việc bỏ `da` sau tính từ đuôi na giúp phần mềm tra từ điển Offline chính xác 100%.
