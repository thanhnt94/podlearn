# API và Các Tuyến đường (Routes) của PodLearn

PodLearn sử dụng hệ thống định tuyến (routing) dựa trên các Flask Blueprints để xử lý các yêu cầu từ dashboard, trình phát video, và các dịch vụ API ngầm.

## 🛠️ Các Blueprints Chính

| Blueprint | Tiền tố (Prefix) | Mục đích |
| :--- | :--- | :--- |
| `auth` | `/auth` | Đăng ký, Đăng nhập, Hồ sơ (SSR). |
| `dashboard` | `/` | Container cho React SPA & Landing Page. |
| `admin` | `/admin` | Trang quản trị hệ thống (Phục vụ React SPA). |
| `admin_api` | `/api/admin` | API dành riêng cho Admin Studio. |
| `api` | `/api` | API lõi cho Player & Dashboard. |
| `subtitle_api` | `/api/subtitles` | Xử lý chuyên sâu về phụ đề (Download, Save, Sync). |
| `tracking` | `/api/tracking` | Theo dõi thời gian học và hành vi người dùng. |
| `handsfree` | `/api/handsfree` | Tạo và quản lý tệp âm thanh Podcast. |
| `community` | `/api/community` | Khám phá video công khai và Wiki Glossary. |
| `practice` | `/practice` | Các chế độ ôn tập SRS (Sentences, Vocab). |
| `auth_center` | `/auth-center` | Giao tiếp với CentralAuth SSO. |
| `share` | `/share` | Chia sẻ bài học và Workspace. |

## 🚀 Các Endpoints Quan trọng (JSON API)

### 1. Phụ đề & Biên tập (Subtitle API)
- `GET /api/subtitles/track/<video_id>`: Lấy toàn bộ các track phụ đề của một video.
- `POST /api/subtitles/save-track`: Lưu thay đổi cho một track phụ đề (S1/S2/S3).
- `POST /api/subtitles/shift`: Dịch chuyển thời gian (offset) cho toàn bộ track.
- `POST /api/subtitles/split`: Tách một dòng phụ đề tại timestamp chỉ định.
- `POST /api/subtitles/merge`: Gộp các dòng phụ đề được chọn.

### 2. Hands-free (Podcast Generator)
- `POST /api/handsfree/generate`: Bắt đầu tiến trình tạo podcast interleaved (Original + TTS).
- `GET /api/handsfree/status/<task_id>`: Theo dõi tiến độ tạo tệp âm thanh.
- `GET /api/handsfree/audio/<video_id>`: Lấy URL tệp âm thanh đã tạo hoặc stream trực tiếp.

### 3. Tracking & Gamification
- `POST /api/tracking/heartbeat`: Gửi tín hiệu online và cập nhật thời gian học.
- `GET /api/tracking/stats`: Lấy dữ liệu Streak, Badge và Progress.

### 4. Admin API (Quản trị)
- `GET /api/admin/users`: Danh sách người dùng hệ thống.
- `GET /api/admin/videos`: Quản lý kho video và trạng thái xử lý AI.
- `POST /api/admin/ai/analyze-all`: Kích hoạt phân tích AI hàng loạt cho video.

### 5. AI Insights
- `POST /api/ai/insights/<video_id>/line/<index>`: Phân tích sâu 8 lớp cho một dòng phụ đề cụ thể.
- `GET /api/ai/insights/<video_id>`: Lấy kết quả phân tích đã cache cho toàn bộ video.

## 🧠 Các Dịch vụ Backend (Services)
Các logic phức tạp được xử lý tại `app/services/`:
- `subtitle_service`: Xử lý phân tích và định dạng phụ đề (VTT/JSON).
- `vocab_service`: Tích hợp các bộ từ điển tiếng Nhật offline và online.
- `shadowing_service`: Logic chấm điểm và quản lý lịch sử phát âm.
- `audio_service` / `handsfree_service`: Tạo và xử lý tệp âm thanh (TTS/Cắt ghép/Podcast).
- `ai_service`: Giao tiếp với Gemini API cho phân tích chuyên sâu.
- `gamification_service`: Quản lý Streak, Badge và phần thưởng.
