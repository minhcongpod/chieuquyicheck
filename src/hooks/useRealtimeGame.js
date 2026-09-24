import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { SAMPLE_DAILY_LEDGER } from '../constants/sampleLedger';

const INITIAL_PLAYERS = [
  { id: 'p1', name: 'A', color: '#f4e950' },
  { id: 'p2', name: 'B', color: '#66ff33' },
  { id: 'p3', name: 'C', color: '#16e4ff' },
  { id: 'p4', name: 'D', color: '#c073ff' },
  { id: 'p5', name: 'E', color: '#fd6161' }
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
  // Lấy roomId từ URL path (ví dụ: /1, /2, /nhom1) hoặc query param (?room=1, mặc định 'default')
  const [roomId] = useState(() => {
    if (typeof window !== 'undefined') {
      // 1. Ưu tiên lấy từ URL pathname (loại bỏ dấu / ở đầu và cuối: /1 -> "1", /nhom1/ -> "nhom1")
      const cleanPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
      if (cleanPath && cleanPath !== '') {
        return decodeURIComponent(cleanPath);
      }
      // 2. Hỗ trợ query param dạng ?room=1
      const params = new URLSearchParams(window.location.search);
      const roomParam = params.get('room');
      if (roomParam && roomParam.trim() !== '') {
        return roomParam.trim();
      }
    }
    return 'default';
  });

  const [players, setPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem(`cq_players_${roomId}`);
      return saved ? JSON.parse(saved) : INITIAL_PLAYERS;
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
      return saved ? JSON.parse(saved) : SAMPLE_DAILY_LEDGER;
    } catch (e) {
      return SAMPLE_DAILY_LEDGER;
    }
  });

  const [roundDeltas, setRoundDeltas] = useState({});
  const [isConnected, setIsConnected] = useState(false);
  const [userCount, setUserCount] = useState(1);

  const socketRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  // Gửi tin nhắn qua WebSocket an toàn
  const sendMessage = useCallback((type, payload) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }));
    }
  }, []);

  // Kết nối WebSocket
  useEffect(() => {
    let isMounted = true;

    function connect() {
      if (typeof window === 'undefined') return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?room=${encodeURIComponent(roomId)}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        if (!isMounted) return;
        setIsConnected(true);
        console.log(`[ChieuQuy Sync] Đã kết nối phòng "${roomId}"`);
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
            // Lưu cache offline
            localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(payload.players || []));
            localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(payload.history || []));
            if (payload.dailyLedger) localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(payload.dailyLedger));
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

    // Heartbeat ping mỗi 25s để giữ kết nối trên mobile
    const pingInterval = setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({ type: 'PING' }));
      }
    }, 25000);

    return () => {
      isMounted = false;
      clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (socketRef.current) socketRef.current.close();
    };
  }, [roomId]);

  // Các hàm điều khiển đồng bộ
  const updatePlayerName = useCallback((id, newName) => {
    // Cập nhật lạc quan trên máy mình ngay lập tức
    setPlayers(prev => prev.map(p => p.id === id ? { ...p, name: newName } : p));
    sendMessage('UPDATE_PLAYER_NAME', { id, name: newName });
  }, [sendMessage]);

  const updateRoundDeltas = useCallback((newDeltasOrUpdater) => {
    setRoundDeltas(prev => {
      const next = typeof newDeltasOrUpdater === 'function' ? newDeltasOrUpdater(prev) : newDeltasOrUpdater;
      sendMessage('UPDATE_DELTAS', { roundDeltas: next });
      return next;
    });
  }, [sendMessage]);

  const confirmRound = useCallback((newRound) => {
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
    sendMessage('UNDO_ROUND', {});
  }, [sendMessage]);

  const resetGame = useCallback(() => {
    sendMessage('RESET_GAME', {});
    // Cập nhật ngay lập tức tại máy này: reset toàn bộ tên người chơi về mặc định A, B, C, D, E
    setPlayers(prev => {
      const next = prev.map((p, idx) => ({ ...p, name: String.fromCharCode(65 + idx) }));
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
    sendMessage('ADD_LEDGER_ENTRY', { entry });
    setDailyLedger(prev => {
      const next = [entry, ...prev];
      localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(next));
      return next;
    });
    fireConfetti();
  }, [roomId, sendMessage]);

  const setDailyLedgerData = useCallback((newLedger) => {
    sendMessage('SET_DAILY_LEDGER', { dailyLedger: newLedger });
    setDailyLedger(newLedger);
    localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(newLedger));
    fireConfetti();
  }, [roomId, sendMessage]);

  const deleteLedgerEntry = useCallback((entryId) => {
    setDailyLedger(prev => {
      const next = prev.filter(e => e.id !== entryId);
      sendMessage('SET_DAILY_LEDGER', { dailyLedger: next });
      localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(next));
      return next;
    });
  }, [roomId, sendMessage]);

  return {
    roomId,
    players,
    history,
    roundDeltas,
    dailyLedger,
    isConnected,
    userCount,
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
