# 🏆 CHIẾU QUỶ ICHECK

Ứng dụng web tính điểm Sâm Lốc / Chiếu Quỷ chuyên nghiệp, chuẩn xác 100% theo thiết kế Figma, hỗ trợ đồng bộ thời gian thực (Real-time Multi-Device Sync) trên mọi thiết bị qua mạng nội bộ LAN hoặc Internet.

🔗 **Production URL (Render)**: [https://chieuquyicheck.onrender.com](https://chieuquyicheck.onrender.com)

---

## 🌟 Tính Năng Nổi Bật

1. **Đồng bộ thời gian thực (Realtime Multi-Device Sync)**:
   - Tất cả các máy/điện thoại mở cùng một link sẽ hiển thị và cập nhật điểm số tức thì với độ trễ < 10ms.
   - Hỗ trợ nhiều phòng chơi riêng biệt qua query parameter `?room=ten_phong` (mặc định là `default`).
   - Tự động lưu trữ lịch sử và trạng thái vào ổ cứng (`data/rooms/*.json`) và bộ nhớ đệm `localStorage` của trình duyệt.

2. **Giao diện & Trải nghiệm người dùng (UX) chuẩn Figma**:
   - Thiết kế chuẩn tỉ lệ di động 390px, màu sắc nhận diện người chơi sắc nét, tương thích mọi kích thước màn hình (iPhone SE, iPhone 14/15/16 Pro Max, iPad, PC).
   - **FLIP Animation (Chuyển đổi vị trí mượt mà)**: Sau mỗi ván, các hàng người chơi tự động lướt chuyển vị trí theo thứ tự điểm tích lũy mới (người cao nhất trên cùng) với animation 0.55s chuẩn iOS.
   - **Drawer Lịch Sử Trượt Lên / Trượt Xuống**: Bấm icon Phóng to để trượt toàn màn hình từ đáy lên, vuốt ngón tay xuống hoặc bấm phím `Escape` để thu gọn.
   - **Bàn phím số cảm ứng thông minh**:
     - Tự động ẩn bảng lịch sử điểm khi mở bàn phím để giao diện gọn gàng, không bị rối mắt.
     - Giới hạn nhập tối đa 3 chữ số, tự động co nhỏ font chữ khi vượt khung.
     - Nút **✕ (Hủy)** màu đỏ hoàn nguyên ô điểm và đóng bàn phím nhanh chóng.
     - Chạm vào khoảng trống phía trên bàn phím để đóng bàn phím tức thì.

3. **Bảng Thống Kê Điểm (Daily Stats Ledger)**:
   - Thống kê toàn bộ các lần chốt sổ theo từng ngày/đợt chơi.
   - Phân biệt màu sắc trực quan: **Xanh lá** cho điểm dương, **Đỏ** cho điểm âm, **Trắng** cho điểm 0.
   - Chế độ sắp xếp linh hoạt: theo điểm số (Cao ➔ Thấp) hoặc theo tên (A ➔ Z).
   - Hỗ trợ xóa lần chốt sổ với giao diện xác nhận an toàn.

4. **Cơ chế bảo vệ & Tính điểm an toàn**:
   - **Kiểm tra SUM = 0**: Nút chốt ván màu xanh lá chỉ kích hoạt khi tổng điểm người thắng và người thua cân bằng chính xác bằng 0.
   - **Trượt xác nhận inline an toàn**: Thao tác Hoàn tác (Undo) và Reset toàn bộ điểm được tích hợp xác nhận inline chống bấm nhầm.
   - **Bôi màu tự động ở bảng lịch sử**: Nổi bật các ván bước ngoặt (Cháy / Chặn 2: -20/+20, Đánh sâm / Tới trắng: +40/+60/+80).

5. **Tích hợp Quỹ Chiếu Quỷ (MoMo QR)**:
   - Popup quét mã QR MoMo thanh toán quỹ.
   - Hỗ trợ sao chép liên kết, mở trực tiếp ứng dụng hoặc tải ảnh QR về máy.

---

## 📁 Cấu Trúc Dự Án

```text
chieuquyicheck/
├── data/
│   └── rooms/                  # Lưu trữ dữ liệu các phòng chơi (JSON)
├── dist/                       # Bản build production tối ưu
├── public/                     # Tài nguyên tĩnh (Ảnh nền, Mã QR MoMo)
├── server/
│   └── syncManager.js          # WebSocket Realtime Sync Server & Quản lý phòng
├── src/
│   ├── components/
│   │   ├── ActionToolbar.jsx   # Thanh công cụ: Chốt ván, Hoàn tác, Thống kê, QR
│   │   ├── DailyStatsDrawer.jsx# Bảng thống kê điểm theo ngày & Quản lý chốt sổ
│   │   ├── HistoryTable.jsx    # Bảng lịch sử điểm & Drawer phóng to/thu nhỏ
│   │   ├── Icons.jsx           # Bộ SVG icons chuẩn xác theo Figma
│   │   ├── Keyboard.jsx        # Bàn phím số cảm ứng thông minh
│   │   ├── Modals.jsx          # Popup Mã QR Quỹ Chiếu Quỷ (MoMo)
│   │   └── ScoreInputTable.jsx # 5 hàng người chơi với FLIP animation & gợi ý tên
│   ├── constants/
│   │   └── sampleLedger.js     # Hằng số bảng màu và danh sách người chơi
│   ├── hooks/
│   │   └── useRealtimeGame.js  # Custom Hook quản lý WebSocket & Offline Fallback
│   ├── App.jsx                 # Component trung tâm điều phối toàn bộ ứng dụng
│   ├── main.jsx                # Điểm khởi động React 18
│   └── style.css               # Toàn bộ CSS phong cách Figma & Responsive Safe Area
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
Khởi động Vite Dev Server kèm WebSocket Realtime:
```bash
npm run dev
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
Server sẽ lắng nghe tại cổng `PORT` (mặc định 3000).

---

## 🌐 Triển Khai Trực Tuyến

Ứng dụng được triển khai tự động (Continuous Deployment) từ nhánh `main` lên nền tảng Render:
- **Địa chỉ truy cập**: [https://chieuquyicheck.onrender.com](https://chieuquyicheck.onrender.com)
