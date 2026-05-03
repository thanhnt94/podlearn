# Hướng dẫn Cài đặt Cloudflare WARP (SOCKS5 Proxy Mode) trên Linux VPS

Tài liệu này hướng dẫn cách cấu hình Cloudflare WARP chạy dưới dạng **SOCKS5 Proxy** nội bộ. Mục đích là giúp các ứng dụng (như `yt-dlp` trong dự án PodLearn) có thể sử dụng IP của Cloudflare để tránh bị chặn bởi YouTube, trong khi vẫn giữ nguyên kết nối mạng gốc của VPS, đảm bảo SSH và các dịch vụ Web (Nginx/Gunicorn) không bị gián đoạn.

---

> [!CAUTION]
> ### 🛑 CẢNH BÁO AN TOÀN (RED FLAGS)
> Việc cấu hình sai WARP có thể dẫn đến việc VPS bị định tuyến toàn bộ traffic qua VPN của Cloudflare, làm thay đổi IP public và **NGẮT KẾT NỐI SSH NGAY LẬP TỨC**.
>
> 1. **TUYỆT ĐỐI KHÔNG** gõ lệnh `warp-cli connect` khi chưa chuyển sang chế độ `proxy`.
> 2. **KHÔNG** sử dụng lệnh `warp-cli mode warp` (Đây là chế độ VPN toàn hệ thống - Mặc định).
> 3. **LUÔN KIỂM TRA** chế độ hiện tại bằng `warp-cli settings` trước khi thực hiện kết nối.

---

## 1. Chuẩn bị (Pre-requisites)

* **Hệ điều hành:** Ubuntu hoặc Debian (x86_64 hoặc ARM64).
* **Quyền hạn:** Truy cập `sudo`.
* **Khuyến nghị:** Hãy tạo một **Snapshot** của VPS trên trang quản trị (DigitalOcean, Vultr, Linode...) trước khi thực hiện để có thể khôi phục nhanh nếu mất SSH.

---

## 2. Cài đặt warp-cli

Chạy các lệnh sau để thêm Repository chính thức của Cloudflare và cài đặt gói `cloudflare-warp`.

```bash
# Thêm khóa GPG của Cloudflare
curl -fsSL https://pkg.cloudflareclient.com/pubkey.gpg | sudo gpg --yes --dearmor --output /usr/share/keyrings/cloudflare-warp-archive-keyring.gpg

# Thêm Repository vào danh sách nguồn (Ví dụ cho Ubuntu/Debian)
echo "deb [signed-by=/usr/share/keyrings/cloudflare-warp-archive-keyring.gpg] https://pkg.cloudflareclient.com/ $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflare-client.list

# Cập nhật và cài đặt
sudo apt update
sudo apt install cloudflare-warp -y
```

---

## 3. Cấu hình SOCKS5 Proxy (Quan trọng nhất)

Đây là các bước để đảm bảo WARP chỉ chạy như một "đường ống" SOCKS5 và không can thiệp vào card mạng của hệ thống.

### Bước 3.1: Chuyển chế độ sang Proxy
Lệnh này là quan trọng nhất để tránh mất kết nối SSH.
```bash
warp-cli mode proxy
```

### Bước 3.2: Đăng ký thiết bị với Cloudflare
```bash
warp-cli register
```

### Bước 3.3: Thiết lập Port cho SOCKS5
Bạn có thể chọn bất kỳ port nào còn trống, ví dụ `40000`.
```bash
warp-cli proxy port 40000
```

### Bước 3.4: Bật loại trừ (Excluded Routes)
Để chắc chắn traffic nội bộ và SSH không bao giờ bị ảnh hưởng, hãy đảm bảo tính năng `families` hoặc `dns` không can thiệp quá sâu (thường mặc định ở chế độ proxy là an toàn).

### Bước 3.5: Khởi động kết nối
```bash
warp-cli connect
```

---

## 4. Kiểm tra kết nối (Verification)

Sử dụng lệnh `curl` để xác nhận việc phân tách traffic thành công.

### Kiểm tra IP gốc của VPS (Phải giữ nguyên IP của nhà cung cấp)
```bash
curl https://ifconfig.me
```

### Kiểm tra IP thông qua WARP Proxy (Phải hiện IP của Cloudflare)
```bash
curl --proxy socks5://127.0.0.1:40000 https://ifconfig.me
```
*Nếu lệnh trên trả về một IP khác với IP gốc và có dạng `104.x.x.x` hoặc `172.x.x.x`, bạn đã thành công.*

### Kiểm tra trạng thái WARP
```bash
warp-cli status
```

---

## 5. Ứng dụng vào PodLearn

Trong giao diện **Admin Panel > Settings > Infrastructure**, bạn hãy điền URL proxy như sau:
**`socks5://127.0.0.1:40000`**

---

## 6. Phương án dự phòng (Rollback/Troubleshooting)

### Ngắt kết nối WARP
Nếu nghi ngờ mạng có vấn đề, hãy ngắt kết nối ngay lập tức:
```bash
warp-cli disconnect
```

### Reset toàn bộ cấu hình
```bash
warp-cli reset-settings
```

### Gỡ cài đặt khẩn cấp
```bash
sudo apt remove cloudflare-warp -y
sudo rm /etc/apt/sources.list.d/cloudflare-client.list
```

### Lỗi "Unable to connect to CloudflareWARP daemon"
Thực hiện restart dịch vụ systemd:
```bash
sudo systemctl restart warp-svc
```

---
*Tài liệu này được biên soạn cho quy trình vận hành (SOP) của hệ thống PodLearn.*
