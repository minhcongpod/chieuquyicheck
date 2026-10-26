import { useState, useEffect, useRef, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { SAMPLE_DAILY_LEDGER } from '../constants/sampleLedger';
import { db, isFirebaseConfigured } from '../firebase';
import {
  doc,
  collection,
  onSnapshot,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  runTransaction
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

// Các file tĩnh ở gốc trang, không được hiểu là tên phòng
const RESERVED_PATHS = new Set(['index.html', '404.html']);

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch (e) {
    return value;
  }
}

/**
 * Xác định phòng chơi từ URL:
 * - Link gốc (https://.../) -> null: phòng RIÊNG của từng máy, chỉ lưu localStorage, không đồng bộ
 * - Đường dẫn con (/vip, /ban-2) -> phòng CHUNG: mọi máy mở cùng link cùng xem & sửa realtime
 * - Hỗ trợ tiếp các dạng cũ: ?room=abc, #room=abc, #/room/abc
 */
export function resolveRoomId() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const roomParam = (params.get('room') || '').trim();
  if (roomParam) return roomParam;

  const hash = window.location.hash.replace(/^#\/?/, '');
  if (hash.startsWith('room=') || hash.startsWith('room/')) {
    const val = safeDecode(hash.slice(5)).replace(/\/+$/, '').trim();
    if (val) return val;
  }

  // GitHub Pages chạy dưới /chieuquyicheck/ nên bỏ qua tên repo đứng đầu
  const segments = window.location.pathname.split('/').filter(Boolean);
  if (window.location.hostname.endsWith('github.io')) segments.shift();
  const roomPath = segments
    .filter(s => !RESERVED_PATHS.has(s.toLowerCase()))
    .map(s => safeDecode(s).trim().toLowerCase())
    .filter(Boolean)
    .join('-'); // Firestore không cho phép dấu "/" trong ID
  return roomPath || null;
}

// Link gốc của ứng dụng (phòng riêng)
function getBaseUrl() {
  if (typeof window === 'undefined') return '';
  const { origin, hostname, pathname } = window.location;
  if (hostname.endsWith('github.io')) {
    const repo = pathname.split('/').filter(Boolean)[0];
    return repo ? `${origin}/${repo}/` : `${origin}/`;
  }
  return `${origin}/`;
}

// Tên người chơi lưu riêng ở playerNames.<id>, ghi đè lên danh sách players (id + màu)
function mergePlayerNames(data) {
  const names = data.playerNames || {};
  return (data.players || INITIAL_PLAYERS).map(p => (
    typeof names[p.id] === 'string' ? { ...p, name: names[p.id] } : p
  ));
}

function readCache(name, storageKey, fallbackKey) {
  try {
    const saved = localStorage.getItem(`cq_${name}_${storageKey}`)
      ?? (fallbackKey ? localStorage.getItem(`cq_${name}_${fallbackKey}`) : null);
    return saved ? JSON.parse(saved) : null;
  } catch (e) {
    return null;
  }
}

function writeCache(name, storageKey, value) {
  try {
    localStorage.setItem(`cq_${name}_${storageKey}`, JSON.stringify(value));
  } catch (e) {}
}

export function useRealtimeGame() {
  const [roomId] = useState(resolveRoomId);
  // Chỉ đồng bộ Firestore khi đang ở phòng chung (đường dẫn con)
  const isShared = Boolean(roomId) && isFirebaseConfigured && Boolean(db);
  // Phòng riêng dùng khoá 'local'; lần đầu lấy lại ván đang chơi dở ở bản cũ (khoá 'default')
  const storageKey = roomId || 'local';
  const fallbackKey = roomId ? null : 'default';

  const [players, setPlayers] = useState(() => {
    const saved = readCache('players', storageKey, fallbackKey);
    if (!saved) return INITIAL_PLAYERS;
    return saved.map((p, idx) => {
      const legacyDefault = String.fromCharCode(65 + idx);
      if (p.name === legacyDefault) return { ...p, name: '' };
      return p;
    });
  });

  const [history, setHistory] = useState(() => readCache('history', storageKey, fallbackKey) || []);
  const [dailyLedger, setDailyLedger] = useState(() => readCache('dailyLedger', storageKey, fallbackKey) || []);

  const [roundDeltas, setRoundDeltasState] = useState(() => (isShared ? {} : (readCache('roundDeltas', storageKey) || {})));
  const roundDeltasRef = useRef(roundDeltas);
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

  const setRoundDeltas = useCallback((next) => {
    roundDeltasRef.current = next;
    setRoundDeltasState(next);
    if (!isShared) writeCache('roundDeltas', storageKey, next);
  }, [isShared, storageKey]);

  /**
   * Ghi an toàn khi nhiều máy cùng sửa: đọc dữ liệu mới nhất trên server rồi mới ghi (transaction),
   * tránh việc máy này ghi đè mất thao tác của máy khác.
   * - mutate(serverData) trả về patch cần ghi, hoặc null nếu thao tác đã bị máy khác làm trước (xung đột)
   * - fallbackPatch: dùng khi mất mạng (transaction không chạy được offline), ghi thẳng vào hàng đợi
   * Trả về false nếu xung đột để nơi gọi đồng bộ lại.
   */
  const writeQueueRef = useRef(Promise.resolve());
  const writeShared = useCallback((mutate, fallbackPatch) => {
    if (!isShared) return Promise.resolve(true);
    // Xếp hàng các lần ghi của máy này để chúng không tự tranh chấp với nhau
    const run = () => runSharedTransaction(mutate, fallbackPatch);
    const result = writeQueueRef.current.then(run, run);
    writeQueueRef.current = result.catch(() => {});
    return result;
  }, [isShared, roomId]);

  const runSharedTransaction = async (mutate, fallbackPatch) => {
    const ref = doc(db, 'rooms', roomId);
    try {
      return await runTransaction(db, async (tx) => {
        const snap = await tx.get(ref);
        const patch = mutate(snap.exists() ? snap.data() : {});
        if (!patch) return false;
        const payload = { ...patch, updatedAt: Date.now() };
        if (snap.exists()) {
          tx.update(ref, payload);
        } else {
          tx.set(ref, { roomId, players: INITIAL_PLAYERS, history: [], roundDeltas: {}, dailyLedger: [], createdAt: Date.now(), ...payload });
        }
        return true;
      });
    } catch (e) {
      console.warn('[Firebase] Transaction lỗi, ghi trực tiếp:', e?.code, e);
      if (fallbackPatch) {
        updateDoc(ref, { ...fallbackPatch, updatedAt: Date.now() })
          .catch(err => console.error('[Firebase] Lỗi ghi dữ liệu:', err));
      }
      return true;
    }
  };

  // Lấy lại dữ liệu server khi thao tác bị xung đột (máy khác đã chốt / hoàn tác trước)
  const resyncFromServer = useCallback(async () => {
    if (!isShared) return;
    try {
      const snap = await getDoc(doc(db, 'rooms', roomId));
      const data = snap.data();
      if (!data) return;
      if (data.history) {
        prevHistoryLenRef.current = data.history.length;
        setHistory(data.history);
        writeCache('history', storageKey, data.history);
      }
      if (data.roundDeltas !== undefined) setRoundDeltas(data.roundDeltas || {});
      if (data.dailyLedger) {
        prevLedgerLenRef.current = data.dailyLedger.length;
        setDailyLedger(data.dailyLedger);
        writeCache('dailyLedger', storageKey, data.dailyLedger);
      }
    } catch (e) {
      console.error('[Firebase] Lỗi đồng bộ lại:', e);
    }
  }, [isShared, roomId, storageKey, setRoundDeltas]);

  // Lắng nghe dữ liệu thời gian thực từ Firebase Firestore (chỉ phòng chung)
  useEffect(() => {
    if (!isShared) {
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
      if (data.players || data.playerNames) {
        const nextPlayers = mergePlayerNames(data);
        setPlayers(nextPlayers);
        writeCache('players', roomId, nextPlayers);
      }

      if (data.history) {
        if (!isInitialMount && data.history.length > prevHistoryLenRef.current) {
          const newestRound = data.history[data.history.length - 1];
          if (isSamRound(newestRound)) {
            const winner = getSamWinnerInfo(newestRound, mergePlayerNames(data));
            triggerSamCelebration(winner?.name || '', winner?.points || 0);
          } else {
            fireConfetti();
          }
        }
        prevHistoryLenRef.current = data.history.length;
        setHistory(data.history);
        writeCache('history', roomId, data.history);
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
        writeCache('dailyLedger', roomId, data.dailyLedger);
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
  }, [isShared, roomId]);

  // Các thao tác ghi dữ liệu (Ai cũng có toàn quyền thực hiện)
  const updatePlayerName = useCallback(async (id, newName) => {
    const nextPlayers = players.map(p => p.id === id ? { ...p, name: newName } : p);
    setPlayers(nextPlayers);
    writeCache('players', storageKey, nextPlayers);

    // Chỉ ghi tên đúng người này (playerNames.<id>) để 2 máy đổi tên 2 người khác nhau không đè nhau
    if (isShared) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          [`playerNames.${id}`]: newName,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi updatePlayerName:', e);
      }
    }
  }, [players, isShared, roomId, storageKey]);

  // Điểm đang nhập: chỉ ghi các ô thay đổi để 2 máy nhập 2 người khác nhau không đè nhau
  const updateRoundDeltas = useCallback((newDeltasOrUpdater) => {
    const prev = roundDeltasRef.current;
    const next = typeof newDeltasOrUpdater === 'function' ? newDeltasOrUpdater(prev) : newDeltasOrUpdater;
    if (next === prev) return;
    setRoundDeltas(next);

    if (!isShared) return;
    const patch = {};
    new Set([...Object.keys(prev || {}), ...Object.keys(next || {})]).forEach(playerId => {
      if ((prev || {})[playerId] !== (next || {})[playerId]) {
        patch[`roundDeltas.${playerId}`] = next[playerId] === undefined ? deleteField() : next[playerId];
      }
    });
    if (Object.keys(patch).length === 0) return;
    updateDoc(doc(db, 'rooms', roomId), { ...patch, updatedAt: Date.now() })
      .catch(e => console.error('[Firebase] Lỗi updateRoundDeltas:', e));
  }, [isShared, roomId, setRoundDeltas]);

  const confirmRound = useCallback(async (newRound) => {
    const expectedLength = history.length;
    const nextHistory = [...history, newRound];
    prevHistoryLenRef.current = nextHistory.length;
    setHistory(nextHistory);
    setRoundDeltas({});
    writeCache('history', storageKey, nextHistory);
    if (isSamRound(newRound)) {
      const winner = getSamWinnerInfo(newRound, players);
      triggerSamCelebration(winner?.name || '', winner?.points || 0);
    } else {
      fireConfetti();
    }

    // Nếu máy khác vừa chốt ván trước (lịch sử server đã dài hơn) thì bỏ qua để không bị trùng ván
    const ok = await writeShared(data => {
      const serverHistory = data.history || [];
      if (serverHistory.length !== expectedLength) return null;
      return { history: [...serverHistory, newRound], roundDeltas: {} };
    }, { history: nextHistory, roundDeltas: {} });
    if (!ok) resyncFromServer();
  }, [history, players, storageKey, setRoundDeltas, triggerSamCelebration, writeShared, resyncFromServer]);

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
    prevHistoryLenRef.current = nextHistory.length;
    setHistory(nextHistory);
    setRoundDeltas(restoredDeltas);
    writeCache('history', storageKey, nextHistory);

    // Chỉ hoàn tác nếu ván cuối trên server đúng là ván máy này đang thấy
    const ok = await writeShared(data => {
      const serverHistory = data.history || [];
      if (serverHistory[serverHistory.length - 1]?.id !== lastRound?.id) return null;
      return { history: serverHistory.slice(0, -1), roundDeltas: restoredDeltas };
    }, { history: nextHistory, roundDeltas: restoredDeltas });
    if (!ok) resyncFromServer();
  }, [history, storageKey, setRoundDeltas, writeShared, resyncFromServer]);

  const resetGame = useCallback(async () => {
    // Giữ nguyên tên người chơi, chỉ reset lịch sử điểm và điểm ván hiện tại về 0
    prevHistoryLenRef.current = 0;
    setHistory([]);
    setRoundDeltas({});
    writeCache('history', storageKey, []);

    if (isShared) {
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
  }, [isShared, roomId, storageKey, setRoundDeltas]);

  const applyLocalLedger = useCallback((nextLedger) => {
    prevLedgerLenRef.current = nextLedger.length;
    setDailyLedger(nextLedger);
    writeCache('dailyLedger', storageKey, nextLedger);
  }, [storageKey]);

  const addLedgerEntry = useCallback(async (entry) => {
    const nextLedger = [entry, ...(dailyLedger || [])];
    applyLocalLedger(nextLedger);
    fireConfetti();

    await writeShared(data => {
      const serverLedger = data.dailyLedger || [];
      if (serverLedger.some(e => e.id === entry.id)) return null;
      return { dailyLedger: [entry, ...serverLedger] };
    }, { dailyLedger: nextLedger });
  }, [dailyLedger, applyLocalLedger, writeShared]);

  // Thêm 1 lần chốt sổ vào cuối sổ (giữ nguyên các lần chốt sổ máy khác vừa thêm)
  const appendLedgerEntry = useCallback(async (entry) => {
    const nextLedger = [...(dailyLedger || []), entry];
    applyLocalLedger(nextLedger);
    fireConfetti();

    await writeShared(data => {
      const serverLedger = data.dailyLedger || [];
      if (serverLedger.some(e => e.id === entry.id)) return null;
      return { dailyLedger: [...serverLedger, entry] };
    }, { dailyLedger: nextLedger });
  }, [dailyLedger, applyLocalLedger, writeShared]);

  const setDailyLedgerData = useCallback(async (newLedger) => {
    applyLocalLedger(newLedger);
    fireConfetti();

    if (isShared) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          dailyLedger: newLedger,
          updatedAt: Date.now()
        });
      } catch (e) {
        console.error('[Firebase] Lỗi setDailyLedgerData:', e);
      }
    }
  }, [isShared, roomId, applyLocalLedger]);

  const deleteLedgerEntry = useCallback(async (entryId) => {
    const nextLedger = (dailyLedger || []).filter(e => e.id !== entryId);
    applyLocalLedger(nextLedger);

    await writeShared(data => ({
      dailyLedger: (data.dailyLedger || []).filter(e => e.id !== entryId)
    }), { dailyLedger: nextLedger });
  }, [dailyLedger, applyLocalLedger, writeShared]);

  // Link chia sẻ: phòng chung -> chính link đang mở; phòng riêng -> link gốc
  const roomUrl = typeof window !== 'undefined'
    ? (roomId ? window.location.href : getBaseUrl())
    : '/';

  return {
    roomId,
    isSharedRoom: isShared,
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
    appendLedgerEntry,
    setDailyLedgerData,
    deleteLedgerEntry,
    samCelebration,
    triggerSamCelebration,
    closeSamCelebration
  };
}
