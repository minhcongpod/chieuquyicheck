# 🏆 CHIẾU QUỶ ICHECK

Ứng dụng web tính điểm Sâm Lốc / Chiếu Quỷ chuyên nghiệp, chuẩn xác 100% theo thiết kế Figma, hỗ trợ đồng bộ thời gian thực (Real-time Multi-Device Sync) trên mọi thiết bị qua nền tảng Google Firebase và GitHub Pages.

🔗 **Production URL (GitHub Pages)**: [https://minhcongpod.github.io/chieuquyicheck/](https://minhcongpod.github.io/chieuquyicheck/)

---

## 🌟 Tính Năng Nổi Bật

1. **Đồng bộ thời gian thực không cần máy chủ (Firebase Realtime & Presence)**:
   - Tất cả các máy/điện thoại mở cùng một link sẽ hiển thị và cập nhật điểm số tức thì với độ trễ siêu thấp (< 50ms) qua Google Cloud Firestore.
   - Kiến trúc Serverless 100% không còn hiện tượng máy chủ ngủ (sleep/cold start).
   - Hỗ trợ nhiều phòng chơi riêng biệt qua query parameter `?room=ten_phong` (mặc định là `default`).
   - Phân quyền tự động: 2 máy kết nối đầu tiên được quyền Active (sửa điểm), từ máy thứ 3 trở đi chuyển sang chế độ View-Only (chỉ xem).
   - Hỗ trợ link chia sẻ View-Only riêng biệt (`?view=1` hoặc `?mode=view`).
   - Tự động lưu trữ offline và phục hồi ngay lập tức qua `localStorage`.

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
├── .github/
│   └── workflows/
│       └── deploy.yml          # Tự động build & deploy lên GitHub Pages
├── dist/                       # Bản build production tối ưu
├── public/                     # Tài nguyên tĩnh (Ảnh nền, Mã QR MoMo)
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
│   │   └── useRealtimeGame.js  # Custom Hook quản lý Firebase Firestore Sync & Presence
│   ├── firebase.js             # Cấu hình khởi tạo Google Firebase
│   ├── App.jsx                 # Component trung tâm điều phối toàn bộ ứng dụng
│   ├── main.jsx                # Điểm khởi động React 18
│   └── style.css               # Toàn bộ CSS phong cách Figma & Responsive Safe Area
├── index.html                  # File HTML chính
├── package.json                # Dependencies sạch & Scripts (không cần express, ws)
└── vite.config.js              # Cấu hình Vite với base relative
```

---

## 🚀 Hướng Dẫn Cấu Hình Firebase

Để kết nối đồng bộ thời gian thực:
1. Vào [Firebase Console](https://console.firebase.google.com), tạo một Web Project (hoặc dùng project đã có).
2. Bật dịch vụ **Cloud Firestore Database** (chọn chế độ Test mode hoặc thêm Security Rules cho phép read/write).
3. Copy đoạn mã cấu hình `firebaseConfig` và dán vào file [src/firebase.js](file:///Users/pod/Library/CloudStorage/GoogleDrive-minhcong.pod@gmail.com/My%20Drive/ICHECK/chieuquyicheck/src/firebase.js) hoặc tạo file `.env` với các biến tương ứng.
