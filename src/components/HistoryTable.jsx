import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ExpandIcon, SortScoreIcon, SortNameIcon } from './Icons';
import { ResetConfirmModal } from './Modals';

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
  sortedPlayers,
  reversedHistory,
  isExpanded,
  onToggle,
  listRef,
  cumulativeScores = {},
  samCount = {},
  chayCount = {},
  onChotSo,
  canReset = false,
  onResetClick,
  sortMode = 'score',
  onToggleSort
}) {
  return (
    <>
      {/* Header Bảng Lịch Sử (Icon Phóng to / Sắp xếp + 5 tên người chơi và điểm tích luỹ) */}
      <div className={`history-header ${isExpanded ? 'expanded-header' : ''}`}>
        {/* Cột Phóng to (khi thu gọn) / Sắp xếp (khi phóng to) */}
        <div className="history-trophy-col">
          {isExpanded ? (
            <button
              type="button"
              className="history-toggle-btn history-sort-btn"
              onClick={onToggleSort}
              title={
                sortMode === 'score'
                  ? 'Đang sắp xếp: Điểm cao -> thấp. Bấm để sắp xếp theo tên (A -> Z)'
                  : 'Đang sắp xếp: Tên A -> Z. Bấm để sắp xếp theo điểm (Cao -> Thấp)'
              }
              aria-label="Sắp xếp cột người chơi"
            >
              {sortMode === 'score' ? (
                <SortScoreIcon width={28} height={28} />
              ) : (
                <SortNameIcon width={28} height={28} />
              )}
            </button>
          ) : (
            <button
              type="button"
              className="history-toggle-btn"
              onClick={onToggle}
              title="Phóng to xem toàn bộ bảng lịch sử điểm"
              aria-label="Phóng to xem toàn bộ bảng lịch sử điểm"
            >
              <ExpandIcon />
            </button>
          )}
        </div>

        {/* 5 Cột Tên Người Chơi (và Điểm tích luỹ hiện ngay dưới tên khi phóng to) theo thứ tự sortedPlayers */}
        <div className="history-names-group">
          {sortedPlayers.map((player) => {
            const originalIndex = players.findIndex(p => p.id === player.id);
            const defaultName = String.fromCharCode(65 + (originalIndex >= 0 ? originalIndex : 0));
            const displayName = (player.name && player.name.trim()) ? player.name.trim().toUpperCase() : defaultName;
            const totalScore = cumulativeScores[player.id] !== undefined ? cumulativeScores[player.id] : 0;
            const colorClass = originalIndex >= 0 ? `text-p${originalIndex + 1}` : 'text-p1';

            return (
              <div
                key={player.id}
                className={`history-name-col ${colorClass}`}
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
            {sortedPlayers.map((player) => (
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

                {/* 5 Cột Điểm của từng người chơi theo thứ tự sortedPlayers */}
                {sortedPlayers.map((player) => {
                  const score = scores[player.id] || 0;
                  const highlightClass = getScoreCellClass(score);

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

      {/* Footer hiển thị khi phóng to: Dòng SÂM, Dòng CHÁY và Nhóm Nút RESET + SAVE */}
      {isExpanded && (
        <div className="history-expanded-footer">
          {/* 1. Dòng SÂM */}
          <div className="history-stat-row">
            <div className="history-stat-label text-sam">SÂM</div>
            <div className="history-stat-cells">
              {sortedPlayers.map((player) => {
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
              {sortedPlayers.map((player) => {
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

          {/* 3. Nhóm nút điều khiển: RESET (bên cạnh) và SAVE (thay cho CHỐT SỔ) */}
          <div className="history-footer-actions">
            <button
              type="button"
              className="btn-history-reset"
              onClick={onResetClick}
              disabled={!canReset}
              title={canReset ? "Reset toàn bộ điểm về 0" : "Chưa có thay đổi nào để reset"}
            >
              RESET
            </button>

            <button
              type="button"
              className="btn-chot-so btn-history-save"
              onClick={() => {
                if (reversedHistory.length === 0) return;
                if (onChotSo) onChotSo();
                if (onToggle) onToggle(); // Đóng bottom sheet lịch sử điểm lại
              }}
              disabled={reversedHistory.length === 0}
              title={reversedHistory.length > 0 ? "Lưu sổ các ván đấu đã chơi" : "Chưa có dữ liệu nào để lưu"}
            >
              SAVE
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function HistoryTable({
  players,
  history,
  cumulativeScores,
  onChotSo,
  canReset = false,
  onResetConfirm
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Chế độ sắp xếp cột: 'score' (Cao bên trái - thấp dần bên phải) | 'name' (A đến Z)
  const [sortMode, setSortMode] = useState('score');
  // Trạng thái modal xác nhận Reset
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const listRef = useRef(null);

  // Tính số lần Sâm và Cháy từ danh sách ván đấu
  const { samCount, chayCount } = calculateSamAndChay(history, players);

  // Tính tổng điểm tích lũy của từng người chơi
  const finalCumulativeScores = useMemo(() => {
    if (cumulativeScores) return cumulativeScores;
    return players.reduce((acc, player) => {
      acc[player.id] = (history || []).reduce((sum, round) => sum + (round.scores?.[player.id] || 0), 0);
      return acc;
    }, {});
  }, [cumulativeScores, players, history]);

  // Sắp xếp danh sách người chơi theo sortMode:
  // - 'score': Điểm cao bên trái, điểm thấp dần sang phải
  // - 'name': Tên người chơi từ A đến Z
  const sortedPlayers = useMemo(() => {
    const list = [...players];
    if (sortMode === 'score') {
      return list.sort((a, b) => {
        const scoreA = finalCumulativeScores[a.id] ?? 0;
        const scoreB = finalCumulativeScores[b.id] ?? 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA; // Cao bên trái - thấp dần bên phải
        }
        // Điểm bằng nhau thì giữ thứ tự người chơi ban đầu
        const idxA = players.findIndex(p => p.id === a.id);
        const idxB = players.findIndex(p => p.id === b.id);
        return idxA - idxB;
      });
    } else {
      // sortMode === 'name': A đến Z
      return list.sort((a, b) => {
        const idxA = players.findIndex(p => p.id === a.id);
        const idxB = players.findIndex(p => p.id === b.id);
        const defaultNameA = String.fromCharCode(65 + (idxA >= 0 ? idxA : 0));
        const defaultNameB = String.fromCharCode(65 + (idxB >= 0 ? idxB : 0));
        const nameA = (a.name && a.name.trim()) ? a.name.trim().toUpperCase() : defaultNameA;
        const nameB = (b.name && b.name.trim()) ? b.name.trim().toUpperCase() : defaultNameB;
        return nameA.localeCompare(nameB, 'vi');
      });
    }
  }, [players, sortMode, finalCumulativeScores]);

  // Chuyển đổi chế độ sắp xếp khi bấm vào icon
  const handleToggleSort = () => {
    setSortMode(prev => (prev === 'score' ? 'name' : 'score'));
  };

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
  const reversedHistory = useMemo(() => [...(history || [])].reverse(), [history]);

  return (
    <>
      {/* 1. Bảng lịch sử thông thường ở đáy màn hình */}
      <div className="history-section">
        <HistoryTableContent
          players={players}
          sortedPlayers={sortedPlayers}
          reversedHistory={reversedHistory}
          isExpanded={false}
          onToggle={() => setIsExpanded(true)}
          cumulativeScores={finalCumulativeScores}
          samCount={samCount}
          chayCount={chayCount}
          sortMode={sortMode}
          onToggleSort={handleToggleSort}
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
          sortedPlayers={sortedPlayers}
          reversedHistory={reversedHistory}
          isExpanded={true}
          onToggle={() => setIsExpanded(false)}
          listRef={listRef}
          cumulativeScores={finalCumulativeScores}
          samCount={samCount}
          chayCount={chayCount}
          onChotSo={onChotSo}
          canReset={canReset}
          onResetClick={() => canReset && setIsResetModalOpen(true)}
          sortMode={sortMode}
          onToggleSort={handleToggleSort}
        />
      </div>

      {/* 3. Popup Cảnh Báo Reset Trận Đấu */}
      <ResetConfirmModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        onConfirm={() => {
          if (onResetConfirm) onResetConfirm();
          setIsResetModalOpen(false);
        }}
      />
    </>
  );
}
