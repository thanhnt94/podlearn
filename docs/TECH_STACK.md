# PodLearn - Hệ thống Công nghệ (Tech Stack)

PodLearn được xây dựng trên một nền tảng công nghệ hiện đại, tối ưu cho hiệu năng cao và trải nghiệm người dùng cao cấp. Dự án tuân thủ mô hình **Modular Monolith (Hexagonal Architecture)** với sự tách biệt hoàn toàn giữa Backend (Headless API) và Frontend (Pure React SPA).

---

## 🖥️ Backend (Python Core)

### 1. Web Framework & API
- **Flask 3.1**: Cung cấp nền tảng WSGI linh hoạt, được cấu trúc theo dạng Blueprints/Modules để dễ dàng bảo trì.
- **Pure Headless API**: Loại bỏ hoàn toàn server-side rendering (Jinja2) cho ứng dụng chính, giao tiếp hoàn toàn qua JSON.

### 2. Security & Identity
- **Stateless Authentication**: Sử dụng **JWT (JSON Web Token)** thông qua `flask-jwt-extended`.
- **RBAC (Role-Based Access Control)**: Phân quyền chặt chẽ (Admin, VIP, Free) tại cả lớp API và UI.
- **CentralAuth SSO**: Tích hợp đồng bộ danh tính toàn cầu qua OAuth2/JWT Bridge.

### 3. Database & Task Queue
- **ORM**: [SQLAlchemy 2.0](https://www.sqlalchemy.org/) với các mô hình dữ liệu (Models) được tối ưu hóa.
- **Migration**: [Flask-Migrate](https://flask-migrate.readthedocs.io/) quản lý phiên bản database.
- **Asynchronous Processing**: **Celery 5.4** xử lý các tác vụ nặng (Deep Analysis, Video Import, Sync).
- **Broker/Result Backend**: **Redis** (mặc định) hoặc **SQLite** (fallback) cho môi trường dev.

### 4. AI & NLP Engine
- **LLM**: **Google Gemini 1.5 Flash/Pro** - Sử dụng cho hệ thống "AI Insights" phân tích ngữ pháp và văn hóa.
- **Japanese NLP**: `SudachiPy`, `SudachiDict`, `pykakasi`, `jamdict`.
- **TTS (Text-to-Speech)**: `Edge-TTS` (giọng đọc tự nhiên của Microsoft) và `gTTS`.

---

## 🎨 Frontend (React SPA Studio)

### 1. Framework & Language
- **React 19**: Sử dụng các tính năng mới nhất (Concurrent Rendering, Suspense).
- **Vite 8**: Công cụ build và bundling siêu nhanh, thay thế hoàn toàn Webpack.
- **TypeScript (Strict)**: Đảm bảo tính ổn định và tự ghi tài liệu cho mã nguồn.

### 2. UI/UX Architecture
- **TailwindCSS 4.0**: Hệ thống thiết kế utility-first giúp xây dựng giao diện nhanh và nhất quán.
- **Framer Motion**: Thư viện Animation mạnh mẽ cho các tương tác mượt mà (Smooth transitions, drag-and-drop).
- **Lucide React**: Hệ thống Icon vector hiện đại và đồng bộ.

### 3. State & Communication
- **Zustand**: Quản lý Global State (User, Player, Dashboard) một cách gọn nhẹ và hiệu suất cao.
- **Axios**: Kết nối API với hệ thống Interceptors tự động đính kèm JWT Token vào Header `Authorization`.
- **Recharts**: Thư viện biểu đồ phục vụ cho việc trực quan hóa dữ liệu học tập (Heatmap, Progress Chart).

---

## ⚙️ Cơ sở Hạ tầng & Mở rộng
- **Modular Monolith**: Các module (Admin, Content, Identity, Study, Engagement) độc lập về domain nhưng chia sẻ chung core logic.
- **Deployment**: Tương thích hoàn toàn với Docker/Vercel/Railway.
- **Storage Strategy**: Kiến trúc trừu tượng cho phép chuyển đổi linh hoạt giữa Local Storage và AWS S3.

---
*Tài liệu được cập nhật cho phiên bản PodLearn Headless v22.*
