import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ⚙️ Cấu hình Firebase Web chính thức của dự án chieuquyicheck:
export const firebaseConfig = {
  apiKey: "AIzaSyAJw-5twD9rve15m_BUrvrLjVG0wrBMWfE",
  authDomain: "chieuquyicheck.firebaseapp.com",
  projectId: "chieuquyicheck",
  storageBucket: "chieuquyicheck.firebasestorage.app",
  messagingSenderId: "36460032761",
  appId: "1:36460032761:web:8c31f28f6d1e0afdae6828",
  measurementId: "G-2MPV2BS7CJ"
};

// Kiểm tra cấu hình hợp lệ
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('YOUR_API_KEY') &&
  firebaseConfig.projectId &&
  !firebaseConfig.projectId.includes('your-project-id')
);

let app = null;
let db = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    db = getFirestore(app);
    console.log('[Firebase] 🟢 Đã kết nối Firebase Firestore thành công với project chieuquyicheck.');
  } catch (error) {
    console.error('[Firebase] 🔴 Lỗi khởi tạo Firebase:', error);
  }
} else {
  console.warn('[Firebase] ⚠️ Chưa cấu hình Firebase. Đang chạy offline local.');
}

export { app, db };
