# 🎙️ PodLearn - Nền tảng Học Ngoại Ngữ qua Video

PodLearn là một ứng dụng web hiện đại được thiết kế để giúp người học ngoại ngữ chuyển từ việc nghe thụ động sang việc sản xuất ngôn ngữ chủ động. Bằng cách tận dụng nguồn nội dung khổng lồ từ YouTube, PodLearn cung cấp các công cụ tương tác mạnh mẽ như Shadowing, Phân tích ngôn ngữ AI, và Hệ thống ôn tập SRS.

---

## 🚀 Công nghệ Sử dụng (Tech Stack)

### Backend (Python)
- **Framework:** [Flask 3.1](https://flask.palletsprojects.com/) - Mạnh mẽ, linh hoạt và tối ưu cho kiến trúc Modular Monolith.
- **ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/) - Quản lý cơ sở dữ liệu với hiệu năng cao.
- **Database:** SQLite (Hỗ trợ Postgres cho Production).
- **Xử lý Video:** `yt-dlp` để tải phụ đề và thông tin từ YouTube.
- **NLP (Xử lý ngôn ngữ):** `SudachiPy` & `SudachiDict` cho tiếng Nhật, tích hợp `deep-translator`.
- **Xử lý âm thanh:** `Edge-TTS`, `gTTS`, `pydub`.

### Frontend (React SPA)
- **Framework:** [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/)
- **Ngôn ngữ:** TypeScript
- **Styling:** [TailwindCSS](https://tailwindcss.com/) + Framer Motion (Animation).
- **Quản lý trạng thái:** [Zustand](https://github.com/pmndrs/zustand).
- **Icons:** Lucide React.

### Hệ sinh thái (Ecosystem)
- **SSO:** Tích hợp **CentralAuth** để đồng bộ hóa danh tính người dùng trên toàn hệ sinh thái.

---

## ✨ Tính năng Nổi bật

1.  **Trình phát Video Thông minh:** Hỗ trợ phụ đề đa ngôn ngữ, click-to-lookup và ghi chú theo mốc thời gian.
2.  **Shadowing Studio:** Chế độ luyện nói ngắt quãng, tự động chấm điểm phát âm bằng AI.
3.  **Hành trình Mastery:** Lưu trữ và luyện tập các mẫu câu, ngữ pháp và từ vựng thông qua hệ thống thẻ học (Flashcards).
4.  **Phân tích ngôn ngữ chuyên sâu:** Tự động tách từ, tra từ điển offline và phân tích cấu trúc câu (đặc biệt tối ưu cho tiếng Nhật).
5.  **Dashboard V3:** Giao diện hiện đại, quản lý lộ trình học tập và chuỗi ngày học (Streak) hiệu quả.

---

## 🛠️ Hướng dẫn Cài đặt & Chạy ứng dụng

### 1. Cài đặt Backend
Yêu cầu Python 3.10+.
```bash
# Tạo môi trường ảo
python -m venv venv
source venv/bin/activate  # Hoặc venv\Scripts\activate trên Windows

# Cài đặt thư viện
pip install -r requirements.txt

# Khởi tạo database
python run_podlearn.py
```
Ứng dụng backend sẽ chạy tại: `http://localhost:5020`

### 2. Cài đặt Frontend
Yêu cầu Node.js 18+.
```bash
cd frontend
npm install
npm run dev
```
Frontend sẽ chạy tại: `http://localhost:5173` (Vite Proxy sẽ chuyển hướng API về port 5020).

---

## 📂 Cấu trúc Thư mục

- `app/`: Mã nguồn Flask (Models, Routes, Services).
- `frontend/`: Ứng dụng React SPA (TypeScript, Tailwind).
- `docs/`: Tài liệu chi tiết về API, Database và Tính năng.
- `migrations/`: Quản lý phiên bản cơ sở dữ liệu.
- `static/` & `templates/`: Tài sản dùng cho các trang SSR (Landing, Auth).

---

## 📘 Tài liệu Chi tiết
Để hiểu sâu hơn về hệ thống, vui lòng tham khảo:
- [Kiến trúc Công nghệ (TECH_STACK.md)](./docs/TECH_STACK.md)
- [Cấu trúc Dự án (PROJECT_STRUCTURE.md)](./docs/PROJECT_STRUCTURE.md)
- [Sơ đồ Database (DATABASE_SCHEMA.md)](./docs/DATABASE_SCHEMA.md)
- [Hướng dẫn API (API_AND_ROUTES.md)](./docs/API_AND_ROUTES.md)

---
*Phát triển bởi đội ngũ Ecosystem.*
