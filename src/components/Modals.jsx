import React, { useState, useEffect } from 'react';
import { CopyIcon, CheckIcon, ExternalLinkIcon, DownloadQrIcon, LoadingSpinnerIcon } from './Icons';

/**
 * Popup Chuyển Khoản Quỹ Chiếu Quỷ (MoMo QR)
 * Cho phép xem mã QR, sao chép liên kết, mở trực tiếp hoặc tải ảnh về máy.
 */
export function QrTransferModal({ isOpen, onClose }) {
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

  const momoUrl = 'https://quy.momo.vn/v2/O2HWggyJjd?cover=6749';

  const handleOpenLink = () => {
    window.open(momoUrl, '_blank', 'noopener,noreferrer');
  };

  const handleCopyQrImage = async () => {
    try {
      const img = document.querySelector('.qr-image-display') || new Image();
      if (!img.complete) {
        img.crossOrigin = 'anonymous';
        if (!img.src) img.src = '/qr-momo.jpg';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
        });
      }

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || img.width || 500;
      canvas.height = img.naturalHeight || img.height || 500;
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
      const response = await fetch('/qr-momo.jpg');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = 'QR_QUY_CHIEU_QUY.jpg';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setTimeout(() => setDownloading(false), 1500);
    } catch (err) {
      setDownloading(false);
      const a = document.createElement('a');
      a.href = '/qr-momo.jpg';
      a.download = 'QR_QUY_CHIEU_QUY.jpg';
      a.target = '_blank';
      a.click();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card modal-qr-card" onClick={(e) => e.stopPropagation()}>
        {/* Khung mã QR MoMo */}
        <div className="qr-image-container">
          <img
            src="/qr-momo.jpg"
            alt="Mã QR Quỹ Chiếu Quỷ"
            className="qr-image-display"
          />
        </div>

        {/* Thông tin đường link quỹ kèm icon mở link trực tiếp trong tab mới */}
        <div
          className="qr-link-box"
          onClick={handleOpenLink}
          title="Bấm để mở trực tiếp đường link QR trong tab mới"
        >
          <span className="qr-link-url">{momoUrl}</span>
          <button
            type="button"
            className="qr-copy-btn"
            aria-label="Mở link trong tab mới"
            onClick={(e) => {
              e.stopPropagation();
              handleOpenLink();
            }}
          >
            <ExternalLinkIcon width={20} height={20} color="#ffffff" />
          </button>
        </div>

        {/* Nút Sao chép ảnh QR và Lưu QR */}
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
      </div>
    </div>
  );
}

export const InfoModal = QrTransferModal;
