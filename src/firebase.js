import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// ⚙️ Cấu hình Firebase Web của bạn:
// Bạn có thể điền trực tiếp vào đây hoặc qua file .env (VITE_FIREBASE_...)
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSy_YOUR_API_KEY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "your-project-id.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "your-project-id.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456"
};

// Kiểm tra xem đã có cấu hình thực tế chưa (không phải placeholder)
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
    console.log('[Firebase] 🟢 Đã kết nối Firebase Firestore thành công.');
  } catch (error) {
    console.error('[Firebase] 🔴 Lỗi khởi tạo Firebase:', error);
  }
} else {
  console.warn('[Firebase] ⚠️ Chưa điền thông tin firebaseConfig trong src/firebase.js hoặc .env. Ứng dụng sẽ hoạt động ở chế độ Local Offline.');
}

export { app, db };
