import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { setupWebSocketServer } from './server/syncManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

const PORT = process.env.PORT || 3000;

// Gắn WebSocket Server vào HTTP server
setupWebSocketServer(server);

// Phục vụ các file tĩnh đã build
app.use(express.static(path.join(__dirname, 'dist')));

// SPA fallback: Mọi route chưa khớp file tĩnh đều trả về index.html
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[ChieuQuy Server] Đang chạy tại http://0.0.0.0:${PORT}`);
});
