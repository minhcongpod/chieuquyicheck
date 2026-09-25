import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';

/**
 * Lưu tên người chơi mới vào localStorage để ghi nhớ cho những lần sau
 */
function saveKnownPlayer(name) {
  if (!name || !name.trim()) return;
  const clean = name.trim();
  try {
    const raw = localStorage.getItem('cq_known_players');
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];
    const exists = list.some(item => item.toLowerCase() === clean.toLowerCase());
    if (!exists) {
      list.push(clean);
      localStorage.setItem('cq_known_players', JSON.stringify(list));
    }
  } catch (err) {
    // Không xử lý lỗi nếu localStorage bị chặn
  }
}

// Hàm xác định class kích thước font chữ dựa trên số lượng chữ số hiển thị để tránh tràn khung
function getBtnSizeClass(text) {
  if (!text) return '';
  const digitsMatch = text.match(/\d/g);
  const numDigits = digitsMatch ? digitsMatch.length : 0;
  if (numDigits >= 3) return 'size-3digits small-text';
  if (numDigits === 2) return 'size-2digits small-text';
  return '';
}

export default function ScoreInputTable({
  players,
  cumulativeScores,
  roundDeltas,
  onUpdatePlayerName,
  onOpenKeyboard,
  dailyLedger = [],
  activeKeypad = null,
  isViewOnly = false
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [tempName, setTempName] = useState('');

  const inputRef = useRef(null);
  const blurTimerRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const isFirstRender = useRef(true);
  const frozenOrderRef = useRef(null);

  // Dọn dẹp timer khi component unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    };
  }, []);

  const handleNameClick = (player) => {
    if (isViewOnly) return;
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    // Khóa cố định thứ tự hiện tại của các hàng ngay khi mở ô nhập
    frozenOrderRef.current = sortedPlayers.map((p) => p.id);
    setEditingPlayerId(player.id);
    setTempName(player.name || '');
  };

  // Cập nhật tên người chơi:
  // - State cục bộ (tempName) cập nhật tức thì (0ms) để ô input phản hồi mượt mà từng ký tự
  // - State tổng thể và WebSocket được debounce 400ms để tránh kích hoạt re-render toàn app liên tục
  const handleInputChange = (playerId, val) => {
    setTempName(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      onUpdatePlayerName(playerId, val);
    }, 400);
  };

  // Chốt lưu tên tự động khi mất tiêu điểm (onBlur) hoặc chạm ra ngoài màn hình
  const handleInputBlur = (playerId) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);

    blurTimerRef.current = setTimeout(() => {
      const finalName = tempName.trim();
      if (finalName) {
        saveKnownPlayer(finalName);
      }
      onUpdatePlayerName(playerId, finalName);

      // Lưu lại toạ độ DOM chính xác của các hàng trước khi mở khoá sắp xếp
      sortedPlayers.forEach((player) => {
        const el = rowRefs.current[player.id];
        if (el) {
          prevPositions.current[player.id] = el.getBoundingClientRect().top;
        }
      });

      frozenOrderRef.current = null;
      setEditingPlayerId(null);
      setTempName('');
      window.scrollTo(0, 0);
    }, 120);
  };

  const handleNameSave = (playerId, newName) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    if (blurTimerRef.current) {
      clearTimeout(blurTimerRef.current);
      blurTimerRef.current = null;
    }

    const raw = newName !== undefined ? newName : tempName;
    const toSave = (raw || '').trim();
    if (toSave) {
      saveKnownPlayer(toSave);
    }
    onUpdatePlayerName(playerId, toSave);

    sortedPlayers.forEach((player) => {
      const el = rowRefs.current[player.id];
      if (el) {
        prevPositions.current[player.id] = el.getBoundingClientRect().top;
      }
    });

    frozenOrderRef.current = null;
    setEditingPlayerId(null);
    setTempName('');
    window.scrollTo(0, 0);
  };

  // Sắp xếp danh sách người chơi trên bảng nhập liệu theo quy tắc ưu tiên:
  // - Khi người dùng đang gõ tên (editingPlayerId !== null): CỐ ĐỊNH 100% thứ tự, không xáo trộn
  // - Nhóm có tên (Được sắp xếp): Sắp xếp vị trí theo thứ tự tổng điểm từ cao xuống thấp
  // - Nhóm trống (Ghim xuống cuối): Hàng thỏa mãn đồng thời 2 điều kiện: tên bị bỏ trống VÀ điểm số bằng 0
  //   sẽ bị loại khỏi luồng sắp xếp điểm, luôn được đẩy (push/append) xuống dưới cùng danh sách
  const sortedPlayers = useMemo(() => {
    // Nếu đang trong quá trình gõ tên, giữ nguyên thứ tự hàng hiện tại để người dùng nhập liền mạch
    if (editingPlayerId && frozenOrderRef.current) {
      const map = new Map(players.map((p) => [p.id, p]));
      return frozenOrderRef.current
        .map((id) => map.get(id))
        .filter(Boolean);
    }

    const sorted = [...players].sort((a, b) => {
      const nameA = (a.name || '').trim();
      const scoreA = cumulativeScores[a.id] || 0;
      const isEmptyA = nameA === '' && scoreA === 0;

      const nameB = (b.name || '').trim();
      const scoreB = cumulativeScores[b.id] || 0;
      const isEmptyB = nameB === '' && scoreB === 0;

      // 1. Nhóm trống luôn bị ghim xuống cuối cùng
      if (isEmptyA && !isEmptyB) return 1;
      if (!isEmptyA && isEmptyB) return -1;
      if (isEmptyA && isEmptyB) {
        // Cả 2 đều thuộc nhóm trống: giữ nguyên thứ tự p1, p2, p3...
        return a.id.localeCompare(b.id);
      }

      // 2. Nhóm có tên: sắp xếp theo tổng điểm từ cao xuống thấp
      if (scoreB !== scoreA) {
        return scoreB - scoreA;
      }

      // Điểm bằng nhau: giữ thứ tự ổn định theo id
      return a.id.localeCompare(b.id);
    });

    frozenOrderRef.current = sorted.map((p) => p.id);
    return sorted;
  }, [players, cumulativeScores, editingPlayerId]);

  // Hiệu ứng FLIP (First, Last, Invert, Play) chuyển đổi vị trí mượt mà khi thứ tự thay đổi
  useLayoutEffect(() => {
    // TẠM DỪNG HOÀN TOÀN FLIP animation khi người dùng đang nhập tên để triệt tiêu mọi rung giật / layout shift
    if (editingPlayerId) {
      return;
    }

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
  }, [sortedPlayers, cumulativeScores, editingPlayerId]);

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
        {sortedPlayers.map((player, index) => {
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

          // Kiểm tra xem nút - hoặc + của người này có đang được chọn/focus để nhập điểm không
          const isMinusActive = Boolean(
            activeKeypad &&
            activeKeypad.player &&
            activeKeypad.player.id === player.id &&
            activeKeypad.mode === '-'
          );
          const isPlusActive = Boolean(
            activeKeypad &&
            activeKeypad.player &&
            activeKeypad.player.id === player.id &&
            activeKeypad.mode === '+'
          );

          return (
            <div
              key={player.id}
              ref={(el) => {
                if (el) rowRefs.current[player.id] = el;
              }}
              className={`player-row player-row-${player.id}`}
              style={{
                backgroundColor: player.color,
                '--row-color': player.color
              }}
            >
              {/* Khối Trái: Tên người chơi và Điểm tích luỹ trong cùng 1 ô liền mạch */}
              <div
                className={`player-left-group ${isViewOnly ? 'is-view-only' : ''}`}
                onClick={() => {
                  if (!isViewOnly && editingPlayerId !== player.id) handleNameClick(player);
                }}
              >
                {/* Tên Người Chơi */}
                <div className="player-name-box">
                  {!isViewOnly && editingPlayerId === player.id ? (
                    <div className="player-name-input-wrapper">
                      <input
                        ref={inputRef}
                        type="text"
                        autoFocus
                        value={tempName}
                        onChange={(e) => handleInputChange(player.id, e.target.value)}
                        onFocus={() => {
                          window.scrollTo(0, 0);
                        }}
                        onBlur={() => handleInputBlur(player.id)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleNameSave(player.id, tempName);
                            inputRef.current?.blur();
                          } else if (e.key === 'Escape') {
                            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
                            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                            frozenOrderRef.current = null;
                            setEditingPlayerId(null);
                            setTempName('');
                          }
                        }}
                        className="player-name-input"
                        autoComplete="on"
                        autoCorrect="on"
                        autoCapitalize="characters"
                        spellCheck={false}
                      />
                    </div>
                  ) : (
                    <span className="player-name-text">
                      {(player.name && player.name.trim()) ? player.name.trim().toUpperCase() : ''}
                    </span>
                  )}
                </div>

                {/* Điểm Tổng Tích Luỹ */}
                <div className="player-score-box">
                  <span
                    className={`player-score-text ${
                      Math.abs(displayScore) >= 1000
                        ? 'score-4digits'
                        : Math.abs(displayScore) >= 100
                        ? 'score-3digits'
                        : ''
                    }`}
                  >
                    {displayScore}
                  </span>
                </div>
              </div>

              {/* Chỉ hiển thị nút Trừ (-) và Cộng (+) khi ở quyền Active (không phải View-Only) */}
              {!isViewOnly && (
                <>
                  {/* Nút Trừ (-) - Bấm mở bàn phím phép trừ */}
                  <button
                    type="button"
                    className={`player-btn-minus ${isMinusActive ? 'is-active' : ''} ${getBtnSizeClass(minusText)}`}
                    onClick={() => onOpenKeyboard(player, '-')}
                    title="Trừ điểm"
                    style={isMinusActive ? { boxShadow: `inset 0 0 0 2px ${player.color}` } : undefined}
                  >
                    <span className="player-btn-content">
                      <span className="player-btn-symbol">{minusText}</span>
                      {isMinusActive && <span className="blinking-cursor" aria-hidden="true" />}
                    </span>
                  </button>

                  {/* Nút Cộng (+) - Bấm mở bàn phím phép cộng */}
                  <button
                    type="button"
                    className={`player-btn-plus ${isPlusActive ? 'is-active' : ''} ${getBtnSizeClass(plusText)}`}
                    onClick={() => onOpenKeyboard(player, '+')}
                    title="Cộng điểm"
                    style={isPlusActive ? { boxShadow: `inset 0 0 0 2px ${player.color}` } : undefined}
                  >
                    <span className="player-btn-content">
                      <span className="player-btn-symbol">{plusText}</span>
                      {isPlusActive && <span className="blinking-cursor" aria-hidden="true" />}
                    </span>
                  </button>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

