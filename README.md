# Chat app — Backend

API REST + Socket.IO + MongoDB (Express, Node).

## Chạy local

```bash
npm install
cp .env.example .env   # MONGO_URI, JWT_*, PORT, CORS_ORIGIN, …
npm run dev
```

### Biến môi trường quan trọng

| Biến | Ý nghĩa |
|------|---------|
| `MONGO_URI` | Chuỗi kết nối MongoDB |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Ký JWT (bắt buộc đổi production) |
| `CORS_ORIGIN` | Để trống = mọi origin (dev). **Production:** URL frontend, phân tách bằng dấu phẩy (ví dụ `https://app.example.com`) — HTTP API và Socket.IO dùng cùng danh sách |
| `UPLOAD_MAX_MB` | Giới hạn dung lượng file chat (ảnh/video/audio), mặc định 25 |
| `TRUST_PROXY_HOPS` | `0` hoặc `false` khi chạy trực tiếp local; trên Fly/Heroku/nginx thường đặt `1` để rate limit theo IP client thật |
| `PORT` | Cổng HTTP (mặc định 5000) |

**HTTPS:** API không tự cấp TLS; HTTPS do reverse proxy (Fly, nginx, Cloudflare) phía trước. Frontend phải dùng `https://…` và `VITE_API_URL` trỏ tới cùng scheme.

Thư mục `uploads/` chứa file chat; các file upload thật được `.gitignore`, chỉ giữ `uploads/.gitkeep`.

### Health & log

- `GET /health` — trả `status`, `mongo`, `mongoState`, `uptime`; HTTP 503 nếu ping MongoDB thất bại.
- Log server ghi dạng JSON một dòng (`level`, `event`, `time`, …) — dễ tích hợp log tập trung.

### Rate limit (một phần API)

- Đăng ký / đăng nhập: giới hạn theo IP (chống brute-force).
- Refresh / logout: trần riêng (cao hơn).
- `POST /api/friends/request`: giới hạn theo giờ.
- `POST /api/messages/upload`: trần theo 15 phút.

## Deploy Fly.io (CLI — tránh lỗi “Failed to create app” trên web)

1. Cài [flyctl](https://fly.io/docs/hands-on/install-flyctl/), đăng nhập: `fly auth login`
2. Vào thư mục backend. Tạo app (tên phải **duy nhất** toàn Fly; sửa `app` trong `fly.toml` cho khớp):

   `fly apps create thinh-chat-backend`

   Nếu báo tên đã tồn tại: đổi thành ví dụ `thinh-chat-api-2026` ở cả lệnh trên và trong `fly.toml`.

3. Đặt secrets (giống `.env` local, **không** commit `.env`):

   `fly secrets set MONGO_URI="..." JWT_ACCESS_SECRET="..." JWT_REFRESH_SECRET="..." CORS_ORIGIN="https://<frontend-cua-ban>"`

   (Thêm `ACCESS_TOKEN_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`, `UPLOAD_MAX_MB`, `TRUST_PROXY_HOPS=1` nếu cần.)

4. `fly deploy`

5. Kiểm tra: `https://<app>.fly.dev/health`

6. MongoDB Atlas → Network Access: cho phép `0.0.0.0/0` (hoặc thu hẹp sau).

Frontend cần đặt `VITE_API_URL=https://<app>.fly.dev` (HTTPS) và **cùng** URL trong `CORS_ORIGIN` trên backend.

**Socket.IO:** realtime dùng bộ nhớ trong một process. Nên chạy **một** machine (`fly scale count 1`) hoặc dùng Redis adapter nếu scale > 1.

**Đừng để máy ngủ nếu cần chat realtime:** Trong `fly.toml`, `auto_stop_machines = "off"` giúp API/WebSocket luôn sẵn sàng; nếu để `"stop"`, lần đầu sau vài phút không traffic có thể chờ rất lâu mới nhận tin.

## Git

Đây là **một repo Git độc lập** (chỉ backend). Frontend nằm repo `chat-app-frontend`.

## Changelog (recent)

- Added ESLint + Node test scripts and CI checks.
- Added `helmet` and removed weak JWT secret fallbacks (env required).
- Hardened user search regex handling to reduce ReDoS risk.
- Implemented refresh token rotation during `/api/auth/refresh`.
- Expanded API rate-limits for search and chat-read heavy endpoints.
- Optimized unread summary query path to reduce N+1 database calls.
