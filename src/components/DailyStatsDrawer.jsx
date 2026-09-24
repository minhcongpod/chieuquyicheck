import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PLAYER_COLORS_10 } from '../constants/sampleLedger';

/**
 * Bảng Thống Kê Điểm Theo Ngày (Daily Stats Ledger)
 * 
 * - Trượt xuống (Swipe/Drag down) để đóng trang
 * - Nền mờ blur và tối:
 *     background-color: rgba(0, 0, 0, 0.85);
 *     backdrop-filter: blur(5px);
 * - Có thể có nhiều hơn 5 người chơi (Tối đa 10 người)
 * - Cho phép xem người thứ 6, 7, 8 bằng cách trượt ngang sang phải
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

  // Tập hợp danh sách tất cả người chơi từng tham gia (tối đa 10 người chơi)
  // Quy tắc: Những người đã có tên trong sổ từ các lần chốt trước sẽ giữ nguyên thứ tự cột bên trái.
  // Những người mới vào sau / chưa có tên trong sổ sẽ lần lượt xuất hiện tiếp sang bên phải.
  const allPlayers = useMemo(() => {
    const playerMap = new Map();

    // 1. Quét qua toàn bộ lịch sử dailyLedger theo thứ tự xuất hiện (#1, #2, #3...)
    dailyLedger.forEach((entry) => {
      if (entry.playersInfo && Array.isArray(entry.playersInfo)) {
        entry.playersInfo.forEach((pInfo) => {
          const rawName = pInfo.name?.trim();
          const key = rawName ? rawName.toUpperCase() : pInfo.id;
          if (!playerMap.has(key)) {
            playerMap.set(key, {
              id: key,
              originalId: pInfo.id,
              name: rawName ? rawName.toUpperCase() : key,
              color: pInfo.color || PLAYER_COLORS_10[playerMap.size % PLAYER_COLORS_10.length]
            });
          }
        });
      }

      if (entry.scores) {
        Object.keys(entry.scores).forEach((sKey) => {
          const keyUpper = sKey.toUpperCase();
          if (!playerMap.has(sKey) && !playerMap.has(keyUpper)) {
            const matchedP = players.find((p) => p.id === sKey);
            const name = matchedP?.name?.trim()?.toUpperCase() || keyUpper;
            playerMap.set(keyUpper, {
              id: keyUpper,
              originalId: sKey,
              name: name,
              color: matchedP?.color || PLAYER_COLORS_10[playerMap.size % PLAYER_COLORS_10.length]
            });
          }
        });
      }
    });

    // 2. Thêm những người chơi hiện đang ngồi tại bàn nếu họ chưa từng xuất hiện trong bất kỳ lần chốt sổ nào
    players.forEach((p, idx) => {
      const rawName = p.name?.trim();
      const displayName = rawName ? rawName.toUpperCase() : String.fromCharCode(65 + idx);
      const key = rawName ? rawName.toUpperCase() : p.id;
      if (!playerMap.has(key)) {
        playerMap.set(key, {
          id: key,
          originalId: p.id,
          name: displayName,
          color: p.color || PLAYER_COLORS_10[playerMap.size % PLAYER_COLORS_10.length]
        });
      }
    });

    // Giới hạn tối đa 10 người chơi theo yêu cầu
    return Array.from(playerMap.values()).slice(0, 10);
  }, [players, dailyLedger]);

  // Hàm lấy điểm của 1 người chơi trong 1 lần chốt sổ cụ thể
  const getPlayerScore = (entry, player) => {
    if (!entry.scores) return undefined;
    if (entry.scores[player.id] !== undefined) return entry.scores[player.id];
    if (entry.scores[player.name] !== undefined) return entry.scores[player.name];
    if (player.originalId && entry.scores[player.originalId] !== undefined) {
      return entry.scores[player.originalId];
    }
    return undefined;
  };

  // Tính tổng số điểm tích luỹ của từng người chơi qua các ngày đã chốt sổ
  const totalScoresByPlayer = useMemo(() => {
    const totals = {};
    allPlayers.forEach(p => { totals[p.id] = 0; });
    dailyLedger.forEach(entry => {
      allPlayers.forEach(p => {
        const score = getPlayerScore(entry, p);
        if (score !== undefined && score !== null) {
          totals[p.id] = (totals[p.id] || 0) + score;
        }
      });
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

              {/* Các cột người chơi: Tên người chơi và Tổng điểm tích luỹ (Tối đa 10 người, trượt ngang để xem) */}
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
                    <p className="stats-empty-title">Chưa có lần chốt sổ nào</p>
                    <p className="stats-empty-sub">
                      Hãy hoàn thành các ván đấu và bấm nút <strong>CHỐT SỔ</strong> ở Bảng lịch sử điểm để lưu số liệu!
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              dailyLedger.map((entry, idx) => {
                const roundLabel = entry.label || (entry.roundIndex ? `#${entry.roundIndex}` : (entry.dateStr || `#${idx + 1}`));
                return (
                  <tr key={entry.id} className="stats-data-row">
                    {/* Cột Lần Chốt Sổ (Ghim cố định bên trái khi lướt ngang) */}
                    <td className="stats-td-sticky stats-td-date">
                      {roundLabel}
                    </td>

                    {/* Các cột điểm tương ứng của từng người chơi theo ngày */}
                    {allPlayers.map((player) => {
                      const score = getPlayerScore(entry, player);
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
