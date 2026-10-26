import React, { useState, useEffect, useRef, useCallback } from 'react';
import Keyboard from './Keyboard';
import lockQuestionIcon from '../assets/lock-question.svg';

// Mật khẩu xác nhận xoá kết quả trong Thống kê điểm
const DELETE_PASSCODE = '1996';
const PASSCODE_LENGTH = DELETE_PASSCODE.length;

/**
 * Ô nhập mật khẩu 4 số trước khi xoá một lần chốt sổ (Thiết kế Figma "Pass")
 *
 * - Hàng nền đen: icon ổ khoá dấu hỏi bên trái + 4 ô số có gạch chân
 * - Bên dưới là bàn phím số xanh dùng lại component Keyboard
 * - Không giới hạn số lần nhập. Nhập sai đủ 4 số thì rung nhẹ, xoá trắng và nhập lại từ đầu
 * - Nhập đúng thì gọi onSuccess, bấm [✕] thì gọi onCancel
 */
export default function PasscodePrompt({ onSuccess, onCancel }) {
  const [digits, setDigits] = useState('');
  const [isWrong, setIsWrong] = useState(false);
  const wrongTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(wrongTimerRef.current), []);

  const handleNumber = useCallback((num) => {
    if (isWrong || digits.length >= PASSCODE_LENGTH) return;
    const next = digits + num;
    setDigits(next);
    if (next.length < PASSCODE_LENGTH) return;

    if (next === DELETE_PASSCODE) {
      onSuccess();
    } else {
      // Hiện đủ 4 số một chút rồi xoá trắng để nhập lại từ đầu
      setIsWrong(true);
      wrongTimerRef.current = setTimeout(() => {
        setDigits('');
        setIsWrong(false);
      }, 450);
    }
  }, [digits, isWrong, onSuccess]);

  const handleBackspace = useCallback(() => {
    if (isWrong) return;
    setDigits((prev) => prev.slice(0, -1));
  }, [isWrong]);

  // Hỗ trợ gõ phím số / Backspace trên máy tính
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        handleNumber(e.key);
      } else if (e.key === 'Backspace') {
        handleBackspace();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNumber, handleBackspace]);

  return (
    <div
      className="passcode-prompt"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
    >
      <div className="passcode-input-row" aria-label="Nhập mật khẩu để xoá">
        <img className="passcode-lock-icon" src={lockQuestionIcon} width={32} height={32} alt="" />
        <div className={`passcode-slots ${isWrong ? 'is-wrong' : ''}`}>
          {Array.from({ length: PASSCODE_LENGTH }).map((_, i) => (
            <div key={i} className="passcode-slot">
              <span className="passcode-digit">{digits[i] || ''}</span>
              <span className="passcode-slot-line" />
            </div>
          ))}
        </div>
      </div>
      <Keyboard
        onNumberClick={handleNumber}
        onBackspace={handleBackspace}
        onCancel={onCancel}
      />
    </div>
  );
}
