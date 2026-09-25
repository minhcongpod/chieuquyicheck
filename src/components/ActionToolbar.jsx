import React, { useState, useRef, useEffect } from 'react';
import { UndoIcon, LedgerCalendarIcon, QrCodeIcon, CheckmarkIcon, CrossIcon, EyeIcon } from './Icons';

export default function ActionToolbar({
  sumTotal = 0,
  canConfirm = false,
  onConfirmRound,
  onUndoConfirm,
  onUndoClick,
  onLedgerClick,
  onQrClick,
  canUndo = false,
  hasLedger = false,
  isViewOnly = false
}) {
  // Trạng thái trượt xác nhận inline: null | 'undo'
  const [confirmMode, setConfirmMode] = useState(null);

  const toolbarRef = useRef(null);

  // Nếu đang ở chế độ View-Only: Hiển thị nút VIEW ONLY bên trái và 2 nút Thống kê, QR bên phải
  if (isViewOnly) {
    return (
      <div className="action-toolbar is-view-only" ref={toolbarRef}>
        {/* KHU VỰC TRÁI: Nút VIEW ONLY */}
        <div className="toolbar-left-slot">
          <div className="toolbar-btn toolbar-btn-view-only" title="Chế độ chỉ xem (View-only)">
            <EyeIcon width={24} height={24} color="#000000" />
            <span className="view-only-text">VIEW ONLY</span>
          </div>
        </div>

        {/* KHU VỰC PHẢI: 2 nút Thống kê và QR Code */}
        <div className="toolbar-right-slot is-view-only">
          <div className="toolbar-right-group toolbar-right-default">
            {/* Nút 1: Thống kê */}
            <button
              type="button"
              className="toolbar-btn toolbar-btn-ledger"
              onClick={onLedgerClick}
              title="Sổ thống kê điểm"
            >
              <LedgerCalendarIcon width={26} height={26} color="#000000" />
            </button>

            {/* Nút 2: QR Code Quỹ Chiếu Quỷ */}
            <button
              type="button"
              className="toolbar-btn toolbar-btn-qr"
              onClick={onQrClick}
              title="Mã QR Quỹ Chiếu Quỷ"
            >
              <QrCodeIcon width={28} height={28} color="#000000" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Kích hoạt chế độ trượt xác nhận hoàn tác
  const handleTriggerMode = (mode) => {
    if (mode === 'undo' && !canUndo) return;

    if (mode === 'undo' && onUndoClick && !onUndoConfirm) {
      onUndoClick();
      return;
    }

    setConfirmMode(mode);
  };

  // Xác nhận thực hiện hoàn tác
  const handleExecuteConfirm = () => {
    if (confirmMode === 'undo') {
      if (onUndoConfirm) onUndoConfirm();
      else if (onUndoClick) onUndoClick();
    }
    setConfirmMode(null);
  };

  // Hủy bỏ trạng thái xác nhận, trượt về mặc định
  const handleCancel = () => {
    setConfirmMode(null);
  };

  // Tự động đóng trạng thái xác nhận khi người dùng chạm/click ra ngoài thanh toolbar
  useEffect(() => {
    if (!confirmMode) return;
    const handleOutsideClick = (e) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target)) {
        setConfirmMode(null);
      }
    };
    document.addEventListener('pointerdown', handleOutsideClick);
    return () => {
      document.removeEventListener('pointerdown', handleOutsideClick);
    };
  }, [confirmMode]);

  // Format hiển thị tổng điểm: 0, +30, -30
  let formattedSum = '0';
  if (sumTotal > 0) {
    formattedSum = `+${sumTotal}`;
  } else if (sumTotal < 0) {
    formattedSum = `${sumTotal}`;
  }

  return (
    <div className="action-toolbar" ref={toolbarRef}>
      {/* 1. KHU VỰC TRÁI: Chiếm toàn bộ độ rộng còn lại (flex: 1, tương đương nút chốt ván xanh lá) */}
      <div className="toolbar-left-slot">
        {/* Nút Chốt Ván kèm Tổng Điểm Kiểm Tra (Disable khi tổng chưa bằng 0 hoặc chưa nhập điểm) */}
        <button
          type="button"
          className={`toolbar-btn toolbar-btn-confirm ${confirmMode ? 'slide-left-out' : 'slide-in'}`}
          onClick={confirmMode || !canConfirm ? undefined : onConfirmRound}
          disabled={!canConfirm}
          title={canConfirm ? "Chốt ván và lưu lịch sử" : "Tổng điểm phải bằng 0 để chốt ván"}
          tabIndex={confirmMode || !canConfirm ? -1 : 0}
        >
          <span className="confirm-sum-text">{formattedSum}</span>
          <CheckmarkIcon width={28} height={28} className="confirm-sum-check" color="#000000" />
        </button>

        {/* Nút hành động đang được kích hoạt (Quay lại) - Hiển thị chữ BACK */}
        <button
          type="button"
          className={`toolbar-btn toolbar-btn-active-action ${confirmMode ? 'slide-in' : 'slide-right-out'}`}
          onClick={handleCancel}
          title="Bấm để hủy thao tác"
          tabIndex={confirmMode ? 0 : -1}
        >
          <span className="action-confirm-label">BACK</span>
        </button>
      </div>

      {/* 2. KHU VỰC PHẢI: Chiều rộng cố định 212px (3 nút 68px + 2 khoảng cách 4px) */}
      <div className="toolbar-right-slot">
        {/* Bộ 3 nút chức năng theo thứ tự: Quay lại, Thống kê, QR Code */}
        <div
          className={`toolbar-right-group toolbar-right-default ${
            confirmMode ? 'slide-left-out' : 'slide-in'
          }`}
        >
          {/* Nút 1: Quay lại (Undo) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-undo"
            onClick={() => canUndo && handleTriggerMode('undo')}
            disabled={!canUndo}
            title="Hoàn tác ván trước"
            tabIndex={confirmMode ? -1 : 0}
          >
            <UndoIcon width={28} height={28} />
          </button>

          {/* Nút 2: Thống kê (Sổ thống kê điểm) - Disable khi chưa có lần chốt sổ nào */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-ledger"
            onClick={() => hasLedger && !confirmMode && onLedgerClick && onLedgerClick()}
            disabled={!hasLedger}
            title={hasLedger ? "Sổ thống kê điểm" : "Chưa có lần chốt sổ nào"}
            tabIndex={confirmMode || !hasLedger ? -1 : 0}
          >
            <LedgerCalendarIcon width={26} height={26} color="#000000" />
          </button>

          {/* Nút 3: QR Code Quỹ Chiếu Quỷ */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-qr"
            onClick={() => !confirmMode && onQrClick && onQrClick()}
            title="Mã QR Quỹ Chiếu Quỷ"
            tabIndex={confirmMode ? -1 : 0}
          >
            <QrCodeIcon width={28} height={28} color="#000000" />
          </button>
        </div>

        {/* Bộ 2 nút xác nhận hiện ra: Nút Xác nhận (Xanh ✓) và Nút Hủy (Đỏ ✕) */}
        <div
          className={`toolbar-right-group toolbar-right-confirm ${
            confirmMode ? 'slide-in' : 'slide-right-out'
          }`}
        >
          {/* Nút Xác nhận Đồng ý (Xanh lá) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-confirm-yes"
            onClick={handleExecuteConfirm}
            title="Xác nhận hoàn tác ván đấu"
            tabIndex={confirmMode ? 0 : -1}
          >
            <CheckmarkIcon width={32} height={32} color="#000000" />
          </button>

          {/* Nút Hủy bỏ (Màu đỏ) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-confirm-no"
            onClick={handleCancel}
            title="Hủy bỏ"
            tabIndex={confirmMode ? 0 : -1}
          >
            <CrossIcon width={32} height={32} color="#000000" />
          </button>
        </div>
      </div>
    </div>
  );
}
