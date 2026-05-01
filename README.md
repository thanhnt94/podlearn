# 🎙️ PodLearn - Nền tảng Học Ngoại Ngữ qua Video (Headless Edition)

PodLearn là một ứng dụng web hiện đại, hiệu năng cao được thiết kế để giúp người học ngoại ngữ chuyển từ việc nghe thụ động sang việc sản xuất ngôn ngữ chủ động. Dự án hiện đã được tái cấu trúc hoàn toàn sang kiến trúc **Headless SPA** với mô hình **Modular Monolith (Hexagonal Architecture)**.

---

## 🚀 Công nghệ Sử dụng (Tech Stack)

### Backend (Python Core)
- **Framework:** [Flask 3.1](https://flask.palletsprojects.com/) - Kiến trúc Modular Monolith tối ưu cho khả năng mở rộng.
- **Security:** **Stateless JWT Authentication** (via `flask-jwt-extended`) - Loại bỏ hoàn toàn CSRF/Session truyền thống để hỗ trợ Headless.
- **AI Intelligence:** **Google Gemini 1.5 Flash/Pro** - Phân tích ngôn ngữ đa tầng (Ngữ pháp, Sắc thái, Mnemonic).
- **Asynchronous Tasks:** **Celery 5.4 + Redis** - Xử lý ngầm các tác vụ nặng (Deep Analysis, Subtitle Sync, Media Processing).
- **ORM:** [SQLAlchemy 2.0](https://www.sqlalchemy.org/) - Quản lý DB hiệu năng cao với Typing hỗ trợ.
- **NLP:** `SudachiPy` (Japanese), `Deep-Translator`, `Edge-TTS`.

### Frontend (Modern React SPA)
- **Framework:** [React 19](https://react.dev/) + [Vite 8](https://vitejs.dev/) - Trải nghiệm mượt mà, render tức thì.
- **Ngôn ngữ:** TypeScript (Strict Mode) - Đảm bảo an toàn dữ liệu từ API.
- **Styling:** **TailwindCSS 4.0** + Framer Motion - Giao diện Dark Mode cao cấp với Glassmorphism.
- **Quản lý trạng thái:** **Zustand** - Global state gọn nhẹ, thay thế Redux.
- **API Interaction:** **Axios** với Interceptors (Tự động đính kèm JWT & xử lý lỗi 401/403).
- **Visualization:** Recharts cho các biểu đồ phân tích Dashboard.

### Infrastructure & Ecosystem
- **SSO Connection:** Tích hợp **CentralAuth** qua OAuth2/JWT Bridge.
- **Storage:** Hỗ trợ Local Storage & AWS S3.
- **Deployment:** Docker Ready, Gunicorn/Uvicorn.

---

## ✨ Tính năng Nổi bật

1.  **Pure Headless Architecture:** Frontend và Backend tách biệt hoàn toàn qua API JSON. Dễ dàng mở rộng sang Mobile App (React Native) trong tương lai.
2.  **Admin Studio React:** Hệ thống quản trị (Dashboard, MemberHub, AISettings) được xây dựng hoàn toàn bằng React 19, thay thế các bản SSR cũ.
3.  **AI Insight Studio:** Tích hợp Gemini AI để giải thích ngữ pháp, từ vựng và văn hóa theo thời gian thực ngay trên Trình phát Video.
4.  **Shadowing Mode:** Ghi âm và so sánh giọng nói, theo dõi tiến độ Mastery qua biểu đồ nhiệt (Heatmap).
5.  **Subtitle Sync Engine:** Công cụ đồng bộ phụ đề mạnh mẽ, hỗ trợ đa kênh (S1-S3).

---

## 🛠️ Hướng dẫn Cài đặt & Chạy ứng dụng

### ⚡ Lưu ý cho Lập trình viên
**Tự động hóa:** Khi bạn chạy `python run_podlearn.py` trên **Windows**, hệ thống sẽ tự động gọi `build_vite.py` để thực hiện `npm run build`. Trên môi trường Linux/VPS, bước này sẽ tự động được bỏ qua để tối ưu hiệu suất server.

### 1. Cài đặt Backend
```bash
# Tạo & Kích hoạt venv
python -m venv venv
source venv/bin/activate 

# Cài đặt thư viện & Chạy Server
pip install -r requirements.txt
python run_podlearn.py
```
*Backend chạy tại: `http://localhost:5020`*

### 2. Chạy Worker (Celery)
Cần có Redis đang chạy (mặc định port 6379) hoặc hệ thống sẽ tự động fallback sang SQLite broker.
```bash
python run_celery.py
```

### 3. Cài đặt Frontend
```bash
cd frontend
npm install
npm run dev
```
*Frontend chạy tại: `http://localhost:5173`*

---

## 📂 Cấu trúc Thư mục

- `app/modules/`: Chứa các Domain logic (Identity, Study, Content, Admin, Engagement) theo chuẩn Modular.
- `app/core/`: Các cấu hình dùng chung (Extensions, Config, Security).
- `frontend/src/`: Mã nguồn React (bao gồm cả `admin/` studio mới).
- `Storage/`: Thư mục lưu trữ database, video và dữ liệu cục bộ.

---

## 📘 Tài liệu Chi tiết
- [Tài liệu Kiến trúc (MODULE_ARCHITECTURE.md)](./docs/MODULE_ARCHITECTURE.md)
- [Cấu trúc Công nghệ (TECH_STACK.md)](./docs/TECH_STACK.md)
- [Hướng dẫn API (API_AND_ROUTES.md)](./docs/API_AND_ROUTES.md)

---
*Phát triển bởi đội ngũ PodLearn Ecosystem.*
