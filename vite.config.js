import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Tạo 404.html giống index.html để GitHub Pages mở được các phòng theo đường dẫn con (/vip, /ban-2...)
const spaFallback404 = {
  name: 'spa-fallback-404',
  enforce: 'post',
  generateBundle(_, bundle) {
    const html = bundle['index.html'];
    if (html && html.type === 'asset') {
      this.emitFile({ type: 'asset', fileName: '404.html', source: html.source });
    }
  }
};

export default defineConfig({
  base: './',
  plugins: [react(), spaFallback404],
  build: {
    rollupOptions: {
      output: {
        // Tách thư viện ra file riêng: sửa app không làm máy phải tải lại Firebase / React
        manualChunks: {
          firebase: ['firebase/app', 'firebase/firestore'],
          react: ['react', 'react-dom']
        }
      }
    }
  },
  server: {
    port: 3000,
    host: true
  }
});
