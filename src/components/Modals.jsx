import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import qrMomoUrl from '../assets/qr-momo.jpg';

// Bản rút gọn của link: giữ https:// và nhánh phía sau, che cả phần đuôi tên miền (.web.app)
// Ví dụ: https://chieuquyicheck.web.app/vip -> https://chieuquyicheck…/vip
const formatCompactUrl = (url) => {
  try {
    const { protocol, hostname, pathname, search } = new URL(url);
    const name = hostname.split('.')[0];
    if (name === hostname) return url;
    return `${protocol}//${name}…${pathname}${search}`;
  } catch (e) {
    return url;
  }
};

/**
 * Popup Mã QR: Hỗ trợ 2 chế độ:
 * 1. Vào Chiếu: Quét mã QR hoặc sao chép link bàn chơi để cùng xem điểm trên Firebase
 * 2. Quỹ Chiếu Quỷ: Mã QR MoMo nộp quỹ
 */
export function QrTransferModal({ isOpen, onClose, roomUrl }) {
  const [activeTab, setActiveTab] = useState('room'); // 'room' | 'momo'
  const [copiedLink, setCopiedLink] = useState(false);
  // Link đầy đủ không vừa ô thì chuyển sang bản rút gọn
  const [isLinkCompact, setIsLinkCompact] = useState(false);
  const roomLinkRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Mỗi lần mở popup / đổi tab / đổi link: hiện link đầy đủ trước, tràn ô thì rút gọn
  useLayoutEffect(() => {
    setIsLinkCompact(false);
  }, [isOpen, activeTab, roomUrl]);

  useLayoutEffect(() => {
    const el = roomLinkRef.current;
    if (el && !isLinkCompact && el.scrollWidth > el.clientWidth) {
      setIsLinkCompact(true);
    }
  });

  if (!isOpen) return null;

  // Đường link bàn chơi chuẩn chính thức
  const targetRoomUrl = roomUrl || (typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname.replace(/\/+$/, '')}/`
    : 'https://minhcongpod.github.io/chieuquyicheck/');

  // QR Code động cho link bàn chơi
  const roomQrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=10&data=${encodeURIComponent(targetRoomUrl)}`;

  const momoUrl = 'https://quy.momo.vn/v2/O2HWggyJjd?cover=6749';

  const handleCopyText = async (text) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } catch (err) {
      console.error('Lỗi sao chép link:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-qr-card" onClick={(e) => e.stopPropagation()}>
        {/* Thanh chuyển đổi Tab: Vào Chiếu vs Quỹ Chiếu Quỷ */}
        <div className="modal-qr-tabs">
          <button
            type="button"
            className={`modal-qr-tab-btn ${activeTab === 'room' ? 'active' : ''}`}
            onClick={() => setActiveTab('room')}
          >
            JOIN US
          </button>
          <button
            type="button"
            className={`modal-qr-tab-btn ${activeTab === 'momo' ? 'active' : ''}`}
            onClick={() => setActiveTab('momo')}
          >
            MOMO
          </button>
        </div>

        {activeTab === 'room' ? (
          <>
            {/* Khung mã QR link bàn chơi */}
            <div className="qr-image-container">
              <img
                src={roomQrCodeUrl}
                alt="Mã QR Vào Chiếu"
                className="qr-image-display"
              />
            </div>

            {/* Thông tin đường link bàn chơi */}
            <div
              className="qr-link-box"
              onClick={() => handleCopyText(targetRoomUrl)}
              title="Bấm để sao chép link bàn chơi"
            >
              {/* Link dài: che phần tên miền (.web.app), giữ https:// và đuôi link (vd /vip) */}
              <span className="qr-link-url" ref={roomLinkRef}>
                {isLinkCompact ? formatCompactUrl(targetRoomUrl) : targetRoomUrl}
              </span>
              <button
                type="button"
                className="qr-copy-btn"
                aria-label="Sao chép link bàn chơi"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyText(targetRoomUrl);
                }}
              >
                {copiedLink ? (
                  <CheckIcon width={18} height={18} color="#66ff33" />
                ) : (
                  <CopyIcon width={18} height={18} color="#ffffff" />
                )}
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Khung mã QR MoMo chuyển tiền quỹ */}
            <div className="qr-image-container">
              <img
                src={qrMomoUrl}
                alt="Mã QR Quỹ Chiếu Quỷ"
                className="qr-image-display"
              />
            </div>

            {/* Thông tin đường link quỹ */}
            <div
              className="qr-link-box"
              onClick={() => handleCopyText(momoUrl)}
              title="Bấm để sao chép link quỹ MoMo"
            >
              <span className="qr-link-url">{momoUrl}</span>
              <button
                type="button"
                className="qr-copy-btn"
                aria-label="Sao chép link quỹ MoMo"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCopyText(momoUrl);
                }}
              >
                {copiedLink ? (
                  <CheckIcon width={18} height={18} color="#66ff33" />
                ) : (
                  <CopyIcon width={18} height={18} color="#ffffff" />
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
