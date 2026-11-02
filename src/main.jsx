import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './style.css';

// iPhone mở app từ màn hình chính (thanh trạng thái trong suốt): chiều cao 100% bị thiếu
// đúng phần thanh trạng thái nên đáy màn hình hiện dải đen. Dùng chiều cao thật của màn hình.
function updateAppHeight() {
  const root = document.documentElement;
  if (!window.navigator.standalone) {
    root.style.removeProperty('--app-height');
    return;
  }
  const isPortrait = window.innerHeight >= window.innerWidth;
  const screenHeight = isPortrait
    ? Math.max(window.screen.width, window.screen.height)
    : Math.min(window.screen.width, window.screen.height);
  root.style.setProperty('--app-height', `${Math.max(screenHeight, window.innerHeight)}px`);
}
updateAppHeight();
window.addEventListener('resize', updateAppHeight);
window.addEventListener('orientationchange', updateAppHeight);

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[App Crash caught by ErrorBoundary]:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0a2e14',
          color: '#ffffff',
          padding: '24px',
          textAlign: 'center',
          fontFamily: 'Inter, sans-serif'
        }}>
          <h2 style={{ fontSize: '20px', fontWeight: '800', marginBottom: '12px' }}>
            Đã có sự cố hiển thị
          </h2>
          <p style={{ fontSize: '14px', color: '#a0c4ab', marginBottom: '24px', maxWidth: '320px', lineHeight: '1.5' }}>
            Ứng dụng gặp lỗi tạm thời khi hiển thị giao diện. Bạn vui lòng bấm nút bên dưới để tải lại.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: '12px 24px',
              backgroundColor: '#4ade80',
              color: '#000000',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '15px',
              cursor: 'pointer'
            }}
          >
            Tải lại trang
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
