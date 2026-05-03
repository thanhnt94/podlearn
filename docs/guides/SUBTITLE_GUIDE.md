# Hướng dẫn tạo Subtitle đúng chuẩn cho PodLearn

Để hệ thống PodLearn có thể nhận diện từ vựng, hiển thị Furigana và phân tách từ chính xác, bạn nên tuân thủ các quy tắc định dạng dưới đây.

## 1. Định dạng File
*   **Loại file**: Hỗ trợ `.srt` hoặc `.vtt`.
*   **Encoding**: Bắt buộc sử dụng **UTF-8** (để hiển thị đúng tiếng Nhật/Việt).

## 2. Cấu trúc nội dung (Syntax đặc biệt)

### A. Furigana (Cách đọc)
Sử dụng dấu ngoặc nhọn `{}` ngay sau từ Hán tự hoặc từ cần chú thích cách đọc.
*   **Cấu trúc**: `TừVựng{cách_đọc}`
*   **Ví dụ**: 
    - `昨日{きのう} là hôm qua.`
    - `学習{がくしゅう}`

### B. Phân tách từ (Segmentation)
Sử dụng dấu gạch đứng `|` để ngăn cách các từ. Việc này giúp hệ thống tra từ chính xác mà không phụ thuộc vào AI tự động.
*   **Ví dụ**: `私|は|日本|に|行きたい|です。`

### C. Từ gốc (Lemma)
Với các từ đã chia (động từ, tính từ), bạn có thể cung cấp từ gốc trong ngoặc vuông `[]` để hệ thống tra từ điển chính xác hơn.
*   **Ví dụ**: `話{はな}したい[話す]` (Hệ thống sẽ hiển thị "hanashitai" nhưng tra từ điển cho "hanasu").

### D. Gán nhãn bỏ qua (Skip Tokens)
Dùng `[-]` cho các trợ từ hoặc từ vô nghĩa.
*   **Ví dụ**: `私|は[-]`

---

## 3. AI Prompt mẫu để tạo Subtitle
Bạn có thể copy prompt dưới đây và gửi kèm file SRT/Transcript cho AI (ChatGPT, Claude, Gemini) để nhờ nó xử lý đúng định dạng.

```text
Bạn là một chuyên gia Ngôn ngữ học tiếng Nhật. Hãy xử lý nội dung phụ đề dưới đây theo các quy tắc:

1. Băm nhỏ câu thành các phần, ngăn cách bởi dấu gạch đứng `|`.
2. Với Chữ Hán (Kanji): Thêm Hiragana vào dấu ngoặc nhọn `{ }` (VD: 日本{にほん}).
3. Với Từ mượn (Katakana): Thêm Từ ngoại ngữ gốc vào dấu ngoặc nhọn `{ }` (VD: ポッドキャスト{Podcast}).
4. Với Động từ/Tính từ: Khôi phục về thể từ điển trong ngoặc vuông `[ ]`. (VD: 話{はな}したい[話す]). Lưu ý: Không thêm Furigana vào trong [lemma].
5. Gán nhãn [-] cho các trợ từ đơn (wa, ga, wo, ni, e, de, mo), dấu câu, và từ đệm vô nghĩa.

Nội dung cần xử lý:
[Dán nội dung SRT vào đây]
```

---

## 4. Quy tắc trình bày (Best Practices)
*   **Độ dài câu**: Không quá 2 dòng. Ngắt câu tại các vị trí tự nhiên.
*   **Timing**: Sub nên xuất hiện sớm hơn tiếng nói khoảng 100ms - 200ms.
