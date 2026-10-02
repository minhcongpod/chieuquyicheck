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
  deleteDoc,
  arrayUnion,
  arrayRemove,
  runTransaction
} from 'firebase/firestore';

const INITIAL_PLAYERS = [
  { id: 'p1', name: '', color: '#f4e950' }, // Vàng
  { id: 'p2', name: '', color: '#66ff33' }, // Xanh lá
  { id: 'p3', name: '', color: '#16e4ff' }, // Cyan
  { id: 'p4', name: '', color: '#c073ff' }, // Tím
  { id: 'p5', name: '', color: '#fd6161' }  // Đỏ
];

// Cấu hình nhịp tim và thời gian phát hiện mất kết nối
const HEARTBEAT_INTERVAL_MS = 2500; // Gửi nhịp tim mỗi 2.5s để duy trì kết nối
const PRESENCE_TIMEOUT_MS = 6000;   // 6s timeout để kịp thời nhường quyền khi mất kết nối / đóng tab
const RECONCILE_INTERVAL_MS = 2000; // 2s định kỳ rà soát và điều phối slot trống
const MAX_EDITORS = 2;              // Giới hạn tối đa đúng 2 người chỉnh sửa

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

// Client ID & thời điểm vào phòng duy nhất cho mỗi tab/thiết bị để quản lý thứ tự FIFO chuẩn xác
function getOrCreateClientSession(roomId) {
  if (typeof window === 'undefined') return { clientId: 'server', joinedAt: Date.now() };
  try {
    // Đảm bảo mỗi tab có window.name riêng biệt, tránh dùng chung session khi Duplicate Tab
    if (!window.name || !window.name.startsWith('cq_tab_')) {
      window.name = 'cq_tab_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
    }
    const tabKey = window.name;
    let id = sessionStorage.getItem(`cq_id_${tabKey}`);
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem(`cq_id_${tabKey}`, id);
    }
    let joinedAtStr = sessionStorage.getItem(`cq_joined_${roomId}_${tabKey}`);
    let joinedAt = joinedAtStr ? parseInt(joinedAtStr, 10) : 0;
    if (!joinedAt || isNaN(joinedAt)) {
      joinedAt = Date.now();
      sessionStorage.setItem(`cq_joined_${roomId}_${tabKey}`, String(joinedAt));
    }
    return { clientId: id, joinedAt };
  } catch (e) {
    return {
      clientId: 'client_' + Math.random().toString(36).substring(2, 9),
      joinedAt: Date.now()
    };
  }
}

export function useRealtimeGame() {
  // Trích xuất roomId và chế độ View-Only
  const [{ roomId, isForcedViewOnly }] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const hash = window.location.hash.replace(/^#\/?/, '');
      const pathname = window.location.pathname.replace(/^\/+|\/+$/g, '');

      const viewParam = params.get('view') || params.get('mode');
      const isForcedView = (
        viewParam === 'true' ||
        viewParam === '1' ||
        viewParam === 'view' ||
        hash.startsWith('view') ||
        pathname.includes('view')
      );

      let extractedRoom = 'default';

      if (params.get('room') && params.get('room').trim() !== '') {
        extractedRoom = params.get('room').trim();
      } else if (hash) {
        const parts = hash.replace(/^view\/?/, '').split('/');
        if (parts[0] && parts[0].trim() !== '') extractedRoom = decodeURIComponent(parts[0].trim());
      } else if (pathname && pathname !== '' && !pathname.endsWith('index.html')) {
        const parts = pathname.split('/');
        const lastPart = parts[parts.length - 1];
        if (lastPart && lastPart !== 'view' && lastPart !== 'chieuquyicheck') {
          extractedRoom = decodeURIComponent(lastPart);
        }
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
  
  // 🔒 MẶC ĐỊNH LÀ VIEW_ONLY để bảo vệ an toàn tuyệt đối.
  // Chỉ khi Firebase kiểm tra xác nhận máy nằm trong 2 slot đầu tiên thì mới mở quyền Active!
  const [role, setRole] = useState('view_only');
  const [slotIndex, setSlotIndex] = useState(null); // 1, 2 hoặc null
  const [activeSlots, setActiveSlots] = useState([]);

  const isViewOnly = isForcedViewOnly || role === 'view_only';
  const roleRef = useRef(isViewOnly ? 'view_only' : role);
  roleRef.current = isViewOnly ? 'view_only' : role;

  const prevHistoryLenRef = useRef(history.length);
  const prevLedgerLenRef = useRef(dailyLedger.length);

  // Lắng nghe dữ liệu thời gian thực từ Firebase Firestore & Điều phối phân quyền
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setIsConnected(false);
      // Chạy offline đơn máy: mở quyền active cho máy đó
      if (!isForcedViewOnly) {
        setRole('active');
        setSlotIndex(1);
        setActiveSlots(['local_player']);
      }
      return;
    }

    const { clientId, joinedAt } = getOrCreateClientSession(roomId);
    const roomRef = doc(db, 'rooms', roomId);
    const presenceRef = doc(db, 'rooms', roomId, 'presence', clientId);
    const presenceCol = collection(db, 'rooms', roomId, 'presence');
    let isInitialMount = true;

    let presenceCache = [];
    let latestRoomData = null;
    let isReconciling = false;

    // Hàm điều phối và nhường quyền tự động khi có slot trống hoặc editor mất kết nối
    const reconcileEditors = async (onlineList = presenceCache, roomData = latestRoomData) => {
      if (!isFirebaseConfigured || !db || isForcedViewOnly) return;
      if (isReconciling) return;
      if (!roomData) return;

      const now = Date.now();
      // 1. Lọc danh sách người chơi online (heartbeat < PRESENCE_TIMEOUT_MS) và không phải view-only bắt buộc
      const eligibleOnline = (onlineList || []).filter(item => {
        return (now - (item.lastSeen || 0) < PRESENCE_TIMEOUT_MS) && !item.isExplicitViewOnly;
      });

      // 2. Sắp xếp danh sách theo thứ tự vào phòng trước (FIFO): joinedAt nhỏ hơn đứng trước
      eligibleOnline.sort((a, b) => {
        if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
        return (a.clientId || '').localeCompare(b.clientId || '');
      });

      const onlineClientIds = new Set(eligibleOnline.map(u => u.clientId));
      const currentSlots = Array.isArray(roomData?.activeSlots) ? roomData.activeSlots : [];

      // 3. Giữ lại những editor trong activeSlots vẫn đang online (tối đa 2 người)
      const nextSlots = currentSlots.filter(id => onlineClientIds.has(id)).slice(0, MAX_EDITORS);

      // 4. Nếu thiếu slot (dưới 2 người) -> Tự động nhấc người chơi online sớm nhất (FIFO) chưa có slot lên
      for (const candidate of eligibleOnline) {
        if (nextSlots.length >= MAX_EDITORS) break;
        if (!nextSlots.includes(candidate.clientId)) {
          nextSlots.push(candidate.clientId);
        }
      }

      // 5. Kiểm tra xem slots có thay đổi không
      const slotsChanged = (
        nextSlots.length !== currentSlots.length ||
        nextSlots.some((id, idx) => id !== currentSlots[idx])
      );

      if (!slotsChanged) return;

      // 6. Điều kiện thực thi: Chỉ máy có liên quan (nằm trong currentSlots hoặc nextSlots) mới gửi transaction để tránh xung đột
      const isConcerned = nextSlots.includes(clientId) || currentSlots.includes(clientId);
      if (!isConcerned) return;

      isReconciling = true;
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) return;
          const freshData = snap.data();
          const freshSlots = Array.isArray(freshData.activeSlots) ? freshData.activeSlots : [];

          // Tính toán lại với freshSlots từ Firestore
          const validFreshSlots = freshSlots.filter(id => onlineClientIds.has(id)).slice(0, MAX_EDITORS);
          for (const candidate of eligibleOnline) {
            if (validFreshSlots.length >= MAX_EDITORS) break;
            if (!validFreshSlots.includes(candidate.clientId)) {
              validFreshSlots.push(candidate.clientId);
            }
          }

          const reallyChanged = (
            validFreshSlots.length !== freshSlots.length ||
            validFreshSlots.some((id, idx) => id !== freshSlots[idx])
          );

          if (reallyChanged) {
            tx.update(roomRef, {
              activeSlots: validFreshSlots,
              updatedAt: Date.now()
            });
          }
        });
      } catch (e) {
        console.warn('[Slots] Reconciliation transaction warning:', e);
      } finally {
        isReconciling = false;
      }
    };

    // 1. Khởi tạo / Lắng nghe document phòng & Active Slots
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      setIsConnected(true);

      if (!snapshot.exists()) {
        // Phòng chưa tồn tại trên Firestore -> Tạo mới với máy đầu tiên
        const initialActive = isForcedViewOnly ? [] : [clientId];
        setDoc(roomRef, {
          roomId,
          players: INITIAL_PLAYERS,
          history: [],
          roundDeltas: {},
          dailyLedger: SAMPLE_DAILY_LEDGER,
          activeSlots: initialActive,
          createdAt: Date.now(),
          updatedAt: Date.now()
        }, { merge: true }).catch(err => console.error('[Firebase] Lỗi tạo phòng mới:', err));

        if (!isForcedViewOnly) {
          setRole('active');
          setSlotIndex(1);
          setActiveSlots(initialActive);
        }
        return;
      }

      const data = snapshot.data();
      if (!data) return;
      latestRoomData = data;

      // Cập nhật dữ liệu game
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

      // 🎯 QUẢN LÝ PHÂN QUYỀN CHẶT CHẼ:
      const slots = Array.isArray(data.activeSlots) ? data.activeSlots : [];
      setActiveSlots(slots);

      if (isForcedViewOnly) {
        setRole('view_only');
        setSlotIndex(null);
      } else {
        const myIndex = slots.indexOf(clientId);
        if (myIndex !== -1 && myIndex < MAX_EDITORS) {
          // Client nằm trong tối đa 2 slot active
          setRole('active');
          setSlotIndex(myIndex + 1);
        } else {
          // Người thứ 3 trở đi hoặc chưa có slot -> KHÓA CHẾ ĐỘ VIEW-ONLY!
          setRole('view_only');
          setSlotIndex(null);
        }
      }

      // Kiểm tra xem phòng có slot trống để nhấc người tiếp theo không
      reconcileEditors(presenceCache, data);

      isInitialMount = false;
    }, (error) => {
      console.error('[Firebase] Lỗi kết nối Firestore phòng:', error);
      setIsConnected(false);
    });

    // 2. Presence Heartbeat: Gửi nhịp tim mỗi 3 giây để duy trì trạng thái online
    const sendHeartbeat = () => {
      setDoc(presenceRef, {
        clientId,
        joinedAt,
        lastSeen: Date.now(),
        isExplicitViewOnly: Boolean(isForcedViewOnly)
      }, { merge: true }).catch(e => console.warn('[Presence] Heartbeat error:', e));
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);

    // 3. Lắng nghe danh sách Online Presence & Tự động dọn dẹp máy offline
    const unsubscribePresence = onSnapshot(presenceCol, (snapshot) => {
      const list = [];
      const now = Date.now();

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d) list.push(d);
      });
      presenceCache = list;

      const onlineCount = list.filter(d => now - (d.lastSeen || 0) < PRESENCE_TIMEOUT_MS).length;
      setUserCount(Math.max(1, onlineCount));

      // Dọn dẹp các presence documents quá cũ (> 30s) để giữ Firestore sạch sẽ
      const firstActiveOnline = (latestRoomData?.activeSlots || []).find(id => list.some(d => d.clientId === id && now - (d.lastSeen || 0) < PRESENCE_TIMEOUT_MS));
      if (firstActiveOnline === clientId || (!firstActiveOnline && list[0]?.clientId === clientId)) {
        list.forEach(d => {
          if (now - (d.lastSeen || 0) > 30000 && d.clientId !== clientId) {
            deleteDoc(doc(db, 'rooms', roomId, 'presence', d.clientId)).catch(() => {});
          }
        });
      }

      reconcileEditors(list, latestRoomData);
    }, (err) => {
      console.warn('[Presence] Lỗi presence:', err);
    });

    // 4. Timer định kỳ kiểm tra heartbeat timeout phòng trường hợp snapshot không kích hoạt
    const reconcileInterval = setInterval(() => {
      reconcileEditors(presenceCache, latestRoomData);
    }, RECONCILE_INTERVAL_MS);

    // 5. Gửi heartbeat ngay khi quay lại tab (un-minimize hoặc mở màn hình điện thoại)
    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
        reconcileEditors(presenceCache, latestRoomData);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);
    window.addEventListener('online', handleVisibilityOrFocus);

    // 6. Thoát nhanh: Giải phóng ngay slot và presence khi tắt tab / đóng trình duyệt
    const handleExit = () => {
      try {
        deleteDoc(presenceRef).catch(() => {});
        updateDoc(roomRef, {
          activeSlots: arrayRemove(clientId)
        }).catch(() => {});
      } catch (e) {}
    };
    window.addEventListener('beforeunload', handleExit);
    window.addEventListener('pagehide', handleExit);

    return () => {
      clearInterval(heartbeatInterval);
      clearInterval(reconcileInterval);
      window.removeEventListener('beforeunload', handleExit);
      window.removeEventListener('pagehide', handleExit);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      window.removeEventListener('online', handleVisibilityOrFocus);
      handleExit();
      unsubscribeRoom();
      unsubscribePresence();
    };
  }, [roomId, isForcedViewOnly]);

  // Các thao tác ghi dữ liệu (chặn 100% nếu ở chế độ View-Only)
  const updatePlayerName = useCallback(async (id, newName) => {
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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
    if (roleRef.current === 'view_only') return;
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

  // Tạo liên kết chia sẻ
  const baseUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.split('?')[0].replace(/\/+$/, '')}`
    : '';

  const viewOnlyUrl = typeof window !== 'undefined'
    ? `${baseUrl}?${roomId === 'default' ? '' : `room=${encodeURIComponent(roomId)}&`}view=1`
    : `/view/${roomId}`;

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
