import React, { useState, useEffect, useRef, useMemo } from 'react';
import { PLAYER_COLORS_10 } from '../constants/sampleLedger';
import { TrashIcon, SortScoreIcon, SortNameIcon } from './Icons';

/**
 * Bảng Thống Kê Điểm Theo Lần Chốt Sổ (Daily Stats Ledger)
 * 
 * - Trượt xuống (Swipe/Drag down) để đóng trang
 * - Nền mờ blur và tối:
 *     background-color: rgba(0, 0, 0, 0.85);
 *     backdrop-filter: blur(5px);
 * - Có thể có nhiều hơn 5 người chơi (Tối đa 10 người)
 * - Cho phép xem người thứ 6, 7, 8 bằng cách trượt ngang sang phải
 * - Cột thứ tự và nút Sắp xếp được ghim cố định bên trái (Sticky left)
 * - Toàn bộ chữ font-weight: 800 đồng nhất
 * - Bấm vào thứ tự (Vd: #6) để hiển thị icon thùng rác màu đỏ, nền đỏ rượu, cả dòng đỏ mờ 10% để xoá
 */
export default function DailyStatsDrawer({
  isOpen,
  onClose,
  players = [],
  dailyLedger = [],
  onDeleteLedgerEntry
}) {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  // Chế độ sắp xếp cột: 'score' (Cao bên trái - thấp dần bên phải) | 'name' (A đến Z)
  const [sortMode, setSortMode] = useState('score');

  const handleToggleSort = () => {
    setSortMode(prev => (prev === 'score' ? 'name' : 'score'));
  };

  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const currentDragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const scrollRef = useRef(null);

  // Đóng khi bấm phím Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (pendingDeleteId) {
          setPendingDeleteId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, pendingDeleteId]);

  // Reset drag position và trạng thái xoá khi trạng thái isOpen thay đổi
  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      setIsDragging(false);
      isDraggingRef.current = false;
      currentDragYRef.current = 0;
      setPendingDeleteId(null);
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

  // =========================================================================
  // XÂY DỰNG DANH SÁCH TIÊU ĐỀ CỘT (MASTER LIST) & XỬ LÝ MẢNG DỮ LIỆU
  //
  // 1. Kiểm tra trùng lặp (Deduplication):
  //    So sánh từng người chơi với Master List bằng find() / some() theo tên/ID.
  // 2. Cập nhật dữ liệu cho người cũ (Merge):
  //    Nếu tên người chơi đã tồn tại trong bảng, tuyệt đối không tạo thêm cột mới.
  //    Giữ nguyên vị trí (index) của người này, cộng dồn điểm mới vào tổng điểm cột.
  // 3. Thêm cột mới vào bên phải cho người mới:
  //    Nếu phát hiện tên người chơi hoàn toàn mới, push vào cuối mảng Master List
  //    để cột xuất hiện ở ngoài cùng bên phải. Các hàng trước đó tự động điền 0 hoặc -.
  // 4. Xử lý khoảng trống (Null/Undefined):
  //    Mỗi hàng sinh ra khớp chính xác số lượng ô <td> với tổng số cột <th>.
  // =========================================================================
  const masterPlayers = useMemo(() => {
    const masterList = [];

    // Sắp xếp các lần chốt sổ theo thứ tự thời gian tăng dần (#1 -> #2 -> #3...)
    // để xác định thứ tự cột ban đầu và lần lượt thêm người mới sang phải
    const chronologicalLedger = [...dailyLedger].sort((a, b) => {
      const idxA = a.roundIndex || 0;
      const idxB = b.roundIndex || 0;
      if (idxA !== idxB) return idxA - idxB;
      return (a.timestamp || 0) - (b.timestamp || 0);
    });

    chronologicalLedger.forEach((entry) => {
      // 1. Duyệt playersInfo của entry
      if (entry.playersInfo && Array.isArray(entry.playersInfo)) {
        entry.playersInfo.forEach((pInfo) => {
          const rawName = pInfo.name || pInfo.id;
          if (!rawName) return;
          const cleanName = rawName.trim().toUpperCase();
          if (!cleanName) return;

          // Deduplication: Dùng find() kiểm tra xem người chơi này đã có trong Master List chưa
          const exists = masterList.find(
            (col) => col.name.toUpperCase() === cleanName || (col.id && col.id.toUpperCase() === cleanName)
          );

          if (!exists) {
            // Người chơi mới hoàn toàn: PUSH vào cuối mảng để cột xuất hiện ở ngoài cùng bên phải
            masterList.push({
              id: cleanName,
              name: cleanName,
              color: pInfo.color || PLAYER_COLORS_10[masterList.length % PLAYER_COLORS_10.length]
            });
          }
        });
      } else if (entry.scores) {
        // Fallback an toàn cho dữ liệu cũ nếu không có playersInfo:
        // Lọc bỏ các key ghế nội bộ p1..p5
        Object.keys(entry.scores).forEach((sKey) => {
          if (/^p[1-5]$/i.test(sKey)) return;
          const cleanName = sKey.trim().toUpperCase();
          if (!cleanName) return;

          const exists = masterList.find(
            (col) => col.name.toUpperCase() === cleanName || (col.id && col.id.toUpperCase() === cleanName)
          );

          if (!exists) {
            masterList.push({
              id: cleanName,
              name: cleanName,
              color: PLAYER_COLORS_10[masterList.length % PLAYER_COLORS_10.length]
            });
          }
        });
      }
    });

    // Giới hạn tối đa 10 người chơi theo thiết kế
    return masterList.slice(0, 10);
  }, [dailyLedger]);

  // Hàm lấy điểm của 1 người chơi trong 1 lần chốt sổ cụ thể
  const getPlayerScore = (entry, player) => {
    if (!entry || !entry.scores) return undefined;
    const targetName = player.name.toUpperCase();

    // 1. Tìm trực tiếp theo tên chuẩn trong object scores
    for (const key of Object.keys(entry.scores)) {
      if (key.trim().toUpperCase() === targetName) {
        return entry.scores[key];
      }
    }

    // 2. Tra cứu qua playersInfo của entry nếu có
    if (entry.playersInfo && Array.isArray(entry.playersInfo)) {
      const match = entry.playersInfo.find(
        (p) =>
          (p.name && p.name.trim().toUpperCase() === targetName) ||
          (p.id && p.id.trim().toUpperCase() === targetName)
      );
      if (match) {
        if (entry.scores[match.name] !== undefined) return entry.scores[match.name];
        if (entry.scores[match.id] !== undefined) return entry.scores[match.id];
      }
    }

    return undefined;
  };

  // Tính tổng số điểm tích luỹ của từng cột người chơi qua tất cả các lần chốt sổ
  // (Cộng dồn điểm mới vào tổng điểm của cột hiện tại)
  const totalScoresByPlayer = useMemo(() => {
    const totals = {};
    masterPlayers.forEach((p) => { totals[p.name] = 0; });

    dailyLedger.forEach((entry) => {
      masterPlayers.forEach((p) => {
        const score = getPlayerScore(entry, p);
        if (score !== undefined && score !== null && !isNaN(score)) {
          totals[p.name] = (totals[p.name] || 0) + Number(score);
        }
      });
    });

    return totals;
  }, [masterPlayers, dailyLedger]);

  // Sắp xếp các cột người chơi theo sortMode:
  // - 'score': Tổng điểm cao bên trái, thấp dần sang phải
  // - 'name': Tên người chơi từ A đến Z
  const displayPlayers = useMemo(() => {
    const list = [...masterPlayers];
    if (sortMode === 'score') {
      return list.sort((a, b) => {
        const scoreA = totalScoresByPlayer[a.name] ?? 0;
        const scoreB = totalScoresByPlayer[b.name] ?? 0;
        if (scoreB !== scoreA) {
          return scoreB - scoreA;
        }
        return a.name.localeCompare(b.name, 'vi');
      });
    } else {
      return list.sort((a, b) => {
        return a.name.localeCompare(b.name, 'vi');
      });
    }
  }, [masterPlayers, sortMode, totalScoresByPlayer]);

  // Sắp xếp các lần chốt sổ theo thứ tự mới nhất nằm trên cùng (#6 -> #5 -> #4 -> ... -> #1)
  const sortedLedger = useMemo(() => {
    const list = [...dailyLedger];
    return list.sort((a, b) => {
      const idxA = a.roundIndex || 0;
      const idxB = b.roundIndex || 0;
      if (idxA !== idxB) {
        return idxB - idxA;
      }
      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }, [dailyLedger]);

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

      {/* Vùng cuộn dọc chung cho cả Khối 1 và Khối 2 */}
      <div 
        className="daily-stats-v-scroll" 
        ref={scrollRef}
        onClick={() => {
          if (pendingDeleteId) setPendingDeleteId(null);
        }}
      >
        <div className="daily-stats-panels-wrapper">
          {/* Khối 1 (Fixed Panel - Bên trái):
              - Chứa nút 'X' và các mốc thứ tự ván (#1, #2, #3...).
              - Chiều rộng cố định 54px, không cho phép cuộn ngang (overflow-x: hidden).
              - Nền hoàn toàn trong suốt (transparent). */}
          <div className="daily-stats-fixed-panel">
            {/* Header cell: Nút Sắp xếp (Thay thế icon Close) */}
            <div className="stats-fixed-header-cell">
              <button
                type="button"
                className="stats-sort-btn"
                onClick={handleToggleSort}
                title={
                  sortMode === 'score'
                    ? 'Đang sắp xếp: Điểm cao -> thấp. Bấm để sắp xếp theo tên (A -> Z)'
                    : 'Đang sắp xếp: Tên A -> Z. Bấm để sắp xếp theo điểm (Cao -> Thấp)'
                }
                aria-label="Sắp xếp cột người chơi"
              >
                {sortMode === 'score' ? (
                  <SortScoreIcon width={24} height={24} />
                ) : (
                  <SortNameIcon width={24} height={24} />
                )}
              </button>
            </div>

            {/* Danh sách các ô thứ tự lần chốt sổ (#6, #5... hoặc thùng rác) */}
            <div className="stats-fixed-body">
              {sortedLedger.map((entry, idx) => {
                const roundLabel = entry.label || (entry.roundIndex ? `#${entry.roundIndex}` : (entry.dateStr || `#${sortedLedger.length - idx}`));
                const isDeleting = pendingDeleteId === entry.id;

                return (
                  <div 
                    key={entry.id} 
                    className={`stats-fixed-row-cell ${isDeleting ? 'is-deleting' : ''}`}
                  >
                    {isDeleting ? (
                      <button
                        type="button"
                        className="stats-trash-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onDeleteLedgerEntry) {
                            onDeleteLedgerEntry(entry.id);
                          }
                          setPendingDeleteId(null);
                        }}
                        title="Bấm để xác nhận xoá lần chốt sổ này"
                        aria-label="Xoá lần chốt sổ"
                      >
                        <TrashIcon width={20} height={20} color="#fd6161" />
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="stats-round-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingDeleteId(entry.id);
                        }}
                        title={`Bấm để xoá ${roundLabel}`}
                        aria-label={`Xoá ${roundLabel}`}
                      >
                        {roundLabel}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Khối 2 (Scrollable Panel - Bên phải):
              - Chứa danh sách tên người chơi và các ô điểm số.
              - width: calc(100% - 54px); overflow-x: auto;
              - Cuộn ngầm bên trong phạm vi Khối 2, biến mất khi chạm mép trái Khối 2, không trượt sang Khối 1. */}
          <div className="daily-stats-scrollable-panel">
            <div className="stats-scrollable-track">
              {/* Header row: Tên người chơi và Tổng điểm tích luỹ theo displayPlayers (Dương: xanh, Âm: đỏ, 0: trắng) */}
              <div className="stats-scrollable-header-row">
                {displayPlayers.map((player) => {
                  const total = totalScoresByPlayer[player.name] || 0;
                  const statusClass = total > 0 ? 'is-pos' : total < 0 ? 'is-neg' : 'is-zero';
                  return (
                    <div key={player.name} className={`stats-player-head-cell ${statusClass}`}>
                      <span className="stats-player-name">
                        {player.name}
                      </span>
                      <span className="stats-player-score">
                        {total}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Danh sách các dòng điểm số tương ứng khớp chính xác với displayPlayers */}
              <div className="stats-scrollable-body">
                {sortedLedger.map((entry) => {
                  const isDeleting = pendingDeleteId === entry.id;

                  return (
                    <div 
                      key={entry.id} 
                      className={`stats-scrollable-data-row ${isDeleting ? 'is-deleting' : ''}`}
                    >
                      {displayPlayers.map((player) => {
                        const score = getPlayerScore(entry, player);
                        const isScoreDefined = score !== undefined && score !== null;
                        const numScore = isScoreDefined ? Number(score) : null;
                        const scoreClass = numScore !== null
                          ? (numScore > 0 ? 'is-pos' : numScore < 0 ? 'is-neg' : 'is-zero')
                          : '';

                        return (
                          <div 
                            key={player.name} 
                            className="stats-score-cell"
                            onClick={() => {
                              if (pendingDeleteId) setPendingDeleteId(null);
                            }}
                          >
                            {isScoreDefined ? (
                              <span className={`stats-score-value ${scoreClass}`}>
                                {score}
                              </span>
                            ) : (
                              <span className="stats-score-dash">-</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
