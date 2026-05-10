# 🛡️ Hướng dẫn Cấu hình Proxy (Cloudflare WARP) cho PodLearn

Tài liệu này hướng dẫn cách cấu hình Cloudflare WARP chạy ở chế độ **SOCKS5 Proxy** để vượt tường lửa YouTube trên VPS mà không ảnh hưởng đến các ứng dụng khác.

---

## 1. Tại sao cần dùng WARP Proxy?
Khi chạy PodLearn trên VPS, YouTube thường chặn IP của server, dẫn đến không tải được Metadata (Tiêu đề, Ảnh) và Phụ đề. Việc dùng WARP giúp:
- Lấy IP sạch từ Cloudflare.
- **Chỉ áp dụng cho PodLearn**: Các ứng dụng khác (Web server, SSH) vẫn dùng IP gốc của VPS.

---

## 2. Các bước cài đặt trên VPS (Linux/Ubuntu)

### Bước 1: Cài đặt Cloudflare WARP
Làm theo hướng dẫn chính thức từ Cloudflare:
```bash
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list
sudo apt-get update && sudo apt-get install cloudflare-warp
```

### Bước 2: Chuyển sang chế độ Proxy
Mặc định WARP sẽ tạo VPN cho toàn hệ thống. Bạn cần chuyển sang chế độ **Proxy** để chỉ dùng khi cần:
```bash
# Đăng ký thiết bị (chỉ làm lần đầu)
warp-cli registration new

# Chuyển sang chế độ Proxy
warp-cli mode proxy

# Kết nối
warp-cli connect
```
*Mặc định WARP Proxy sẽ lắng nghe tại: `127.0.0.1:40000`*

---

## 3. Cấu hình trong PodLearn

### Bước 1: Cập nhật thư viện
Đảm bảo bạn đã cài đặt `PySocks` để Python có thể giao tiếp qua giao thức SOCKS5:
```bash
pip install PySocks
# Hoặc cập nhật qua file requirements mới nhất
pip install -r requirements_fastapi.txt
```

### Bước 2: Điền Proxy vào Admin Panel
1. Truy cập vào trang **Admin** của PodLearn.
2. Tìm mục **Cài đặt Hệ thống** (System Settings).
3. Tại ô **YOUTUBE_PROXY_URL**, điền:
   ```text
   socks5://127.0.0.1:40000
   ```
4. Lưu cấu hình.

---

## 4. Kiểm tra hoạt động
Sau khi cấu hình, hãy thử Import một Video YouTube mới.
- Hệ thống sẽ ưu tiên dùng WARP Proxy để gọi API YouTube.
- Nếu WARP gặp sự cố, PodLearn sẽ tự động dùng cơ chế dự phòng **Phase 3 (NoEmbed API)** để lấy thông tin cơ bản nhất.

> [!TIP]
> Bạn có thể kiểm tra xem Proxy có hoạt động không bằng lệnh:
> `curl -x socks5h://127.0.0.1:40000 https://www.google.com`

---
*Tài liệu này được biên soạn tự động bởi Antigravity AI.*
