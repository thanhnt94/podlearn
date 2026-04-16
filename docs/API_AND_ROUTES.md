# API và Các Tuyến đường (Routes) của PodLearn

PodLearn sử dụng hệ thống định tuyến (routing) dựa trên các Flask Blueprints để xử lý các yêu cầu từ dashboard, trình phát video, và các dịch vụ API ngầm.

## 🛠️ Các Blueprints Chính

| Blueprint | Tiền tố (Prefix) | Mục đích |
| :--- | :--- | :--- |
| `auth` | `/auth` | Quản lý đăng ký, đăng nhập và hồ sơ người dùng (SSR). |
| `dashboard` | `/` | Trang chủ và container phục vụ React SPA. |
| `api` | `/api` | Các JSON endpoints cho React SPA giao tiếp. |
| `player` | `/player` | Môi trường trình phát video tương tác (SSR/Legacy). |
| `practice` | `/practice` | Các phiên học Mastery (Sentences, Grammar, Vocab). |
| `admin` | `/admin` | Trang quản trị hệ thống. |
| `share` | `/share` | Quản lý chia sẻ video giữa các người dùng. |

## 🚀 Các Endpoints Quan trọng (JSON API)

### 1. Dashboard & Khởi tạo (SPA)
- `GET /api/dashboard/init`: Endpoint hợp nhất để khởi tạo toàn bộ Dashboard. Trả về:
    - `lessons`: Danh sách bài học của người dùng.
    - `community_videos`: Video công khai gợi ý.
    - `notifications`: Lời mời chia sẻ/học nhóm.
    - `sets`: Các bộ Mastery (Ngữ pháp, Từ vựng).
    - `stats`: Thống kê Streak và tiến độ.
- `POST /api/lesson/<int:lesson_id>/track-time`: Cập nhật thời gian học và tính toán Streak.

### 2. Bộ sưu tập & Playlists (Library Sets)
- `GET /api/playlists`: Liệt kê tất cả danh sách phát của người dùng.
- `POST /api/playlists`: Tạo danh sách phát mới.
- `DELETE /api/playlists/<int:id>`: Xóa danh sách phát.
- `GET /api/playlists/<int:id>/details`: Lấy danh sách video bên trong một Playlist cụ thể.
- `POST /api/playlists/<int:id>/videos`: Thêm một video vào Playlist.
- `DELETE /api/playlists/<int:id>/videos/<int:video_id>`: Xóa video khỏi Playlist.

### 2. Phân tích Ngôn ngữ & Từ vựng
- `POST /api/vocab/analyze`: Phân tích câu (tách từ, tra từ điển offline) bằng Sudachi.
- `POST /api/vocab/tokens/save`: Lưu cấu hình tách từ (segmentation) tùy chỉnh của người dùng.
- `GET /api/vocab/list/<int:lesson_id>`: Lấy danh sách từ vựng được trích xuất cho một bài học.
- `POST /api/vocab/update-wiki`: Cập nhật định nghĩa cộng đồng cho một từ vựng trong video.

### 3. Shadowing & Phát âm
- `POST /api/score-pronunciation`: Gửi tệp âm thanh hoặc văn bản để AI chấm điểm phát âm.
- `GET /api/lesson/<int:lesson_id>/shadowing-stats`: Lấy thống kê luyện nói cho từng dòng trong bài học.

### 4. AI Insights & Deep Analysis (On-demand)
- `GET /api/ai/insights/<video_id>`: Lấy danh sách tất cả các phân tích AI đã lưu cho một video.
- `POST /api/ai/insights/<video_id>/line/<int:line_index>`: Kích hoạt AI (Gemini) để phân tích sâu một câu thoại cụ thể (8 thẻ kiến thức).

### 4. Dịch thuật & Media
- `POST /api/translate`: Proxy dịch thuật qua server để tránh lỗi CORS.
- `GET /api/youtube/subtitles-list/<video_id>`: Lấy danh sách phụ đề có sẵn trên YouTube.
- `POST /api/youtube/subtitles-download/<int:lesson_id>`: Tải và xử lý phụ đề từ YouTube về database.

### 5. SSO & Đồng bộ Hệ sinh thái (Internal)
Các route này được bảo vệ bởi `X-Client-Secret`:
- `POST /api/sso-internal/user-list`: Danh sách người dùng để đồng bộ hóa.
- `POST /api/sso-internal/link-user`: Liên kết tài khoản local với CentralAuth UUID.
- `POST /api/sso-internal/delete-user`: Xóa người dùng theo yêu cầu từ CentralAuth.

## 🧠 Các Dịch vụ Backend (Services)
Các logic phức tạp được xử lý tại `app/services/`:
- `subtitle_service`: Xử lý phân tích và định dạng phụ đề (VTT/JSON).
- `vocab_service`: Tích hợp các bộ từ điển tiếng Nhật offline và online.
- `shadowing_service`: Logic chấm điểm và quản lý lịch sử phát âm.
- `audio_service`: Tạo và xử lý tệp âm thanh (TTS/Cắt ghép).
