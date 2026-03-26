# Kế hoạch / checklist dự án chat-app

Chỉ còn các việc **chưa làm**. Đánh dấu `[x]` khi hoàn thành.

---

## 1. Chat & realtime (còn lại)

- [ ] **Đang gõ** (`typing`) trong room
- [ ] **Gọi thoại / video** (WebRTC hoặc dịch vụ) — thay cho nút placeholder
- [ ] **Sửa tin nhắn** (nếu cần)

---

## 2. Giao diện & nội dung

- [x] **Chuẩn hóa tiếng Việt có dấu** toàn app (thay chuỗi ASCII hiện tại)
- [x] **Preview video / âm thanh** trước khi gửi (tương tự ảnh)

---

## 3. Bảo mật & vận hành

- [ ] **Upload an toàn hơn**: không để `/uploads` public vô hạn; URL có hạn / proxy kiểm tra thành viên room
- [ ] **Rate limiting**: login, upload, (nếu được) số event socket
- [ ] **Helmet** + **CORS** chỉ domain production
- [ ] **Siết MIME / extension** upload (whitelist rõ ràng)
- [ ] **Dọn file orphan**: xóa file trên disk không còn message tham chiếu

---

## 4. Chất lượng & CI

- [x] **ESLint + Prettier** (frontend)
- [x] **Lint** cho backend (ESLint hoặc tương đương)
- [ ] **Test API** (ví dụ supertest: auth, room cơ bản)
- [ ] **Test frontend** (ít nhất utils / hook quan trọng)
- [ ] **GitHub Actions** (hoặc CI khác): lint + test khi push

---

## 5. Triển khai (deploy)

- [ ] **Docker Compose**: Mongo + backend + frontend (hoặc static + nginx)
- [ ] **Tài liệu env**: `.env.example` đầy đủ (JWT, Mongo, `VITE_API_URL`, …) — bổ sung backend nếu thiếu
- [ ] **Backup Mongo** định kỳ (nếu chạy production)

---

## Ghi chú của bạn

_(Ý tưởng hoặc thứ tự ưu tiên riêng.)_

```
Ưu tiên 1:
Ưu tiên 2:
Ưu tiên 3:
```
