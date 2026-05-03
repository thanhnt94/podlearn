# 🤖 PodLearn AI Guidelines & Project Rules

Tài liệu này chứa các quy tắc bắt buộc mà mọi AI Assistant phải tuân thủ khi làm việc với dự án PodLearn.

---

## 🏗️ 1. Kiến trúc: Modular Monolith (Hexagonal)
- Dự án được chia thành các module độc lập tại `app/modules/` (ví dụ: `study`, `identity`, `content`).
- **Nguyên tắc**: Hạn chế import trực tiếp giữa các module. Nếu cần gọi chéo, hãy sử dụng `interface.py` hoặc `signals.py`.
- Mọi API route phải được đăng ký dưới Blueprint có tiền tố `/api/<module_name>`.

## 🗄️ 2. Quy tắc Database & Migration (BẮT BUỘC)
- Dự án sử dụng **Flask-SQLAlchemy** và **Flask-Migrate (Alembic)**.
- **QUY TẮC VÀNG**: Sau khi thay đổi bất kỳ Model nào trong `models.py`, AI **PHẢI** thực hiện lệnh:
  ```powershell
  flask db migrate -m "Mô tả thay đổi"
  ```
  để tạo file version trong `migrations/versions/`.
- **KHÔNG** được sử dụng `db.create_all()` để thay đổi schema.
- File `run_podlearn.py` đã được cấu hình để tự động chạy `flask db upgrade` khi khởi động.

## 🚀 3. Tech Stack & Môi trường
- **Backend**: Flask 3.x, JWT (flask-jwt-extended), SQLite.
- **Frontend**: React + Vite, TailwindCSS (nếu có), Lucide Icons, Framer Motion.
- **Background Tasks**: Celery (với SQLite broker hoặc Redis).
- **Windows Friendly**: Các lệnh subprocess phải xử lý tốt trên Windows.

## 🎨 4. Tiêu chuẩn UI/UX
- **Aesthetics**: Giao diện phải mang cảm giác cao cấp (Premium), hiện đại.
- **Màu sắc**: Ưu tiên Dark Mode, dùng các tông màu sâu (Slate, Zinc) kết hợp với các dải màu Gradient (Sky, Amber, Rose).
- **Hiệu ứng**: Sử dụng Framer Motion cho các hiệu ứng chuyển cảnh, hover mượt mà.

## 📝 5. Coding Style
- Biến và hàm đặt tên rõ ràng, theo chuẩn Python (snake_case) và React (camelCase).
- Giữ nguyên các comment quan trọng của người dùng.
- Ưu tiên viết code gọn gàng, tránh dư thừa (DRY).

---

**Lưu ý cho AI**: Hãy luôn đọc file này trước khi bắt đầu bất kỳ tác vụ nào liên quan đến cấu trúc hoặc database của dự án.
