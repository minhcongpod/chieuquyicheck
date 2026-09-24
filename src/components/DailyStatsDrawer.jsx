import React, { useEffect, useMemo } from 'react';

/**
 * Bảng thống kê điểm theo ngày (Daily Stats Ledger)
 * 
 * - Hàng trên cùng (Header):
 *   + Nút Close [✕] ở góc trái để đóng bảng
 *   + Tên người chơi và Tổng số điểm tích luỹ qua các ngày của họ
 *   + Hỗ trợ cuộn ngang (Swipe horizontal) khi có nhiều người chơi
 * 
 * - Các hàng bên dưới:
 *   + Cột bên trái: Ngày tháng (ví dụ: 24/9, 23/9, 12/9...) được ghim cố định (sticky)
 *   + Các cột bên phải: Số điểm tương ứng của từng người chơi theo ngày sau khi CHỐT SỔ
 *   + Hỗ trợ cuộn dọc vô tận (Infinite vertical scroll)
 */
export default function DailyStatsDrawer({
  isOpen,
  onClose,
  players = [],
  dailyLedger = []
}) {
  // Đóng khi bấm phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Tập hợp danh sách tất cả người chơi từng tham gia (kết hợp người chơi hiện tại và các ngày cũ)
  const allPlayers = useMemo(() => {
    const playerMap = new Map();
    // 1. Thêm người chơi hiện tại
    players.forEach((p, idx) => {
      playerMap.set(p.id, {
        id: p.id,
        name: p.name || String.fromCharCode(65 + idx), // A, B, C, D, E...
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

  // Tính tổng số điểm tích luỹ của từng người chơi qua TẤT CẢ các ngày đã chốt sổ
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

  if (!isOpen) return null;

  return (
    <div className="daily-stats-overlay" onClick={onClose}>
      <div className="daily-stats-container" onClick={(e) => e.stopPropagation()}>
        {/* Vùng cuộn 2 chiều: Cuộn ngang cho danh sách người chơi & Cuộn dọc cho danh sách ngày */}
        <div className="daily-stats-scroll-area">
          <table className="daily-stats-table">
            <thead>
              <tr className="stats-header-row">
                {/* Ô góc trên cùng bên trái: Ghim cố định và chứa nút Close ✕ */}
                <th className="stats-th-sticky stats-th-close">
                  <button
                    type="button"
                    className="stats-close-btn"
                    onClick={onClose}
                    title="Đóng bảng thống kê"
                    aria-label="Đóng"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="3.2" strokeLinecap="round">
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
    </div>
  );
}
