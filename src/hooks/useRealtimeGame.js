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

// Bắn pháo hoa ăn mừng khi chốt ván thông thường hoặc chốt sổ
export function fireConfetti() {
  try {
    confetti({
      particleCount: 70,
      spread: 70,
      origin: { y: 0.6 },
      zIndex: 10000005
    });
  } catch (e) {
    console.error('Confetti error:', e);
  }
}

/**
 * Kiểm tra xem ván đấu vừa chốt có liên quan đến điểm Sâm hoặc đền Sâm hay không:
 * Các mức điểm Sâm quy ước theo số lượng người chơi:
 * - Bàn 3 người: ±40 điểm (thắng sâm +40, đền sâm -40)
 * - Bàn 4 người: ±60 điểm (thắng sâm +60, đền sâm -60)
 * - Bàn 5 người: ±80 điểm (thắng sâm +80, đền sâm -80)
 */
export function isSamRound(round) {
  if (!round || !round.scores) return false;
  const SAM_POINTS = [40, 60, 80];
  const scores = Object.values(round.scores);
  return scores.some(score => {
    const num = typeof score === 'number' ? score : Number(score);
    return !isNaN(num) && SAM_POINTS.includes(Math.abs(num));
  });
}

/**
 * Xác định thông tin người hô Sâm thành công trong ván đấu
 */
export function getSamWinnerInfo(round, players = []) {
  if (!round || !round.scores) return null;
  const SAM_POINTS = [40, 60, 80];
  // 1. Tìm người có điểm dương (+40, +60, +80) - Người hô Sâm thành công
  for (const [playerId, score] of Object.entries(round.scores)) {
    const num = typeof score === 'number' ? score : Number(score);
    if (SAM_POINTS.includes(num)) {
      const p = players.find(item => item.id === playerId);
      return {
        playerId,
        name: p?.name || '',
        points: num
      };
    }
  }
  // 2. Trường hợp đền Sâm: Người có điểm dương cao nhất
  for (const [playerId, score] of Object.entries(round.scores)) {
    const num = typeof score === 'number' ? score : Number(score);
    if (num > 0) {
      const p = players.find(item => item.id === playerId);
      return {
        playerId,
        name: p?.name || '',
        points: num
      };
    }
  }
  return null;
}

/**
 * Hiệu ứng pháo hoa (Fireworks Animation) khi chốt thành công ván Sâm:
 * Bắn đồng thời từ 2 bên sườn màn hình hướng vào trung tâm, hiển thị bên trên logo Sâm.
 */
export function fireSamFireworks() {
  try {
    // Bộ màu lễ hội rực rỡ, lấp lánh và có độ tương phản cao
    const samColors = [
      '#ffd700', // Vàng hoàng kim
      '#ff0055', // Đỏ hồng neon
      '#00f0ff', // Cyan rực sáng
      '#a855f7', // Tím neon
      '#39ff14', // Xanh lá laser
      '#ff7700', // Cam lửa
      '#ffffff', // Ánh bạc lấp lánh
      '#ffea00'  // Vàng chanh
    ];

    // 1. Bên trái: pháo hoa bắn vút lên chéo sang phải (hiển thị đè lên trên logo Sâm)
    confetti({
      particleCount: 110,
      angle: 55,
      spread: 75,
      startVelocity: 58,
      origin: { x: 0, y: 0.7 },
      colors: samColors,
      gravity: 0.85,
      ticks: 240,
      zIndex: 10000005,
      disableForReducedMotion: true
    });

    // 2. Bên phải: pháo hoa bắn vút lên chéo sang trái (hiển thị đè lên trên logo Sâm)
    confetti({
      particleCount: 110,
      angle: 125,
      spread: 75,
      startVelocity: 58,
      origin: { x: 1, y: 0.7 },
      colors: samColors,
      gravity: 0.85,
      ticks: 240,
      zIndex: 10000005,
      disableForReducedMotion: true
    });
  } catch (e) {
    console.error('Confetti error in fireSamFireworks:', e);
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

  // Trạng thái hiệu ứng hiển thị Sâm toàn màn hình
  const [samCelebration, setSamCelebration] = useState({
    isOpen: false,
    winnerName: '',
    points: 0
  });

  const triggerSamCelebration = useCallback((winnerName = '', points = 0) => {
    setSamCelebration({
      isOpen: true,
      winnerName,
      points
    });
  }, []);

  const closeSamCelebration = useCallback(() => {
    setSamCelebration(prev => ({ ...prev, isOpen: false }));
  }, []);

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
          const newestRound = data.history[data.history.length - 1];
          if (isSamRound(newestRound)) {
            const currentPlayers = data.players || players;
            const winner = getSamWinnerInfo(newestRound, currentPlayers);
            triggerSamCelebration(winner?.name || '', winner?.points || 0);
          } else {
            fireConfetti();
          }
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
    prevHistoryLenRef.current = nextHistory.length;
    setHistory(nextHistory);
    setRoundDeltas({});
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(nextHistory));
    if (isSamRound(newRound)) {
      const winner = getSamWinnerInfo(newRound, players);
      triggerSamCelebration(winner?.name || '', winner?.points || 0);
    } else {
      fireConfetti();
    }

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
    const lastRound = history[history.length - 1];
    let restoredDeltas = (lastRound && lastRound.rawDeltas)
      ? { ...lastRound.rawDeltas }
      : { ...((lastRound && lastRound.scores) || {}) };

    // Đối với các ván cũ chưa lưu rawDeltas: Nếu có (N-1) người âm và 1 người dương với tổng = 0,
    // loại bỏ người dương để cơ chế tự động cân bằng (auto-balance) hoạt động trơn tru khi người dùng sửa điểm.
    if (!lastRound?.rawDeltas && lastRound?.scores) {
      const scoreEntries = Object.entries(restoredDeltas);
      const positiveEntries = scoreEntries.filter(([_, score]) => typeof score === 'number' && score > 0);
      const negativeEntries = scoreEntries.filter(([_, score]) => typeof score === 'number' && score < 0);
      const sum = scoreEntries.reduce((s, [_, v]) => s + (typeof v === 'number' ? v : 0), 0);
      if (sum === 0 && positiveEntries.length === 1 && negativeEntries.length > 0) {
        const [posId] = positiveEntries[0];
        delete restoredDeltas[posId];
      }
    }

    const nextHistory = history.slice(0, -1);
    setHistory(nextHistory);
    setRoundDeltas(restoredDeltas);
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify(nextHistory));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          history: nextHistory,
          roundDeltas: restoredDeltas,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi undoRound:', e);
      }
    }
  }, [roomId, history]);

  const resetGame = useCallback(async () => {
    // Giữ nguyên tên người chơi, chỉ reset lịch sử điểm và điểm ván hiện tại về 0
    setHistory([]);
    setRoundDeltas({});
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify([]));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          history: [],
          roundDeltas: {},
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi resetGame:', e);
      }
    }
  }, [roomId]);

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
    deleteLedgerEntry,
    samCelebration,
    triggerSamCelebration,
    closeSamCelebration
  };
}
