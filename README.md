# Game Dân Gian Việt Nam

Ứng dụng PWA chơi các game truyền thống Việt Nam: **Lô tô**, **Bài cào 3 lá**, **Xì dách**.

## Công nghệ

- React + Vite + TypeScript
- Tailwind CSS v3
- Shadcn-style components
- Motion (animation)
- Socket.IO (real-time multiplayer)
- PWA

## Chạy ứng dụng

### 1. Cài đặt dependencies

```bash
npm install
cd server && npm install && cd ..
```

### 2. Chạy server Socket.IO (terminal 1)

```bash
npm run server
# hoặc với auto-reload:
npm run server:dev
```

Server chạy trên **http://localhost:3001**

### 3. Chạy frontend (terminal 2)

```bash
npm run dev
```

Frontend chạy trên **http://localhost:5173**

## Cách chơi

1. **Vào game**: Chọn Lô tô, Bài cào 3 lá hoặc Xì dách
2. **Tạo phòng**: Bấm "Tạo phòng mới" → Đặt tên → Nhận mã phòng 4 số
3. **Mời bạn**: Copy link hoặc gửi mã phòng cho người khác
4. **Vào phòng**: Người khác mở link hoặc nhập mã phòng → Đặt tên → Vào phòng

## Luật chơi

### Lô tô (1-90)
- Mỗi người có vé 15 số (3 hàng x 5 cột)
- Chủ phòng bốc số ngẫu nhiên
- Thắng khi: đủ 1 hàng (5 số), 2 hàng (10 số), hoặc kín vé (15 số)

### Bài cào 3 lá
- Mỗi người 3 lá bài
- Điểm = số lẻ của tổng (vd: 27 → 7 nút, 20 → 0 bù)
- Đặc biệt: Ba Tây (JQK), Ba Cào (3 lá giống), Liêng (3 lá liên tiếp)
- Chủ phòng chia bài mới mỗi ván

### Xì dách (21 điểm)
- Mục tiêu ≤ 21 điểm
- Chủ phòng làm nhà cái
- Rút bài hoặc Dừng khi đến lượt

## Build production

```bash
npm run build
npm run preview  # xem bản build
```

**Lưu ý**: Khi deploy, cần chạy server Socket.IO riêng (port 3001) và cập nhật `SOCKET_URL` trong `src/context/SocketContext.tsx` nếu cần.
