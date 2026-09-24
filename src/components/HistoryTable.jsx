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
 *
 * Các ván thông thường khác: Giữ nền mặc định để nổi bật các ván bước ngoặt.
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

function HistoryTableContent({
  players,
  reversedHistory,
  isExpanded,
  onToggle,
  listRef
}) {
  return (
    <>
      {/* Header Bảng Lịch Sử (Icon Phóng to/Thu nhỏ + 5 tên người chơi căn trái, ellipsis nếu dài) */}
      <div className="history-header">
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

        {/* 5 Cột Tên Người Chơi (Căn trái, hiển thị ... nếu tên quá dài) */}
        <div className="history-names-group">
          {players.map((player, index) => (
            <div
              key={player.id}
              className={`history-name-col text-p${index + 1}`}
              title={player.name}
            >
              <span className="history-name-text">
                {player.name ? player.name.toUpperCase() : ''}
              </span>
            </div>
          ))}
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
    </>
  );
}

export default function HistoryTable({
  players,
  history
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const listRef = useRef(null);

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
        />
      </div>
    </>
  );
}
