import React, { useState } from 'react';
import { CopyIcon, CheckIcon } from './Icons';

// Popup Cảnh Báo Reset Trận Đấu
export function ResetConfirmModal({ isOpen, onClose, onConfirm }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">RESET</h3>
        <p className="modal-message" >
          Bơi lại từ đầu :)
        </p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            HỦY
          </button>
          <button type="button" className="modal-btn modal-btn-confirm" onClick={onConfirm}>
            RESET VỀ 0
          </button>
        </div>
      </div>
    </div>
  );
}

// Popup Cảnh Báo Hoàn Tác (Undo) Ván Trước
export function UndoConfirmModal({ isOpen, onClose, onConfirm, roundNumber }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title">QUAY LẠI</h3>
        <p className="modal-message">
          Mày chắc chưa!!?
        </p>
        <div className="modal-actions">
          <button type="button" className="modal-btn modal-btn-cancel" onClick={onClose}>
            HỦY
          </button>
          <button type="button" className="modal-btn modal-btn-confirm undo" onClick={onConfirm}>
            QUAY LẠI
          </button>
        </div>
      </div>
    </div>
  );
}

// Popup Chuyển Khoản Quỹ Chiếu Quỷ (MoMo QR)
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
        <div className="modal-qr-header">
          <h3 className="modal-title qr-title">QUỸ CHIẾU QUỶ</h3>
        </div>

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
              <CheckIcon width={18} height={18} color="#66ff33" />
            ) : (
              <CopyIcon width={18} height={18} color="#ffffff" />
            )}
          </button>
        </div>

        {/* Nút Mở đường link và Lưu QR */}
        <div className="modal-qr-actions">
          <button
            type="button"
            className="modal-btn modal-btn-open-link"
            onClick={handleOpenLink}
          >
            MỞ ĐƯỜNG LINK
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-save-qr"
            onClick={handleSaveQr}
          >
            {downloading ? 'ĐANG TẢI...' : 'LƯU QR'}
          </button>
        </div>
      </div>
    </div>
  );
}

// Giữ lại InfoModal trỏ tới QrTransferModal để tương thích ngược
export const InfoModal = QrTransferModal;

// Popup Cảnh Báo Lỗi Nhập Điểm Chưa Chính Xác (LỖI CMNR)
export function ErrorConfirmModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <h3 className="modal-title" style={{fontSize: '18px', fontWeight: '800' }}>
          LỖI CMNR
        </h3>
        <p className="modal-message" >
          Có làm được không!!?
        </p>
        <div className="modal-actions">
          <button
            type="button"
            className="modal-btn modal-btn-confirm"
            onClick={onClose}
            style={{ width: '100%', height: '44px', fontSize: '15px', borderRadius: 0, color: '#000000' }}
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}
