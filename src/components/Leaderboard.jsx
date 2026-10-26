import React, { useState, useEffect, useRef } from 'react';

// Màu thẻ podium theo thiết kế Figma "Bảng xếp hạng Chiếu Quỷ"
const PODIUM_COLORS = {
  1: '#66ff33',
  2: '#f5ea00',
  3: '#00e9ff'
};

const formatScore = (score) => (score > 0 ? `+${score}` : String(score));

const CrownIcon = () => (
  <svg width="24" height="20" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M2 6L7 11L12 3L17 11L22 6L20 16H4L2 6Z" fill="#F5EA00" />
    <rect x="4" y="16.5" width="16" height="2.5" rx="1" fill="#F5EA00" />
    <circle cx="2" cy="5" r="1.8" fill="#F5EA00" />
    <circle cx="12" cy="2" r="1.8" fill="#F5EA00" />
    <circle cx="22" cy="5" r="1.8" fill="#F5EA00" />
  </svg>
);

export const RankingIcon = () => (
  <svg width="24" height="21" viewBox="0 0 28 24.23" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect y="8.97" width="7.27" height="15.26" fill="currentColor" />
    <rect x="10.27" width="7.27" height="24.23" fill="currentColor" />
    <rect x="20.54" y="12.86" width="7.27" height="11.37" fill="currentColor" />
  </svg>
);

/**
 * Bảng xếp hạng Chiếu Quỷ (Thiết kế Figma "Bảng xếp hạng Chiếu Quỷ")
 *
 * - Top 3 đứng trên podium theo thứ tự 2 - 1 - 3, top 1 cao nhất có vương miện và nhãn VUA SÂM
 * - Từ hạng #4 trở đi là danh sách: điểm dương nền xanh mờ, điểm âm nền đỏ mờ
 * - Bấm ra ngoài vùng podium / danh sách hoặc vuốt xuống để quay lại Bảng thống kê
 *
 * rankedPlayers: [{ name, score }] đã sắp xếp điểm cao -> thấp
 */
export default function Leaderboard({ isOpen, onClose, rankedPlayers = [] }) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef(0);
  const startXRef = useRef(0);
  const dragYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setDragY(0);
      dragYRef.current = 0;
      isDraggingRef.current = false;
    }
  }, [isOpen]);

  // Vuốt xuống để đóng (chỉ khi danh sách đang ở trên cùng)
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    dragYRef.current = 0;
    isDraggingRef.current = false;
  };

  const handleTouchMove = (e) => {
    const touch = e.touches[0];
    const deltaY = touch.clientY - startYRef.current;
    const deltaX = touch.clientX - startXRef.current;
    if (deltaY > 0 && Math.abs(deltaY) > Math.abs(deltaX)) {
      if (scrollRef.current && scrollRef.current.scrollTop > 0) return;
      isDraggingRef.current = true;
      dragYRef.current = deltaY;
      setDragY(deltaY);
      if (e.cancelable) e.preventDefault();
    }
  };

  const handleTouchEnd = () => {
    if (!isDraggingRef.current) return;
    if (dragYRef.current > 70) onClose();
    setDragY(0);
    isDraggingRef.current = false;
    dragYRef.current = 0;
  };

  const podium = rankedPlayers.slice(0, 3).map((p, idx) => ({ ...p, rank: idx + 1 }));
  // Thứ tự hiển thị trên podium: hạng 2 - hạng 1 - hạng 3
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean);
  const rest = rankedPlayers.slice(3);

  // Bấm vào vùng trống (ngoài thẻ podium và các dòng xếp hạng) thì đóng
  const handleBackdropClick = (e) => {
    if (e.target.closest('.podium-col, .leaderboard-row')) return;
    onClose();
  };

  return (
    <div
      className={`leaderboard-screen ${isOpen ? 'is-open' : ''} ${dragY > 0 ? 'is-dragging' : ''}`}
      style={dragY > 0 ? { transform: `translateY(${dragY}px)` } : undefined}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleBackdropClick}
      aria-hidden={!isOpen}
    >
      <div className="leaderboard-scroll" ref={scrollRef}>
        <div className="leaderboard-podium">
          {podiumOrder.map((p) => (
            <div key={p.name} className={`podium-col is-top-${p.rank}`}>
              {p.rank === 1 ? (
                <CrownIcon />
              ) : (
                <span className="podium-rank-badge" style={{ background: PODIUM_COLORS[p.rank] }}>
                  {p.rank}
                </span>
              )}
              <div className="podium-card" style={{ background: PODIUM_COLORS[p.rank] }}>
                <div className="podium-card-head">
                  <span className="podium-name">{p.name}</span>
                  {p.rank === 1 && <span className="podium-pill">VUA SÂM</span>}
                </div>
                <span className="podium-score">{formatScore(p.score)}</span>
              </div>
            </div>
          ))}
        </div>

        {rest.length > 0 && (
          <div className="leaderboard-list">
            {rest.map((p, idx) => {
              const statusClass = p.score > 0 ? 'is-pos' : p.score < 0 ? 'is-neg' : 'is-zero';
              return (
                <div key={p.name} className={`leaderboard-row ${statusClass}`}>
                  <span className="leaderboard-row-rank">#{idx + 4}</span>
                  <span className="leaderboard-row-name">{p.name}</span>
                  <span className="leaderboard-row-score">{formatScore(p.score)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
