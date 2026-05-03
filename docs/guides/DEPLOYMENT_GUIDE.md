# Hướng dẫn Triển khai (Deployment Guide) PodLearn trên VPS

Tài liệu này hướng dẫn cách chạy song song hệ thống PodLearn (bao gồm Backend Flask, Frontend Vite/React, và Celery Worker) trên máy chủ VPS dùng hệ điều hành Linux (Ubuntu/Debian).

---

## Yêu cầu hệ thống (Prerequisites)
- VPS cài sẵn **Ubuntu 22.04 / 24.04**.
- Đã cài đặt Python 3.10+, Node.js (v18+), Nginx, và Redis.
- Dùng `PM2` hoặc `systemd` để quản lý các tiến trình (trong hướng dẫn này sẽ dùng `systemd` cho Backend/Celery và `Nginx` để phục vụ Frontend).

---

## 1. Môi trường Local (Development)
Ở môi trường Dev (trên máy tính của bạn), tôi đã cấu hình file `run_podlearn.py`. Bạn **chỉ cần chạy một lệnh duy nhất**:
```bash
python run_podlearn.py
```
Hệ thống sẽ tự động khởi động **Flask server** ở port 5020, và tự động gọi thêm 1 tiến trình ngầm chạy **Celery worker** (`--pool=solo`) dành cho Windows. Khi bạn tắt Flask (Ctrl+C), Celery worker cũng sẽ được tự động tắt theo.

---

## 2. Triển khai lên VPS (Production)

Trên VPS (Production), **không nên** dùng chung một file `run_podlearn.py` vì nó chỉ phù hợp cho Dev (chạy bằng werkzeug server). Bạn nên dùng **Gunicorn** cho Flask và **Systemd** cho Celery để đảm bảo tiến trình tự động khởi động lại nếu bị lỗi.

### A. Phục vụ Frontend (React/Vite)
Build bản tĩnh của frontend và để Nginx phục vụ:
```bash
cd frontend
npm install
npm run build
```
Copy thư mục `frontend/dist` vào `/var/www/podlearn/html`. Cấu hình Nginx trỏ `root` vào thư mục này.

### B. Cấu hình Systemd cho Gunicorn (Flask API)
Tạo file `/etc/systemd/system/podlearn-api.service`:
```ini
[Unit]
Description=Gunicorn daemon for PodLearn API
After=network.target

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/path/to/PodLearn
Environment="PATH=/path/to/PodLearn/venv/bin"
# Chạy Gunicorn ở port 5020 (hoặc file sock)
ExecStart=/path/to/PodLearn/venv/bin/gunicorn --workers 3 --bind 127.0.0.1:5020 "app:create_app()"

[Install]
WantedBy=multi-user.target
```

### C. Cấu hình Systemd cho Celery Worker
Đây là phần quan trọng nhất để các tác vụ ngầm (như AI, tải Youtube) hoạt động trên VPS.

Tạo file `/etc/systemd/system/podlearn-celery.service`:
```ini
[Unit]
Description=Celery Worker for PodLearn
After=network.target redis-server.service

[Service]
User=ubuntu
Group=www-data
WorkingDirectory=/path/to/PodLearn
Environment="PATH=/path/to/PodLearn/venv/bin"

# Lưu ý: Queue được thiết lập là podlearn_tasks
# Ở Linux, không cần --pool=solo, Celery có thể dùng prefork mặc định rất mạnh
ExecStart=/path/to/PodLearn/venv/bin/celery -A run_podlearn.celery_app worker -Q podlearn_tasks --loglevel=info

Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### D. Kích hoạt dịch vụ
Sau khi tạo xong 2 file cấu hình systemd, chạy các lệnh sau để khởi động:
```bash
sudo systemctl daemon-reload

sudo systemctl enable podlearn-api
sudo systemctl start podlearn-api

sudo systemctl enable podlearn-celery
sudo systemctl start podlearn-celery
```

---

## 3. Cấu hình Nginx (Nginx Reverse Proxy)
Bạn cần 1 file cấu hình Nginx để điều phối traffic:
- Các request vào `/api` -> Gửi cho Gunicorn (port 5020).
- Các request còn lại -> Trả về `index.html` của Frontend.

Mẫu `nginx.conf`:
```nginx
server {
    listen 80;
    server_name podlearn.yourdomain.com;

    # Phục vụ Frontend
    root /var/www/podlearn/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API cho Gunicorn
    location /api/ {
        proxy_pass http://127.0.0.1:5020;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Chúc bạn triển khai thành công!
