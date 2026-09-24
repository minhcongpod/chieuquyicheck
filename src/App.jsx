import React, { useState, useRef, useMemo } from 'react';
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

  // Trạng thái Modal QR MoMo
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);

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

    // 4. Có tên người chơi thay đổi so với mặc định ban đầu (A, B, C, D, E)
    if (players && players.some((p, idx) => {
      const defaultName = String.fromCharCode(65 + idx);
      const currentName = p.name ? p.name.trim().toUpperCase() : '';
      return currentName !== '' && currentName !== defaultName;
    })) {
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
      } else if (prev.length >= 2) {
        return prev; // Giới hạn tối đa 2 chữ số (ví dụ: 12)
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

  // Đóng bàn phím [✕] (giữ nguyên điểm đã nhập ở ô +/-)
  const handleKeypadCancel = () => {
    setActiveKeypad(null);
    setCurrentKeypadValue('');
  };

  // Kiểm tra điều kiện chốt ván: Tổng điểm bằng 0 và có ít nhất 1 người có điểm khác 0
  const currentSumTotal = players.reduce((sum, p) => sum + (roundDeltas[p.id] || 0), 0);
  const hasEnteredScore = Object.values(roundDeltas).some(val => val !== undefined && val !== 0);
  const canConfirmRound = currentSumTotal === 0 && hasEnteredScore;

  // Chốt ván và lưu điểm vào lịch sử, phát sóng đồng bộ cho toàn bộ máy
  const handleConfirmRound = () => {
    if (!canConfirmRound) return;

    // Tạo ván mới và phát sóng đồng bộ
    const nextRoundNumber = history.length + 1;
    const newRound = {
      id: `round-${Date.now()}`,
      roundNumber: nextRoundNumber,
      scores: { ...roundDeltas },
      timestamp: Date.now()
    };

    confirmRound(newRound);
    setActiveKeypad(null);
    setCurrentKeypadValue('');
  };

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
    const label = `#${nextRoundIndex}`;

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
      const rawName = (p.name && p.name.trim()) ? p.name.trim() : String.fromCharCode(65 + idx);
      let displayName = rawName.toUpperCase();

      // Đảm bảo không trùng tên nếu tại bàn có 2 người đặt cùng tên
      if (seenNamesInRound.has(displayName)) {
        displayName = `${displayName}_${idx + 1}`;
      }
      seenNamesInRound.add(displayName);

      const score = cumulativeScores[p.id] || 0;

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
      timestamp: Date.now(),
      playersInfo,
      scores: sessionScores
    };

    // Thêm lần chốt sổ mới vào sổ
    const updatedLedger = [...(dailyLedger || []), newEntry];
    setDailyLedgerData(updatedLedger);
  };

  return (
    <div className="app-screen">
      {/* 1. Phần bảng điểm nhập liệu 5 người chơi (Khu vực trên cùng) */}
      <ScoreInputTable
        players={players}
        cumulativeScores={cumulativeScores}
        roundDeltas={roundDeltas}
        dailyLedger={dailyLedger}
        onUpdatePlayerName={handleUpdatePlayerName}
        onOpenKeyboard={handleOpenKeyboard}
      />

      {/* 2. Hàng 4 nút chức năng kèm trượt xác nhận Reset, Undo */}
      <ActionToolbar
        sumTotal={currentSumTotal}
        canConfirm={canConfirmRound}
        onConfirmRound={handleConfirmRound}
        onResetConfirm={handleResetConfirm}
        onUndoConfirm={handleUndoConfirm}
        onStatsClick={() => setIsDailyStatsOpen(true)}
        onLedgerClick={() => setIsDailyStatsOpen(true)}
        onQrClick={() => setIsQrModalOpen(true)}
        canUndo={history.length > 0}
        hasLedger={Boolean(dailyLedger && dailyLedger.length > 0)}
        canReset={canReset}
      />

      {/* 3. Bảng lịch sử điểm mỗi ván đấu (Khu vực dưới cùng) */}
      <HistoryTable
        players={players}
        history={history}
        cumulativeScores={cumulativeScores}
        onChotSo={handleChotSo}
      />

      {/* 4. Bàn phím số tương tác theo thiết kế ở ảnh số 2 */}
      {activeKeypad && (
        <Keyboard
          activePlayer={activeKeypad.player}
          onNumberClick={handleKeypadNumber}
          onBackspace={handleKeypadBackspace}
          onCancel={handleKeypadCancel}
        />
      )}

      {/* 5. Bảng thống kê điểm theo ngày (Daily Stats Ledger) */}
      <DailyStatsDrawer
        isOpen={isDailyStatsOpen}
        onClose={() => setIsDailyStatsOpen(false)}
        players={players}
        dailyLedger={dailyLedger}
        onDeleteLedgerEntry={deleteLedgerEntry}
      />

      {/* 6. Cửa sổ Popup Mã QR Quỹ Chiếu Quỷ (dự phòng) */}
      <QrTransferModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
}
