# Cấu trúc Dự án PodLearn

PodLearn được tổ chức theo kiến trúc Modular Monolith, tách biệt rõ ràng giữa Backend (Flask) và Frontend (React) nhưng vẫn duy trì sự nhất quán trong cùng một repository.

## 📂 Sơ đồ Thư mục

```text
PodLearn/
├── app/                        # Backend: Mã nguồn chính (Python/Flask)
│   ├── models/                 # SQLAlchemy Models (Thực thể Database)
│   ├── routes/                 # Flask Blueprints (Controllers & API)
│   ├── services/               # Logic nghiệp vụ & Tích hợp bên ngoài
│   ├── static/                 # Tài sản tĩnh cho SSR (Landing, Auth)
│   ├── templates/              # Jinja2 Templates (Landing, Auth)
│   ├── utils/                  # Hàm tiện ích (Time, Formatting)
│   ├── __init__.py             # App Factory & Cấu hình Extensions
│   ├── config.py               # Cấu hình môi trường
│   └── extensions.py           # Khởi tạo Flask Extensions (DB, Migrate)
├── docs/                       # Tài liệu kỹ thuật dự án
├── frontend/                   # Frontend: Ứng dụng React SPA (Vite/TS)
│   ├── src/                    # Mã nguồn React (Components, Store, Hooks)
│   ├── public/                 # Tài sản công cộng cho Frontend
│   ├── package.json            # Quản lý thư viện Node.js
│   └── vite.config.ts          # Cấu hình công cụ build Vite
├── migrations/                 # Các tệp Migration Database (Alembic)
├── logs/                       # Tệp nhật ký hệ thống
├── run_podlearn.py             # Điểm khởi chạy Backend (Port 5020)
├── requirements.txt            # Danh sách thư viện Python
├── .env                        # Chứa các biến môi trường (Secrets)
└── README.md                   # Hướng dẫn tổng quan dự án
```

## 🏗️ Các Thành phần Chính

- **App Factory (`app/__init__.py`)**: Khởi tạo Flask App, đăng ký Blueprints và thiết lập các API SSO với CentralAuth.
- **Modern SPA Entry Point**: Flask đóng vai trò là container, phục vụ trang React hiện đại tại route gốc `/` cho những người dùng đã đăng nhập.
- **Frontend SPA**: Nằm hoàn toàn trong thư mục `frontend/`, giao tiếp với Backend thông qua JSON API (Blueprint `api`).
- **Media Services**: Xử lý tải video từ YouTube, trích xuất âm thanh và tạo tệp Shadowing thông qua các Service chuyên biệt trong `app/services/`.
- **Ecosystem Sync**: Các route đặc biệt dành cho việc đồng bộ người dùng với hệ sinh thái chung của người dùng.
