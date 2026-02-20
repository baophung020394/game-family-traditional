# Prompt tái tạo game Lô tô (multiplayer realtime)

Dùng prompt dưới đây để hướng dẫn AI tạo lại (hoặc tạo mới) game Lô tô multiplayer realtime với đủ tính năng đã có. Copy toàn bộ hoặc chỉnh sửa theo nhu cầu.

---

## Prompt

```
Tạo một game Lô tô multiplayer chơi theo phòng (room), realtime qua Socket.IO, với các yêu cầu sau.

---

### 1. Stack kỹ thuật

- **Frontend:** React (hoặc tương đương) + TypeScript, Vite. UI: Tailwind CSS, component Button/Card/Dialog/Input cơ bản.
- **Backend:** Node.js, HTTP server + Socket.IO (CORS cho client).
- **Realtime:** Socket.IO (client kết nối URL server). Một phòng = một roomCode (ví dụ 4 chữ số). Server lưu rooms trong Map: roomCode -> { gameType, players, hostId, gameState }.

---

### 2. Luật và dữ liệu Lô tô

- Số dùng: 1–90. Mỗi ván bốc lần lượt các số (random, không trùng) cho đến khi có người “KINH” hoặc hết 90 số.
- **Vé (ticket):** Grid 9 cột × 9 hàng. Cột j tương ứng “thập” (1–9, 10–19, …, 80–90). Mỗi vé có đúng 45 ô chứa số (ô còn lại trống). Mỗi hàng đúng 5 số, mỗi cột có 4–6 số tùy thập. Cùng màu: 2 vé không trùng số; pool 12 vé (6 màu × 2 vé), tổng 90 số.
- **KINH:** Một người thắng khi có ít nhất một hàng trên một trong các vé của họ mà cả 5 số trên hàng đó đã được bốc. Khi có ít nhất một người KINH thì ván kết thúc (gameEnded = true). Có thể nhiều người cùng KINH trong một lần bốc.

**Game state Lô tô trên server (và đồng bộ xuống client):**

- drawnNumbers: number[] — các số đã bốc (1–90), tăng dần.
- lastDrawn: number | null — số vừa bốc lần gần nhất (để client đọc giọng).
- ticketPool: { color, grid: (number|null)[][] }[] — 12 vé (server sinh khi tạo phòng).
- tickets: Record<playerId, { color, grid }[]> — vé mỗi người chơi đã chọn.
- kinhWinners: string[] — danh sách playerId đủ 1 hàng (KINH).
- gameEnded: boolean — true khi có người KINH.

---

### 3. Luồng nghiệp vụ

**Vào phòng**

- Tạo phòng: emit create-room { roomCode, gameType: 'loto', playerName }. Server tạo room, khởi tạo gameState (drawnNumbers=[], ticketPool=generateTicketPool(), tickets={}, kinhWinners=[], gameEnded=false), gửi room-joined và room-state cho chủ phòng.
- Vào phòng: emit join-room { roomCode, playerName }. Server thêm player vào room, gửi room-joined cho người vào và room-state cho cả phòng.
- Client lắng room-state và cập nhật state toàn phòng (players, gameState, hostId) để render UI.

**Chọn vé**

- Sau khi vào phòng, nếu có ticketPool và chưa có tickets[playerId], hiển thị màn chọn vé. User chọn một hoặc nhiều vé từ 12 vé (theo index), bấm xác nhận.
- Emit loto-select-tickets { selectedIndices: number[] }. Server gán tickets[socket.id] từ ticketPool theo selectedIndices, rồi emit room-state. Client nhận room-state và chuyển sang màn chơi (hiển thị vé đã chọn, nút Bốc số, danh sách số đã bốc).
- Cho phép “Chọn lại vé” chỉ khi drawnNumbers.length === 0: emit loto-clear-my-tickets, server xóa tickets[socket.id] và emit room-state.

**Bốc số (chỉ host)**

- Chỉ host được bốc. Emit loto-draw.
- Server: random một số 1–90 chưa có trong drawnNumbers, push vào và sort. Kiểm tra KINH: với mỗi (playerId, danh sách vé), kiểm tra mỗi vé có ít nhất một hàng mà 5 số đều nằm trong drawnNumbers; nếu có thì thêm playerId vào kinhWinners. Nếu kinhWinners.length > 0 thì set gameEnded = true. Emit loto-update { drawnNumbers, lastDrawn, kinhWinners, gameEnded } cho cả phòng.
- Client: lắng loto-update và merge drawnNumbers, lastDrawn, kinhWinners, gameEnded vào gameState. Hiển thị danh sách số đã bốc và tô các ô trên vé tương ứng (xem mục Đánh dấu vé).

**Kết thúc ván**

- Khi gameEnded && kinhWinners.length > 0: hiển thị thông báo “KINH” và danh sách tên người thắng (map kinhWinners sang tên từ danh sách players). Có thể dùng Web Speech API để đọc câu kiểu “Chúc mừng [tên] đã KINH!” một lần cho mỗi lần kết thúc ván.

**Reset ván (chỉ host)**

- Emit loto-reset. Server set drawnNumbers=[], kinhWinners=[], gameEnded=false và emit loto-update. Client cập nhật gameState và reset các ref dùng cho đọc số/đọc tên để ván mới hoạt động đúng.

---

### 4. Đánh dấu vé (ô đã bốc)

- Chế độ “Tự điền” (autoMark = true): ô trên vé được tô (đánh dấu) nếu số trong ô nằm trong drawnNumbers.
- Chế độ “Tự bấm” (autoMark = false): ô chỉ được tô khi user bấm vào ô (lưu trong state local, ví dụ Set<string> key theo ticketKey + số). Không tự tô theo drawnNumbers.

---

### 5. Giọng nói (Web Speech API)

- Đọc số vừa bốc: Khi có lastDrawn mới, gọi SpeechSynthesisUtterance với lastDrawn. Trên Chrome cần “mở khóa” âm thanh trong user gesture (ví dụ trong handler bấm “Bốc số” gọi resume AudioContext, getVoices(), và có thể speak một utterance rất ngắn). Chỉ đọc số mới (dùng ref để tránh đọc lại khi re-render).
- Đọc tên người thắng: Khi có KINH, đọc câu “Chúc mừng [tên1], [tên2] … đã KINH!” bằng SpeechSynthesisUtterance với text. Dùng ref để chỉ đọc một lần cho mỗi lần kết thúc ván. Ưu tiên giọng vi-VN nếu có (getVoices(), lang 'vi-VN').
- Chrome: getVoices() có thể trả về [] lần đầu; cần chờ sự kiện voiceschanged hoặc timeout fallback trước khi speak.

---

### 6. Sinh vé trên server

- ticketPool: 12 vé. 6 màu, mỗi màu 2 vé. Cột j có DECADE_SIZES[j] ô có số (ví dụ [9,10,10,10,10,10,10,10,11]). Cùng màu: 2 vé dùng 45+45 số không trùng trong 1–90 (chia theo thập: 1–9, 10–19, …, 80–90). Grid 9×9: mỗi hàng đúng 5 số, mỗi cột đúng số ô theo thập. Có thể dùng thuật toán: với mỗi cột chọn đủ số hàng cần, gán số đã shuffle trong thập đó vào các ô đã chọn; random hóa thứ tự hàng được chọn để vé không giống nhau mỗi lần.

---

### 7. UI gợi ý

- Trang chính: Nếu chưa vào phòng -> form Tạo phòng / Vào phòng (mã 4 số, tên). Sau khi vào phòng: nếu chưa chọn vé -> màn chọn vé (grid 12 vé, chọn/bỏ chọn, nút Xác nhận). Sau khi chọn vé: khu vực số đã bốc (danh sách số + có thể dùng component ô số với prop “drawn” để tô màu), nút “Bốc số” (chỉ host, disable khi đang đọc hoặc gameEnded hoặc đủ 90 số), 2 nút chế độ “Tự điền” / “Tự bấm”, vé của bạn (grid 9×9, mỗi ô số gọi component ô số, drawn = theo autoMark và drawnNumbers hoặc manualMarked). Khi gameEnded và có kinhWinners: hiển thị “KINH! … đủ hàng!” và danh sách tên, nút “Chơi lại” (chỉ host) gửi loto-reset.
- Component ô số: nhận number và drawn (boolean); khi drawn=true tô nền đậm (ví dụ primary), khi false nền nhạt. Có thể có size xs/sm/md cho ô trong vé và ô trong danh sách số đã bốc.

---

### 8. Socket events tóm tắt

**Client -> Server:** create-room, join-room, loto-select-tickets, loto-clear-my-tickets, loto-draw (host), loto-reset (host).

**Server -> Client:** room-joined, room-state (full state phòng), loto-update (drawnNumbers, lastDrawn, kinhWinners, gameEnded). Client merge loto-update vào gameState thay vì thay thế toàn bộ room-state.

---

Tạo đủ file: server (Node + Socket.IO, xử lý các event trên và sinh ticketPool), context Socket (kết nối, lắng room-state và loto-update), trang Lô tô (luồng chọn phòng -> chọn vé -> chơi -> KINH/reset), component vé và ô số, hook đọc số/đọc văn bản (Web Speech API). Đảm bảo khi bật “Tự bấm” thì ô chỉ tô khi user bấm, không tự tô theo số vừa bốc.
```

---

## Cách dùng

1. Copy toàn bộ nội dung trong khối **Prompt** ở trên.
2. Dán vào chat với AI (Cursor, ChatGPT, Claude, …).
3. Có thể bổ sung: “Dùng React 19 + Vite 7 + TypeScript”, “UI giống Tailwind + shadcn”, “Server chạy port 3001”, “PWA optional”, v.v.

File **LOTO_FLOW.md** trong cùng thư mục `docs/` mô tả chi tiết luồng và file liên quan của bản hiện tại, có thể dùng làm tài liệu tham chiếu khi implement hoặc review.
