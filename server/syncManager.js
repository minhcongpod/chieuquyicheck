import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data/rooms');

// Đảm bảo thư mục lưu dữ liệu tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 5 Người chơi mặc định
const INITIAL_PLAYERS = [
  { id: 'p1', name: '', color: '#f4e950' }, // Vàng
  { id: 'p2', name: '', color: '#66ff33' }, // Xanh lá
  { id: 'p3', name: '', color: '#16e4ff' }, // Cyan
  { id: 'p4', name: '', color: '#c073ff' }, // Tím
  { id: 'p5', name: '', color: '#fd6161' }  // Đỏ
];

// Lưu trữ trạng thái trong bộ nhớ RAM và danh sách kết nối
const roomStates = new Map(); // roomId -> state
const roomClients = new Map(); // roomId -> Set<ws>

import { SAMPLE_DAILY_LEDGER } from '../src/constants/sampleLedger.js';

/**
 * Đọc trạng thái phòng từ file (nếu có) hoặc khởi tạo mới
 */
function getOrCreateRoomState(roomId) {
  if (roomStates.has(roomId)) {
    return roomStates.get(roomId);
  }

  const filePath = path.join(DATA_DIR, `${roomId}.json`);
  if (fs.existsSync(filePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (!data.dailyLedger || data.dailyLedger.length === 0) {
        data.dailyLedger = JSON.parse(JSON.stringify(SAMPLE_DAILY_LEDGER));
      }
      roomStates.set(roomId, data);
      return data;
    } catch (e) {
      console.error(`[SyncServer] Lỗi đọc file phòng ${roomId}:`, e);
    }
  }

  const newState = {
    roomId,
    players: JSON.parse(JSON.stringify(INITIAL_PLAYERS)),
    history: [],
    roundDeltas: {},
    dailyLedger: JSON.parse(JSON.stringify(SAMPLE_DAILY_LEDGER)),
    updatedAt: Date.now()
  };

  roomStates.set(roomId, newState);
  saveRoomState(roomId, newState);
  return newState;
}

/**
 * Lưu trạng thái phòng ra đĩa
 */
function saveRoomState(roomId, state) {
  try {
    const filePath = path.join(DATA_DIR, `${roomId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[SyncServer] Lỗi ghi file phòng ${roomId}:`, e);
  }
}

/**
 * Phát tin nhắn đến tất cả các client đang kết nối trong cùng phòng
 */
function broadcastToRoom(roomId, message, excludeWs = null) {
  const clients = roomClients.get(roomId);
  if (!clients) return;

  const dataStr = JSON.stringify(message);
  for (const client of clients) {
    if (client !== excludeWs && client.readyState === 1) { // 1 = OPEN
      try {
        client.send(dataStr);
      } catch (e) {
        console.error('[SyncServer] Lỗi gửi dữ liệu client:', e);
      }
    }
  }
}

/**
 * Khởi tạo WebSocket Server và gắn vào HTTP Server
 */
export function setupWebSocketServer(httpServer) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    if (urlObj.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws, request) => {
    const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const roomId = urlObj.searchParams.get('room') || 'default';

    // Đăng ký client vào phòng
    if (!roomClients.has(roomId)) {
      roomClients.set(roomId, new Set());
    }
    roomClients.get(roomId).add(ws);

    // Gửi ngay trạng thái hiện tại của phòng cho client mới kết nối
    const currentState = getOrCreateRoomState(roomId);
    ws.send(JSON.stringify({
      type: 'INIT_STATE',
      payload: currentState,
      serverTime: Date.now()
    }));

    // Báo số người đang online trong phòng cho mọi người
    broadcastToRoom(roomId, {
      type: 'ROOM_USERS_COUNT',
      count: roomClients.get(roomId).size
    });

    // Lắng nghe các thay đổi từ client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        const { type, payload } = data;
        const state = getOrCreateRoomState(roomId);

        switch (type) {
          case 'UPDATE_PLAYER_NAME': {
            const { id, name } = payload;
            state.players = state.players.map(p => p.id === id ? { ...p, name } : p);
            state.updatedAt = Date.now();
            saveRoomState(roomId, state);
            broadcastToRoom(roomId, {
              type: 'STATE_UPDATE',
              actionType: 'UPDATE_PLAYER_NAME',
              payload: state
            });
            break;
          }

          case 'UPDATE_DELTAS': {
            state.roundDeltas = payload.roundDeltas || {};
            state.updatedAt = Date.now();
            // Cập nhật điểm đang nhập dở tức thì
            broadcastToRoom(roomId, {
              type: 'STATE_UPDATE',
              actionType: 'UPDATE_DELTAS',
              payload: state
            });
            break;
          }

          case 'CONFIRM_ROUND': {
            const { newRound } = payload;
            state.history.push(newRound);
            state.roundDeltas = {};
            state.updatedAt = Date.now();
            saveRoomState(roomId, state);
            broadcastToRoom(roomId, {
              type: 'STATE_UPDATE',
              actionType: 'CONFIRM_ROUND',
              payload: state
            });
            break;
          }

          case 'UNDO_ROUND': {
            if (state.history.length > 0) {
              state.history.pop();
              state.updatedAt = Date.now();
              saveRoomState(roomId, state);
              broadcastToRoom(roomId, {
                type: 'STATE_UPDATE',
                actionType: 'UNDO_ROUND',
                payload: state
              });
            }
            break;
          }

          case 'RESET_GAME': {
            state.history = [];
            state.roundDeltas = {};
            state.updatedAt = Date.now();
            saveRoomState(roomId, state);
            broadcastToRoom(roomId, {
              type: 'STATE_UPDATE',
              actionType: 'RESET_GAME',
              payload: state
            });
            break;
          }

          case 'ADD_LEDGER_ENTRY': {
            if (!state.dailyLedger) state.dailyLedger = [];
            state.dailyLedger.unshift(payload.entry);
            state.updatedAt = Date.now();
            saveRoomState(roomId, state);
            broadcastToRoom(roomId, {
              type: 'STATE_UPDATE',
              actionType: 'ADD_LEDGER_ENTRY',
              payload: state
            });
            break;
          }

          case 'SET_DAILY_LEDGER': {
            state.dailyLedger = payload.dailyLedger || [];
            state.updatedAt = Date.now();
            saveRoomState(roomId, state);
            broadcastToRoom(roomId, {
              type: 'STATE_UPDATE',
              actionType: 'SET_DAILY_LEDGER',
              payload: state
            });
            break;
          }

          case 'PING': {
            ws.send(JSON.stringify({ type: 'PONG' }));
            break;
          }

          default:
            break;
        }
      } catch (err) {
        console.error('[SyncServer] Lỗi xử lý message:', err);
      }
    });

    ws.on('close', () => {
      const clients = roomClients.get(roomId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          roomClients.delete(roomId);
        } else {
          broadcastToRoom(roomId, {
            type: 'ROOM_USERS_COUNT',
            count: clients.size
          });
        }
      }
    });

    ws.on('error', (err) => {
      console.error('[SyncServer] Lỗi socket client:', err);
    });
  });

  console.log('[SyncServer] WebSocket Realtime Server đã khởi động sẵn sàng tại /ws');
  return wss;
}
