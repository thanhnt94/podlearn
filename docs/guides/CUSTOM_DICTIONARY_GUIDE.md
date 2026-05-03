# Hướng dẫn tạo Custom Dictionary (Từ điển riêng cho bài học)

Tính năng **Custom Dictionary** cho phép bạn nạp một danh sách từ vựng riêng cho từng bài học. Khi tra từ, hệ thống sẽ ưu tiên các định nghĩa này trước khi tìm kiếm trong các từ điển chung.

## 1. Định dạng nhập liệu cơ bản
Dữ liệu được nhập dưới dạng văn bản thuần túy, mỗi dòng là một từ vựng, ngăn cách mặt trước và mặt sau bởi dấu gạch đứng `|`.

*   **Cấu trúc**: `Mặt trước | Mặt sau`

## 2. Định dạng nâng cao (Rich Formatting)
Vì hệ thống hỗ trợ **Markdown** và **HTML**, bạn có thể tạo ra các định nghĩa cực kỳ đẹp mắt với màu sắc và xuống dòng ngay trong phần "Mặt sau".

### A. Cách xuống dòng
Sử dụng thẻ `<br/>` để ngắt dòng bên trong phần nghĩa.
*   **Ví dụ**: `Từ | Dòng 1 <br/> Dòng 2 <br/> Dòng 3`

### B. Thêm màu sắc và định dạng
Sử dụng thẻ HTML `<span>`.
*   **Màu sắc gợi ý (hợp với giao diện tối)**:
    - **Vàng**: `<span style="color: #facc15;">nội dung</span>`
    - **Xanh dương**: `<span style="color: #38bdf8;">nội dung</span>`
    - **Hồng/Đỏ**: `<span style="color: #fb7185;">nội dung</span>`

### C. Ví dụ cụ thể (Mẫu chuẩn)
Copy dòng dưới đây vào hệ thống để xem kết quả:
```text
勉強 | <span style="color: #38bdf8;">n. / v.</span> <br/> <span style="color: #facc15; font-weight: bold; font-size: 1.1em;">/べんきょう/</span> <br/> <span style="color: #fb7185;">[MIỄN CƯỜNG]</span> <br/> Học tập, nghiên cứu.
```

---

## 3. AI Prompt mẫu để tạo danh sách từ vựng "Xịn" (Chuẩn nhất)
Bạn có thể dùng prompt này để AI tự động liệt kê toàn bộ từ vựng trong bài.

```text
Dựa vào nội dung bài học dưới đây, hãy liệt kê TOÀN BỘ các từ vựng xuất hiện trong bài (ngoại trừ các trợ từ, từ đệm vô nghĩa, và dấu câu).

Yêu cầu định dạng kết quả trả về là một CODE BLOCK Markdown chứa danh sách văn bản thuần túy, mỗi từ một dòng:
[Từ vựng] | [Nội dung chi tiết]

Trong phần [Nội dung chi tiết], hãy trình bày theo cấu trúc sau (sử dụng <br/> để xuống dòng):
1. [Loại từ - POS]: Viết tắt kiểu tiếng Anh (n., v., adj., adv...) bôi màu xanh dương (#38bdf8).
2. [Cách đọc Hiragana]: Viết trong dấu gạch chéo / / bôi màu vàng (#facc15), in đậm, cỡ chữ lớn.
3. [Hán Việt]: Viết trong dấu ngoặc vuông [ ], VIẾT HOA toàn bộ chữ bên trong, bôi màu hồng (#fb7185).
4. [Nghĩa tiếng Việt]: Viết ở dòng cuối cùng.

Ví dụ mẫu:
昨日 | <span style="color: #38bdf8;">n.</span> <br/> <span style="color: #facc15; font-weight: bold; font-size: 1.1em;">/きのう/</span> <br/> <span style="color: #fb7185;">[TẠC NHẬT]</span> <br/> Ngày hôm qua.

Nội dung bài học:
[Dán Transcript/Nội dung bài học vào đây]
```

---

## 4. Cách nạp vào hệ thống
1.  Mở bài học -> **Settings** -> Tab **Vocab**.
2.  Dán danh sách từ vựng vào ô **Custom Lesson Dictionary**.
3.  Chọn **Language Pair** phù hợp.
4.  Nhấn **SAVE CUSTOM DICT**.
