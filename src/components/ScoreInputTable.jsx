import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';

export default function ScoreInputTable({
  players,
  cumulativeScores,
  roundDeltas,
  onUpdatePlayerName,
  onOpenKeyboard
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [tempName, setTempName] = useState('');

  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const isFirstRender = useRef(true);

  const handleNameClick = (player) => {
    setEditingPlayerId(player.id);
    setTempName(player.name || '');
  };

  const handleNameSave = (playerId) => {
    onUpdatePlayerName(playerId, tempName.trim());
    setEditingPlayerId(null);
  };

  // Sắp xếp người chơi theo tổng điểm sau mỗi ván: Cao nhất trên cùng, thấp nhất dưới cùng
  const sortedPlayers = [...players].sort((a, b) => {
    const scoreA = cumulativeScores[a.id] || 0;
    const scoreB = cumulativeScores[b.id] || 0;
    if (scoreB !== scoreA) {
      return scoreB - scoreA; // Cao nhất trên cùng
    }
    // Khi bằng điểm, giữ thứ tự gốc ổn định (p1, p2, p3, p4, p5)
    return a.id.localeCompare(b.id);
  });

  // Hiệu ứng FLIP (First, Last, Invert, Play) chuyển đổi vị trí mượt mà khi thứ tự thay đổi
  useLayoutEffect(() => {
    if (isFirstRender.current) {
      // Lưu vị trí ban đầu của 5 người chơi
      sortedPlayers.forEach((player) => {
        const el = rowRefs.current[player.id];
        if (el) {
          prevPositions.current[player.id] = el.getBoundingClientRect().top;
        }
      });
      isFirstRender.current = false;
      return;
    }

    const animations = [];

    // Tính toán độ lệch vị trí (deltaY) của từng người chơi
    sortedPlayers.forEach((player) => {
      const el = rowRefs.current[player.id];
      if (!el) return;

      const newTop = el.getBoundingClientRect().top;
      const oldTop = prevPositions.current[player.id];

      if (oldTop !== undefined) {
        const deltaY = oldTop - newTop;

        if (Math.abs(deltaY) > 0.5) {
          // Invert: đặt phần tử trở lại vị trí cũ ngay lập tức
          el.style.transform = `translateY(${deltaY}px)`;
          el.style.transition = 'none';
          // Nếu đang thăng hạng (deltaY > 0), bay nổi lên trên hàng tụt hạng
          el.style.zIndex = deltaY > 0 ? '5' : '3';
          el.classList.add('player-row-animating');

          animations.push({ el, deltaY });
        }
      }

      // Cập nhật vị trí mới cho ván kế tiếp
      prevPositions.current[player.id] = newTop;
    });

    if (animations.length > 0) {
      // Force reflow để trình duyệt áp dụng transform invert
      const firstEl = animations[0].el;
      if (firstEl) void firstEl.offsetHeight;

      // Play: Lướt mượt mà về vị trí mới bằng cubic-bezier chuẩn iOS
      const rafId = requestAnimationFrame(() => {
        animations.forEach(({ el }) => {
          el.style.transition = 'transform 0.55s cubic-bezier(0.25, 1, 0.35, 1)';
          el.style.transform = 'translateY(0)';
        });
      });

      const timerId = setTimeout(() => {
        animations.forEach(({ el }) => {
          el.style.transition = '';
          el.style.transform = '';
          el.style.zIndex = '';
          el.classList.remove('player-row-animating');
        });
      }, 560);

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
      };
    }
  }, [sortedPlayers, cumulativeScores]);

  // Cập nhật lại vị trí khi xoay màn hình hoặc resize
  useEffect(() => {
    const handleResize = () => {
      sortedPlayers.forEach((player) => {
        const el = rowRefs.current[player.id];
        if (el) {
          prevPositions.current[player.id] = el.getBoundingClientRect().top;
        }
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [sortedPlayers]);

  return (
    <div className="section-input-table">
      {/* 5 Hàng Người Chơi (Sắp xếp theo điểm sau mỗi ván: cao nhất trên cùng) */}
      <div className="players-list">
        {sortedPlayers.map((player) => {
          // Điểm tổng tích luỹ ván trước (giữ nguyên cho đến khi bấm tích xanh chốt ván)
          const displayScore = cumulativeScores[player.id] || 0;

          // Hiển thị số điểm trừ / cộng trên 2 nút thao tác dựa trên roundDeltas
          const delta = roundDeltas[player.id];
          let minusText = '–';
          let plusText = '+';

          if (delta !== undefined && delta !== 0) {
            if (delta < 0) {
              minusText = `–${Math.abs(delta)}`;
            } else {
              plusText = `+${delta}`;
            }
          }

          return (
            <div
              key={player.id}
              ref={(el) => {
                if (el) rowRefs.current[player.id] = el;
              }}
              className={`player-row player-row-${player.id}`}
              style={{ backgroundColor: player.color }}
            >
              {/* Cột Tên Người Chơi - Bấm trực tiếp để đổi tên */}
              <div
                className="player-name-box"
                onClick={() => {
                  if (editingPlayerId !== player.id) handleNameClick(player);
                }}
              >
                {editingPlayerId === player.id ? (
                  <input
                    type="text"
                    autoFocus
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => handleNameSave(player.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNameSave(player.id);
                    }}
                    className="player-name-input"
                  />
                ) : (
                  <span className="player-name-text">
                    {player.name || ''}
                  </span>
                )}
              </div>

              {/* Cột Điểm Tổng Tích Luỹ */}
              <div className="player-score-box">
                <span className="player-score-text">
                  {displayScore}
                </span>
              </div>

              {/* Nút Trừ (-) - Bấm mở bàn phím phép trừ */}
              <button
                type="button"
                className={`player-btn-minus ${minusText.length > 2 ? 'small-text' : ''}`}
                onClick={() => onOpenKeyboard(player, '-')}
                title="Trừ điểm"
              >
                {minusText}
              </button>

              {/* Nút Cộng (+) - Bấm mở bàn phím phép cộng */}
              <button
                type="button"
                className={`player-btn-plus ${plusText.length > 2 ? 'small-text' : ''}`}
                onClick={() => onOpenKeyboard(player, '+')}
                title="Cộng điểm"
              >
                {plusText}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
