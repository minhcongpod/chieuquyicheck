import React, { useState, useEffect, useRef } from 'react';
import { fireSamFireworks } from '../hooks/useRealtimeGame';

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

// Icon cúp vàng mở Bảng xếp hạng
export const RankingIcon = () => (
  <svg width="30" height="30" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M73.8496 9.97754C73.9729 10.2681 74.041 10.5883 74.041 10.9238V13.7344H89.0664C91.3685 13.7344 93.2344 15.6012 93.2344 17.9033V26.0459C93.2344 38.454 83.9288 48.6327 71.8115 50.0869C69.6843 54.5407 66.007 58.0827 61.4678 60.0566C57.3619 61.8421 54.75 65.9436 54.75 70.4209V72.5117H65.1865V80.6699H72.6689V91.5H27.3311V80.6699H34.8135V72.5117H45.0566V70.4629C45.0565 65.985 42.4439 61.883 38.3369 60.0986C33.7987 58.1271 30.122 54.54 27.9951 50.0869C16.0716 48.6328 6.76562 38.3571 6.76562 26.0459V17.9033C6.76562 15.6012 8.63154 13.7345 10.9336 13.7344H25.8623V10.9238C25.8623 10.6697 25.9021 10.4245 25.9746 10.1943V8.5H73.8496V9.97754ZM16.4697 22.0713C15.7144 22.0715 15.1025 22.6841 15.1025 23.4395V26.0459C15.1025 32.2508 18.7029 37.6898 23.8613 40.251C24.7802 40.7072 25.8622 40.0581 25.8623 39.0322V23.4395C25.8623 22.6839 25.2497 22.0713 24.4941 22.0713H16.4697ZM75.5059 22.0713C74.7503 22.0713 74.1377 22.6839 74.1377 23.4395V39.0068C74.1378 40.0371 75.2286 40.6867 76.1475 40.2207C81.3012 37.6068 84.8984 32.2473 84.8984 26.0459V23.4395C84.8984 22.684 84.2857 22.0714 83.5303 22.0713H75.5059Z" fill="#F5EB02" />
  </svg>
);

/**
 * Bảng xếp hạng Chiếu Quỷ (Thiết kế Figma "Bảng xếp hạng Chiếu Quỷ")
 *
 * - Top 3 đứng trên podium theo thứ tự 2 - 1 - 3, top 1 cao nhất có vương miện và nhãn VUA SÂM
 * - Podium không có dấu +. Người âm điểm không đứng trên podium: cột vẫn giữ nguyên, chỉ để trống tên và điểm
 * - Mở bảng thì bắn pháo hoa 2 bên giống lúc báo Sâm
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

  // Bắn pháo hoa 2 bên mỗi lần mở bảng (chờ bảng trượt lên xong)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(fireSamFireworks, 250);
    return () => clearTimeout(timer);
  }, [isOpen]);

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

  // Luôn đủ 3 cột podium, ô nào không có người hoặc người đó âm điểm thì để trống
  const podium = [0, 1, 2].map((idx) => {
    const p = rankedPlayers[idx];
    return { rank: idx + 1, player: p && p.score >= 0 ? p : null };
  });
  // Thứ tự hiển thị trên podium: hạng 2 - hạng 1 - hạng 3
  const podiumOrder = [podium[1], podium[0], podium[2]];
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
            <div key={p.rank} className={`podium-col is-top-${p.rank}`}>
              {p.rank === 1 ? (
                <CrownIcon />
              ) : (
                <span className="podium-rank-badge" style={{ background: PODIUM_COLORS[p.rank] }}>
                  {p.rank}
                </span>
              )}
              <div className="podium-card" style={{ background: PODIUM_COLORS[p.rank] }}>
                {p.player && (
                  <>
                    <div className="podium-card-head">
                      <span className="podium-name">{p.player.name}</span>
                      {p.rank === 1 && <span className="podium-pill">VUA SÂM</span>}
                    </div>
                    <span className="podium-score">{p.player.score}</span>
                  </>
                )}
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
