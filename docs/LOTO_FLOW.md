# Lô tô – Luồng chạy và cách hoạt động

Tài liệu mô tả luồng chạy, kiến trúc và cách hoạt động **chỉ** của game Lô tô trong dự án (không bao gồm Bài cào, Xì dách).

---

## 1. Tổng quan kiến trúc

- **Client:** React (Vite) + TypeScript, Socket.IO client.
- **Server:** Node.js HTTP + Socket.IO (port 3001).
- **Giao tiếp:** Real-time qua Socket.IO (phòng theo `roomCode` 4 số).

```
[Browser: LotoPage] <--Socket.IO--> [Server: index.js]
        |                                    |
   roomState, gameState                 rooms (Map)
   socket.emit / socket.on              gameState per room
```

---

## 2. Dữ liệu game (gameState Lô tô)

Server và client đồng bộ qua `roomState.gameState` (với `gameType === 'loto'`):

| Trường | Mô tả |
|--------|--------|
| `drawnNumbers` | Mảng số đã bốc (1–90), tăng dần. |
| `lastDrawn` | Số vừa bốc lần gần nhất (dùng để đọc giọng, không merge vào `loto-update` cũ). |
| `ticketPool` | 12 vé (6 màu × 2 vé). Mỗi vé: `{ color, grid }`, grid 9×9. |
| `tickets` | `Record<playerId, [{ color, grid }, ...]>` – vé mỗi người đã chọn. |
| `kinhWinners` | Mảng `playerId` đủ 1 hàng (KINH). |
| `gameEnded` | `true` khi có ít nhất một người KINH. |

**Vé (ticket):**

- Grid **9 cột × 9 hàng**. Mỗi cột tương ứng một “thập” (1–9, 10–19, …, 80–90).
- Mỗi vé có **45 ô có số** (ô còn lại `null`).
- Mỗi hàng đúng **5 số**, mỗi cột có 4–6 số (theo `DECADE_SIZES`).
- Cùng màu: 2 vé không trùng số; tổng pool 90 số (1–90).

---

## 3. Luồng từng bước

### 3.1. Vào phòng (Lobby)

1. User mở trang Lô tô → **RoomManager** hiển thị: Tạo phòng / Vào phòng.
2. **Tạo phòng:** Nhập tên → `socket.emit('create-room', { roomCode, gameType: 'loto', playerName })`.
   - Server: tạo `rooms.set(roomCode, { gameType: 'loto', players, hostId, gameState })`.
   - `gameState` ban đầu: `drawnNumbers: []`, `ticketPool: generateTicketPool()`, `tickets: {}`, `kinhWinners: []`, `gameEnded: false`.
   - Server `emit('room-joined', ...)` và `emit('room-state', ...)` cho chủ phòng.
3. **Vào phòng:** Nhập mã 4 số + tên → `socket.emit('join-room', { roomCode, playerName })`.
   - Server thêm player vào `room.players`, `socket.join(roomCode)`, gửi `room-joined` cho người vào, `room-state` cho cả phòng.
4. **SocketContext** lắng nghe `room-state` → cập nhật `roomState` (bao gồm `gameState`) → toàn bộ UI Lô tô đọc từ `roomState`.

### 3.2. Chọn vé

1. Sau khi vào phòng, nếu `ticketPool.length > 0` và chưa có `tickets[playerId]` → **LotoPage** hiển thị **LotoTicketSelection**.
2. User chọn một hoặc nhiều vé từ 12 vé (nhấn vào vé để toggle), bấm **Xác nhận chọn**.
3. `socket.emit('loto-select-tickets', { selectedIndices })`.
4. Server: `gs.tickets[socket.id] = [ vé tương ứng selectedIndices ]`, rồi `io.to(roomCode).emit('room-state', ...)`.
5. Client nhận `room-state` → có `myTickets` → thoát màn chọn vé, vào màn chơi (có nút Bốc số, danh sách số đã bốc, vé của bạn).
6. **Chọn lại vé:** Chỉ khi `drawnNumbers.length === 0`. Gửi `loto-clear-my-tickets` → server xóa `gs.tickets[socket.id]` và emit lại `room-state`.

### 3.3. Bốc số (chỉ host)

1. Host bấm **Bốc số** → `unlockAudio()` (mở khóa âm thanh trong user gesture), `setIsSpeaking(true)`, `socket.emit('loto-draw')`.
2. Server:
   - Chỉ xử lý nếu `room.hostId === socket.id` và `gameType === 'loto'`, chưa `gameEnded` và `drawnNumbers.length < 90`.
   - Random số 1–90 chưa có trong `drawnNumbers`, push vào, sort.
   - Kiểm tra KINH: với mỗi `(playerId, playerTickets)`, kiểm tra mỗi vé có ít nhất một hàng đủ 5 số và 5 số đó đều trong `drawnNumbers` → thêm `playerId` vào `kinhWinners`. Nếu `kinhWinners.size > 0` → `gameEnded = true`, `gs.kinhWinners = [...kinhWinners]`.
   - `io.to(roomCode).emit('loto-update', { drawnNumbers, lastDrawn, kinhWinners, gameEnded })`.
3. Client:
   - **SocketContext** lắng `loto-update` → merge vào `roomState.gameState` (drawnNumbers, lastDrawn, kinhWinners, gameEnded).
   - **LotoPage** có `useEffect` phụ thuộc `gs.lastDrawn`: nếu khác `lastSpokenRef` thì gọi `speak(lastDrawn)` (đọc số bằng Web Speech API), rồi `setIsSpeaking(false)`.
   - Ô số trên vé: **Tự điền** (`autoMark === true`): ô được tô nếu số nằm trong `drawnNumbers`. **Tự bấm** (`autoMark === false`): ô chỉ tô khi user bấm (lưu trong `manualMarked`).

### 3.4. Kết thúc ván (KINH)

1. Khi `gameEnded === true` và `kinhWinners.length > 0`, UI hiển thị “KINH! … đủ hàng!” và danh sách tên (map `kinhWinners` → `roomState.players`).
2. **Đọc tên người thắng:** `useEffect` phụ thuộc `gameEnded`, `kinhWinners`, `roomState?.players`: nếu chưa từng đọc cho bộ winners này (so sánh qua `lastAnnouncedWinnersRef`) thì gọi `speakText("Chúc mừng [tên] đã KINH!")` (hook `useSpeakNumber`, hàm `speakText`).

### 3.5. Reset ván (chỉ host)

1. Host bấm **Chơi lại** (hoặc tương đương) → `socket.emit('loto-reset')`.
2. Server: `gs.drawnNumbers = []`, `gs.kinhWinners = []`, `gs.gameEnded = false` → `io.to(roomCode).emit('loto-update', { drawnNumbers: [], lastDrawn: null, kinhWinners: [], gameEnded: false })`.
3. Client cập nhật `roomState`; refs `lastSpokenRef` và `lastAnnouncedWinnersRef` được reset khi `drawnNumbers.length === 0` để ván mới đọc số/đọc tên đúng.

---

## 4. Các file chính (chỉ Lô tô)

| Vai trò | File |
|--------|------|
| Trang game | `src/pages/LotoPage.tsx` – UI chính, chọn vé, bốc số, vé của bạn, KINH, tự điền/tự bấm. |
| Component số | `src/components/LotoNumber.tsx` – ô số, prop `drawn` để tô màu. |
| Socket | `src/context/SocketContext.tsx` – kết nối Socket.IO, lắng `room-state`, `loto-update` và merge vào `roomState`. |
| Hook đọc | `src/hooks/useSpeakNumber.ts` – đọc số `speak(num)`, đọc văn bản `speakText(text)`, `unlockAudio()`, `abort()`. |
| Phòng | `src/components/RoomManager.tsx` – tạo/ vào phòng (dùng chung cho cả Lô tô và game khác). |
| Server Lô tô | `server/index.js` – `create-room`/`join-room` (loto), `loto-draw`, `loto-select-tickets`, `loto-clear-my-tickets`, `loto-reset`; sinh vé `generateTicketPool()`, `buildTicketGrid`. |

---

## 5. Sự kiện Socket (Lô tô)

| Event (client → server) | Điều kiện | Hành vi server |
|-------------------------|-----------|-----------------|
| `create-room` | - | Tạo phòng, `gameState` loto với `ticketPool`, emit `room-joined` + `room-state`. |
| `join-room` | Phòng tồn tại | Thêm player, emit `room-joined` (cho user) và `room-state` (cả phòng). |
| `loto-select-tickets` | Trong phòng loto | Gán `gs.tickets[socket.id]`, emit `room-state`. |
| `loto-clear-my-tickets` | Trong phòng loto, `drawnNumbers.length === 0` | Xóa `gs.tickets[socket.id]`, emit `room-state`. |
| `loto-draw` | Host, loto, chưa kết thúc, < 90 số | Bốc 1 số, kiểm tra KINH, emit `loto-update`. |
| `loto-reset` | Host, loto | Reset drawn/kinh/gameEnded, emit `loto-update`. |

| Event (server → client) | Nơi lắng | Tác dụng |
|-------------------------|----------|----------|
| `room-state` | SocketContext | Gán toàn bộ `roomState` (players, gameState, hostId). |
| `room-joined` | SocketContext | Cập nhật `roomState` (merge theo logic room mới/cũ). |
| `loto-update` | SocketContext | Merge `drawnNumbers`, `lastDrawn`, `kinhWinners`, `gameEnded` vào `gameState`. |

---

## 6. Giọng nói (Web Speech API)

- **Đọc số vừa bốc:** Trong user gesture (bấm Bốc số) gọi `unlockAudio()`; sau đó `useEffect` theo `lastDrawn` gọi `speak(lastDrawn)`. Chỉ đọc số mới (so sánh `lastSpokenRef`).
- **Đọc tên người thắng:** Khi có KINH, `speakText("Chúc mừng [tên] đã KINH!")`, chỉ một lần cho mỗi lần kết thúc ván (ref `lastAnnouncedWinnersRef`).
- **Tự bấm:** Khi tắt “Tự điền” (`autoMark = false`), ô chỉ tô khi user bấm vào ô (state `manualMarked`), không tô theo `drawnNumbers`.

---

Tài liệu này mô tả đầy đủ luồng và cách hoạt động của game Lô tô trong dự án.
