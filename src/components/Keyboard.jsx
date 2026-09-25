import React from 'react';
import { BackspaceIcon, CrossIcon } from './Icons';

export default function Keyboard({
  activePlayer,
  onNumberClick,
  onBackspace,
  onCancel
}) {
  return (
    <div className="keyboard-overlay">
      {/* Row 1: 1, 2, 3 */}
      <div className="keyboard-row">
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('1')}>1</button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('2')}>2</button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('3')}>3</button>
      </div>

      {/* Row 2: 4, 5, 6 */}
      <div className="keyboard-row">
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('4')}>4</button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('5')}>5</button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('6')}>6</button>
      </div>

      {/* Row 3: 7, 8, 9 */}
      <div className="keyboard-row">
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('7')}>7</button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('8')}>8</button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('9')}>9</button>
      </div>

      {/* Row 4: Nút Hủy [✕] bên trái, Phím 0 ở giữa, Phím Xóa Backspace [←] bên phải */}
      <div className="keyboard-row">
        <button type="button" className="keyboard-key keyboard-key-cancel" onClick={onCancel} title="Hủy nhập">
          <CrossIcon />
        </button>
        <button type="button" className="keyboard-key" onClick={() => onNumberClick('0')}>0</button>
        <button type="button" className="keyboard-key" onClick={onBackspace} title="Xóa">
          <BackspaceIcon />
        </button>
      </div>
    </div>
  );
}
