import React, { useState, useRef, useEffect } from 'react';
import { ResetIcon, UndoIcon, QrCodeIcon, CheckmarkIcon, CrossIcon } from './Icons';

export default function ActionToolbar({
  sumTotal = 0,
  onConfirmRound,
  onResetConfirm,
  onUndoConfirm,
  onResetClick,
  onUndoClick,
  onQrClick,
  onInfoClick,
  canUndo = false,
  isError = false
}) {
  // Trạng thái trượt xác nhận inline: null | 'reset' | 'undo'
  const [confirmMode, setConfirmMode] = useState(null);
  // displayMode ghi nhớ 'reset' hoặc 'undo' để giữ nguyên icon khi trượt ra
  const [displayMode, setDisplayMode] = useState('reset');

  const toolbarRef = useRef(null);

  // Khi có lỗi LỖI CMNR, đóng ngay chế độ confirm nếu đang mở
  useEffect(() => {
    if (isError) {
      setConfirmMode(null);
    }
  }, [isError]);

  // Kích hoạt chế độ trượt xác nhận
  const handleTriggerMode = (mode) => {
    // Nếu có onResetClick hoặc onUndoClick từ ngoài mà không dùng confirm inline
    if (mode === 'reset' && onResetClick && !onResetConfirm) {
      onResetClick();
      return;
    }
    if (mode === 'undo' && onUndoClick && !onUndoConfirm) {
      onUndoClick();
      return;
    }

    setDisplayMode(mode);
    setConfirmMode(mode);
  };

  // Xác nhận thực hiện hành động
  const handleExecuteConfirm = () => {
    if (confirmMode === 'reset') {
      if (onResetConfirm) onResetConfirm();
      else if (onResetClick) onResetClick();
    } else if (confirmMode === 'undo') {
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
      {/* 1. KHU VỰC TRÁI: Chiếm toàn bộ độ rộng còn lại (flex: 1, tương đương độ rộng nút chốt ván xanh lá) */}
      <div className="toolbar-left-slot">
        {/* Nút Chốt Ván kèm Tổng Điểm Kiểm Tra (Màu xanh lá - Trạng thái mặc định) */}
        <button
          type="button"
          className={`toolbar-btn toolbar-btn-confirm ${confirmMode ? 'slide-left-out' : 'slide-in'}`}
          onClick={confirmMode ? undefined : onConfirmRound}
          title="Chốt ván và lưu lịch sử"
          tabIndex={confirmMode ? -1 : 0}
        >
          <span className="confirm-sum-text">{formattedSum}</span>
          <CheckmarkIcon width={28} height={28} className="confirm-sum-check" color="#000000" />
        </button>

        {/* Nút hành động đang được kích hoạt (Reset hoặc Undo) - Trượt sang bên trái với cùng chiều ngang */}
        <button
          type="button"
          className={`toolbar-btn toolbar-btn-active-action ${confirmMode ? 'slide-in' : 'slide-right-out'}`}
          onClick={handleCancel}
          title="Bấm để hủy thao tác"
          tabIndex={confirmMode ? 0 : -1}
        >
          {displayMode === 'reset' ? (
            <ResetIcon width={28} height={28} color="#000000" />
          ) : (
            <UndoIcon width={28} height={28} />
          )}
        </button>
      </div>

      {/* 2. KHU VỰC PHẢI: Chiều rộng cố định 212px (bằng 3 nút 68px + 2 khoảng cách 4px) */}
      <div className="toolbar-right-slot">
        {/* Bộ 3 nút chức năng mặc định: Reset, Undo, QR MoMo */}
        <div
          className={`toolbar-right-group toolbar-right-default ${
            confirmMode || isError ? 'slide-left-out' : 'slide-in'
          }`}
        >
          {/* Nút Reset (Cột 2) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-reset"
            onClick={() => handleTriggerMode('reset')}
            title="Reset toàn bộ điểm về 0"
            tabIndex={confirmMode || isError ? -1 : 0}
          >
            <ResetIcon width={28} height={28} />
          </button>

          {/* Nút Back/Undo (Cột 3) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-undo"
            onClick={() => canUndo && handleTriggerMode('undo')}
            disabled={!canUndo}
            title="Hoàn tác ván trước"
            tabIndex={confirmMode || isError ? -1 : 0}
          >
            <UndoIcon width={28} height={28} />
          </button>

          {/* Nút QR Code Quỹ Chiếu Quỷ (Cột 4) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-qr toolbar-btn-info"
            onClick={confirmMode || isError ? undefined : (onQrClick || onInfoClick)}
            title="Quỹ Chiếu Quỷ (Mã QR MoMo)"
            tabIndex={confirmMode || isError ? -1 : 0}
          >
            <QrCodeIcon width={28} height={28} />
          </button>
        </div>

        {/* Bộ 2 nút xác nhận hiện ra: Nút Xác nhận (Xanh ✓) và Nút Hủy (Đỏ ✕) */}
        <div
          className={`toolbar-right-group toolbar-right-confirm ${
            confirmMode && !isError ? 'slide-in' : 'slide-right-out'
          }`}
        >
          {/* Nút Xác nhận Đồng ý (Xanh lá) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-confirm-yes"
            onClick={handleExecuteConfirm}
            title={confirmMode === 'reset' ? 'Xác nhận Reset toàn bộ điểm' : 'Xác nhận hoàn tác ván đấu'}
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

        {/* Khối Thông báo lỗi "LỖI CMNR" khi tổng điểm chưa bằng 0 (Nền đỏ, tự mất sau 1s) */}
        <div
          className={`toolbar-right-group toolbar-right-error ${
            isError ? 'slide-in' : 'slide-right-out'
          }`}
        >
          <span className="toolbar-error-text">LỖI CMNR</span>
        </div>
      </div>
    </div>
  );
}
