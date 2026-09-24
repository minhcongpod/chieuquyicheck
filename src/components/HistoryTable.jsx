import React, { useState, useEffect, useRef } from 'react';
import { ExpandIcon, CompressIcon } from './Icons';

/**
 * Quy tắc bôi màu nền tự động tại Bảng lịch sử điểm:
 *
 * 1. Bàn 3 người:
 * - Ô điểm +40: Bôi nền xanh. Hệ thống tự động cộng 1 Sâm vào thống kê của người chơi này.
 * - Ô điểm -40: Bôi nền đỏ.
 *
 * 2. Bàn 4 người:
 * - Ô điểm +60: Bôi nền xanh. Hệ thống tự động cộng 1 Sâm vào thống kê của người chơi này.
 * - Ô điểm -60: Bôi nền đỏ.
 *
 * 3. Bàn 5 người:
 * - Ô điểm +80: Bôi nền xanh. Hệ thống tự động cộng 1 Sâm vào thống kê của người chơi này.
 * - Ô điểm -80: Bôi nền đỏ.
 *
 * 4. Chặn 2 / Bàn 2 người / Cháy:
 * - Ô điểm +20: Bôi nền xanh.
 * - Ô điểm -20: Bôi nền đỏ (Hệ thống tự động cộng 1 Cháy).
 */
function getScoreCellClass(score) {
  // Điểm thắng (+20, +40, +60, +80): Bôi nền xanh
  if (score === 20 || score === 40 || score === 60 || score === 80) {
    return 'history-score-win';
  }

  // Điểm thua / đền sâm / cháy (-20, -40, -60, -80): Bôi nền đỏ
  if (score === -20 || score === -40 || score === -60 || score === -80) {
    return 'history-score-lose';
  }

  // Các trường hợp điểm số thông thường: không bôi màu nền
  return '';
}

/**
 * Tính số lần SÂM và CHÁY của từng người chơi dựa trên lịch sử ván đấu:
 * 
 * 1. Luật tính SÂM (Dành cho người thắng):
 * - Bàn 3 người: Ô điểm +40 -> Tự động cộng 1 Sâm vào thống kê của người chơi này.
 * - Bàn 4 người: Ô điểm +60 -> Tự động cộng 1 Sâm vào thống kê của người chơi này.
 * - Bàn 5 người: Ô điểm +80 -> Tự động cộng 1 Sâm vào thống kê của người chơi này.
 * - Bàn 2 người: Người thắng được +20 điểm (khi 1 người +20 và 1 người -20).
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

    players.forEach((p) => {
      const score = scores[p.id] || 0;

      // 1. TÍNH CHÁY: Bất kỳ người chơi nào có điểm kết thúc ván là -20
      if (score === -20) {
        chayCount[p.id] = (chayCount[p.id] || 0) + 1;
      }

      // 2. TÍNH SÂM:
      // - Ô điểm +40 (Bàn 3 người): tự động cộng 1 Sâm
      // - Ô điểm +60 (Bàn 4 người): tự động cộng 1 Sâm
      // - Ô điểm +80 (Bàn 5 người): tự động cộng 1 Sâm
      if (score === 40 || score === 60 || score === 80) {
        samCount[p.id] = (samCount[p.id] || 0) + 1;
      }

      // - Bàn 2 người: người thắng +20 khi có 1 người thua -20 (và các ghế còn lại = 0)
      if (score === 20) {
        const losersMinus20 = players.filter((other) => (scores[other.id] || 0) === -20);
        const nonZeroPlayers = players.filter((other) => (scores[other.id] || 0) !== 0);
        if (losersMinus20.length === 1 && nonZeroPlayers.length === 2) {
          samCount[p.id] = (samCount[p.id] || 0) + 1;
        }
      }
    });
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
            const defaultName = String.fromCharCode(65 + index);
            const displayName = (player.name && player.name.trim()) ? player.name.trim().toUpperCase() : defaultName;
            const totalScore = cumulativeScores[player.id] !== undefined ? cumulativeScores[player.id] : 0;
            return (
              <div
                key={player.id}
                className={`history-name-col text-p${index + 1}`}
                title={displayName}
              >
                <span className="history-name-text">
                  {displayName}
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

          {/* 3. Nút CHỐT SỔ: Ghi sổ và đóng bottom sheet Lịch sử điểm lại */}
          <button
            type="button"
            className="btn-chot-so"
            onClick={() => {
              if (onChotSo) onChotSo();
              if (onToggle) onToggle(); // Đóng bottom sheet lịch sử điểm lại
            }}
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
