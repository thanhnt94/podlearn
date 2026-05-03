# Hướng dẫn tạo Subtitle đúng chuẩn cho PodLearn

Để hệ thống PodLearn có thể nhận diện từ vựng, hiển thị Furigana và phân tách từ chính xác, bạn nên tuân thủ các quy tắc định dạng dưới đây.

## 1. Định dạng File
*   **Loại file**: Hỗ trợ `.srt` hoặc `.vtt`.
*   **Encoding**: Bắt buộc sử dụng **UTF-8**.

## 2. Cấu trúc nội dung (Syntax đặc biệt)

### A. Furigana (Cách đọc)
Sử dụng dấu ngoặc nhọn `{}` ngay sau chữ Hán hoặc Katakana.
*   **Kanji (CHỈ dùng cho chữ Hán)**: `HánTự{hiragana}` -> Ví dụ: `昨日{きのう}`. 
    *   *Lưu ý*: Nếu từ có cả Hiragana đi kèm (Okurigana), chỉ đặt `{}` sau phần chữ Hán. 
    *   *Ví dụ*: `聞{き}きたくて` (Đúng), `聞きたくて{ききたくて}` (Sai).
*   **Katakana (Từ mượn)**: `Katakana{từ_gốc_lowercase}` -> Ví dụ: `ポッドキャスト{podcast}`.
*   **Katakana (Từ tượng thanh)**: `Katakana{hiragana}` -> Ví dụ: `コロコロ{ころころ}`.

### B. Phân tách từ (Segmentation)
Sử dụng dấu gạch đứng `|` để ngăn cách các từ. (Tuyệt đối không có khoảng trắng quanh dấu `|`).
*   **Ví dụ**: `私|は|日本|に|行きたい|입니다. (nhầm ví dụ Nhật Việt)` -> `私|は|日本|に|行きたい|です。`

### C. Từ gốc (Lemma)
Dùng ngoặc vuông `[]` cho từ gốc (thể từ điển) của Động từ/Tính từ.
*   **Ví dụ**: `話{はな}したい[話す]`

### D. Gán nhãn bỏ qua (Skip Tokens)
Dùng `[-]` cho các trợ từ hoặc từ đệm. **Lưu ý quan trọng**: Nếu có nhiều thành phần bỏ qua đứng cạnh nhau, hãy gộp chúng lại thành một cụm duy nhất rồi mới gán nhãn `[-]`.

---

## 3. AI Prompt mẫu để tạo Subtitle (Chuẩn nhất)
Copy toàn bộ prompt dưới đây để gửi cho AI:

```text
Bạn là một chuyên gia Ngôn ngữ học tiếng Nhật. Hãy xử lý nội dung phụ đề SRT dưới đây theo các quy tắc nghiêm ngặt:

1. GIỮ NGUYÊN định dạng SRT (số thứ tự và timestamps).
2. Dùng dấu gạch đứng `|` để phân tách từ (KHÔNG có khoảng trắng).
3. Furigana cho Kanji (RẤT QUAN TRỌNG): 
   - CHỈ thêm Furigana cho phần chữ Hán (Kanji). 
   - Đặt dấu { } ngay sau chữ Hán đó. 
   - TUYỆT ĐỐI không bao gồm phần chữ mềm Hiragana đi kèm (Okurigana) vào trong dấu { }.
   - Ví dụ ĐÚNG: 聞{き}きたくて, 食べ{た}べました.
   - Ví dụ SAI: 聞きたくて{ききたくて}, 食べました{たべました}.
4. Furigana cho Katakana:
   - Nếu là từ mượn: Thêm từ gốc ngoại ngữ (viết thường) vào { }. Ví dụ: ポッドキャスト{podcast}.
   - Nếu là từ thuần Nhật/Tượng thanh: Thêm Hiragana vào { }. Ví dụ: コロコロ{ころころ}.
5. Lemma: Với Động từ/Tính từ, khôi phục về thể từ điển trong [ ]. Ví dụ: 食べたい[食べる].
6. Nhãn Skip [-]:
   - Dùng cho trợ từ, dấu câu, từ đệm.
   - QUY TẮC GỘP: Gộp các thành phần skip cạnh nhau thành 1 cụm duy nhất rồi mới gán nhãn [-]. Ví dụ: "さんは、[-]"
7. TRẢ VỀ: Đặt kết quả vào trong một code block Markdown.

Nội dung cần xử lý:
[Dán nội dung SRT vào đây]
```
