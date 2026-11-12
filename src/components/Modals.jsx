import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { CopyIcon, CheckIcon } from './Icons';
import qrMomoUrl from '../assets/qr-momo.jpg';
import PasscodePrompt from './PasscodePrompt';
import { DEFAULT_RULES, MAX_RULE_POINT, normalizeRules, areRulesEqual } from '../constants/scoring';

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
 * 1. Cài đặt: luật Sâm / Cháy của phòng (chỉ chỉnh được sau khi nhập mật khẩu 1996, giống lúc xoá ở
 *    Thống kê điểm), kèm mã QR + link bàn chơi để mọi người vào cùng xem điểm trên Firebase
 * 2. MoMo: Mã QR MoMo nộp Quỹ Chiếu Quỷ
 */
export function QrTransferModal({ isOpen, onClose, roomUrl, rules = DEFAULT_RULES, onSaveRules }) {
  const [activeTab, setActiveTab] = useState('setting'); // 'setting' | 'momo'
  // Luật chỉ sửa được khi đã nhập đúng mật khẩu; đóng popup là khoá lại
  const [isAskingPasscode, setIsAskingPasscode] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [draftSam, setDraftSam] = useState('');
  const [draftChay, setDraftChay] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  // Link đầy đủ không vừa ô thì chuyển sang bản rút gọn
  const [isLinkCompact, setIsLinkCompact] = useState(false);
  const roomLinkRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setIsAskingPasscode(false);
      setIsUnlocked(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Esc đóng ô mật khẩu trước, bấm tiếp mới đóng popup
        if (isAskingPasscode) setIsAskingPasscode(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, isAskingPasscode]);

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

  const startEditRules = () => {
    if (!canEditRules) return;
    if (isUnlocked) return;
    setIsAskingPasscode(true);
  };

  const handlePasscodeSuccess = () => {
    setDraftSam(String(currentRules.samPoint));
    setDraftChay(String(-currentRules.chayPoint));
    setIsAskingPasscode(false);
    setIsUnlocked(true);
  };

  const sanitizeDigits = (value) => value.replace(/\D/g, '').slice(0, 3);
  const draftRules = {
    samPoint: parseInt(draftSam, 10),
    chayPoint: -parseInt(draftChay, 10)
  };
  const isDraftValid = draftRules.samPoint >= 1 && draftRules.samPoint <= MAX_RULE_POINT
    && -draftRules.chayPoint >= 1 && -draftRules.chayPoint <= MAX_RULE_POINT;
  const isDraftChanged = isDraftValid && !areRulesEqual(draftRules, currentRules);

  const handleSaveRules = () => {
    if (!isDraftValid) return;
    onSaveRules(normalizeRules(draftRules));
    setIsUnlocked(false);
  };

  const handleResetDraft = () => {
    setDraftSam(String(DEFAULT_RULES.samPoint));
    setDraftChay(String(-DEFAULT_RULES.chayPoint));
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
            className={`modal-qr-tab-btn ${activeTab === 'setting' ? 'active' : ''}`}
            onClick={() => setActiveTab('setting')}
          >
            SETTING
          </button>
          <button
            type="button"
            className={`modal-qr-tab-btn ${activeTab === 'momo' ? 'active' : ''}`}
            onClick={() => setActiveTab('momo')}
          >
            MOMO
          </button>
        </div>

        {activeTab === 'setting' ? (
          <>
            {/* Luật Sâm / Cháy: bấm vào để chỉnh (cần mật khẩu 1996) */}
            <div className="rule-row">
              <div
                className={`rule-box ${canEditRules && !isUnlocked ? 'is-tappable' : ''} ${isUnlocked ? 'is-editing' : ''}`}
                onClick={isUnlocked ? undefined : startEditRules}
                role={canEditRules && !isUnlocked ? 'button' : undefined}
                title={canEditRules && !isUnlocked ? 'Bấm để chỉnh luật Sâm (cần mật khẩu)' : undefined}
              >
                <span className="rule-label">SÂM</span>
                {isUnlocked ? (
                  <label className="rule-input-wrap text-sam">
                    <span>+</span>
                    <input
                      className="rule-input"
                      inputMode="numeric"
                      aria-label="Điểm Sâm mỗi người trả"
                      value={draftSam}
                      onChange={(e) => setDraftSam(sanitizeDigits(e.target.value))}
                    />
                  </label>
                ) : (
                  <span className="rule-value text-sam">+{currentRules.samPoint}</span>
                )}
              </div>
              <div
                className={`rule-box ${canEditRules && !isUnlocked ? 'is-tappable' : ''} ${isUnlocked ? 'is-editing' : ''}`}
                onClick={isUnlocked ? undefined : startEditRules}
                role={canEditRules && !isUnlocked ? 'button' : undefined}
                title={canEditRules && !isUnlocked ? 'Bấm để chỉnh luật Cháy (cần mật khẩu)' : undefined}
              >
                <span className="rule-label">CHÁY</span>
                {isUnlocked ? (
                  <label className="rule-input-wrap text-chay">
                    <span>-</span>
                    <input
                      className="rule-input"
                      inputMode="numeric"
                      aria-label="Ngưỡng điểm Cháy"
                      value={draftChay}
                      onChange={(e) => setDraftChay(sanitizeDigits(e.target.value))}
                    />
                  </label>
                ) : (
                  <span className="rule-value text-chay">{currentRules.chayPoint}</span>
                )}
              </div>
            </div>

            {isUnlocked ? (
              <>
                <p className="rule-hint">
                  Sâm: mỗi người còn lại trả {isDraftValid ? draftRules.samPoint : '…'} điểm cho người hô Sâm.
                  Cháy: ô điểm {isDraftValid ? draftRules.chayPoint : '…'} (hoặc thua Sâm) tô đỏ và tính +1 Cháy.
                </p>
                <div className="rule-actions">
                  <button type="button" className="rule-btn" onClick={handleResetDraft}>MẶC ĐỊNH</button>
                  <button
                    type="button"
                    className="rule-btn rule-btn-primary"
                    onClick={handleSaveRules}
                    disabled={!isDraftChanged}
                  >
                    LƯU
                  </button>
                </div>
              </>
            ) : canEditRules ? (
              <p className="rule-hint">Bấm SÂM hoặc CHÁY để chỉnh luật (cần mật khẩu).</p>
            ) : null}

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

      {isAskingPasscode && (
        <PasscodePrompt
          ariaLabel="Nhập mật khẩu để chỉnh luật Sâm và Cháy"
          onSuccess={handlePasscodeSuccess}
          onCancel={() => setIsAskingPasscode(false)}
        />
      )}
    </div>
  );
}
