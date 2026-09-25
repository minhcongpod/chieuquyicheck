import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data/rooms');

// Đảm bảo thư mục lưu dữ liệu tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Khởi tạo Firebase nếu có cấu hình
let db = null;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
    console.log('[SyncServer] 🟢 Firebase Firestore đã được khởi tạo thành công.');
  } catch (error) {
    console.error('[SyncServer] 🔴 Lỗi khởi tạo Firebase:', error);
  }
}

// 5 Người chơi mặc định (chuỗi rỗng ban đầu)
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
const roomActiveSlots = new Map(); // roomId -> Array<ws> (tối đa 2 người chơi Active)

/**
 * Phân bổ slot khi có client mới kết nối vào phòng:
 * - 2 người đầu tiên được cấp quyền Active (Chủ phòng / Người chơi)
 * - Từ người thứ 3 trở đi được cấp quyền View-Only (Chỉ xem)
 */
function assignSlotForConnection(roomId, ws) {
  if (!roomActiveSlots.has(roomId)) {
    roomActiveSlots.set(roomId, []);
  }
  let activeSlots = roomActiveSlots.get(roomId).filter((s) => s.readyState === 1);

  if (activeSlots.length < 2) {
    activeSlots.push(ws);
    ws.role = 'active';
    ws.slotIndex = activeSlots.length; // 1 hoặc 2
    console.log(`[SyncServer] 🟢 Cấp quyền ACTIVE cho client mới tại phòng "${roomId}" (Slot #${ws.slotIndex})`);
  } else {
    ws.role = 'view_only';
    ws.slotIndex = null;
    console.log(`[SyncServer] 👁️ Cấp quyền VIEW-ONLY cho client mới tại phòng "${roomId}"`);
  }

  roomActiveSlots.set(roomId, activeSlots);
  return { role: ws.role, slotIndex: ws.slotIndex, activeCount: activeSlots.length };
}

/**
 * Cơ chế giải phóng slot (Release Slot):
 * Khi 1 trong 2 người chơi đầu tiên thoát trang (đóng tab, mất kết nối),
 * hệ thống tự động giải phóng slot và đôn người tiếp theo đang chờ ở chế độ view_only lên Active.
 */
function releaseSlotAndPromote(roomId, ws) {
  if (!roomActiveSlots.has(roomId)) return 0;

  let activeSlots = roomActiveSlots.get(roomId).filter((s) => s !== ws && s.readyState === 1);
  const clients = roomClients.get(roomId);

  // Nếu slot còn trống (< 2) và còn client khác đang kết nối trong phòng
  if (activeSlots.length < 2 && clients && clients.size > 0) {
    for (const candidate of clients) {
      if (activeSlots.length >= 2) break;
      if (!activeSlots.includes(candidate) && candidate.readyState === 1) {
        candidate.role = 'active';
        candidate.slotIndex = activeSlots.length + 1;
        activeSlots.push(candidate);

        console.log(`[SyncServer] 🚀 ĐÔN CLIENT LÊN ACTIVE tại phòng "${roomId}" (Slot #${candidate.slotIndex})`);

        // Gửi thông báo cập nhật quyền Active ngay lập tức qua realtime
        try {
          candidate.send(JSON.stringify({
            type: 'ROLE_ASSIGNMENT',
            payload: {
              role: 'active',
              slotIndex: candidate.slotIndex,
              totalUsers: clients.size,
              activeCount: activeSlots.length
            }
          }));
        } catch (e) {
          console.error('[SyncServer] Lỗi gửi ROLE_ASSIGNMENT đôn quyền:', e);
        }
      }
    }
  }

  roomActiveSlots.set(roomId, activeSlots);
  return activeSlots.length;
}

import { SAMPLE_DAILY_LEDGER } from '../src/constants/sampleLedger.js';

/**
 * Đọc trạng thái phòng từ Firebase/File (nếu có) hoặc khởi tạo mới
 */
async function getOrCreateRoomState(roomId) {
  if (roomStates.has(roomId)) {
    return roomStates.get(roomId);
  }

  let data = null;

  // 1. Cố gắng lấy từ Firebase trước
  if (db) {
    try {
      const doc = await db.collection('rooms').doc(roomId).get();
      if (doc.exists) {
        data = doc.data();
      }
    } catch (e) {
      console.error(`[SyncServer] Lỗi đọc Firebase phòng ${roomId}:`, e);
    }
  }

  // 2. Nếu không có Firebase, thử đọc file local
  if (!data) {
    const filePath = path.join(DATA_DIR, `${roomId}.json`);
    if (fs.existsSync(filePath)) {
      try {
        data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      } catch (e) {
        console.error(`[SyncServer] Lỗi đọc file phòng ${roomId}:`, e);
      }
    }
  }

  // 3. Nếu vẫn không có dữ liệu, tạo mới
  if (!data) {
    data = {
      roomId,
      players: JSON.parse(JSON.stringify(INITIAL_PLAYERS)),
      history: [],
      roundDeltas: {},
      dailyLedger: JSON.parse(JSON.stringify(SAMPLE_DAILY_LEDGER)),
      updatedAt: Date.now()
    };
  } else {
    // 4. Chuẩn hóa dữ liệu cũ
    if (!data.dailyLedger || data.dailyLedger.length === 0) {
      data.dailyLedger = JSON.parse(JSON.stringify(SAMPLE_DAILY_LEDGER));
    }
    if (!data.history || data.history.length === 0) {
      data.players = (data.players || []).map((p, idx) => {
        const oldDefault = String.fromCharCode(65 + idx);
        if (p.name === oldDefault) return { ...p, name: '' };
        return p;
      });
    }
  }

  roomStates.set(roomId, data);
  // Nếu là phòng mới tinh, lưu luôn để tạo file/doc
  if (!data.updatedAt || data.history?.length === 0) {
    saveRoomState(roomId, data);
  }
  
  return data;
}

/**
 * Lưu trạng thái phòng ra đĩa & Firebase (chạy ngầm không block)
 */
function saveRoomState(roomId, state) {
  // Ghi ra file local làm backup
  try {
    const filePath = path.join(DATA_DIR, `${roomId}.json`);
    fs.writeFileSync(filePath, JSON.stringify(state, null, 2), 'utf-8');
  } catch (e) {
    console.error(`[SyncServer] Lỗi ghi file phòng ${roomId}:`, e);
  }

  // Cập nhật Firebase
  if (db) {
    db.collection('rooms').doc(roomId).set(state).catch(err => {
      console.error(`[SyncServer] Lỗi ghi Firebase phòng ${roomId}:`, err);
    });
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

  wss.on('connection', async (ws, request) => {
    const urlObj = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    const roomId = urlObj.searchParams.get('room') || 'default';
    ws.roomId = roomId;

    // Đăng ký client vào phòng
    if (!roomClients.has(roomId)) {
      roomClients.set(roomId, new Set());
    }
    roomClients.get(roomId).add(ws);

    // Phân bổ slot theo cơ chế FIFO (2 người đầu tiên Active, từ người thứ 3 là View-only)
    const { role, slotIndex, activeCount } = assignSlotForConnection(roomId, ws);

    // Báo số người đang online và số slot Active trong phòng cho mọi người
    broadcastToRoom(roomId, {
      type: 'ROOM_USERS_COUNT',
      count: roomClients.get(roomId).size,
      activeCount
    });

    // Lấy state từ Firebase/Local (hàm async)
    const currentState = await getOrCreateRoomState(roomId);
    
    // Gửi ngay trạng thái hiện tại kèm quyền (role) và slot cho client mới kết nối
    if (ws.readyState === 1) {
      ws.send(JSON.stringify({
        type: 'INIT_STATE',
        payload: currentState,
        role: ws.role,
        slotIndex: ws.slotIndex,
        serverTime: Date.now()
      }));

      ws.send(JSON.stringify({
        type: 'ROLE_ASSIGNMENT',
        payload: {
          role: ws.role,
          slotIndex: ws.slotIndex,
          totalUsers: roomClients.get(roomId).size,
          activeCount
        }
      }));
    }

    // Lắng nghe các thay đổi từ client
    ws.on('message', (message) => {
      try {
        const data = JSON.parse(message.toString());
        const { type, payload } = data;
        
        // Kiểm tra quyền nghiêm ngặt: Client ở chế độ view_only không được phép thay đổi dữ liệu
        const mutatingTypes = [
          'UPDATE_PLAYER_NAME',
          'UPDATE_DELTAS',
          'CONFIRM_ROUND',
          'UNDO_ROUND',
          'RESET_GAME',
          'ADD_LEDGER_ENTRY',
          'SET_DAILY_LEDGER'
        ];

        if (mutatingTypes.includes(type)) {
          if (ws.role === 'view_only') {
            console.warn(`[SyncServer] ⚠️ Chặn thao tác ${type} từ client View-Only tại phòng "${roomId}"`);
            ws.send(JSON.stringify({
              type: 'ERROR_PERMISSION_DENIED',
              message: 'Bạn đang ở chế độ View-only (Chỉ xem), không có quyền thao tác.'
            }));
            return;
          }
        }

        // Vì state đã load khi connection, chỉ cần lấy từ RAM (cực nhanh và đồng bộ)
        const state = roomStates.get(roomId);
        if (!state) return;

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
            state.players = (state.players || []).map((p) => ({
              ...p,
              name: ''
            }));
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
        const activeCount = releaseSlotAndPromote(roomId, ws);

        if (clients.size === 0) {
          roomClients.delete(roomId);
          roomActiveSlots.delete(roomId);
        } else {
          broadcastToRoom(roomId, {
            type: 'ROOM_USERS_COUNT',
            count: clients.size,
            activeCount: activeCount || 0
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
