import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import qrMomoUrl from '../assets/qr-momo.jpg';
import PasscodePrompt from './PasscodePrompt';
import { DEFAULT_RULES, MAX_RULE_POINT, normalizeRules } from '../constants/scoring';

// Icon ✓ và ✕ của 2 nút lưu / huỷ (Figma 174:200): nét đen dày 4px, cùng cỡ 19px
const SaveIcon = () => (
  <svg width="24" height="19" viewBox="0 0 24 19" fill="none" aria-hidden="true">
    <path d="M1.4 9.6 L8.6 16.8 L22.6 2.2" stroke="#000000" strokeWidth="4" />
  </svg>
);
const CancelIcon = () => (
  <svg width="19" height="19" viewBox="0 0 19 19" fill="none" aria-hidden="true">
    <path d="M1.5 1.5 L17.5 17.5 M17.5 1.5 L1.5 17.5" stroke="#000000" strokeWidth="4" />
  </svg>
);

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
 * Popup Cài đặt & Mã QR: Hỗ trợ 2 tab:
 * 1. Cài đặt: luật Sâm / Cháy của phòng (mỗi lần chỉnh phải nhập mật khẩu 1996, giống lúc xoá ở
 *    Thống kê điểm; bấm ✓ xanh để lưu, ✕ đỏ để huỷ), kèm mã QR + link bàn chơi để mọi người vào cùng xem điểm trên Firebase
 * 2. MoMo: Mã QR MoMo nộp Quỹ Chiếu Quỷ
 */
export function QrTransferModal({ isOpen, onClose, roomUrl, rules = DEFAULT_RULES, onSaveRules }) {
  const [activeTab, setActiveTab] = useState('setting'); // 'setting' | 'momo'
  // Mỗi lần sửa (SÂM hoặc CHÁY) đều phải nhập lại mật khẩu: askingRule = ô đang hỏi mật khẩu,
  // editingRule = ô đã mở khoá và đang sửa ('sam' | 'chay' | null). Lưu hoặc huỷ là khoá lại.
  const [askingRule, setAskingRule] = useState(null);
  const [editingRule, setEditingRule] = useState(null);
  const [draftValue, setDraftValue] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  // Link đầy đủ không vừa ô thì chuyển sang bản rút gọn
  const [isLinkCompact, setIsLinkCompact] = useState(false);
  const roomLinkRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setAskingRule(null);
      setEditingRule(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Esc đóng ô mật khẩu trước, bấm tiếp mới đóng popup
        if (askingRule) setAskingRule(null);
        else if (editingRule) setEditingRule(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, askingRule, editingRule]);

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

  const currentRules = normalizeRules(rules);
  const canEditRules = typeof onSaveRules === 'function';

  // Bấm SÂM hoặc CHÁY: luôn hỏi mật khẩu 1996 trước khi cho sửa ô đó
  const startEditRule = (rule) => {
    if (!canEditRules || editingRule === rule) return;
    setEditingRule(null);
    setAskingRule(rule);
  };

  const handlePasscodeSuccess = () => {
    setDraftValue(String(askingRule === 'sam' ? currentRules.samPoint : -currentRules.chayPoint));
    setEditingRule(askingRule);
    setAskingRule(null);
  };

  const sanitizeDigits = (value) => value.replace(/\D/g, '').slice(0, 3);
  const draftNumber = parseInt(draftValue, 10);
  const isDraftValid = draftNumber >= 1 && draftNumber <= MAX_RULE_POINT;

  // Nút ✓ xanh: lưu luật; nút ✕ đỏ: huỷ. Cả hai đều khoá lại, lần sau phải nhập lại mật khẩu.
  const handleSaveRule = () => {
    if (!isDraftValid) return;
    onSaveRules(normalizeRules({
      ...currentRules,
      ...(editingRule === 'sam' ? { samPoint: draftNumber } : { chayPoint: -draftNumber })
    }));
    setEditingRule(null);
  };

  const handleCancelRule = () => setEditingRule(null);

  const renderRuleRow = (rule, label, sign, shownValue, colorClass) => {
    const isEditing = editingRule === rule;
    const isTappable = canEditRules && !isEditing;
    return (
      <div className="rule-line" key={rule}>
        <div
          className={`rule-box ${isTappable ? 'is-tappable' : ''} ${isEditing ? 'is-editing' : ''}`}
          onClick={isTappable ? () => startEditRule(rule) : undefined}
          role={isTappable ? 'button' : undefined}
          title={isTappable ? `Bấm để chỉnh luật ${label} (cần mật khẩu)` : undefined}
        >
          <span className="rule-label">{label}</span>
          {isEditing ? (
            <label className={`rule-input-wrap ${colorClass}`}>
              <span>{sign}</span>
              <input
                className="rule-input"
                inputMode="numeric"
                autoFocus
                aria-label={rule === 'sam' ? 'Điểm Sâm mỗi người trả' : 'Ngưỡng điểm Cháy'}
                style={{ width: `${Math.max(2, draftValue.length) + 0.6}ch` }}
                value={draftValue}
                onChange={(e) => setDraftValue(sanitizeDigits(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveRule();
                }}
              />
            </label>
          ) : (
            <span className={`rule-value ${colorClass}`}>{shownValue}</span>
          )}
        </div>
        {isEditing && (
          <>
            <button
              type="button"
              className="rule-icon-btn rule-icon-save"
              aria-label="Lưu"
              onClick={handleSaveRule}
              disabled={!isDraftValid}
            >
              <SaveIcon />
            </button>
            <button
              type="button"
              className="rule-icon-btn rule-icon-cancel"
              aria-label="Huỷ"
              onClick={handleCancelRule}
            >
              <CancelIcon />
            </button>
          </>
        )}
      </div>
    );
  };

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
            className={`modal-qr-tab-btn ${activeTab === 'momo' ? 'active' : ''}`}
            onClick={() => setActiveTab('momo')}
          >
            MOMO
          </button>
          <button
            type="button"
            className={`modal-qr-tab-btn ${activeTab === 'setting' ? 'active' : ''}`}
            onClick={() => setActiveTab('setting')}
          >
            SETTING
          </button>
        </div>

        {activeTab === 'setting' ? (
          <>
            {/* Luật Sâm / Cháy: bấm vào ô để chỉnh (cần mật khẩu 1996 mỗi lần sửa) */}
            <div className="rule-row">
              {renderRuleRow('sam', 'SÂM', '+', `+${currentRules.samPoint}`, 'text-sam')}
              {renderRuleRow('chay', 'CHÁY', '-', `${currentRules.chayPoint}`, 'text-chay')}
            </div>

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

      {askingRule && (
        <PasscodePrompt
          ariaLabel="Nhập mật khẩu để chỉnh luật Sâm và Cháy"
          onSuccess={handlePasscodeSuccess}
          onCancel={() => setAskingRule(null)}
        />
      )}
    </div>
  );
}
