# Xóa cache khi UI không đúng (ví dụ: không thấy danh sách chọn vé)

PWA (Service Worker) có thể đang cache bản JavaScript cũ. Làm lần lượt:

## 1. Gỡ Service Worker (quan trọng nhất)

1. Mở **DevTools** (F12)
2. Vào tab **Application** (Chrome) hoặc **Storage** (Firefox)
3. Bên trái chọn **Service Workers**
4. Bấm **Unregister** cho localhost:5173

## 2. Xóa cache & storage

- Cùng tab **Application**: **Storage** → **Clear site data** (chọn localhost:5173)

## 3. Xóa thư mục build

```bash
rm -rf dist dev-dist
```

## 4. Restart dev server

- Dừng `npm run dev` (Ctrl+C)
- Chạy lại: `npm run dev`

## 5. Hard refresh

- Mở lại http://localhost:5173/loto
- **Ctrl+Shift+R** (Windows/Linux) hoặc **Cmd+Shift+R** (Mac)

---

Sau khi làm xong, tạo phòng mới → phải thấy **DANH SÁCH VÉ** (6 màu, mỗi màu 2 vé) trước, chọn vé xong mới thấy "Vé của bạn" và nút Bốc số.
