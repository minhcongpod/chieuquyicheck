import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import ScoreInputTable from './components/ScoreInputTable';
import ActionToolbar from './components/ActionToolbar';
import HistoryTable from './components/HistoryTable';
import Keyboard from './components/Keyboard';
import DailyStatsDrawer from './components/DailyStatsDrawer';
import { QrTransferModal } from './components/Modals';
import { useRealtimeGame } from './hooks/useRealtimeGame';
import './style.css';

export default function App() {
  const {
    roomId,
    players,
    history,
    roundDeltas,
    dailyLedger,
    isConnected,
    userCount,
    role,
    isViewOnly,
    slotIndex,
    viewOnlyUrl,
    updatePlayerName,
    updateRoundDeltas,
    confirmRound,
    undoRound,
    resetGame,
    addLedgerEntry,
    setDailyLedgerData,
    deleteLedgerEntry
  } = useRealtimeGame();

  // Trạng thái bàn phím số (Keyboard) của máy này
  const [activeKeypad, setActiveKeypad] = useState(null); // { player, index, mode: '+' | '-' }
  const [currentKeypadValue, setCurrentKeypadValue] = useState('');

  // Trạng thái mở Bảng thống kê điểm theo ngày
  const [isDailyStatsOpen, setIsDailyStatsOpen] = useState(false);

  // Trạng thái mở Bảng lịch sử điểm phóng to
  const [isHistoryExpanded, setIsHistoryExpanded] = useState(false);

  // Trạng thái Modal QR MoMo
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

  // Đóng bàn phím và làm sạch dữ liệu tạm khi xem Bảng thống kê hoặc Bảng lịch sử phóng to
  const handleOpenDailyStats = useCallback(() => {
    setActiveKeypad(null);
    setCurrentKeypadValue('');
    setIsDailyStatsOpen(true);
  }, []);

  const handleOpenQrModal = useCallback(() => {
    setActiveKeypad(null);
    setCurrentKeypadValue('');
    setIsQrModalOpen(true);
  }, []);

  // Đóng bàn phím khi chạm vào vùng mờ bên ngoài (giữ nguyên điểm đã nhập)
  const handleCloseKeyboard = useCallback(() => {
    setActiveKeypad(null);
    setCurrentKeypadValue('');
  }, []);

  const handleHistoryExpandChange = useCallback((expanded) => {
    setIsHistoryExpanded(prev => (prev !== expanded ? expanded : prev));
    if (expanded) {
      setActiveKeypad(null);
      setCurrentKeypadValue('');
    }
  }, []);

  // Tự động tắt bàn phím khi bất kỳ bảng nào (Thống kê, Lịch sử phóng to, QR) đang mở
  useEffect(() => {
    if (isDailyStatsOpen || isHistoryExpanded || isQrModalOpen) {
      setActiveKeypad(prev => (prev !== null ? null : prev));
      setCurrentKeypadValue(prev => (prev !== '' ? '' : prev));
    }
  }, [isDailyStatsOpen, isHistoryExpanded, isQrModalOpen]);

  // Tính tổng điểm tích luỹ qua tất cả các ván đấu đã hoàn thành
  const cumulativeScores = players.reduce((acc, player) => {
    const total = history.reduce((sum, round) => {
      return sum + (round.scores[player.id] || 0);
    }, 0);
    acc[player.id] = total;
    return acc;
  }, {});

  // Kiểm tra có bất kỳ thay đổi nào để cho phép Reset (Disable khi chưa có thay đổi nào)
  const canReset = useMemo(() => {
    // 1. Đã có ván đấu trong lịch sử
    if (history && history.length > 0) return true;

    // 2. Đang có điểm nhập dở trên bàn phím cho ván hiện tại
    if (roundDeltas && Object.values(roundDeltas).some(v => v !== 0 && v !== undefined && v !== null && v !== '')) {
      return true;
    }

    // 3. Có điểm tích luỹ khác 0
    if (cumulativeScores && Object.values(cumulativeScores).some(s => s !== 0)) {
      return true;
    }

    // 4. Có tên người chơi đã được nhập (khác rỗng)
    if (players && players.some(p => (p.name || '').trim() !== '')) {
      return true;
    }

    return false;
  }, [history, roundDeltas, cumulativeScores, players]);

  // Cập nhật tên người chơi (đồng bộ realtime)
  const handleUpdatePlayerName = (id, newName) => {
    updatePlayerName(id, newName);
  };

  // Mở bàn phím số khi bấm nút - hoặc + ở hàng người chơi
  const handleOpenKeyboard = (player, mode) => {
    if (isDailyStatsOpen || isHistoryExpanded || isQrModalOpen) return;
    const playerIndex = players.findIndex(p => p.id === player.id);
    setActiveKeypad({
      player,
      index: playerIndex,
      mode
    });
    // Lấy giá trị hiện có của người này trong ván nếu có
    const existingDelta = roundDeltas[player.id];
    if (existingDelta !== undefined && existingDelta !== 0) {
      const num = Math.abs(existingDelta);
      const updatedDelta = mode === '+' ? num : -num;
      if (updatedDelta !== existingDelta) {
        updateRoundDeltas(prev => ({
          ...prev,
          [player.id]: updatedDelta
        }));
      }
      setCurrentKeypadValue(String(num));
    } else {
      setCurrentKeypadValue('');
    }
  };

  // Xử lý bấm số trên bàn phím: Cập nhật trực tiếp điểm vào roundDeltas và phát sóng realtime
  const handleKeypadNumber = (digit) => {
    if (!activeKeypad || digit === '') return;
    setCurrentKeypadValue(prev => {
      let nextVal;
      if (prev === '0' || prev === '') {
        nextVal = digit;
      } else if (prev.length >= 3) {
        return prev; // Giới hạn tối đa 3 chữ số (ví dụ: 100, 999)
      } else {
        nextVal = prev + digit;
      }

      const num = parseInt(nextVal, 10);
      const signedVal = activeKeypad.mode === '+' ? num : -num;
      updateRoundDeltas(prevDeltas => ({
        ...prevDeltas,
        [activeKeypad.player.id]: signedVal
      }));

      return nextVal;
    });
  };

  // Xử lý bấm phím Xóa (Backspace): Cập nhật trực tiếp điểm và phát sóng realtime
  const handleKeypadBackspace = () => {
    if (!activeKeypad) return;
    setCurrentKeypadValue(prev => {
      if (prev.length <= 1) {
        updateRoundDeltas(prevDeltas => {
          const updated = { ...prevDeltas };
          delete updated[activeKeypad.player.id];
          return updated;
        });
        return '';
      }
      const nextVal = prev.slice(0, -1);
      const num = parseInt(nextVal, 10);
      const signedVal = activeKeypad.mode === '+' ? num : -num;
      updateRoundDeltas(prevDeltas => ({
        ...prevDeltas,
        [activeKeypad.player.id]: signedVal
      }));
      return nextVal;
    });
  };

  // Hủy thao tác nhập [✕ màu đỏ]: Xóa dữ liệu tạm, hoàn nguyên ô về + hoặc -, thoát focus và đóng bàn phím
  const handleKeypadCancel = () => {
    if (activeKeypad && activeKeypad.player) {
      updateRoundDeltas(prevDeltas => {
        const updated = { ...prevDeltas };
        delete updated[activeKeypad.player.id];
        return updated;
      });
    }
    setActiveKeypad(null);
    setCurrentKeypadValue('');
  };

  // 🎯 QUY TẮC TỰ ĐỘNG BẬT SÁNG NÚT TÍCH XANH & CỘNG DỒN ĐIỂM CÒN THIẾU
  // Dựa trên số lượng người chơi có tên trong bàn (loại bỏ các hàng trống không có tên)
  const namedPlayers = useMemo(() => {
    return players.filter(p => (p.name || '').trim() !== '');
  }, [players]);

  const numNamed = namedPlayers.length;

  // Danh sách người chơi có tên được nhập điểm âm (< 0)
  const negativeNamedPlayers = useMemo(() => {
    return namedPlayers.filter(p => {
      const delta = roundDeltas[p.id];
      return delta !== undefined && typeof delta === 'number' && delta < 0;
    });
  }, [namedPlayers, roundDeltas]);

  // Kiểm tra điều kiện tự động cân bằng điểm (Auto-balance):
  // Bàn 2 người: đúng 1 người điểm âm
  // Bàn 3 người: đúng 2 người điểm âm
  // Bàn 4 người: đúng 3 người điểm âm
  // Bàn 5 người: đúng 4 người điểm âm
  // -> Quy tắc chung: có đúng (numNamed - 1) người điểm âm trong tổng số numNamed người có tên (với numNamed >= 2)
  const isAutoBalanceEligible = useMemo(() => {
    if (numNamed < 2 || numNamed > 5) return false;
    return negativeNamedPlayers.length === (numNamed - 1);
  }, [numNamed, negativeNamedPlayers]);

  // Người chơi còn lại duy nhất chưa nhập điểm âm để nhận tổng điểm bù dương
  const remainingPlayer = useMemo(() => {
    if (!isAutoBalanceEligible) return null;
    return namedPlayers.find(p => !negativeNamedPlayers.some(neg => neg.id === p.id)) || null;
  }, [isAutoBalanceEligible, namedPlayers, negativeNamedPlayers]);

  // Tổng điểm âm của các người chơi thua
  const sumNegativePoints = useMemo(() => {
    if (!isAutoBalanceEligible) return 0;
    return negativeNamedPlayers.reduce((sum, p) => sum + (roundDeltas[p.id] || 0), 0);
  }, [isAutoBalanceEligible, negativeNamedPlayers, roundDeltas]);

  // Điểm dương bù đắp cho người chơi còn lại: đảo dấu thành dương để tổng ván = 0
  const autoBalancedPositiveScore = useMemo(() => {
    return isAutoBalanceEligible ? -sumNegativePoints : 0;
  }, [isAutoBalanceEligible, sumNegativePoints]);

  const autoBalanceInfo = useMemo(() => {
    if (!isAutoBalanceEligible || !remainingPlayer) return null;
    return {
      playerId: remainingPlayer.id,
      score: autoBalancedPositiveScore
    };
  }, [isAutoBalanceEligible, remainingPlayer, autoBalancedPositiveScore]);

  // Kiểm tra điều kiện chốt ván:
  // 1. Thủ công: Tổng điểm đã bằng 0 và có ít nhất 1 người nhập điểm khác 0
  // 2. Tự động: Đủ điều kiện tự động cân bằng (N - 1 người điểm âm)
  const currentSumTotal = players.reduce((sum, p) => sum + (roundDeltas[p.id] || 0), 0);
  const hasEnteredScore = Object.values(roundDeltas).some(val => val !== undefined && val !== 0);
  const isManuallyBalanced = currentSumTotal === 0 && hasEnteredScore;
  const canConfirmRound = isManuallyBalanced || isAutoBalanceEligible;

  // Tổng điểm hiển thị trên thanh ActionToolbar (hiển thị 0 khi tự động cân bằng điểm)
  const effectiveSumTotal = isAutoBalanceEligible ? 0 : currentSumTotal;

  // Chốt ván và lưu điểm vào lịch sử, phát sóng đồng bộ cho toàn bộ máy
  const handleConfirmRound = () => {
    if (!canConfirmRound) return;

    // Chuẩn bị điểm số của từng người chơi cho ván đấu
    const finalScores = { ...roundDeltas };

    // Nếu đủ điều kiện tự động cân bằng: gán tổng điểm dương bù cho người chơi còn lại
    if (isAutoBalanceEligible && remainingPlayer) {
      finalScores[remainingPlayer.id] = autoBalancedPositiveScore;
    }

    // Loại bỏ điểm rác nếu có trên các hàng trống không có tên
    if (numNamed > 0) {
      players.forEach(p => {
        if (!p.name || !p.name.trim()) {
          delete finalScores[p.id];
        }
      });
    }

    // Tạo ván mới và phát sóng đồng bộ
    const nextRoundNumber = history.length + 1;
    const newRound = {
      id: `round-${Date.now()}`,
      roundNumber: nextRoundNumber,
      scores: finalScores,
      timestamp: Date.now()
    };

    confirmRound(newRound);
    setActiveKeypad(null);
    setCurrentKeypadValue('');
  };

  // Hiệu ứng phát sáng / nhấn phím ảo khi gõ từ bàn phím vật lý
  const [pressedKey, setPressedKey] = useState(null);
  const pressedKeyTimerRef = useRef(null);

  const triggerKeyFeedback = useCallback((key) => {
    if (pressedKeyTimerRef.current) clearTimeout(pressedKeyTimerRef.current);
    setPressedKey(key);
    pressedKeyTimerRef.current = setTimeout(() => {
      setPressedKey(null);
    }, 160);
  }, []);

  useEffect(() => {
    const handleKeyUp = () => {
      if (pressedKeyTimerRef.current) clearTimeout(pressedKeyTimerRef.current);
      pressedKeyTimerRef.current = setTimeout(() => {
        setPressedKey(null);
      }, 50);
    };
    window.addEventListener('keyup', handleKeyUp);
    return () => window.removeEventListener('keyup', handleKeyUp);
  }, []);

  // ⌨️ Lắng nghe sự kiện bàn phím cứng trên PC/Laptop để nhập điểm siêu tốc
  useEffect(() => {
    const handleKeyDown = (e) => {
      // 1. Không can thiệp nếu người dùng đang nhập tên người chơi (input text)
      const tag = e.target?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || e.target?.isContentEditable) {
        return;
      }

      // 2. Không xử lý nếu ở chế độ View-Only hoặc đang mở modal khác
      if (isViewOnly || isDailyStatsOpen || isHistoryExpanded || isQrModalOpen) {
        return;
      }

      // 3. Khi bàn phím số đang mở
      if (activeKeypad) {
        // Phím số từ 0 đến 9 (cả hàng số chính và Numpad)
        if (/^[0-9]$/.test(e.key)) {
          e.preventDefault();
          triggerKeyFeedback(e.key);
          handleKeypadNumber(e.key);
          return;
        }

        // Phím dấu trừ (-) để đổi sang mode trừ
        if (e.key === '-' || e.code === 'Minus' || e.code === 'NumpadSubtract') {
          e.preventDefault();
          if (activeKeypad.mode !== '-') {
            setActiveKeypad(prev => ({ ...prev, mode: '-' }));
            const num = parseInt(currentKeypadValue, 10);
            if (!isNaN(num) && num !== 0) {
              updateRoundDeltas(prev => ({
                ...prev,
                [activeKeypad.player.id]: -num
              }));
            }
          }
          return;
        }

        // Phím dấu cộng (+) để đổi sang mode cộng
        if (e.key === '+' || e.code === 'NumpadAdd' || (e.shiftKey && e.code === 'Equal')) {
          e.preventDefault();
          if (activeKeypad.mode !== '+') {
            setActiveKeypad(prev => ({ ...prev, mode: '+' }));
            const num = parseInt(currentKeypadValue, 10);
            if (!isNaN(num) && num !== 0) {
              updateRoundDeltas(prev => ({
                ...prev,
                [activeKeypad.player.id]: num
              }));
            }
          }
          return;
        }

        // Phím Backspace: Xóa lùi ký tự cuối cùng
        if (e.key === 'Backspace') {
          e.preventDefault();
          triggerKeyFeedback('backspace');
          handleKeypadBackspace();
          return;
        }

        // Phím Escape (Esc): Hủy thao tác nhập và thoát (tương đương nút 'X' đỏ)
        if (e.key === 'Escape') {
          e.preventDefault();
          triggerKeyFeedback('cancel');
          handleKeypadCancel();
          return;
        }

        // Phím Enter hoặc NumpadEnter: Đóng bàn phím và xác nhận số điểm đã gõ
        if (e.key === 'Enter') {
          e.preventDefault();
          handleCloseKeyboard();
          return;
        }

        // Phím Tab hoặc Mũi tên Xuống: Di chuyển nhanh sang người chơi kế tiếp
        if (e.key === 'Tab' || e.key === 'ArrowDown') {
          e.preventDefault();
          const nextIdx = (activeKeypad.index + 1) % players.length;
          handleOpenKeyboard(players[nextIdx], activeKeypad.mode);
          return;
        }

        // Phím Shift + Tab hoặc Mũi tên Lên: Di chuyển về người chơi trước
        if ((e.shiftKey && e.key === 'Tab') || e.key === 'ArrowUp') {
          e.preventDefault();
          const prevIdx = (activeKeypad.index - 1 + players.length) % players.length;
          handleOpenKeyboard(players[prevIdx], activeKeypad.mode);
          return;
        }
      } else {
        // Khi bàn phím chưa mở: Nếu ván đã đủ điều kiện chốt (tổng bằng 0 và có điểm), gõ Enter để chốt ván ngay
        if (e.key === 'Enter' && canConfirmRound) {
          e.preventDefault();
          handleConfirmRound();
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    activeKeypad,
    currentKeypadValue,
    isViewOnly,
    isDailyStatsOpen,
    isHistoryExpanded,
    isQrModalOpen,
    canConfirmRound,
    players,
    handleKeypadNumber,
    handleKeypadBackspace,
    handleKeypadCancel,
    handleCloseKeyboard,
    handleConfirmRound,
    updateRoundDeltas
  ]);

  // Xử lý xác nhận Reset trận đấu (đồng bộ realtime)
  const handleResetConfirm = () => {
    resetGame();
    setActiveKeypad(null);
    setCurrentKeypadValue('');
  };

  // Xử lý xác nhận Hoàn tác (Undo) (đồng bộ realtime)
  const handleUndoConfirm = () => {
    if (history.length === 0) return;
    undoRound();
  };

  // Xử lý khi bấm nút "CHỐT SỔ" tại Bảng lịch sử điểm:
  // - Kiểm tra trùng lặp (Deduplication): Quét danh sách người chơi mới và so sánh với Master List hiện đang có trong bảng thống kê
  // - Cập nhật dữ liệu cho người cũ (Merge): Nếu tên đã tồn tại, không tạo thêm cột mới, lưu điểm theo tên để cộng dồn
  // - Thêm cột mới vào bên phải cho người mới: Nếu chưa có trong Master List, đẩy vào cuối mảng để xuất hiện ở ngoài cùng bên phải
  const handleChotSo = () => {
    const nextRoundIndex = (dailyLedger?.length || 0) + 1;
    const now = new Date();
    const dateLabel = `${now.getDate()}/${now.getMonth() + 1}`;
    const label = dateLabel;

    // 1. Quét Master List hiện tại từ dailyLedger
    const masterListNames = [];
    (dailyLedger || []).forEach((entry) => {
      if (entry.playersInfo && Array.isArray(entry.playersInfo)) {
        entry.playersInfo.forEach((p) => {
          const n = (p.name || p.id || '').trim().toUpperCase();
          if (n && !masterListNames.includes(n)) {
            masterListNames.push(n);
          }
        });
      }
    });

    // 2. Chuẩn hoá danh sách người chơi hiện tại ở bàn đấu
    const sessionScores = {};
    const playersInfo = [];
    const seenNamesInRound = new Set();

    players.forEach((p, idx) => {
      const rawName = (p.name && p.name.trim()) ? p.name.trim() : '';
      const score = cumulativeScores[p.id] || 0;

      // Bỏ qua các hàng trống hoàn toàn (tên rỗng và điểm bằng 0)
      if (!rawName && score === 0) return;

      let displayName = rawName ? rawName.toUpperCase() : `NGƯỜI CHƠI ${idx + 1}`;

      // Đảm bảo không trùng tên nếu tại bàn có 2 người đặt cùng tên
      if (seenNamesInRound.has(displayName)) {
        displayName = `${displayName}_${idx + 1}`;
      }
      seenNamesInRound.add(displayName);

      // Lưu điểm duy nhất theo tên chuẩn displayName (không lưu thêm p.id tránh sinh cột trùng)
      sessionScores[displayName] = score;

      playersInfo.push({
        id: displayName,
        name: displayName,
        color: p.color
      });

      // Nếu là người mới chưa có trong Master List, ghi nhận tiếp vào danh sách
      if (!masterListNames.includes(displayName)) {
        masterListNames.push(displayName);
      }
    });

    const newEntry = {
      id: `ledger-${Date.now()}`,
      roundIndex: nextRoundIndex,
      label,
      dateStr: dateLabel,
      timestamp: Date.now(),
      playersInfo,
      scores: sessionScores
    };

    // Thêm lần chốt sổ mới vào sổ
    const updatedLedger = [...(dailyLedger || []), newEntry];
    setDailyLedgerData(updatedLedger);
  };

  // Kiểm tra bàn phím số có đang mở hay không (tắt nếu ở quyền View-Only)
  const isKeyboardOpen = Boolean(activeKeypad && !isDailyStatsOpen && !isHistoryExpanded && !isQrModalOpen && !isViewOnly);

  return (
    <div className="app-screen">
      {/* 1. Phần bảng điểm nhập liệu 5 người chơi (Khu vực trên cùng) */}
      <ScoreInputTable
        players={players}
        cumulativeScores={cumulativeScores}
        roundDeltas={roundDeltas}
        dailyLedger={dailyLedger}
        activeKeypad={!isKeyboardOpen ? null : activeKeypad}
        onUpdatePlayerName={handleUpdatePlayerName}
        onOpenKeyboard={handleOpenKeyboard}
        isViewOnly={isViewOnly}
        autoBalanceInfo={autoBalanceInfo}
      />

      {/* 2. Hàng 4 nút chức năng: Tích xanh - Quay lại - Thống kê - QR code (Hoặc nút VIEW ONLY nếu ở chế độ xem) */}
      <ActionToolbar
        sumTotal={effectiveSumTotal}
        canConfirm={canConfirmRound}
        onConfirmRound={handleConfirmRound}
        onUndoConfirm={handleUndoConfirm}
        onLedgerClick={handleOpenDailyStats}
        onQrClick={handleOpenQrModal}
        canUndo={history.length > 0}
        hasLedger={Boolean(dailyLedger && dailyLedger.length > 0)}
        isViewOnly={isViewOnly}
        viewOnlyUrl={viewOnlyUrl}
        isAutoBalanced={isAutoBalanceEligible}
      />

      {/* 3. Bảng lịch sử điểm mỗi ván đấu (Ẩn hoàn toàn khi mở bàn phím để đỡ rối mắt) */}
      <HistoryTable
        players={players}
        history={history}
        cumulativeScores={cumulativeScores}
        onChotSo={handleChotSo}
        canReset={canReset}
        onResetConfirm={handleResetConfirm}
        onExpandChange={handleHistoryExpandChange}
        isViewOnly={isViewOnly}
      />

      {/* Vùng mờ nền khi mở bàn phím (Blur Background) - Chạm vào để đóng bàn phím */}
      {isKeyboardOpen && (
        <div
          className="keyboard-dismiss-backdrop"
          onClick={handleCloseKeyboard}
          title="Chạm vào vùng mờ để đóng bàn phím"
        />
      )}

      {/* 4. Bàn phím số tương tác theo thiết kế ở ảnh số 2 (Tắt hoàn toàn khi xem bảng thống kê, bảng lịch sử phóng to hoặc View-Only) */}
      {isKeyboardOpen && (
        <Keyboard
          activePlayer={activeKeypad.player}
          onNumberClick={handleKeypadNumber}
          onBackspace={handleKeypadBackspace}
          onCancel={handleKeypadCancel}
          pressedKey={pressedKey}
        />
      )}

      {/* 5. Bảng thống kê điểm theo ngày (Daily Stats Ledger) */}
      <DailyStatsDrawer
        isOpen={isDailyStatsOpen}
        onClose={() => setIsDailyStatsOpen(false)}
        players={players}
        dailyLedger={dailyLedger}
        onDeleteLedgerEntry={deleteLedgerEntry}
        isViewOnly={isViewOnly}
      />

      {/* 6. Cửa sổ Popup Mã QR Quỹ Chiếu Quỷ (dự phòng) */}
      <QrTransferModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
}
