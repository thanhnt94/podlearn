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
Sử dụng Markdown (`**`, `*`) hoặc thẻ HTML `<span>`.
*   **Màu sắc gợi ý (hợp với giao diện tối)**:
    - **Vàng**: `<span style="color: #facc15;">nội dung</span>`
    - **Xanh dương**: `<span style="color: #38bdf8;">nội dung</span>`
    - **Xanh lá**: `<span style="color: #34d399;">nội dung</span>`
    - **Đỏ/Hồng**: `<span style="color: #fb7185;">nội dung</span>`

### C. Ví dụ cụ thể (Đầy đủ POS, Cách đọc, Hán Việt, Nghĩa)
Copy dòng dưới đây vào hệ thống để xem kết quả:
```text
勉強 | <span style="color: #38bdf8;">[Danh từ / Động từ nhóm 3]</span> <br/> <span style="color: #facc15; font-weight: bold; font-size: 1.1em;">べんきょう</span> <br/> <span style="color: #fb7185;">Hán Việt: MIỄN CƯỜNG</span> <br/> Học tập, nghiên cứu.
```

---

## 3. AI Prompt mẫu để tạo danh sách từ vựng "Xịn"
Bạn có thể dùng prompt này để AI tự động tạo ra bộ từ điển đầy đủ định dạng màu sắc cho bạn.

```text
Dựa vào nội dung bài học dưới đây, hãy liệt kê 20 từ vựng quan trọng nhất.
Yêu cầu định dạng kết quả trả về là danh sách văn bản thuần túy, mỗi từ một dòng:
[Từ vựng] | [Nội dung chi tiết]

Trong phần [Nội dung chi tiết], hãy trình bày theo cấu trúc sau (sử dụng <br/> để xuống dòng):
1. [Loại từ - POS] bôi màu xanh dương (#38bdf8).
2. [Cách đọc Hiragana] bôi màu vàng (#facc15), in đậm, cỡ chữ lớn.
3. [Hán Việt] bôi màu hồng (#fb7185).
4. [Nghĩa tiếng Việt] viết ở dòng cuối cùng.

Ví dụ mẫu:
昨日 | <span style="color: #38bdf8;">[Danh từ]</span> <br/> <span style="color: #facc15; font-weight: bold; font-size: 1.1em;">きのう</span> <br/> <span style="color: #fb7185;">Hán Việt: TẠC NHẬT</span> <br/> Ngày hôm qua.

Nội dung bài học:
[Dán Transcript/Nội dung bài học vào đây]
```

---

## 4. Cách nạp vào hệ thống
1.  Mở bài học -> **Settings** -> Tab **Vocab**.
2.  Dán danh sách vào ô **Custom Lesson Dictionary**.
3.  Chọn **Language Pair** (Ví dụ: JP -> VI).
4.  Nhấn **SAVE CUSTOM DICT**.

---
*Lưu ý: Bạn có thể dùng dấu `|` thoải mái trong phần [Mặt sau] nếu cần, hệ thống sẽ lấy phần trước dấu `|` đầu tiên làm [Mặt trước].*
