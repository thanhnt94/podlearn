# PodLearn - Hệ thống Công nghệ

PodLearn được xây dựng trên một nền tảng công nghệ mạnh mẽ, tối ưu cho hiệu năng và trải nghiệm người dùng cao cấp. Dự án sử dụng mô hình Modular Monolith với Backend Python và Frontend React hiện đại.

## 🖥️ Backend (Python)
- **Framework Chính**: [Flask 3.1](https://flask.palletsprojects.com/) - Cung cấp nền tảng WSGI linh hoạt và modular.
- **ORM & Database**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) & [Flask-SQLAlchemy](https://flask-sqlalchemy.palletsprojects.com/). 
    - Database mặc định: **SQLite** cho phát triển.
    - Hỗ trợ **PostgreSQL/MySQL** cho môi trường Production.
- **Migration**: [Flask-Migrate](https://flask-migrate.readthedocs.io/) (dựa trên Alembic).
- **Xác thực (Auth)**:
    - [Flask-Login](https://flask-login.readthedocs.io/) cho phiên người dùng.
    - Tích hợp **CentralAuth SSO** qua các API nội bộ bảo mật (`X-Client-Secret`).
- **Xử lý ngôn ngữ (NLP)**:
    - **Tiếng Nhật**: `SudachiPy`, `SudachiDict`, `pykakasi`, `jamdict`.
    - **Dịch thuật**: `deep-translator` (Google API proxy).
    - **AI Engine**: Gemini 2.0 Flash (cho phân tích sâu và giải thích ngữ pháp).
- **Xử lý truyền thông**:
    - `yt-dlp`: Tải metadata và phụ đề YouTube.
    - `Edge-TTS`: Chuyển đổi văn bản thành giọng nói chất lượng cao (Sử dụng cho Hands-free & Shadowing).
    - `pydub`: Cắt, ghép và trộn âm thanh chuyên nghiệp (Dùng cho Podcast Generator).

## 🎨 Frontend (React SPA)
- **Runtime**: [Node.js](https://nodejs.org/) & [Vite 8](https://vitejs.dev/) làm công cụ build siêu nhanh.
- **Thư viện Chính**: [React 19](https://react.dev/) với kiến trúc Function Components và Hooks.
- **Ngôn ngữ**: [TypeScript](https://www.typescriptlang.org/) đảm bảo an toàn kiểu dữ liệu.
- **Giao diện (UI/UX)**:
    - **TailwindCSS**: Hệ thống thiết kế tiện ích linh hoạt.
    - **Framer Motion**: Tạo các hiệu ứng chuyển cảnh mượt mà và tương tác premium.
    - **Lucide React**: Thư viện biểu tượng vector hiện đại.
- **Quản lý trạng thái**: [Zustand](https://github.com/pmndrs/zustand) - Thay thế nhẹ nhàng và hiệu quả cho Redux.
- **Kết nối API**: [Axios](https://axios-http.com/) tích hợp interceptors cho xác thực.

## ⚙️ Tích hợp & Hệ sinh thái
- **CentralAuth SSO**: Đồng bộ hóa danh tính trên toàn bộ hệ sinh thái phần mềm (MindStack, IPTV, v.v.).
- **SRS (Spaced Repetition)**: Thuật toán ôn tập ngắt quãng tùy chỉnh cho Sentence & Vocab Mastery.
- **Storage**: Hỗ trợ Storage nội bộ (Local) hoặc AWS S3 cho các tệp media và shadowing clips.
