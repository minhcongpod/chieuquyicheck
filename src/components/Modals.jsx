import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import qrMomoUrl from '../assets/qr-momo.jpg';

// Tách link để hiển thị: phần đầu (https://tên) + tên miền (.web.app) + đuôi link (/vip)
// Link dài thì phần tên miền bị che thành … trước, luôn giữ https:// và đuôi link
const splitDisplayUrl = (url) => {
  try {
    const { protocol, hostname, pathname, search } = new URL(url);
    const [name, ...domain] = hostname.split('.');
    return {
      head: `${protocol}//${name}`,
      domain: domain.length ? `.${domain.join('.')}` : '',
      tail: pathname === '/' && !search ? '' : `${pathname}${search}`
    };
  } catch (e) {
    return { head: url, domain: '', tail: '' };
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

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

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
              <span className="qr-link-url">
                <span className="qr-link-url-head">{splitDisplayUrl(targetRoomUrl).head}</span>
                <span className="qr-link-url-domain">{splitDisplayUrl(targetRoomUrl).domain}</span>
                <span className="qr-link-url-tail">{splitDisplayUrl(targetRoomUrl).tail}</span>
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

export const InfoModal = QrTransferModal;
