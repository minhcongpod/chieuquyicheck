import React, { useEffect, useState, useRef } from 'react';
import { fireSamFireworks } from '../hooks/useRealtimeGame';
import { playSamCelebrationSound } from '../utils/samAudio';

/**
 * SamEffectOverlay - Hiệu ứng hoạt ảnh bùng nổ, uy lực và mãn nhãn khi hô Sâm thành công!
 * 
 * 1. Khởi đầu: Logo ở scale 2.6, xoay nghiêng, opacity 0, màn hình lóe sáng tia chớp trắng/vàng.
 * 2. Thu nhỏ & bứt tốc (0.45s): Thu nhỏ nhanh chóng về giữa (scale 1), dùng cubic-bezier nảy mạnh mẽ.
 * 3. Va đập & Rung màn hình (0.2s): Shockwave nở bung, màn hình rung chuyển, logo tỏa hào quang vàng chói lọi.
 * 4. Duy trì 1.5s: Hiển thị rực rỡ cùng hiệu ứng ánh sao lấp lánh và pháo hoa 4 góc.
 * 5. Tự động mờ dần (fade out) và kết thúc để trở lại bảng điểm.
 */
export default function SamEffectOverlay({
  isOpen,
  winnerName = '',
  points = 0,
  onClose
}) {
  const [phase, setPhase] = useState('idle'); // 'animating' | 'fadeout' | 'idle'
  const timerRef = useRef([]);

  const clearAllTimers = () => {
    timerRef.current.forEach(t => clearTimeout(t));
    timerRef.current = [];
  };

  useEffect(() => {
    if (!isOpen) {
      setPhase('idle');
      clearAllTimers();
      return;
    }

    setPhase('animating');

    // 1. Âm thanh bứt tốc & va đập siêu thực
    playSamCelebrationSound();

    // 2. Ngay khoảnh khắc logo va đập vào giữa (0.45s), bắn pháo hoa từ 4 góc
    const fireworksTimer = setTimeout(() => {
      fireSamFireworks();
    }, 450);
    timerRef.current.push(fireworksTimer);

    // 3. Sau khoảng 2.15s (0.45s bay vào + 1.7s chiêm ngưỡng), bắt đầu mờ dần (fade out)
    const fadeTimer = setTimeout(() => {
      setPhase('fadeout');
    }, 2150);
    timerRef.current.push(fadeTimer);

    // 4. Kết thúc toàn bộ hiệu ứng ở 2.6s và gọi onClose
    const closeTimer = setTimeout(() => {
      setPhase('idle');
      if (onClose) onClose();
    }, 2600);
    timerRef.current.push(closeTimer);

    return () => {
      clearAllTimers();
    };
  }, [isOpen, onClose]);

  if (!isOpen && phase === 'idle') return null;

  const handleSkip = () => {
    clearAllTimers();
    setPhase('fadeout');
    setTimeout(() => {
      setPhase('idle');
      if (onClose) onClose();
    }, 250);
  };

  return (
    <div
      className={`sam-celebration-overlay ${phase === 'fadeout' ? 'is-fading-out' : ''}`}
      onClick={handleSkip}
      title="Bấm để đóng nhanh"
    >
      {/* 1. Tia chớp sáng toàn màn hình (Screen Flash BOOM) */}
      <div className="sam-screen-flash" />

      {/* 2. Sóng chấn động rung lắc toàn màn hình (Screen Shake Wrapper) */}
      <div className="sam-shake-container">
        {/* Vòng hào quang xoay tốc độ cao & giảm tốc dần (Rotating RPM Energy Ring) */}
        <div className="sam-speed-ring" />
        <div className="sam-speed-ring sam-speed-ring-inner" />

        {/* Sóng xung kích bùng nổ khi logo tiếp đất (Impact Shockwave) */}
        <div className="sam-shockwave" />
        <div className="sam-shockwave sam-shockwave-second" />

        {/* Logo Sâm chính tâm & hiệu ứng nảy / phát sáng */}
        <div className="sam-logo-wrapper">
          {/* Lớp hào quang vàng rực rỡ phía sau viền khi va đập (Golden Aura Glow) */}
          <div className="sam-logo-backglow" />

          {/* Hình ảnh Logo Sâm Chiếu Quỳ Icheck */}
          <img
            src="/sam-logo.png"
            alt="Logo Sâm"
            className="sam-logo-img"
            draggable={false}
          />

          {/* Các điểm phát sáng lấp lánh trên 5 ngôi sao & vương miện (Sparkle Flares) */}
          <div className="sam-sparkle sam-sparkle-1" />
          <div className="sam-sparkle sam-sparkle-2" />
          <div className="sam-sparkle sam-sparkle-3" />
          <div className="sam-sparkle sam-sparkle-4" />
          <div className="sam-sparkle sam-sparkle-5" />
          <div className="sam-sparkle sam-sparkle-crown" />
        </div>

        {/* Banner thông báo người chiến thắng */}
        <div className="sam-title-banner">
          <div className="sam-title-main">HÔ SÂM THÀNH CÔNG!</div>
          {winnerName && (
            <div className="sam-winner-sub">
              <span className="sam-winner-crown">👑</span>
              <span className="sam-winner-name">{winnerName}</span>
              {points > 0 && <span className="sam-winner-pts">+{points}</span>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
