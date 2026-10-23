import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon, ExternalLinkIcon, DownloadQrIcon, LoadingSpinnerIcon } from './Icons';
import qrMomoUrl from '../assets/qr-momo.jpg';

/**
 * Popup Mã QR: Hỗ trợ 2 chế độ:
 * 1. Chia sẻ link bàn chơi (để tất cả mọi người quét mã hoặc sao chép link cùng xem điểm trên Firebase)
 * 2. Chuyển khoản Quỹ Chiếu Quỷ (MoMo QR)
 */
export function QrTransferModal({ isOpen, onClose, roomUrl }) {
  const [activeTab, setActiveTab] = useState('room'); // 'room' | 'momo'
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  const handleOpenLink = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

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

  const handleCopyQrImage = async () => {
    try {
      const img = document.querySelector('.qr-image-display') || new Image();
      if (!img.complete) {
        img.crossOrigin = 'anonymous';
        if (!img.src) img.src = qrMomoUrl;
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 1024;
      canvas.height = img.naturalHeight || img.height || 1024;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
      if (pngBlob && navigator?.clipboard?.write && window.ClipboardItem) {
        await navigator.clipboard.write([
          new ClipboardItem({ 'image/png': pngBlob })
        ]);
        setCopiedImage(true);
        setTimeout(() => setCopiedImage(false), 2000);
      } else {
        handleSaveQr();
      }
    } catch (err) {
      console.error('Failed to copy QR image to clipboard:', err);
      handleSaveQr();
    }
  };

  const handleSaveQr = async () => {
    try {
      setDownloading(true);
      const isMomo = activeTab === 'momo';
      const downloadUrl = isMomo ? qrMomoUrl : roomQrCodeUrl;
      const fileName = isMomo ? 'QR_QUY_CHIEU_QUY.jpg' : 'QR_BAN_CHIEU_QUY.png';

      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setTimeout(() => setDownloading(false), 1500);
    } catch (err) {
      setDownloading(false);
      const isMomo = activeTab === 'momo';
      const a = document.createElement('a');
      a.href = isMomo ? qrMomoUrl : roomQrCodeUrl;
      a.download = isMomo ? 'QR_QUY_CHIEU_QUY.jpg' : 'QR_BAN_CHIEU_QUY.png';
      a.target = '_blank';
      a.click();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-qr-card" onClick={(e) => e.stopPropagation()}>
        {/* Thanh chuyển đổi Tab: Vào Bàn Chơi vs Nộp Quỹ MoMo */}
        <div className="modal-qr-tabs">
          <button
            type="button"
            className={`modal-qr-tab-btn ${activeTab === 'room' ? 'active' : ''}`}
            onClick={() => setActiveTab('room')}
          >
            VÀO CHIẾU
          </button>
          <button
            type="button"
            className={`modal-qr-tab-btn ${activeTab === 'momo' ? 'active' : ''}`}
            onClick={() => setActiveTab('momo')}
          >
            QUỸ CHIẾU QUỶ
          </button>
        </div>

        {activeTab === 'room' ? (
          <>
            {/* Khung mã QR link bàn chơi để mọi người quét camera vào xem điểm chung */}
            <div className="qr-image-container">
              <img
                src={roomQrCodeUrl}
                alt="Mã QR Vào Bàn Chiếu Quỷ"
                className="qr-image-display"
              />
            </div>

            {/* Thông tin đường link bàn chơi */}
            <div
              className="qr-link-box"
              onClick={() => handleCopyText(targetRoomUrl)}
              title="Bấm để sao chép link bàn chơi"
            >
              <span className="qr-link-url">{targetRoomUrl}</span>
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
            {/* Placeholder giữ chiều cao bằng tab QUỸ CHIẾU QUỶ */}
            <div className="modal-qr-actions-placeholder" />

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
              onClick={() => handleOpenLink(momoUrl)}
              title="Bấm để mở trực tiếp đường link QR trong tab mới"
            >
              <span className="qr-link-url">{momoUrl}</span>
              <button
                type="button"
                className="qr-copy-btn"
                aria-label="Mở link trong tab mới"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenLink(momoUrl);
                }}
              >
                <ExternalLinkIcon width={20} height={20} color="#ffffff" />
              </button>
            </div>

            {/* Nút Sao chép ảnh QR và Lưu QR MoMo */}
            <div className="modal-qr-actions">
              <button
                type="button"
                className="modal-btn modal-btn-copy-qr"
                onClick={handleCopyQrImage}
                title={copiedImage ? "Đã sao chép ảnh QR vào clipboard!" : "Sao chép ảnh QR code vào clipboard"}
                aria-label="Sao chép ảnh QR"
              >
                {copiedImage ? (
                  <CheckIcon width={24} height={24} color="#000000" />
                ) : (
                  <CopyIcon width={24} height={24} color="#000000" />
                )}
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-save-qr"
                onClick={handleSaveQr}
                title="Lưu QR"
                aria-label="Lưu QR"
                disabled={downloading}
              >
                {downloading ? (
                  <LoadingSpinnerIcon width={24} height={24} color="#000000" />
                ) : (
                  <DownloadQrIcon width={24} height={24} color="#000000" />
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
