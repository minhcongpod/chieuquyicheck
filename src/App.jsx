import React, { useState, useRef } from 'react';
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
    setDailyLedgerData
  } = useRealtimeGame();

  // Trạng thái bàn phím số (Keyboard) của máy này
  const [activeKeypad, setActiveKeypad] = useState(null); // { player, index, mode: '+' | '-' }
  const [currentKeypadValue, setCurrentKeypadValue] = useState('');

  // Trạng thái hiển thị thông báo lỗi inline "LỖI CMNR" (tự tắt sau 1s)
  const [isErrorBanner, setIsErrorBanner] = useState(false);
  const errorTimerRef = useRef(null);

  const triggerErrorBanner = () => {
    setIsErrorBanner(true);
    if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setIsErrorBanner(false);
    }, 1000);
  };

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

  // Chốt ván và lưu điểm vào lịch sử, phát sóng đồng bộ cho toàn bộ máy
  const handleConfirmRound = () => {
    // 1. Tính tổng kiểm tra SUM
    const sumTotal = players.reduce((sum, p) => sum + (roundDeltas[p.id] || 0), 0);
    // 2. Kiểm tra xem có người nào có điểm khác 0 không
    const hasScore = Object.values(roundDeltas).some(val => val !== 0);

    // Khi chưa nhập chính xác (tổng khác 0 hoặc chưa có ai nhập điểm): hiển thị thông báo "LỖI CMNR" trong 1s
    if (sumTotal !== 0 || !hasScore) {
      triggerErrorBanner();
      return;
    }

    // 3. Tạo ván mới và phát sóng đồng bộ
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
  // - Không chuyển sang trang Thống kê điểm theo ngày mà chỉ đóng bottom sheet Lịch sử điểm lại
  // - Không cộng vào số điểm hiện tại ở trang Thống kê điểm theo ngày mà ghi mới
  // - Chỉ giữ ngày hôm nay 24/9. Xóa hết điểm ở các ngày trước đó
  const handleChotSo = () => {
    const now = new Date();
    const dateStr = `${now.getDate()}/${now.getMonth() + 1}`;

    const todayScores = {};
    const playersInfo = [];

    players.forEach((p, idx) => {
      const score = cumulativeScores[p.id] || 0;
      todayScores[p.id] = score;

      const pName = p.name?.trim();
      const displayName = pName ? pName.toUpperCase() : `P${idx + 1}`;
      todayScores[displayName] = score;

      playersInfo.push({
        id: displayName,
        name: displayName,
        color: p.color
      });
    });

    const newEntry = {
      id: `ledger-${Date.now()}`,
      dateStr,
      timestamp: Date.now(),
      playersInfo,
      scores: todayScores
    };

    // Ghi mới và chỉ giữ ngày hôm nay, xóa toàn bộ ngày cũ
    setDailyLedgerData([newEntry]);
  };

  // Tính tổng điểm ván hiện tại để kiểm tra cân bằng
  const currentSumTotal = players.reduce((sum, p) => sum + (roundDeltas[p.id] || 0), 0);

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

      {/* 2. Hàng 4 nút chức năng kèm trượt xác nhận Reset, Undo và báo LỖI CMNR inline */}
      <ActionToolbar
        sumTotal={currentSumTotal}
        onConfirmRound={handleConfirmRound}
        onResetConfirm={handleResetConfirm}
        onUndoConfirm={handleUndoConfirm}
        onStatsClick={() => setIsDailyStatsOpen(true)}
        onLedgerClick={() => setIsDailyStatsOpen(true)}
        onQrClick={() => setIsQrModalOpen(true)}
        canUndo={history.length > 0}
        isError={isErrorBanner}
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
      />

      {/* 6. Cửa sổ Popup Mã QR Quỹ Chiếu Quỷ (dự phòng) */}
      <QrTransferModal
        isOpen={isQrModalOpen}
        onClose={() => setIsQrModalOpen(false)}
      />
    </div>
  );
}
