# Chat app — Backend

API REST + Socket.IO + MongoDB (Express, Node).

## Chạy local

```bash
npm install
cp .env.example .env   # MONGO_URI, JWT_*, PORT, …
npm run dev
```

Thư mục `uploads/` chứa file chat; các file upload thật được `.gitignore`, chỉ giữ `uploads/.gitkeep`.

## Git

Đây là **một repo Git độc lập** (chỉ backend). Frontend nằm repo `chat-app-frontend`.
