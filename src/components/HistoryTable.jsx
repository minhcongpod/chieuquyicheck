import React, { useState, useEffect, useRef, useMemo } from 'react';
import { DEFAULT_RULES, getChayPoints, getSamWinnerId, getSamWinPoints } from '../constants/scoring';
import { ExpandIcon, SortScoreIcon, SortNameIcon, ResetIcon, CheckmarkIcon, CrossIcon } from './Icons';

/**
 * Quy tắc bôi màu nền tự động tại Bảng lịch sử điểm (định mức Sâm +25 / Cháy -15):
 *
 * 1. Ván Sâm (theo bàn, người còn lại đều -25):
 * - Bàn 2: người +25 | Bàn 3: người +50 | Bàn 4: người +75 | Bàn 5: người +100
 *   -> Người thắng Sâm nền xanh (+1 Sâm), những người còn lại nền đỏ.
 *
 * 2. Cháy:
 * - Ô điểm -15 hoặc -25: Bôi nền đỏ (Hệ thống tự động cộng 1 Cháy).
 */
function getScoreCellClass(score, playerId, samWinnerId, rules) {
  // Ván Sâm (theo bàn): người thắng Sâm nền xanh, những người còn lại nền đỏ
  if (samWinnerId) {
    if (playerId === samWinnerId) return 'history-score-win';
    if (score !== 0) return 'history-score-lose';
  }

  // Cháy (ngưỡng Cháy hoặc điểm thua Sâm): Bôi nền đỏ
  if (getChayPoints(rules).includes(score)) {
    return 'history-score-lose';
  }

  // Các trường hợp điểm số thông thường: không bôi màu nền
  return '';
}

/**
 * Tính số lần SÂM và CHÁY của từng người chơi dựa trên lịch sử ván đấu:
 */
function calculateSamAndChay(history, players, rules) {
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
    const samWinnerId = getSamWinnerId(scores, rules);
    const chayPoints = getChayPoints(rules);

    players.forEach((p) => {
      const score = scores[p.id] || 0;

      // 1. TÍNH CHÁY: Bất kỳ người chơi nào có điểm kết thúc ván bằng ngưỡng Cháy hoặc -samPoint
      if (chayPoints.includes(score)) {
        chayCount[p.id] = (chayCount[p.id] || 0) + 1;
      }

      // 2. TÍNH SÂM (theo bàn): người thắng nhận samPoint × (số người − 1), người còn lại -samPoint
      if (p.id === samWinnerId) {
        samCount[p.id] = (samCount[p.id] || 0) + 1;
      }
    });
  });

  return { samCount, chayCount };
}

// 2 dòng thống kê SÂM và CHÁY của từng người chơi (dùng ở màn chính và màn lịch sử phóng to)
function SamChayRows({ sortedPlayers, samCount, chayCount, onTriggerSamCelebration, rules }) {
  // Điểm hiển thị khi xem lại hiệu ứng Sâm: bàn 4 người theo luật hiện tại
  const replayPoints = getSamWinPoints(4, rules);
  return (
    <>
      {/* 1. Dòng SÂM */}
      <div className="history-stat-row">
        <div
          className="history-stat-label text-sam"
          style={{ cursor: onTriggerSamCelebration ? 'pointer' : 'default' }}
          onClick={() => onTriggerSamCelebration && onTriggerSamCelebration('CHIẾU QUỲ', replayPoints)}
          title="Bấm để xem lại hiệu ứng Sâm"
        >
          SÂM
        </div>
        <div className="history-stat-cells">
          {sortedPlayers.map((player) => {
            const count = samCount[player.id] || 0;
            return (
              <div
                key={player.id}
                className="history-stat-cell"
                style={{ cursor: count > 0 && onTriggerSamCelebration ? 'pointer' : 'default' }}
                onClick={() => count > 0 && onTriggerSamCelebration && onTriggerSamCelebration(player.name, replayPoints)}
                title={count > 0 ? `Bấm để xem lại hiệu ứng Sâm của ${player.name}` : undefined}
              >
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
    </>
  );
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
  onResetConfirm,
  sortMode = 'score',
  onToggleSort,
  isViewOnly = false,
  onTriggerSamCelebration,
  rules = DEFAULT_RULES
}) {
  // Trạng thái trượt xác nhận Reset inline trong footer
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  const footerActionsRef = useRef(null);

  // Tự động đóng trạng thái xác nhận khi click ra ngoài footer actions
  useEffect(() => {
    if (!isResetConfirming) return;
    const handleOutsideClick = (e) => {
      if (footerActionsRef.current && !footerActionsRef.current.contains(e.target)) {
        setIsResetConfirming(false);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [isResetConfirming]);

  // Reset trạng thái xác nhận khi đóng bảng lịch sử
  useEffect(() => {
    if (!isExpanded) {
      setIsResetConfirming(false);
    }
  }, [isExpanded]);

  // Xử lý bấm nút Reset (Đổi icon xoay tròn thành chữ RESET và trượt nút xác nhận)
  const handleResetButtonClick = () => {
    if (!canReset) return;
    setIsResetConfirming((prev) => !prev);
  };

  // Xác nhận Reset toàn bộ điểm
  const handleExecuteReset = () => {
    if (onResetConfirm) onResetConfirm();
    setIsResetConfirming(false);
    if (onToggle) onToggle(); // Đóng bottom sheet lại và ra màn hình chính như nút SAVE
  };

  // Hủy bỏ thao tác Reset
  const handleCancelReset = () => {
    setIsResetConfirming(false);
  };

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
            const originalIndex = players.findIndex((p) => p.id === player.id);
            const displayName = player.name && player.name.trim() ? player.name.trim().toUpperCase() : '';
            const totalScore = cumulativeScores[player.id] !== undefined ? cumulativeScores[player.id] : 0;
            const colorClass = originalIndex >= 0 ? `text-p${originalIndex + 1}` : 'text-p1';

            return (
              <div key={player.id} className={`history-name-col ${colorClass}`} title={displayName}>
                <span className="history-name-text">{displayName}</span>
                {isExpanded && <span className="history-cumulative-score">{totalScore}</span>}
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
            const samWinnerId = getSamWinnerId(scores, rules);

            return (
              <div key={round.id || roundNum} className="history-row">
                {/* Cột Số Thứ Tự Ván */}
                <div className="history-round-num">#{roundNum}</div>

                {/* 5 Cột Điểm của từng người chơi theo thứ tự sortedPlayers */}
                {sortedPlayers.map((player) => {
                  const score = scores[player.id] || 0;
                  const highlightClass = getScoreCellClass(score, player.id, samWinnerId, rules);

                  return (
                    <div key={player.id} className={`history-score-cell ${highlightClass}`}>
                      {score}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Màn chính: cụm SÂM / CHÁY ghim dưới cùng */}
      {!isExpanded && (
        <div className="history-main-stats">
          <SamChayRows
            sortedPlayers={sortedPlayers}
            samCount={samCount}
            chayCount={chayCount}
            rules={rules}
            onTriggerSamCelebration={onTriggerSamCelebration}
          />
        </div>
      )}

      {/* Footer hiển thị khi phóng to: Dòng SÂM, Dòng CHÁY và Nhóm Nút RESET + SAVE */}
      {isExpanded && (
        <div className="history-expanded-footer">
          <SamChayRows
            sortedPlayers={sortedPlayers}
            samCount={samCount}
            chayCount={chayCount}
            rules={rules}
            onTriggerSamCelebration={onTriggerSamCelebration}
          />

          {/* 3. Nhóm nút điều khiển: RESET và SAVE (Ẩn hoàn toàn khi ở quyền View-Only) */}
          {!isViewOnly && (
            <div className="history-footer-actions" ref={footerActionsRef}>
            {/* Cột Trái: Nút Reset (rộng 120px) */}
            <div className="history-reset-slot">
              <button
                type="button"
                className={`btn-history-reset ${isResetConfirming ? 'is-confirming' : ''}`}
                onClick={handleResetButtonClick}
                disabled={!canReset}
                title={
                  canReset
                    ? isResetConfirming
                      ? 'Bấm để hủy thao tác reset'
                      : 'Reset toàn bộ điểm về 0'
                    : 'Chưa có thay đổi nào để reset'
                }
                aria-label={isResetConfirming ? 'Hủy reset' : 'Reset toàn bộ điểm về 0'}
              >
                {isResetConfirming ? (
                  <span className="btn-reset-text">RESET</span>
                ) : (
                  <ResetIcon width={28} height={28} color="#000000" />
                )}
              </button>
            </div>

            {/* Cột Phải: Nút SAVE hoặc Bộ 2 nút [Xác nhận ✔] [Hủy ✖] trượt ra */}
            <div className="history-save-slot">
              {/* Nút SAVE mặc định */}
              <div className={`history-save-group ${isResetConfirming ? 'slide-left-out' : 'slide-in'}`}>
                <button
                  type="button"
                  className="btn-chot-so btn-history-save"
                  onClick={() => {
                    if (reversedHistory.length === 0 || isResetConfirming) return;
                    if (onChotSo) onChotSo();
                    if (onToggle) onToggle(); // Đóng bottom sheet lịch sử điểm lại
                  }}
                  disabled={reversedHistory.length === 0 || isResetConfirming}
                  title={reversedHistory.length > 0 ? 'Lưu sổ các ván đấu đã chơi' : 'Chưa có dữ liệu nào để lưu'}
                  tabIndex={isResetConfirming ? -1 : 0}
                >
                  SAVE
                </button>
              </div>

              {/* Bộ 2 nút xác nhận trượt ra: Xác nhận (Xanh ✔) và Hủy (Đỏ ✕) */}
              <div className={`history-confirm-group ${isResetConfirming ? 'slide-in' : 'slide-right-out'}`}>
                <button
                  type="button"
                  className="btn-history-confirm-yes"
                  onClick={handleExecuteReset}
                  title="Xác nhận Reset toàn bộ điểm"
                  tabIndex={isResetConfirming ? 0 : -1}
                >
                  <CheckmarkIcon width={28} height={28} color="#000000" />
                </button>

                <button
                  type="button"
                  className="btn-history-confirm-no"
                  onClick={handleCancelReset}
                  title="Hủy bỏ thao tác reset"
                  tabIndex={isResetConfirming ? 0 : -1}
                >
                  <CrossIcon width={28} height={28} color="#000000" />
                </button>
              </div>
            </div>
            </div>
          )}
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
  onResetConfirm,
  onExpandChange,
  isHidden = false,
  isViewOnly = false,
  onTriggerSamCelebration,
  rules = DEFAULT_RULES
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  // Chế độ sắp xếp cột: 'score' (Cao bên trái - thấp dần bên phải) | 'name' (A đến Z)
  const [sortMode, setSortMode] = useState('score');

  const prevExpandedRef = useRef(isExpanded);
  // Thông báo trạng thái phóng to/thu nhỏ cho component cha (App.jsx)
  useEffect(() => {
    if (prevExpandedRef.current !== isExpanded) {
      prevExpandedRef.current = isExpanded;
      if (onExpandChange) {
        onExpandChange(isExpanded);
      }
    }
  }, [isExpanded, onExpandChange]);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const listRef = useRef(null);

  // Tính số lần Sâm và Cháy từ danh sách ván đấu
  const { samCount, chayCount } = calculateSamAndChay(history, players, rules);

  // Tính tổng điểm tích lũy của từng người chơi
  const finalCumulativeScores = useMemo(() => {
    if (cumulativeScores) return cumulativeScores;
    return players.reduce((acc, player) => {
      acc[player.id] = (history || []).reduce((sum, round) => sum + (round.scores?.[player.id] || 0), 0);
      return acc;
    }, {});
  }, [cumulativeScores, players, history]);

  // Sắp xếp danh sách người chơi theo sortMode:
  // - 'score': Điểm cao bên trái, điểm thấp dần sang phải (nhóm trống ghim sang phải cùng)
  // - 'name': Tên người chơi từ A đến Z (người chưa có tên ghim sang phải cùng)
  const sortedPlayers = useMemo(() => {
    const list = [...players];
    if (sortMode === 'score') {
      return list.sort((a, b) => {
        const nameA = (a.name || '').trim();
        const scoreA = finalCumulativeScores[a.id] ?? 0;
        const isEmptyA = nameA === '' && scoreA === 0;

        const nameB = (b.name || '').trim();
        const scoreB = finalCumulativeScores[b.id] ?? 0;
        const isEmptyB = nameB === '' && scoreB === 0;

        // Nhóm trống luôn ghim sang phải (dưới cùng)
        if (isEmptyA && !isEmptyB) return 1;
        if (!isEmptyA && isEmptyB) return -1;
        if (isEmptyA && isEmptyB) {
          const idxA = players.findIndex((p) => p.id === a.id);
          const idxB = players.findIndex((p) => p.id === b.id);
          return idxA - idxB;
        }

        if (scoreB !== scoreA) {
          return scoreB - scoreA; // Cao bên trái - thấp dần bên phải
        }
        // Điểm bằng nhau thì giữ thứ tự người chơi ban đầu
        const idxA = players.findIndex((p) => p.id === a.id);
        const idxB = players.findIndex((p) => p.id === b.id);
        return idxA - idxB;
      });
    } else {
      // sortMode === 'name': A đến Z
      return list.sort((a, b) => {
        const nameA = a.name && a.name.trim() ? a.name.trim().toUpperCase() : '';
        const nameB = b.name && b.name.trim() ? b.name.trim().toUpperCase() : '';
        if (!nameA && nameB) return 1;
        if (nameA && !nameB) return -1;
        if (!nameA && !nameB) {
          const idxA = players.findIndex((p) => p.id === a.id);
          const idxB = players.findIndex((p) => p.id === b.id);
          return idxA - idxB;
        }
        return nameA.localeCompare(nameB, 'vi');
      });
    }
  }, [players, sortMode, finalCumulativeScores]);

  // Chuyển đổi chế độ sắp xếp khi bấm vào icon
  const handleToggleSort = () => {
    setSortMode((prev) => (prev === 'score' ? 'name' : 'score'));
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
      {/* 1. Bảng lịch sử thông thường ở đáy màn hình (Ẩn khi bàn phím mở) */}
      <div className={`history-section ${isHidden ? 'is-hidden' : ''}`}>
        <HistoryTableContent
          players={players}
          sortedPlayers={sortedPlayers}
          reversedHistory={reversedHistory}
          isExpanded={false}
          onToggle={() => setIsExpanded(true)}
          cumulativeScores={finalCumulativeScores}
          samCount={samCount}
          chayCount={chayCount}
          rules={rules}
          sortMode={sortMode}
          onToggleSort={handleToggleSort}
          isViewOnly={isViewOnly}
          onTriggerSamCelebration={onTriggerSamCelebration}
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
          rules={rules}
          onChotSo={onChotSo}
          canReset={canReset}
          onResetConfirm={onResetConfirm}
          sortMode={sortMode}
          onToggleSort={handleToggleSort}
          isViewOnly={isViewOnly}
          onTriggerSamCelebration={onTriggerSamCelebration}
        />
      </div>
    </>
  );
}
