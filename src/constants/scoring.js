/**
 * 🎯 ĐỊNH MỨC ĐIỂM SÂM & CHÁY (dùng chung toàn ứng dụng)
 *
 * - Sâm: mỗi người còn lại trả 25 điểm cho người hô Sâm thành công.
 *   Người thắng Sâm nhận +25 × (số người chơi - 1):
 *     Bàn 2: +25 / -25
 *     Bàn 3: +50 / -25 / -25
 *     Bàn 4: +75 / -25 × 3
 *     Bàn 5: +100 / -25 × 4
 * - Cháy: -20 điểm cho mỗi người bị cháy.
 */
export const SAM_POINT = 25;
export const CHAY_POINT = -20;

// Các mức điểm tính là Cháy (+1 Cháy & tô đỏ): -20 và -25
export const CHAY_POINTS = [CHAY_POINT, -SAM_POINT];

// Điểm người thắng Sâm nhận theo số người chơi trong bàn (2 → 25, 3 → 50, 4 → 75, 5 → 100)
export function getSamWinPoints(numPlayers) {
  return numPlayers >= 2 ? SAM_POINT * (numPlayers - 1) : 0;
}

// Các mức điểm thắng Sâm hợp lệ cho bàn 2–5 người: [25, 50, 75, 100]
export const SAM_WIN_POINTS = [2, 3, 4, 5].map(getSamWinPoints);

/**
 * Tìm người thắng Sâm trong một ván (dùng cho đếm Sâm & tô màu bảng lịch sử).
 * Số người trong bàn = số ô có điểm khác 0 của ván đó (ván Sâm thì ai cũng có điểm).
 * Ván là Sâm khi đúng 1 người nhận +25 × (số người − 1) và tất cả người còn lại −25:
 *   Bàn 2: +25 | Bàn 3: +50 | Bàn 4: +75 | Bàn 5: +100
 * Trả về id người thắng Sâm, hoặc null nếu không phải ván Sâm.
 */
export function getSamWinnerId(scores = {}) {
  const entries = Object.entries(scores)
    .map(([id, v]) => [id, Number(v) || 0])
    .filter(([, v]) => v !== 0);
  const n = entries.length;
  if (n < 2 || n > 5) return null;
  const winPoints = getSamWinPoints(n);
  const winners = entries.filter(([, v]) => v === winPoints);
  if (winners.length !== 1) return null;
  const othersOk = entries.every(([id, v]) => id === winners[0][0] || v === -SAM_POINT);
  return othersOk ? winners[0][0] : null;
}
