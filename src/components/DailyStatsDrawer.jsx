import React, { useState, useEffect, useRef, useMemo } from 'react';

/**
 * Bảng Thống Kê Điểm Theo Ngày (Daily Stats Ledger)
 * 
 * - Trượt xuống (Swipe/Drag down) để đóng trang
 * - Nền mờ blur và tối:
 *     background-color: rgba(0, 0, 0, 0.85);
 *     backdrop-filter: blur(5px);
 * - Có thể có rất nhiều người chơi: Trượt trái/phải xem từng người
 * - Cột ngày tháng và nút Close được ghim cố định bên trái (Sticky left)
 * - Toàn bộ chữ font-weight: 800 đồng nhất
 */
export default function DailyStatsDrawer({
  isOpen,
  onClose,
  players = [],
  dailyLedger = []
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const scrollRef = useRef(null);

  // Đóng khi bấm phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset drag position khi trạng thái isOpen thay đổi
  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
      currentDragYRef.current = 0;
    }
  }, [isOpen]);

  // Xử lý vuốt ngón tay trượt xuống để đóng (Swipe down gesture on touch)
  const handleTouchStart = (e) => {
    if (!isOpen) return;
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    currentDragYRef.current = 0;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e) => {
    if (!isOpen) return;
    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;

    // Chỉ kích hoạt khi kéo xuống và hướng di chuyển chủ yếu là chiều dọc
    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (scrollRef.current && scrollRef.current.scrollTop > 0) {
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
    if (!isOpen) return;
    if (isDraggingRef.current) {
      // Ngưỡng kéo xuống quá 70px thì đóng
      if (currentDragYRef.current > 70) {
        onClose();
      }
      setDragY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
      currentDragYRef.current = 0;
    }
  };

  // Hỗ trợ kéo chuột trên thanh tay cầm (Mouse drag on handle bar)
  const handlePointerDown = (e) => {
    if (!isOpen) return;
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
      onClose();
    }
    setDragY(0);
    setIsDragging(false);
    isDraggingRef.current = false;
    currentDragYRef.current = 0;
  };

  // Tập hợp danh sách tất cả người chơi từng tham gia (kết hợp người chơi hiện tại và các ngày cũ)
  const allPlayers = useMemo(() => {
    const playerMap = new Map();
    // 1. Thêm người chơi hiện tại
    players.forEach((p, idx) => {
      playerMap.set(p.id, {
        id: p.id,
        name: p.name?.trim() ? p.name.trim().toUpperCase() : String.fromCharCode(65 + idx), // A, B, C, D, E...
        color: p.color
      });
    });
    // 2. Tìm thêm người chơi từ các ngày cũ (nếu có)
    dailyLedger.forEach((entry) => {
      if (entry.scores) {
        Object.keys(entry.scores).forEach((pId) => {
          if (!playerMap.has(pId)) {
            playerMap.set(pId, {
              id: pId,
              name: pId.toUpperCase(),
              color: '#ffffff'
            });
          }
        });
      }
    });
    return Array.from(playerMap.values());
  }, [players, dailyLedger]);

  // Tính tổng số điểm tích luỹ của từng người chơi qua các ngày đã chốt sổ
  const totalScoresByPlayer = useMemo(() => {
    const totals = {};
    allPlayers.forEach(p => { totals[p.id] = 0; });
    dailyLedger.forEach(entry => {
      if (entry.scores) {
        Object.entries(entry.scores).forEach(([pId, score]) => {
          totals[pId] = (totals[pId] || 0) + (score || 0);
        });
      }
    });
    return totals;
  }, [allPlayers, dailyLedger]);

  return (
    <div
      className={`daily-stats-drawer ${isOpen ? 'is-open' : ''} ${isDragging ? 'is-dragging' : ''}`}
      style={
        isOpen && isDragging && dragY > 0
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
        onClick={onClose}
        title="Vuốt xuống hoặc bấm để thu gọn"
      >
        <div className="drawer-drag-pill" />
      </div>

      {/* Vùng cuộn 2 chiều: Cuộn ngang cho danh sách nhiều người chơi & Cuộn dọc cho danh sách ngày */}
      <div className="daily-stats-scroll-area" ref={scrollRef}>
        <table className="daily-stats-table">
          <thead>
            <tr className="stats-header-row">
              {/* Ô góc trên cùng bên trái: Ghim cả Top và Left, chứa nút Close [✕] */}
              <th className="stats-th-sticky stats-th-close">
                <button
                  type="button"
                  className="stats-close-btn"
                  onClick={onClose}
                  title="Đóng bảng thống kê"
                  aria-label="Đóng"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </th>

              {/* Các cột người chơi: Tên người chơi và Tổng điểm tích luỹ */}
              {allPlayers.map((player) => {
                const total = totalScoresByPlayer[player.id] || 0;
                return (
                  <th key={player.id} className="stats-th-player">
                    <div className="stats-player-head-box">
                      <span className="stats-player-name" style={{ color: player.color }}>
                        {player.name}
                      </span>
                      <span className="stats-player-score" style={{ color: player.color }}>
                        {total}
                      </span>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {dailyLedger.length === 0 ? (
              <tr>
                <td colSpan={allPlayers.length + 1} className="stats-empty-cell">
                  <div className="stats-empty-state">
                    <p className="stats-empty-title">Chưa có ngày chốt sổ nào</p>
                    <p className="stats-empty-sub">
                      Hãy hoàn thành các ván đấu và bấm nút <strong>CHỐT SỔ</strong> ở Bảng lịch sử điểm để lưu số liệu theo ngày!
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              dailyLedger.map((entry) => {
                return (
                  <tr key={entry.id} className="stats-data-row">
                    {/* Cột Ngày/Tháng (Ghim cố định bên trái khi lướt ngang) */}
                    <td className="stats-td-sticky stats-td-date">
                      {entry.dateStr}
                    </td>

                    {/* Các cột điểm tương ứng của từng người chơi theo ngày */}
                    {allPlayers.map((player) => {
                      const score = entry.scores?.[player.id];
                      const isScoreDefined = score !== undefined && score !== null;

                      return (
                        <td key={player.id} className="stats-td-score">
                          {isScoreDefined ? (
                            <span className="stats-score-value">
                              {score}
                            </span>
                          ) : (
                            <span className="stats-score-dash">-</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
