# Hướng dẫn tạo Subtitle đúng chuẩn cho PodLearn

Để hệ thống PodLearn có thể nhận diện từ vựng, hiển thị Furigana và phân tách từ chính xác, bạn nên tuân thủ các quy tắc định dạng dưới đây.

## 1. Định dạng File
*   **Loại file**: Hỗ trợ `.srt` hoặc `.vtt`.
*   **Encoding**: Bắt buộc sử dụng **UTF-8**.

## 2. Cấu trúc nội dung (Syntax đặc biệt)

### A. Furigana (Cách đọc)
Sử dụng dấu ngoặc nhọn `{}` ngay sau từ.
*   **Kanji**: `HánTự{hiragana}` -> Ví dụ: `昨日{きのう}`
*   **Katakana**: `Katakana{từ_gốc_lowercase}` -> Ví dụ: `ポッドキャスト{podcast}`

### B. Phân tách từ (Segmentation)
Sử dụng dấu gạch đứng `|` để ngăn cách các từ. (Tuyệt đối không có khoảng trắng quanh dấu `|`).
*   **Ví dụ**: `私|は|日本|に|行きたい|です。`

### C. Từ gốc (Lemma)
Dùng ngoặc vuông `[]` cho từ gốc (thể từ điển) của Động từ/Tính từ.
*   **Ví dụ**: `話{はな}したい[話す]`

### D. Gán nhãn bỏ qua (Skip Tokens)
Dùng `[-]` cho các trợ từ hoặc từ đệm. **Lưu ý quan trọng**: Nếu có nhiều thành phần bỏ qua đứng cạnh nhau, hãy gộp chúng lại thành một cụm duy nhất rồi mới gán nhãn `[-]`.
*   **Ví dụ**: `私|は[-]|日本|に[-]` -> `私|は[-]` (Nếu "wa" và "ni" đứng cạnh nhau thì gộp lại).
*   **Đúng chuẩn**: `レイラさんは、[-]` (Thay vì `レイラ|さん|は|、[-]`)

---

## 3. AI Prompt mẫu để tạo Subtitle (Chuẩn nhất)
Copy toàn bộ prompt dưới đây để gửi cho AI (Gemini, Claude, ChatGPT):

```text
Bạn là một chuyên gia Ngôn ngữ học tiếng Nhật. Hãy xử lý nội dung phụ đề SRT dưới đây theo các quy tắc nghiêm ngặt:

1. GIỮ NGUYÊN vẹn định dạng SRT (số thứ tự và timestamps).
2. Dùng dấu gạch đứng `|` để phân tách từ (TUYỆT ĐỐI không có khoảng trắng xung quanh).
3. Furigana:
   - Với Kanji: Thêm Hiragana vào `{ }`. Ví dụ: 日本{にほん}.
   - Với Katakana: Thêm từ ngoại ngữ gốc (viết thường - lowercase) vào `{ }`. Ví dụ: ポッドキャスト{podcast}.
4. Lemma: Với Động từ/Tính từ, khôi phục về thể từ điển trong `[ ]`. Ví dụ: 食べたい[食べる]. (Không thêm Furigana vào trong [ ]).
5. Nhãn Skip [-]:
   - Chỉ dùng cho: Trợ từ (wa, ga, ni...), dấu câu, từ đệm (ano, eto).
   - QUY TẮC GỘP: Nếu nhiều thành phần skip đứng cạnh nhau, hãy GỘP LẠI thành 1 cụm duy nhất rồi mới gán nhãn [-]. Ví dụ: "さんは、[-]" thay vì tách lẻ.
6. TRẢ VỀ KẾT QUẢ: Đặt toàn bộ nội dung SRT đã xử lý vào trong một code block Markdown để tôi dễ dàng copy.

Nội dung cần xử lý:
[Dán nội dung SRT vào đây]
```

---

## 4. Quy tắc trình bày (Best Practices)
*   **Độ dài câu**: Không quá 2 dòng.
*   **Timing**: Sub nên xuất hiện sớm hơn tiếng nói khoảng 100ms - 200ms.
