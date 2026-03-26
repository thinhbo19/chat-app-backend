# Chat app — Backend

API REST + Socket.IO + MongoDB (Express, Node).

## Chạy local

```bash
npm install
cp .env.example .env   # MONGO_URI, JWT_*, PORT, …
npm run dev
```

Thư mục `uploads/` chứa file chat; các file upload thật được `.gitignore`, chỉ giữ `uploads/.gitkeep`.

## Deploy Fly.io (CLI — tránh lỗi “Failed to create app” trên web)

1. Cài [flyctl](https://fly.io/docs/hands-on/install-flyctl/), đăng nhập: `fly auth login`
2. Vào thư mục backend. Tạo app (tên phải **duy nhất** toàn Fly; sửa `app` trong `fly.toml` cho khớp):

   `fly apps create thinh-chat-backend`

   Nếu báo tên đã tồn tại: đổi thành ví dụ `thinh-chat-api-2026` ở cả lệnh trên và trong `fly.toml`.

3. Đặt secrets (giống `.env` local, **không** commit `.env`):

   `fly secrets set MONGO_URI="..." JWT_ACCESS_SECRET="..." JWT_REFRESH_SECRET="..."`

   (Thêm `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN` nếu cần.)

4. `fly deploy`

5. Kiểm tra: `https://<app>.fly.dev/health`

6. MongoDB Atlas → Network Access: cho phép `0.0.0.0/0` (hoặc thu hẹp sau).

Frontend cần trỏ base URL / Socket tới `https://<app>.fly.dev`.

**Socket.IO:** realtime dùng bộ nhớ trong một process. Nên chạy **một** machine (`fly scale count 1`) hoặc dùng Redis adapter nếu scale > 1.

**Đừng để máy ngủ nếu cần chat realtime:** Trong `fly.toml`, `auto_stop_machines = "off"` giúp API/WebSocket luôn sẵn sàng; nếu để `"stop"`, lần đầu sau vài phút không traffic có thể chờ rất lâu mới nhận tin.

## Git

Đây là **một repo Git độc lập** (chỉ backend). Frontend nằm repo `chat-app-frontend`.
