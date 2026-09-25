import React, { useState } from 'react';
import { CopyIcon, CheckIcon, ExternalLinkIcon, DownloadQrIcon, LoadingSpinnerIcon } from './Icons';

/**
 * Popup Chuyển Khoản Quỹ Chiếu Quỷ (MoMo QR)
 * Cho phép xem mã QR, sao chép liên kết, mở trực tiếp hoặc tải ảnh về máy.
 */
export function QrTransferModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  if (!isOpen) return null;

  const momoUrl = 'https://quy.momo.vn/v2/O2HWggyJjd?cover=6749';

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(momoUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenLink = () => {
    window.open(momoUrl, '_blank', 'noopener,noreferrer');
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

        {/* Thông tin đường link quỹ kèm icon copy màu trắng bên cạnh */}
        <div
          className="qr-link-box"
          onClick={handleCopyLink}
          title="Bấm để sao chép liên kết"
        >
          <span className="qr-link-url">{momoUrl}</span>
          <button
            type="button"
            className="qr-copy-btn"
            aria-label="Sao chép"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyLink();
            }}
          >
            {copied ? (
              <CheckIcon width={20} height={20} color="#66ff33" />
            ) : (
              <CopyIcon width={20} height={20} color="#ffffff" />
            )}
          </button>
        </div>

        {/* Nút Mở đường link và Lưu QR */}
        <div className="modal-qr-actions">
          <button
            type="button"
            className="modal-btn modal-btn-open-link"
            onClick={handleOpenLink}
            title="Mở đường link"
            aria-label="Mở đường link"
          >
            <ExternalLinkIcon width={24} height={24} color="#000000" />
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
