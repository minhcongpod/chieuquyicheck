import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { SAMPLE_DAILY_LEDGER } from '../constants/sampleLedger';

const INITIAL_PLAYERS = [
  { id: 'p1', name: '', color: '#f4e950' },
  { id: 'p2', name: '', color: '#66ff33' },
  { id: 'p3', name: '', color: '#16e4ff' },
  { id: 'p4', name: '', color: '#c073ff' },
  { id: 'p5', name: '', color: '#fd6161' }
];

// Hàm bắn 1 đợt pháo hoa ăn mừng khi chốt ván
export function fireConfetti() {
  try {
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 }
    });
  } catch (e) {
    console.error('Confetti error:', e);
  }
}

export function useRealtimeGame() {
  // Lấy roomId và cờ View-Only từ URL:
  // - Hỗ trợ đường dẫn riêng: /view/:roomId (vd: /view/1, /view/nhom1, hoặc /view)
  // - Hỗ trợ query param: ?view=1 hoặc ?mode=view
  // - Hỗ trợ đường dẫn phòng thông thường: /1, /nhom1 (hoặc mặc định 'default')
  const [{ roomId, isForcedViewOnly }] = useState(() => {
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');
      const params = new URLSearchParams(window.location.search);
      const viewParam = params.get('view') || params.get('mode');
      
      const isForcedView = (
        viewParam === 'true' ||
        viewParam === '1' ||
        viewParam === 'view' ||
        pathname.startsWith('view/') ||
        pathname === 'view'
      );

      let extractedRoom = 'default';
      if (pathname.startsWith('view/')) {
        const afterView = pathname.slice(5).replace(/^\/+|\/+$/g, '');
        if (afterView) extractedRoom = decodeURIComponent(afterView);
      } else if (pathname === 'view') {
        const r = params.get('room');
        if (r && r.trim() !== '') extractedRoom = r.trim();
      } else if (pathname && pathname !== '') {
        extractedRoom = decodeURIComponent(pathname);
      } else if (params.get('room') && params.get('room').trim() !== '') {
        extractedRoom = params.get('room').trim();
      }

      return { roomId: extractedRoom, isForcedViewOnly: Boolean(isForcedView) };
    }
    return { roomId: 'default', isForcedViewOnly: false };
  });

  const [players, setPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem(`cq_players_${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Xóa bỏ hoàn toàn các tên mặc định gán sẵn cũ (A, B, C, D, E)
        return parsed.map((p, idx) => {
          const legacyDefault = String.fromCharCode(65 + idx);
          if (p.name === legacyDefault) {
            return { ...p, name: '' };
          }
          return p;
        });
      }
      return INITIAL_PLAYERS;
    } catch (e) {
      return INITIAL_PLAYERS;
    }
  });

  const [history, setHistory] = useState(() => {
    try {
      const saved = localStorage.getItem(`cq_history_${roomId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [dailyLedger, setDailyLedger] = useState(() => {
    try {
      const saved = localStorage.getItem(`cq_dailyLedger_${roomId}`);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  });

  const [roundDeltas, setRoundDeltas] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(1);
  const [role, setRole] = useState(isForcedViewOnly ? 'view_only' : 'active');
  const [slotIndex, setSlotIndex] = useState(null); // 1, 2 hoặc null

  const isViewOnly = isForcedViewOnly || role === 'view_only';
  const roleRef = useRef(isViewOnly ? 'view_only' : role);
  roleRef.current = isViewOnly ? 'view_only' : role;

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

function getOrCreateDeviceId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = localStorage.getItem('cq_device_id');
    if (!id) {
      id = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      localStorage.setItem('cq_device_id', id);
    }
    return id;
  } catch (e) {
    return 'dev_fallback_' + Date.now();
  }
}

  // Gửi tin nhắn qua WebSocket an toàn
  const sendMessage = useCallback((type, payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // Kết nối WebSocket
  useEffect(() => {
    let isMounted = true;
    const deviceId = getOrCreateDeviceId();

    function connect() {
      if (typeof window === 'undefined') return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(roomId)}&deviceId=${encodeURIComponent(deviceId)}${isForcedViewOnly ? '&viewOnly=1' : ''}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        console.log(`[ChieuQuy Sync] Đã kết nối phòng "${roomId}" (Device: ${deviceId}, ViewOnly: ${isForcedViewOnly})`);
      };

      ws.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const data = JSON.parse(event.data);
          const { type, payload, actionType, count } = data;

          if (type === 'INIT_STATE') {
            if (payload.players) setPlayers(payload.players);
            if (payload.history) setHistory(payload.history);
            if (payload.roundDeltas) setRoundDeltas(payload.roundDeltas);
            if (payload.dailyLedger) setDailyLedger(payload.dailyLedger);
            if (!isForcedViewOnly) {
              if (data.role) setRole(data.role);
              if (data.slotIndex !== undefined) setSlotIndex(data.slotIndex);
            }
            // Lưu cache offline
            localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(payload.players || []));
            localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(payload.history || []));
            if (payload.dailyLedger) localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(payload.dailyLedger));
          } else if (type === 'ROLE_ASSIGNMENT') {
            if (!isForcedViewOnly) {
              if (payload?.role) setRole(payload.role);
              if (payload?.slotIndex !== undefined) setSlotIndex(payload.slotIndex);
            }
            console.log(`[ChieuQuy Sync] Phân quyền phòng: ${payload?.role} (Slot: ${payload?.slotIndex})`);
          } else if (type === 'STATE_UPDATE') {
            if (payload.players) setPlayers(payload.players);
            if (payload.history) setHistory(payload.history);
            if (payload.roundDeltas !== undefined) setRoundDeltas(payload.roundDeltas);
            if (payload.dailyLedger !== undefined) {
              setDailyLedger(payload.dailyLedger);
              localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(payload.dailyLedger));
            }

            // Bắn pháo hoa ăn mừng khi chốt ván mới hoặc chốt sổ
            if (actionType === 'CONFIRM_ROUND' || actionType === 'ADD_LEDGER_ENTRY') {
              fireConfetti();
            }

            // Lưu cache
            localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(payload.players || []));
            localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(payload.history || []));
          } else if (type === 'ROOM_USERS_COUNT') {
            if (count !== undefined) setUserCount(count);
          }
        } catch (err) {
          console.error('[ChieuQuy Sync] Lỗi nhận tin nhắn:', err);
        }
      };

      ws.onclose = () => {
        if (!isMounted) return;
        setIsConnected(false);
        // Tự động kết nối lại sau 2 giây
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isMounted) connect();
        }, 2000);
      };

      ws.onerror = (err) => {
        console.error('[ChieuQuy Sync] Lỗi kết nối WebSocket:', err);
        ws.close();
      };
    }

    connect();

    // Heartbeat ping mỗi 15s để giữ kết nối trên mobile
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 15000);

    // Giải phóng ngay socket khi người dùng đóng tab / điều hướng trang
    const handleBeforeUnload = () => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.close(1000, 'Tab closed');
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [roomId]);

  // Các hàm điều khiển đồng bộ (chặn nếu ở quyền View-Only)
  const updatePlayerName = useCallback((id, newName) => {
    if (roleRef.current === 'view_only') return;
    // Cập nhật lạc quan trên máy mình ngay lập tức
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    sendMessage('UPDATE_PLAYER_NAME', { id, name: newName });
  }, [sendMessage]);

  const updateRoundDeltas = useCallback((newDeltasOrUpdater) => {
    if (roleRef.current === 'view_only') return;
    setRoundDeltas(prev => {
      const next = typeof newDeltasOrUpdater === 'function' ? newDeltasOrUpdater(prev) : newDeltasOrUpdater;
      sendMessage('UPDATE_DELTAS', { roundDeltas: next });
      return next;
    });
  }, [sendMessage]);

  const confirmRound = useCallback((newRound) => {
    if (roleRef.current === 'view_only') return;
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      sendMessage('CONFIRM_ROUND', { newRound });
    } else {
      // Fallback offline nếu mất kết nối
      setHistory(prev => {
        const next = [...prev, newRound];
        localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(next));
        return next;
      });
      setRoundDeltas({});
      fireConfetti();
    }
  }, [roomId, sendMessage]);

  const undoRound = useCallback(() => {
    if (roleRef.current === 'view_only') return;
    sendMessage('UNDO_ROUND', {});
  }, [sendMessage]);

  const resetGame = useCallback(() => {
    if (roleRef.current === 'view_only') return;
    sendMessage('RESET_GAME', {});
    // Cập nhật ngay lập tức tại máy này: reset toàn bộ tên người chơi về chuỗi rỗng "" và điểm về 0
    setPlayers(prev => {
      const next = prev.map(p => ({ ...p, name: '' }));
      localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(next));
      return next;
    });
    setHistory(() => {
      localStorage.setItem(`cq_history_${roomId}`, JSON.stringify([]));
      return [];
    });
    setRoundDeltas({});
  }, [roomId, sendMessage]);

  const addLedgerEntry = useCallback((entry) => {
    if (roleRef.current === 'view_only') return;
    sendMessage('ADD_LEDGER_ENTRY', { entry });
    setDailyLedger(prev => {
      const next = [entry, ...prev];
      localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(next));
      return next;
    });
    fireConfetti();
  }, [roomId, sendMessage]);

  const setDailyLedgerData = useCallback((newLedger) => {
    if (roleRef.current === 'view_only') return;
    sendMessage('SET_DAILY_LEDGER', { dailyLedger: newLedger });
    setDailyLedger(newLedger);
    localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(newLedger));
    fireConfetti();
  }, [roomId, sendMessage]);

  const deleteLedgerEntry = useCallback((entryId) => {
    if (roleRef.current === 'view_only') return;
    setDailyLedger(prev => {
      const next = prev.filter(e => e.id !== entryId);
      sendMessage('SET_DAILY_LEDGER', { dailyLedger: next });
      localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(next));
      return next;
    });
  }, [roomId, sendMessage]);

  const viewOnlyUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/view/${roomId === 'default' ? '' : roomId}`.replace(/\/+$/, '') || `${window.location.origin}/view`
    : `/view/${roomId}`;

  const roomUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/${roomId === 'default' ? '' : roomId}`.replace(/\/+$/, '') || `${window.location.origin}/`
    : `/${roomId}`;

  return {
    roomId,
    players,
    history,
    roundDeltas,
    dailyLedger,
    isConnected,
    userCount,
    role,
    isViewOnly,
    isForcedViewOnly,
    slotIndex,
    viewOnlyUrl,
    roomUrl,
    updatePlayerName,
    updateRoundDeltas,
    confirmRound,
    undoRound,
    resetGame,
    addLedgerEntry,
    setDailyLedgerData,
    deleteLedgerEntry
  };
}

