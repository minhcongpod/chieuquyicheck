import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { setupWebSocketServer } from './server/syncManager.js';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'websocket-sync-server',
      configureServer(server) {
        if (server.httpServer) {
          setupWebSocketServer(server.httpServer);
        }
      }
    }
  ],
  server: {
    port: 3000,
    host: true,
    allowedHosts: true
  }
});
