import React, { useState, useRef, useEffect } from 'react';
import { ResetIcon, UndoIcon, LedgerCalendarIcon, QrCodeIcon, CheckmarkIcon, CrossIcon } from './Icons';

export default function ActionToolbar({
  sumTotal = 0,
  canConfirm = false,
  onConfirmRound,
  onResetConfirm,
  onUndoConfirm,
  onResetClick,
  onUndoClick,
  onStatsClick,
  onLedgerClick,
  onQrClick,
  onInfoClick,
  canUndo = false,
  hasLedger = false
}) {
  // Trạng thái trượt xác nhận inline: null | 'reset' | 'undo'
  const [confirmMode, setConfirmMode] = useState(null);
  // displayMode ghi nhớ 'reset' hoặc 'undo' để giữ nguyên icon khi trượt ra
  const [displayMode, setDisplayMode] = useState('reset');

  const toolbarRef = useRef(null);

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

        {/* Nút hành động đang được kích hoạt (Reset hoặc Back) - Hiển thị chữ RESET / BACK theo yêu cầu */}
        <button
          type="button"
          className={`toolbar-btn toolbar-btn-active-action ${confirmMode ? 'slide-in' : 'slide-right-out'}`}
          onClick={handleCancel}
          title="Bấm để hủy thao tác"
          tabIndex={confirmMode ? 0 : -1}
        >
          {displayMode === 'reset' ? (
            <span className="action-confirm-label">RESET</span>
          ) : (
            <span className="action-confirm-label">BACK</span>
          )}
        </button>
      </div>

      {/* 2. KHU VỰC PHẢI: Chiều rộng cố định 212px (bằng 3 nút 68px + 2 khoảng cách 4px) */}
      <div className="toolbar-right-slot">
        {/* Bộ 3 nút chức năng mặc định: Reset, Undo, QR MoMo */}
        <div
          className={`toolbar-right-group toolbar-right-default ${
            confirmMode ? 'slide-left-out' : 'slide-in'
          }`}
        >
          {/* Nút Reset (Cột 2) */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-reset"
            onClick={() => handleTriggerMode('reset')}
            title="Reset toàn bộ điểm về 0"
            tabIndex={confirmMode ? -1 : 0}
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
            tabIndex={confirmMode ? -1 : 0}
          >
            <UndoIcon width={28} height={28} />
          </button>

          {/* Nút Sổ Thống Kê Điểm (Cột 4) - Disable khi chưa có lần chốt sổ nào giống nút Back */}
          <button
            type="button"
            className="toolbar-btn toolbar-btn-ledger toolbar-btn-info"
            onClick={() => hasLedger && !confirmMode && (onStatsClick || onLedgerClick || onQrClick || onInfoClick)()}
            disabled={!hasLedger}
            title={hasLedger ? "Sổ thống kê điểm" : "Chưa có lần chốt sổ nào"}
            tabIndex={confirmMode || !hasLedger ? -1 : 0}
          >
            <LedgerCalendarIcon width={24} height={24} color="#000000" />
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
      </div>
    </div>
  );
}
