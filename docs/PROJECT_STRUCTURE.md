# Cấu trúc Dự án PodLearn (Modular Monolith)

PodLearn được tổ chức theo kiến trúc **Modular Monolith (Hexagonal Style)**. Hệ thống chia nhỏ các chức năng thành từng Module độc lập, giúp dễ dàng mở rộng và bảo trì.

---

## 📂 Sơ đồ Thư mục Hiện tại

```text
PodLearn/
├── app/                        # Backend: Mã nguồn Flask (Python)
│   ├── core/                   # Cấu hình lõi (Security, Extensions, Config)
│   ├── modules/                # Các Module chức năng (Domain-Driven)
│   │   ├── admin/              # Module Quản trị (Routes, API)
│   │   ├── content/            # Quản lý Video, Lessons, Media
│   │   ├── identity/           # Quản lý Người dùng, Auth, SSO, JWT
│   │   ├── study/              # Shadowing, SRS, Playlists, Mastery
│   │   └── engagement/         # Gamification, Badges, Stats
│   ├── static/dist/            # Chứa các file Frontend đã build (Vite Output)
│   └── __init__.py             # App Factory & Module Registration
├── frontend/                   # Frontend SPA (React 19 + Vite)
│   ├── src/
│   │   ├── admin/              # Mã nguồn Admin Studio Studio (React)
│   │   ├── components/         # Các Component dùng chung & User UI
│   │   ├── store/              # Quản lý trạng thái (Zustand)
│   │   ├── hooks/              # Custom Hooks cho API & Logic
│   │   └── main.tsx            # Entry point cho ứng dụng người dùng
│   ├── admin.html              # Entry point cho Admin Studio
│   ├── index.html              # Entry point cho Main App
│   └── vite.config.ts          # Cấu hình Build & Output Path
├── docs/                       # Tài liệu kỹ thuật chuyên sâu
├── migrations/                 # Lịch sử phiên bản Database
├── Storage/                    # Dữ liệu cục bộ (SQLite, Media, Uploads)
├── run_podlearn.py             # Script khởi chạy Flask Server (Port 5020)
├── run_celery.py               # Script khởi chạy Worker (Background Tasks)
└── README.md                   # Hướng dẫn tổng quan
```

---

## 🏗️ Các Thành phần Kiến trúc

### 1. Modular Architecture (`app/modules/`)
Mỗi thư mục trong `modules` là một đơn vị độc lập chứa:
- `models.py`: Định nghĩa database schema.
- `routes/`: Chứa các API endpoints (Blueprints).
- `services.py`: Logic nghiệp vụ riêng của module.
- `interface.py`: (Tùy chọn) Cung cấp các hàm cho các module khác gọi đến.

### 2. Headless SPA Entry Points
Dự án có hai điểm truy cập chính được build từ React:
- **Main App (`/`)**: Giao diện học tập dành cho người dùng.
- **Admin Studio (`/admin/`)**: Giao diện quản trị hệ thống.
Tất cả đều được Flask phục vụ từ thư mục `app/core/static/dist` sau khi chạy lệnh `npm run build`.

### 3. Stateless Security Layer
Hệ thống không sử dụng Session của Flask mà dựa hoàn toàn vào **JWT (JSON Web Tokens)**. 
- Token được lưu trữ tại `localStorage` ở Frontend.
- Axios Interceptors tự động đính kèm Token vào Header của mọi yêu cầu API.
- Backend xác thực qua decorator `@jwt_required()`.

### 4. Background Processing
Các tác vụ tốn thời gian như phân tích video bằng AI, đồng bộ hóa phụ đề, hoặc tạo file âm thanh TTS được đẩy vào **Celery Worker** để đảm bảo API luôn phản hồi nhanh nhất.

---
*Cập nhật: 2026-05-01 - Đội ngũ Kỹ thuật PodLearn.*
