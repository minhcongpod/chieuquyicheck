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

// Cấu hình nhịp tim và thời gian giữ slot
const HEARTBEAT_INTERVAL_MS = 3000;   // 3s gửi nhịp tim duy trì online
const PRESENCE_TIMEOUT_MS = 10000;    // 10s để hiển thị số người online
const EDITOR_HOLD_TIMEOUT_MS = 5 * 60 * 1000; // 5 PHÚT (300,000 ms) giữ slot khi thoát / F5
const RECONCILE_INTERVAL_MS = 3000;  // 3s rà soát nhường slot khi có người hết hạn > 5 phút
const MAX_EDITORS = 2;               // Giới hạn tối đa đúng 2 người chỉnh sửa

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

// Device ID cố định cho thiết bị (lưu trong localStorage để không bao giờ bị đổi khi F5 hay đóng tab)
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

// Thời điểm thiết bị lần đầu vào phòng (lưu trong localStorage để giữ thứ tự FIFO cố định)
function getDeviceJoinedAt(roomId, deviceId) {
  if (typeof window === 'undefined') return Date.now();
  try {
    const key = `cq_joined_${roomId}_${deviceId}`;
    let saved = localStorage.getItem(key);
    let val = saved ? parseInt(saved, 10) : 0;
    if (!val || isNaN(val)) {
      val = Date.now();
      localStorage.setItem(key, String(val));
    }
    return val;
  } catch (e) {
    return Date.now();
  }
}

// Chuẩn hóa slot dữ liệu (hỗ trợ cả dạng string ID cũ và object mới)
function normalizeSlot(item) {
  if (!item) return null;
  if (typeof item === 'string') {
    return { deviceId: item, lastSeen: Date.now(), joinedAt: Date.now() };
  }
  if (typeof item === 'object' && item.deviceId) {
    return {
      deviceId: String(item.deviceId),
      lastSeen: typeof item.lastSeen === 'number' ? item.lastSeen : Date.now(),
      joinedAt: typeof item.joinedAt === 'number' ? item.joinedAt : Date.now()
    };
  }
  return null;
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
  // Chỉ khi Firebase kiểm tra xác nhận thiết bị nằm trong 2 slot đầu tiên thì mới mở quyền Active!
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

    const deviceId = getOrCreateDeviceId();
    const joinedAt = getDeviceJoinedAt(roomId, deviceId);
    const roomRef = doc(db, 'rooms', roomId);
    const presenceRef = doc(db, 'rooms', roomId, 'presence', deviceId);
    const presenceCol = collection(db, 'rooms', roomId, 'presence');
    let isInitialMount = true;

    let presenceCache = [];
    let latestRoomData = null;
    let isReconciling = false;

    // Hàm điều phối và nhường quyền tự động khi có slot trống hoặc editor mất kết nối quá 5 phút
    const reconcileEditors = async (onlineList = presenceCache, roomData = latestRoomData) => {
      if (!isFirebaseConfigured || !db || isForcedViewOnly) return;
      if (isReconciling) return;
      if (!roomData) return;

      const now = Date.now();
      const rawSlots = Array.isArray(roomData.activeSlots) ? roomData.activeSlots : [];
      const currentSlots = rawSlots.map(normalizeSlot).filter(Boolean);

      // 1. Kiểm tra các slot hiện tại:
      // QUY TẮC CỐT LÕI: Slot CHỈ BỊ MẤT KHI VÀ CHỈ KHI không hoạt động QUÁ 5 PHÚT (300,000 ms)!
      // Nếu thiết bị vừa F5, vừa đóng tab, hoặc vừa thoát chưa đến 5 phút -> BẮT BUỘC GIỮ LẠI SLOT!
      const validRetainedSlots = currentSlots.filter(slot => {
        // Nếu chính là máy này -> Luôn giữ slot!
        if (slot.deviceId === deviceId) return true;

        // Tìm presence của thiết bị này trong danh sách online
        const pres = (onlineList || []).find(p => p.deviceId === slot.deviceId);
        
        // Thời điểm hoạt động gần nhất: lấy max giữa presence và slot
        const lastActive = Math.max(pres?.lastSeen || 0, slot.lastSeen || 0);

        // Chỉ coi là hết hạn khi ĐÃ QUÁ 5 PHÚT KHÔNG MỞ LÊN!
        const isExpired = lastActive > 0 && (now - lastActive) > EDITOR_HOLD_TIMEOUT_MS;
        return !isExpired;
      }).slice(0, MAX_EDITORS);

      // 2. Danh sách slot mới giữ nguyên các slot hợp lệ
      const nextSlots = [...validRetainedSlots];

      // 3. Nếu còn thiếu slot (dưới 2 slot) -> Nhấc người chơi online tiếp theo (FIFO theo joinedAt)
      if (nextSlots.length < MAX_EDITORS) {
        const eligibleOnline = (onlineList || []).filter(item => {
          // Đang online gần đây (< 15s) và không phải link chỉ xem bắt buộc
          return (now - (item.lastSeen || 0) < 15000) && !item.isExplicitViewOnly;
        });

        eligibleOnline.sort((a, b) => {
          if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
          return (a.deviceId || '').localeCompare(b.deviceId || '');
        });

        for (const cand of eligibleOnline) {
          if (nextSlots.length >= MAX_EDITORS) break;
          if (!nextSlots.some(s => s.deviceId === cand.deviceId)) {
            nextSlots.push({
              deviceId: cand.deviceId,
              joinedAt: cand.joinedAt,
              lastSeen: cand.lastSeen || now
            });
          }
        }
      }

      // 4. Kiểm tra xem slots có thay đổi không
      const currentDevIds = currentSlots.map(s => s.deviceId);
      const nextDevIds = nextSlots.map(s => s.deviceId);

      const slotsChanged = (
        nextDevIds.length !== currentDevIds.length ||
        nextDevIds.some((id, idx) => id !== currentDevIds[idx])
      );

      if (!slotsChanged) return;

      // 5. Chỉ máy có liên quan (nằm trong currentSlots hoặc nextSlots) mới gửi transaction để tránh xung đột
      const isConcerned = nextDevIds.includes(deviceId) || currentDevIds.includes(deviceId);
      if (!isConcerned) return;

      isReconciling = true;
      try {
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(roomRef);
          if (!snap.exists()) return;
          const freshData = snap.data();
          const freshRaw = Array.isArray(freshData.activeSlots) ? freshData.activeSlots : [];
          const freshSlots = freshRaw.map(normalizeSlot).filter(Boolean);

          // Tính lại với freshSlots từ Firestore:
          const validFresh = freshSlots.filter(slot => {
            if (slot.deviceId === deviceId) return true;
            const pres = (onlineList || []).find(p => p.deviceId === slot.deviceId);
            const lastActive = Math.max(pres?.lastSeen || 0, slot.lastSeen || 0);
            const isExpired = lastActive > 0 && (now - lastActive) > EDITOR_HOLD_TIMEOUT_MS;
            return !isExpired;
          }).slice(0, MAX_EDITORS);

          const finalSlots = [...validFresh];
          if (finalSlots.length < MAX_EDITORS) {
            const eligibleOnline = (onlineList || []).filter(item => {
              return (now - (item.lastSeen || 0) < 15000) && !item.isExplicitViewOnly;
            });
            eligibleOnline.sort((a, b) => {
              if (a.joinedAt !== b.joinedAt) return a.joinedAt - b.joinedAt;
              return (a.deviceId || '').localeCompare(b.deviceId || '');
            });

            for (const cand of eligibleOnline) {
              if (finalSlots.length >= MAX_EDITORS) break;
              if (!finalSlots.some(s => s.deviceId === cand.deviceId)) {
                finalSlots.push({
                  deviceId: cand.deviceId,
                  joinedAt: cand.joinedAt,
                  lastSeen: cand.lastSeen || now
                });
              }
            }
          }

          const freshDevIds = freshSlots.map(s => s.deviceId);
          const finalDevIds = finalSlots.map(s => s.deviceId);

          const reallyChanged = (
            finalDevIds.length !== freshDevIds.length ||
            finalDevIds.some((id, idx) => id !== freshDevIds[idx])
          );

          if (reallyChanged) {
            tx.update(roomRef, {
              activeSlots: finalSlots,
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
        const initialActive = isForcedViewOnly ? [] : [{
          deviceId,
          joinedAt,
          lastSeen: Date.now()
        }];
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
          setActiveSlots([deviceId]);
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
      const rawSlots = Array.isArray(data.activeSlots) ? data.activeSlots : [];
      const normalizedSlots = rawSlots.map(normalizeSlot).filter(Boolean);
      const slotDevIds = normalizedSlots.map(s => s.deviceId);
      setActiveSlots(slotDevIds);

      if (isForcedViewOnly) {
        setRole('view_only');
        setSlotIndex(null);
      } else {
        const myIndex = slotDevIds.indexOf(deviceId);
        if (myIndex !== -1 && myIndex < MAX_EDITORS) {
          // 🟢 Thiết bị này nằm trong 2 slot active đầu tiên -> Cấp quyền Edit!
          setRole('active');
          setSlotIndex(myIndex + 1);
        } else {
          // 🔒 Người thứ 3 trở đi hoặc chưa có slot -> KHÓA VIEW-ONLY!
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
        deviceId,
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

      // Dọn dẹp các presence documents quá cũ (> 10 phút) để giữ Firestore sạch sẽ
      const rawSlots = Array.isArray(latestRoomData?.activeSlots) ? latestRoomData.activeSlots : [];
      const normalizedSlots = rawSlots.map(normalizeSlot).filter(Boolean);
      const isFirstActive = normalizedSlots[0]?.deviceId === deviceId;
      if (isFirstActive) {
        list.forEach(d => {
          if (now - (d.lastSeen || 0) > 600000 && d.deviceId !== deviceId) {
            deleteDoc(doc(db, 'rooms', roomId, 'presence', d.deviceId)).catch(() => {});
          }
        });
      }

      reconcileEditors(list, latestRoomData);
    }, (err) => {
      console.warn('[Presence] Lỗi presence:', err);
    });

    // 4. Timer định kỳ kiểm tra timeout để nhường quyền khi editor vắng mặt quá 5 phút
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

    // 6. Thoát nhanh: Khi tắt tab / chuyển trang, chỉ xóa presence online, GIỮ NGUYÊN activeSlots trong 5 phút!
    const handleExit = () => {
      try {
        deleteDoc(presenceRef).catch(() => {});
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
