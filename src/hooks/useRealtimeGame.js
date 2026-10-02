import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { SAMPLE_DAILY_LEDGER } from '../constants/sampleLedger';
import { db, isFirebaseConfigured } from '../firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc
} from 'firebase/firestore';

const INITIAL_PLAYERS = [
  { id: 'p1', name: '', color: '#f4e950' }, // Vàng
  { id: 'p2', name: '', color: '#66ff33' }, // Xanh lá
  { id: 'p3', name: '', color: '#16e4ff' }, // Cyan
  { id: 'p4', name: '', color: '#c073ff' }, // Tím
  { id: 'p5', name: '', color: '#fd6161' }  // Đỏ
];

const HEARTBEAT_INTERVAL_MS = 5000;
const PRESENCE_TIMEOUT_MS = 15000;

// Bắn pháo hoa ăn mừng khi chốt ván hoặc chốt sổ
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

// Device ID cố định cho thiết bị
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
    return 'dev_' + Math.random().toString(36).substring(2, 9);
  }
}

export function useRealtimeGame() {
  // Trích xuất roomId từ URL (mặc định 'default')
  const [roomId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#\/?/, '');
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');

      let extractedRoom = 'default';

      if (params.get('room') && params.get('room').trim() !== '') {
        extractedRoom = params.get('room').trim();
      } else if (hash) {
        const parts = hash.split('/');
        if (parts[0] && parts[0].trim() !== '') extractedRoom = decodeURIComponent(parts[0].trim());
      } else if (pathname && pathname !== '' && !pathname.endsWith('index.html')) {
        const parts = pathname.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart !== 'chieuquyicheck') {
          extractedRoom = decodeURIComponent(lastPart);
        }
      }

      return extractedRoom;
    }
    return 'default';
  });

  const [players, setPlayers] = useState(() => {
    try {
      const saved = localStorage.getItem(`cq_players_${roomId}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.map((p, idx) => {
          const legacyDefault = String.fromCharCode(65 + idx);
          if (p.name === legacyDefault) return { ...p, name: '' };
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

  // MỌI NGƯỜI ĐỀU CÓ TOÀN QUYỀN CHỈNH SỬA (BỎ HẲN VIEW-ONLY)
  const role = 'active';
  const isViewOnly = false;
  const isForcedViewOnly = false;
  const slotIndex = 1;
  const activeSlots = ['all_players'];

  const prevHistoryLenRef = useRef(history.length);
  const prevLedgerLenRef = useRef(dailyLedger.length);

  // Lắng nghe dữ liệu thời gian thực từ Firebase Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setIsConnected(false);
      return;
    }

    const deviceId = getOrCreateDeviceId();
    const roomRef = doc(db, 'rooms', roomId);
    const presenceRef = doc(db, 'rooms', roomId, 'presence', deviceId);
    const presenceCol = collection(db, 'rooms', roomId, 'presence');
    let isInitialMount = true;

    // 1. Khởi tạo / Lắng nghe document phòng
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      setIsConnected(true);

      if (!snapshot.exists()) {
        // Phòng chưa tồn tại trên Firestore -> Tạo mới
        setDoc(roomRef, {
          roomId,
          players: INITIAL_PLAYERS,
          history: [],
          roundDeltas: {},
          dailyLedger: SAMPLE_DAILY_LEDGER,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }, { merge: true }).catch(err => console.error('[Firebase] Lỗi tạo phòng mới:', err));
        return;
      }

      const data = snapshot.data();
      if (!data) return;

      // Cập nhật dữ liệu game realtime
      if (data.players) {
        setPlayers(data.players);
        localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(data.players));
      }

      if (data.history) {
        if (!isInitialMount && data.history.length > prevHistoryLenRef.current) {
          fireConfetti();
        }
        prevHistoryLenRef.current = data.history.length;
        setHistory(data.history);
        localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(data.history));
      }

      if (data.roundDeltas !== undefined) {
        setRoundDeltas(data.roundDeltas || {});
      }

      if (data.dailyLedger !== undefined) {
        if (!isInitialMount && data.dailyLedger.length > prevLedgerLenRef.current) {
          fireConfetti();
        }
        prevLedgerLenRef.current = data.dailyLedger.length;
        setDailyLedger(data.dailyLedger);
        localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(data.dailyLedger));
      }

      isInitialMount = false;
    }, (error) => {
      console.error('[Firebase] Lỗi kết nối Firestore phòng:', error);
      setIsConnected(false);
    });

    // 2. Presence Heartbeat: Gửi nhịp tim định kỳ để đếm số người online
    const sendHeartbeat = () => {
      setDoc(presenceRef, {
        deviceId,
        lastSeen: Date.now()
      }, { merge: true }).catch(e => console.warn('[Presence] Heartbeat error:', e));
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // 3. Lắng nghe danh sách Online Presence để hiển thị số người online
    const unsubscribePresence = onSnapshot(presenceCol, (snapshot) => {
      const now = Date.now();
      let count = 0;
      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d && now - (d.lastSeen || 0) < PRESENCE_TIMEOUT_MS) {
          count++;
        }
      });
      setUserCount(Math.max(1, count));
    }, (err) => {
      console.warn('[Presence] Lỗi presence:', err);
    });

    // 4. Gửi heartbeat ngay khi quay lại tab
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);

    // 5. Dọn dẹp presence khi đóng tab
    const handleExit = () => {
      try {
        deleteDoc(presenceRef).catch(() => {});
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      handleExit();
      unsubscribeRoom();
      unsubscribePresence();
    };
  }, [roomId]);

  // Các thao tác ghi dữ liệu (Ai cũng có toàn quyền thực hiện)
  const updatePlayerName = useCallback(async (id, newName) => {
    const nextPlayers = players.map(p => p.id === id ? { ...p, name: newName } : p);
    setPlayers(nextPlayers);
    localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(nextPlayers));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          players: nextPlayers,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi updatePlayerName:', e);
      }
    }
  }, [roomId, players]);

  const updateRoundDeltas = useCallback(async (newDeltasOrUpdater) => {
    setRoundDeltas(prev => {
      const next = typeof newDeltasOrUpdater === 'function' ? newDeltasOrUpdater(prev) : newDeltasOrUpdater;
      if (isFirebaseConfigured && db) {
        updateDoc(doc(db, 'rooms', roomId), {
          roundDeltas: next,
          updatedAt: Date.now()
        }).catch(e => console.error('[Firebase] Lỗi updateRoundDeltas:', e));
      }
      return next;
    });
  }, [roomId]);

  const confirmRound = useCallback(async (newRound) => {
    const nextHistory = [...history, newRound];
    setHistory(nextHistory);
    setRoundDeltas({});
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(nextHistory));
    fireConfetti();

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          history: nextHistory,
          roundDeltas: {},
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi confirmRound:', e);
      }
    }
  }, [roomId, history]);

  const undoRound = useCallback(async () => {
    if (history.length === 0) return;
    const nextHistory = history.slice(0, -1);
    setHistory(nextHistory);
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(nextHistory));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          history: nextHistory,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi undoRound:', e);
      }
    }
  }, [roomId, history]);

  const resetGame = useCallback(async () => {
    const resetPlayers = players.map(p => ({ ...p, name: '' }));
    setPlayers(resetPlayers);
    setHistory([]);
    setRoundDeltas({});
    localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(resetPlayers));
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify([]));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          players: resetPlayers,
          history: [],
          roundDeltas: {},
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi resetGame:', e);
      }
    }
  }, [roomId, players]);

  const addLedgerEntry = useCallback(async (entry) => {
    const nextLedger = [entry, ...(dailyLedger || [])];
    setDailyLedger(nextLedger);
    localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(nextLedger));
    fireConfetti();

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          dailyLedger: nextLedger,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi addLedgerEntry:', e);
      }
    }
  }, [roomId, dailyLedger]);

  const setDailyLedgerData = useCallback(async (newLedger) => {
    setDailyLedger(newLedger);
    localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(newLedger));
    fireConfetti();

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          dailyLedger: newLedger,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi setDailyLedgerData:', e);
      }
    }
  }, [roomId]);

  const deleteLedgerEntry = useCallback(async (entryId) => {
    const nextLedger = (dailyLedger || []).filter(e => e.id !== entryId);
    setDailyLedger(nextLedger);
    localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify(nextLedger));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          dailyLedger: nextLedger,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi deleteLedgerEntry:', e);
      }
    }
  }, [roomId, dailyLedger]);

  // Tạo liên kết chia sẻ phòng
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.split('?')[0].replace(/\/+$/, '')}`
    : '';

  const roomUrl = typeof window !== 'undefined'
    ? (roomId === 'default' ? `${baseUrl}/` : `${baseUrl}?room=${encodeURIComponent(roomId)}`)
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
    activeSlots,
    viewOnlyUrl: roomUrl,
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
