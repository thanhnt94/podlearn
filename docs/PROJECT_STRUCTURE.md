# Cấu trúc Dự án PodLearn

PodLearn được tổ chức theo kiến trúc Modular Monolith, tách biệt rõ ràng giữa Backend (Flask) và Frontend (React) nhưng vẫn duy trì sự nhất quán trong cùng một repository.

## 📂 Sơ đồ Thư mục

```text
PodLearn/
├── app/                        # Backend: Mã nguồn chính (Python/Flask)
│   ├── models/                 # SQLAlchemy Models (20+ thực thể Database)
│   ├── routes/                 # Flask Blueprints (15+ Controllers & API)
│   ├── services/               # Logic nghiệp vụ (AI, Audio, Subtitles, SRS)
│   ├── static/                 # Tài sản tĩnh cho SSR (Landing, Auth)
│   ├── templates/              # Jinja2 Templates (Landing, Auth, SPA Container)
│   ├── utils/                  # Hàm tiện ích (Jinja Filters, Time)
│   ├── __init__.py             # App Factory, Blueprint Registration & SSO
│   ├── config.py               # Cấu hình môi trường (Dev/Prod/Test)
│   └── extensions.py           # Khởi tạo Flask Extensions (DB, Migrate, CSRF)
├── admin-studio/               # Frontend Quản trị: React SPA (Vite/TS)
├── docs/                       # Tài liệu kỹ thuật chi tiết
├── frontend/                   # Frontend chính: React SPA (Vite/TS)
│   ├── src/                    # Mã nguồn React (Components, Store, Hooks)
│   ├── public/                 # Tài sản công cộng cho Frontend
│   └── vite.config.ts          # Cấu hình build Vite
├── migrations/                 # Lịch sử Migration Database (Alembic)
├── Storage/                    # Lưu trữ Media (Shadowing clips, Hands-free audio)
├── run_podlearn.py             # Entry point khởi chạy Backend (Port 5020)
├── requirements.txt            # Dependencies Python
└── README.md                   # Hướng dẫn tổng quan
```

## 🏗️ Các Thành phần Chính

- **App Factory (`app/__init__.py`)**: Khởi tạo Flask App, đăng ký Blueprints và thiết lập các API SSO với CentralAuth.
- **Modern SPA Entry Point**: Flask đóng vai trò là container, phục vụ trang React hiện đại tại route gốc `/` cho những người dùng đã đăng nhập.
- **Frontend SPA**: Nằm hoàn toàn trong thư mục `frontend/`, giao tiếp với Backend thông qua JSON API (Blueprint `api`).
- **Media Services**: Xử lý tải video từ YouTube, trích xuất âm thanh và tạo tệp Shadowing thông qua các Service chuyên biệt trong `app/services/`.
- **Ecosystem Sync**: Các route đặc biệt dành cho việc đồng bộ người dùng với hệ sinh thái chung của người dùng.
