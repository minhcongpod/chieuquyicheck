import React, { useState, useEffect, useRef } from 'react';
import { ExpandIcon, CompressIcon } from './Icons';

/**
 * Quy tắc bôi màu nền tự động tại Bảng lịch sử điểm:
 *
 * Trường hợp 1: Chặn 2 (Chặt heo)
 * - Người chơi chiến thắng (người đi chặt) nhận +20 điểm -> bôi nền xanh lá cây.
 * - Người chơi bị phạt (người bị chặt) nhận -20 điểm -> bôi nền đỏ sẫm.
 *
 * Trường hợp 2: Đánh Sâm (Xin làng thành công / Tới trắng)
 * - Người chơi chiến thắng nhận +40/+60/+80 điểm (tùy số người thua) -> bôi nền xanh lá.
 * - Tất cả những người chơi còn lại bị phạt (-20 điểm/người) -> bôi nền đỏ sẫm:
 *   + 3 người chơi (2 người thua): Người thắng +40 (xanh), 2 người còn lại -20 (đỏ).
 *   + 4 người chơi (3 người thua): Người thắng +60 (xanh), 3 người còn lại -20 (đỏ).
 *   + 5 người chơi (4 người thua): Người thắng +80 (xanh), 4 người còn lại -20 (đỏ).
 */
function getScoreCellClass(score, roundScores) {
  const scoresArray = Object.values(roundScores || {});
  const losersCount = scoresArray.filter((s) => s === -20).length;

  // Trường hợp 2: Đánh Sâm (Xin làng thành công / Tới trắng)
  if (losersCount >= 2) {
    const expectedWin = losersCount * 20; // +40, +60, hoặc +80
    const hasSamWinner = scoresArray.some((s) => s === expectedWin);
    if (hasSamWinner) {
      if (score === expectedWin) return 'history-score-win';
      if (score === -20) return 'history-score-lose';
      return '';
    }
  }

  // Trường hợp 1: Chặn 2 (Chặt heo)
  if (score === 20) {
    return 'history-score-win';
  }
  if (score === -20) {
    return 'history-score-lose';
  }

  // Các trường hợp điểm số thông thường: không bôi màu nền
  return '';
}

/**
 * Tính số lần SÂM và CHÁY của từng người chơi dựa trên lịch sử ván đấu:
 * 
 * 1. Luật tính SÂM (Dành cho người thắng):
 * - Bàn 2 người: Người thắng được +20 điểm; 1 người thua bị -20 điểm.
 * - Bàn 3 người: Người thắng được +40 điểm; 2 người thua đều bị -20 điểm/người.
 * - Bàn 4 người: Người thắng được +60 điểm; 3 người thua đều bị -20 điểm/người.
 * - Bàn 5 người: Người thắng được +80 điểm; 4 người thua đều bị -20 điểm/người.
 *
 * 2. Luật tính CHÁY (Dành cho người thua):
 * - Bất kỳ người chơi nào kết thúc ván đấu với số điểm là -20 điểm sẽ bị hệ thống ghi nhận là "1 Cháy".
 */
export function calculateSamAndChay(history, players) {
  const samCount = {};
  const chayCount = {};

  players.forEach((p) => {
    samCount[p.id] = 0;
    chayCount[p.id] = 0;
  });

  if (!history || history.length === 0) {
    return { samCount, chayCount };
  }

  history.forEach((round) => {
    const scores = round.scores || {};

    // 1. TÍNH CHÁY: Bất kỳ người chơi nào có điểm kết thúc ván là -20
    players.forEach((p) => {
      if (scores[p.id] === -20) {
        chayCount[p.id] = (chayCount[p.id] || 0) + 1;
      }
    });

    // 2. TÍNH SÂM:
    const losersMinus20 = players.filter((p) => scores[p.id] === -20);
    const loserCount = losersMinus20.length;

    // Quy mô bàn chơi từ 2 đến 5 người tương ứng 1 đến 4 người thua bị -20
    if (loserCount >= 1 && loserCount <= 4) {
      const expectedWinScore = loserCount * 20; // 1->+20, 2->+40, 3->+60, 4->+80
      const winners = players.filter((p) => scores[p.id] === expectedWinScore);

      if (winners.length === 1) {
        const winner = winners[0];
        // Đảm bảo những người còn lại (không thắng và không bị -20) đều có điểm bằng 0
        const others = players.filter((p) => p.id !== winner.id && scores[p.id] !== -20);
        const allOthersZero = others.every((p) => (scores[p.id] || 0) === 0);

        if (allOthersZero) {
          samCount[winner.id] = (samCount[winner.id] || 0) + 1;
        }
      }
    }
  });

  return { samCount, chayCount };
}

function HistoryTableContent({
  players,
  reversedHistory,
  isExpanded,
  onToggle,
  listRef,
  cumulativeScores = {},
  samCount = {},
  chayCount = {},
  onChotSo
}) {
  return (
    <>
      {/* Header Bảng Lịch Sử (Icon Phóng to/Thu nhỏ + 5 tên người chơi và điểm tích luỹ) */}
      <div className={`history-header ${isExpanded ? 'expanded-header' : ''}`}>
        {/* Cột Phóng to / Thu nhỏ */}
        <div className="history-trophy-col">
          <button
            type="button"
            className="history-toggle-btn"
            onClick={onToggle}
            title={isExpanded ? 'Thu nhỏ bảng lịch sử điểm' : 'Phóng to xem toàn bộ bảng lịch sử điểm'}
            aria-label={isExpanded ? 'Thu nhỏ bảng lịch sử điểm' : 'Phóng to xem toàn bộ bảng lịch sử điểm'}
          >
            {isExpanded ? <CompressIcon /> : <ExpandIcon />}
          </button>
        </div>

        {/* 5 Cột Tên Người Chơi (và Điểm tích luỹ hiện ngay dưới tên khi phóng to) */}
        <div className="history-names-group">
          {players.map((player, index) => {
            const totalScore = cumulativeScores[player.id] !== undefined ? cumulativeScores[player.id] : 0;
            return (
              <div
                key={player.id}
                className={`history-name-col text-p${index + 1}`}
                title={player.name}
              >
                <span className="history-name-text">
                  {player.name ? player.name.toUpperCase() : ''}
                </span>
                {isExpanded && (
                  <span className="history-cumulative-score">
                    {totalScore}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Danh Sách Ván Đấu (Ván mới nhất lên trên cùng) */}
      <div className="history-list" ref={listRef}>
        {/* Khi chưa có ván đấu nào: vẫn hiện hàng #1 với số điểm bỏ trống */}
        {reversedHistory.length === 0 ? (
          <div className="history-row">
            <div className="history-round-num">#1</div>
            {players.map((player) => (
              <div key={player.id} className="history-score-cell">
                {/* Bỏ trống điểm */}
              </div>
            ))}
          </div>
        ) : (
          reversedHistory.map((round) => {
            const roundNum = round.roundNumber;
            const scores = round.scores || {};

            return (
              <div key={round.id || roundNum} className="history-row">
                {/* Cột Số Thứ Tự Ván */}
                <div className="history-round-num">
                  #{roundNum}
                </div>

                {/* 5 Cột Điểm của từng người chơi với quy tắc bôi màu tự động */}
                {players.map((player) => {
                  const score = scores[player.id] || 0;
                  const highlightClass = getScoreCellClass(score, scores);

                  return (
                    <div
                      key={player.id}
                      className={`history-score-cell ${highlightClass}`}
                    >
                      {score}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hiển thị khi phóng to: Dòng SÂM, Dòng CHÁY và Nút CHỐT SỔ */}
      {isExpanded && (
        <div className="history-expanded-footer">
          {/* 1. Dòng SÂM */}
          <div className="history-stat-row">
            <div className="history-stat-label text-sam">SÂM</div>
            <div className="history-stat-cells">
              {players.map((player) => {
                const count = samCount[player.id] || 0;
                return (
                  <div key={player.id} className="history-stat-cell">
                    {count > 0 ? (
                      <span className="stat-num text-sam">{count}</span>
                    ) : (
                      <span className="stat-dash">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Dòng CHÁY */}
          <div className="history-stat-row">
            <div className="history-stat-label text-chay">CHÁY</div>
            <div className="history-stat-cells">
              {players.map((player) => {
                const count = chayCount[player.id] || 0;
                return (
                  <div key={player.id} className="history-stat-cell">
                    {count > 0 ? (
                      <span className="stat-num text-chay">{count}</span>
                    ) : (
                      <span className="stat-dash">-</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 3. Nút CHỐT SỔ */}
          <button
            type="button"
            className="btn-chot-so"
            onClick={onChotSo || (() => alert('Tính năng Chốt Sổ & Thống kê điểm theo ngày đang được thiết lập!'))}
          >
            CHỐT SỔ
          </button>
        </div>
      )}
    </>
  );
}

export default function HistoryTable({
  players,
  history,
  cumulativeScores,
  onChotSo
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const listRef = useRef(null);

  // Tính số lần Sâm và Cháy từ danh sách ván đấu
  const { samCount, chayCount } = calculateSamAndChay(history, players);

  // Tính tổng điểm tích lũy của từng người chơi
  const finalCumulativeScores = cumulativeScores || players.reduce((acc, player) => {
    acc[player.id] = (history || []).reduce((sum, round) => sum + (round.scores?.[player.id] || 0), 0);
    return acc;
  }, {});

  // Nhấn Escape để đóng chế độ phóng to
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isExpanded) {
        setIsExpanded(false);
        setDragY(0);
        setIsDragging(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isExpanded]);

  // Reset drag position khi trạng thái isExpanded thay đổi
  useEffect(() => {
    if (!isExpanded) {
      setDragY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
      currentDragYRef.current = 0;
    }
  }, [isExpanded]);

  // Xử lý vuốt ngón tay trượt xuống để thu gọn (Swipe down gesture on touch)
  const handleTouchStart = (e) => {
    if (!isExpanded) return;
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    currentDragYRef.current = 0;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isExpanded) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    // Chỉ kích hoạt khi kéo xuống và hướng di chuyển chủ yếu là chiều dọc
    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      // Nếu danh sách đã cuộn xuống dưới, ưu tiên cho người dùng cuộn nội dung lên đầu trước
      if (listRef.current && listRef.current.scrollTop > 0) {
        return;
      }

      isDraggingRef.current = true;
      currentDragYRef.current = deltaY;
      setIsDragging(true);
      setDragY(deltaY);

      if (e.cancelable) {
        e.preventDefault();
      }
    }
  };

  const handleTouchEnd = () => {
    if (!isExpanded) return;
    if (isDraggingRef.current) {
      // Ngưỡng kéo xuống quá 70px thì thu gọn bảng lịch sử
      if (currentDragYRef.current > 70) {
        setIsExpanded(false);
      }
      setDragY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
      currentDragYRef.current = 0;
    }
  };

  // Hỗ trợ kéo chuột trên thanh tay cầm (Mouse drag on handle bar)
  const handlePointerDown = (e) => {
    if (!isExpanded) return;
    startYRef.current = e.clientY;
    currentDragYRef.current = 0;
    isDraggingRef.current = true;
    setIsDragging(true);
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current) return;
    const deltaY = e.clientY - startYRef.current;
    if (deltaY > 0) {
      currentDragYRef.current = deltaY;
      setDragY(deltaY);
    }
  };

  const handlePointerUp = () => {
    if (!isDraggingRef.current) return;
    if (currentDragYRef.current > 70) {
      setIsExpanded(false);
    }
    setDragY(0);
    setIsDragging(false);
    isDraggingRef.current = false;
    currentDragYRef.current = 0;
  };

  // Sắp xếp đảo ngược: ván mới nhất luôn lên đầu tiên
  const reversedHistory = [...history].reverse();

  return (
    <>
      {/* 1. Bảng lịch sử thông thường ở đáy màn hình */}
      <div className="history-section">
        <HistoryTableContent
          players={players}
          reversedHistory={reversedHistory}
          isExpanded={false}
          onToggle={() => setIsExpanded(true)}
          cumulativeScores={finalCumulativeScores}
          samCount={samCount}
          chayCount={chayCount}
        />
      </div>

      {/* 2. Bảng lịch sử toàn màn hình phóng to: Hỗ trợ ngón tay trượt xuống để thu gọn */}
      <div
        className={`history-expanded-drawer ${isExpanded ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''}`}
        style={
          isExpanded && isDragging && dragY > 0
            ? { transform: `translateY(${dragY}px)`, transition: 'none' }
            : undefined
        }
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Thanh tay cầm hiển thị trực quan để vuốt xuống */}
        <div
          className="drawer-drag-handle-bar"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onClick={() => setIsExpanded(false)}
          title="Vuốt xuống hoặc bấm để thu gọn"
        >
          <div className="drawer-drag-pill" />
        </div>

        <HistoryTableContent
          players={players}
          reversedHistory={reversedHistory}
          isExpanded={true}
          onToggle={() => setIsExpanded(false)}
          listRef={listRef}
          cumulativeScores={finalCumulativeScores}
          samCount={samCount}
          chayCount={chayCount}
          onChotSo={onChotSo}
        />
      </div>
    </>
  );
}
