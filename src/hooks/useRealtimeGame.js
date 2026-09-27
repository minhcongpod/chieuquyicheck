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
  arrayRemove
} from 'firebase/firestore';

const INITIAL_PLAYERS = [
  { id: 'p1', name: '', color: '#f4e950' }, // Vàng
  { id: 'p2', name: '', color: '#66ff33' }, // Xanh lá
  { id: 'p3', name: '', color: '#16e4ff' }, // Cyan
  { id: 'p4', name: '', color: '#c073ff' }, // Tím
  { id: 'p5', name: '', color: '#fd6161' }  // Đỏ
];

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

// Client ID duy nhất cho mỗi tab/thiết bị để tránh xung đột khi mở nhiều tab trên cùng 1 máy
function getOrCreateClientId() {
  if (typeof window === 'undefined') return 'server';
  try {
    let id = sessionStorage.getItem('cq_client_id');
    if (!id) {
      id = 'client_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
      sessionStorage.setItem('cq_client_id', id);
    }
    return id;
  } catch (e) {
    return 'client_' + Math.random().toString(36).substring(2, 9);
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

  const isViewOnly = isForcedViewOnly || role === 'view_only';
  const roleRef = useRef(isViewOnly ? 'view_only' : role);
  roleRef.current = isViewOnly ? 'view_only' : role;

  const prevHistoryLenRef = useRef(history.length);
  const prevLedgerLenRef = useRef(dailyLedger.length);

  // Lắng nghe dữ liệu thời gian thực từ Firebase Firestore
  useEffect(() => {
    if (!isFirebaseConfigured || !db) {
      setIsConnected(false);
      // Chạy offline đơn máy: mở quyền active cho máy đó
      if (!isForcedViewOnly) {
        setRole('active');
        setSlotIndex(1);
      }
      return;
    }

    const clientId = getOrCreateClientId();
    const roomRef = doc(db, 'rooms', roomId);
    const presenceRef = doc(db, 'rooms', roomId, 'presence', clientId);
    const presenceCol = collection(db, 'rooms', roomId, 'presence');
    let isInitialMount = true;

    // 1. Khởi tạo / Lắng nghe document phòng & Active Slots
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      setIsConnected(true);

      if (!snapshot.exists()) {
        // Phòng chưa tồn tại trên Firestore -> Tạo mới
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
        }
        return;
      }

      const data = snapshot.data();
      if (!data) return;

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

      // 🎯 QUẢN LÝ PHÂN QUYỀN 2 SLOT ACTIVE NGHIÊM NGẶT TỪ PHÒNG:
      if (isForcedViewOnly) {
        setRole('view_only');
        setSlotIndex(null);
      } else {
        const activeSlots = Array.isArray(data.activeSlots) ? data.activeSlots : [];
        const myIndex = activeSlots.indexOf(clientId);

        if (myIndex !== -1 && myIndex < 2) {
          // Client nằm trong 2 slot active
          setRole('active');
          setSlotIndex(myIndex + 1);
        } else if (activeSlots.length < 2 && !activeSlots.includes(clientId)) {
          // Còn chỗ trống (dưới 2 người) -> Đăng ký chiếm slot
          updateDoc(roomRef, {
            activeSlots: arrayUnion(clientId)
          }).catch(e => console.warn('[Slots] Lỗi đăng ký active slot:', e));
        } else {
          // ĐÃ ĐỦ 2 NGƯỜI HOẶC LÀ NGƯỜI THỨ 3 TRỞ ĐI -> KHÓA CHẾ ĐỘ VIEW-ONLY!
          setRole('view_only');
          setSlotIndex(null);
        }
      }

      isInitialMount = false;
    }, (error) => {
      console.error('[Firebase] Lỗi kết nối Firestore phòng:', error);
      setIsConnected(false);
    });

    // 2. Presence Heartbeat: Gửi nhịp tim mỗi 6 giây để duy trì online
    const sendHeartbeat = () => {
      setDoc(presenceRef, {
        clientId,
        lastSeen: Date.now(),
        isExplicitViewOnly: Boolean(isForcedViewOnly)
      }, { merge: true }).catch(e => console.warn('[Presence] Heartbeat error:', e));
    };

    sendHeartbeat();
    const heartbeatInterval = setInterval(sendHeartbeat, 6000);

    // 3. Lắng nghe danh sách Online & Dọn dẹp máy offline để nhường slot Active
    const unsubscribePresence = onSnapshot(presenceCol, (snapshot) => {
      const now = Date.now();
      const onlineClientIds = new Set();

      snapshot.forEach(docSnap => {
        const d = docSnap.data();
        if (d && (now - (d.lastSeen || 0) < 18000)) { // 18s timeout
          onlineClientIds.add(d.clientId);
        }
      });

      setUserCount(Math.max(1, onlineClientIds.size));

      // Kiểm tra nếu có máy trong activeSlots đã mất kết nối > 18s -> Xóa khỏi activeSlots
      if (snapshot.size > 0) {
        // Chỉ để máy đang giữ slot 1 làm nhiệm vụ dọn dẹp để tránh xung đột
        roomRef.get?.() || null;
      }
    }, (err) => {
      console.warn('[Presence] Lỗi presence:', err);
    });

    // Giải phóng ngay slot và presence khi tắt tab / đóng trình duyệt
    const handleBeforeUnload = () => {
      deleteDoc(presenceRef).catch(() => {});
      updateDoc(roomRef, {
        activeSlots: arrayRemove(clientId)
      }).catch(() => {});
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(heartbeatInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      deleteDoc(presenceRef).catch(() => {});
      updateDoc(roomRef, {
        activeSlots: arrayRemove(clientId)
      }).catch(() => {});
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
    setDailyLedger([]);
    localStorage.setItem(`cq_players_${roomId}`, JSON.stringify(resetPlayers));
    localStorage.setItem(`cq_history_${roomId}`, JSON.stringify([]));
    localStorage.setItem(`cq_dailyLedger_${roomId}`, JSON.stringify([]));

    if (isFirebaseConfigured && db) {
      try {
        await updateDoc(doc(db, 'rooms', roomId), {
          players: resetPlayers,
          history: [],
          roundDeltas: {},
          dailyLedger: [],
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
