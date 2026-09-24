import React, { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react';
import { DEFAULT_KNOWN_PLAYERS } from '../constants/sampleLedger';

/**
 * Loại bỏ dấu tiếng Việt để hỗ trợ tìm kiếm không dấu / gõ Telex
 */
function removeVietnameseTones(str) {
  if (!str) return '';
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

/**
 * Lưu tên người chơi mới vào localStorage để ghi nhớ và gợi ý cho những lần sau
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

export default function ScoreInputTable({
  players,
  cumulativeScores,
  roundDeltas,
  onUpdatePlayerName,
  onOpenKeyboard,
  dailyLedger = []
}) {
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [tempName, setTempName] = useState('');

  const inputRef = useRef(null);
  const blurTimerRef = useRef(null);
  const rowRefs = useRef({});
  const prevPositions = useRef({});
  const isFirstRender = useRef(true);

  // Tập hợp danh sách tất cả người chơi từng chơi (Mặc định + LocalStorage + Bàn hiện tại + Sổ lịch sử)
  const knownNames = useMemo(() => {
    const nameMap = new Map();

    // 1. Danh sách người chơi quen thuộc ban đầu (Linh, Công, Minh, Chiến, Toàn, Tuấn, Hải, An, Dũng, Bình)
    (DEFAULT_KNOWN_PLAYERS || []).forEach(name => {
      if (name && name.trim()) {
        const clean = name.trim();
        nameMap.set(clean.toLowerCase(), clean);
      }
    });

    // 2. Các tên đã từng lưu trong localStorage
    try {
      const raw = localStorage.getItem('cq_known_players');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          parsed.forEach(name => {
            if (name && typeof name === 'string' && name.trim()) {
              const clean = name.trim();
              nameMap.set(clean.toLowerCase(), clean);
            }
          });
        }
      }
    } catch (e) {}

    // 3. Người chơi hiện đang ngồi tại bàn
    if (players && Array.isArray(players)) {
      players.forEach(p => {
        if (p.name && p.name.trim()) {
          const clean = p.name.trim();
          nameMap.set(clean.toLowerCase(), clean);
        }
      });
    }

    // 4. Người chơi từ sổ điểm theo ngày (dailyLedger)
    if (dailyLedger && Array.isArray(dailyLedger)) {
      dailyLedger.forEach(entry => {
        if (entry.playersInfo && Array.isArray(entry.playersInfo)) {
          entry.playersInfo.forEach(pInfo => {
            if (pInfo.name && pInfo.name.trim()) {
              const clean = pInfo.name.trim();
              nameMap.set(clean.toLowerCase(), clean);
            }
          });
        }
      });
    }

    return Array.from(nameMap.values());
  }, [players, dailyLedger]);

  // Tìm các ứng viên phù hợp với từ khoá đang gõ
  const candidateMatches = useMemo(() => {
    const query = tempName.trim();
    if (!query) return [];

    const queryLower = query.toLowerCase();
    const queryNoTone = removeVietnameseTones(queryLower);

    return knownNames.filter((name) => {
      const nameLower = name.trim().toLowerCase();
      // Không gợi ý nếu người dùng đã gõ trọn vẹn 100%
      if (nameLower === queryLower) return false;

      // 1. So khớp tiền tố có dấu
      if (nameLower.startsWith(queryLower)) return true;

      // 2. So khớp tiền tố không dấu (gõ Telex hoặc không dấu)
      const nameNoTone = removeVietnameseTones(nameLower);
      if (nameNoTone.startsWith(queryNoTone)) return true;

      return false;
    });
  }, [tempName, knownNames]);

  // Gợi ý inline chính: Ký tự còn lại sẽ hiển thị mờ hơn nối tiếp sau ký tự đang gõ
  // Ví dụ gõ "L" -> Gợi ý "Linh", phần suffix "INH" hiển thị mờ hơn
  const activeSuggestion = useMemo(() => {
    if (candidateMatches.length === 0) return null;
    const match = candidateMatches[0].trim();
    const query = tempName.trim();

    // Suffix là phần đuôi còn lại sau số ký tự người dùng đã gõ
    const suffix = match.slice(query.length);

    return {
      fullName: match,
      prefix: tempName,
      suffix: suffix
    };
  }, [candidateMatches, tempName]);

  const handleNameClick = (player) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    setEditingPlayerId(player.id);
    setTempName(player.name || '');
  };

  const handleNameSave = (playerId, newName) => {
    if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
    const toSave = (newName !== undefined ? newName : tempName).trim();
    if (toSave) {
      saveKnownPlayer(toSave);
    }
    onUpdatePlayerName(playerId, toSave);
    setEditingPlayerId(null);
    setTempName('');
  };

  // Hoàn tất điền gợi ý khi bấm Tab, ArrowRight hoặc chạm vào chữ mờ
  const handleAcceptSuggestion = (suggestedFullName) => {
    if (!suggestedFullName) return;
    setTempName(suggestedFullName);
    if (inputRef.current) {
      inputRef.current.focus();
      const len = suggestedFullName.length;
      inputRef.current.setSelectionRange(len, len);
    }
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
              {/* Cột Tên Người Chơi - Bấm trực tiếp để đổi tên kèm gợi ý tự động */}
              <div
                className="player-name-box"
                onClick={() => {
                  if (editingPlayerId !== player.id) handleNameClick(player);
                }}
              >
                {editingPlayerId === player.id ? (
                  <div className="player-name-input-wrapper">
                    <input
                      ref={inputRef}
                      type="text"
                      autoFocus
                      value={tempName}
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => {
                        blurTimerRef.current = setTimeout(() => {
                          handleNameSave(player.id, tempName);
                        }, 160);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const toSave = activeSuggestion ? activeSuggestion.fullName : tempName;
                          handleNameSave(player.id, toSave);
                        } else if (e.key === 'Tab') {
                          if (activeSuggestion) {
                            e.preventDefault();
                            handleAcceptSuggestion(activeSuggestion.fullName);
                          }
                        } else if (e.key === 'ArrowRight') {
                          if (
                            activeSuggestion &&
                            inputRef.current &&
                            inputRef.current.selectionStart === tempName.length
                          ) {
                            e.preventDefault();
                            handleAcceptSuggestion(activeSuggestion.fullName);
                          }
                        } else if (e.key === 'Escape') {
                          setEditingPlayerId(null);
                        }
                      }}
                      className="player-name-input"
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="characters"
                      spellCheck={false}
                    />

                    {/* Gợi ý inline: Các ký tự tiếp theo mờ hơn nối tiếp sau ký tự đã gõ */}
                    {activeSuggestion && activeSuggestion.suffix && (
                      <div className="player-name-ghost-overlay" aria-hidden="true">
                        <span className="ghost-prefix">{tempName}</span>
                        <span
                          className="ghost-suffix"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                            handleAcceptSuggestion(activeSuggestion.fullName);
                          }}
                          onTouchStart={(e) => {
                            e.preventDefault();
                            if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                            handleAcceptSuggestion(activeSuggestion.fullName);
                          }}
                          title="Chạm để điền nhanh"
                        >
                          {activeSuggestion.suffix}
                        </span>
                      </div>
                    )}

                    {/* Chip gợi ý nổi bên dưới cho thao tác chạm nhanh trên mobile */}
                    {candidateMatches.length > 0 && (
                      <div className="player-name-suggestions-popup">
                        {candidateMatches.slice(0, 3).map((name) => (
                          <button
                            key={name}
                            type="button"
                            className="name-suggestion-chip"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                              handleNameSave(player.id, name);
                            }}
                            onTouchStart={(e) => {
                              e.preventDefault();
                              if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
                              handleNameSave(player.id, name);
                            }}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
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
