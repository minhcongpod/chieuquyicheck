# 🏆 CHIẾU QUỶ ICHECK

Ứng dụng web tính điểm Sâm Lốc / Chiếu Quỷ chuyên nghiệp, chuẩn xác 100% theo thiết kế Figma, hỗ trợ đồng bộ thời gian thực (Real-time Multi-Device Sync) trên mọi thiết bị qua mạng nội bộ LAN hoặc Internet.

---

## 🌟 Tính Năng Nổi Bật

1. **Đồng bộ thời gian thực (Realtime Multi-Device Sync)**:
   - Tất cả các máy/điện thoại mở cùng một link sẽ hiển thị và cập nhật điểm số tức thì với độ trễ < 10ms.
   - Hỗ trợ nhiều phòng chơi riêng biệt qua query parameter `?room=ten_phong` (mặc định là `default`).
   - Tự động lưu trữ lịch sử và trạng thái vào ổ cứng (`data/rooms/*.json`) và bộ nhớ đệm `localStorage` của trình duyệt.

2. **Giao diện & Trải nghiệm người dùng (UX) chuẩn Figma**:
   - Thiết kế nguyên bản tỉ lệ di động 390px, màu sắc nhận diện 5 người chơi đặc trưng.
   - **FLIP Animation (Chuyển đổi vị trí mượt mà)**: Sau mỗi ván, 5 hàng người chơi tự động lướt chuyển vị trí theo thứ tự điểm tích lũy mới (người cao nhất trên cùng) với animation 0.55s mượt mà chuẩn iOS.
   - **Drawer Lịch Sử Trượt Lên / Trượt Xuống**: Bấm icon Phóng to để trượt toàn màn hình từ đáy lên, bấm Thu nhỏ hoặc phím `Escape` để trượt xuống mượt mà.
   - **Bàn phím số cảm ứng thông minh**: Tự động hiển thị khi bấm `+` hoặc `-`, giới hạn tối đa 2 chữ số, đóng mở linh hoạt.

3. **Cơ chế bảo vệ & Tính điểm an toàn**:
   - **Kiểm tra SUM = 0**: Nút chốt ván màu xanh lá chỉ cho phép sang ván khi tổng điểm người thắng và người thua bằng 0.
   - **Popup LỖI CMNR**: Cảnh báo tức thì nếu chưa nhập điểm hoặc tổng điểm chưa cân bằng.
   - **Popup Xác Nhận Reset ("Bơi lại từ đầu :)")**: Bảo vệ an toàn tránh bấm nhầm reset.
   - **Popup Xác Nhận Hoàn Tác (Undo)**: Cho phép hủy kết quả ván đấu vừa chốt nếu có nhầm lẫn.
   - **Bôi màu tự động ở bảng lịch sử**: Nổi bật các ván bước ngoặt (Chặt heo +20/-20, Đánh sâm / Tới trắng +40/+60/+80).

---

## 📁 Cấu Trúc Dự Án (Sau Khi Tối Ưu)

```text
chieuquyicheck/
├── data/
│   └── rooms/                  # Lưu trữ dữ liệu các phòng chơi (JSON)
├── dist/                       # Bản build production tối ưu
├── server/
│   └── syncManager.js          # WebSocket Realtime Sync Server & Quản lý phòng
├── src/
│   ├── components/
│   │   ├── ActionToolbar.jsx   # 4 nút chức năng: Chốt ván, Reset, Undo, Info
│   │   ├── HistoryTable.jsx    # Bảng lịch sử điểm & Drawer phóng to/thu nhỏ
│   │   ├── Icons.jsx           # Bộ SVG icons chuẩn
│   │   ├── Keyboard.jsx        # Bàn phím số cảm ứng
│   │   ├── Modals.jsx          # Các Popup xác nhận (Reset, Undo, Error LỖI CMNR)
│   │   └── ScoreInputTable.jsx # 5 hàng người chơi với FLIP animation
│   ├── hooks/
│   │   └── useRealtimeGame.js  # Custom Hook quản lý WebSocket & Offline Fallback
│   ├── App.jsx                 # Component trung tâm ứng dụng
│   ├── main.jsx                # Điểm khởi động React 18
│   └── style.css               # Vanilla CSS thiết kế chuẩn Figma & animations
├── index.html                  # File HTML chính
├── package.json                # Dependencies sạch & Scripts
├── server.js                   # Node.js Express + WebSocket Server cho Production
└── vite.config.js              # Cấu hình Vite Dev Server
```

---

## 🚀 Hướng Dẫn Cài Đặt & Chạy Ứng Dụng

### 1. Cài đặt thư viện
```bash
npm install
```

### 2. Chế độ Phát triển (Development)
Khởi động Vite Dev Server kèm WebSocket Realtime trên cổng 3000:
```bash
npm run dev -- --host --port 3000
```
- Mở trên máy tính: `http://localhost:3000`
- Mở trên điện thoại cùng Wi-Fi: `http://<IP_MÁY_TÍNH>:3000`

### 3. Đóng gói & Chạy Bản Production
```bash
# 1. Build mã nguồn React ra thư mục dist
npm run build

# 2. Khởi chạy Server Production (Express + WebSocket)
npm start
```
Server sẽ phục vụ ứng dụng tại `http://localhost:3000` (hoặc biến môi trường `PORT`).

---

## 🌐 Chơi Qua Thiết Bị Khác (Không Cùng Wi-Fi / Dùng 4G)

Để bạn bè hoặc người khác ở xa (dùng 4G hoặc khác mạng Wi-Fi) cùng xem và tính điểm:
```bash
# Mở link Internet công khai miễn phí trong 1 lệnh:
npx localtunnel --port 3000
```
Gửi link kết quả (ví dụ `https://xxxx.loca.lt`) cho tất cả người chơi.
Mọi thao tác nhập điểm sẽ được đồng bộ tức thì xuyên suốt qua Internet!
