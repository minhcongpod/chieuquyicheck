/**
 * 🎯 LUẬT ĐIỂM SÂM & CHÁY (dùng chung toàn ứng dụng)
 *
 * Luật được lưu theo từng phòng (Firebase) nên mọi người cùng phòng thấy cùng một luật.
 * Người chơi tự chỉnh ở tab "Cài đặt" (cần mật khẩu). Mặc định:
 *
 * - Sâm (samPoint = 25): mỗi người còn lại trả 25 điểm cho người hô Sâm thành công.
 *   Người thắng Sâm nhận +samPoint × (số người chơi - 1):
 *     Bàn 2: +25 / -25
 *     Bàn 3: +50 / -25 / -25
 *     Bàn 4: +75 / -25 × 3
 *     Bàn 5: +100 / -25 × 4
 * - Cháy (chayPoint = -20): người nhận đúng -20 điểm trong ván bị tính 1 Cháy (tô đỏ).
 *   Người thua Sâm (-samPoint) cũng bị tính Cháy như trước đây.
 */
export const DEFAULT_RULES = Object.freeze({ samPoint: 25, chayPoint: -20 });

// Giới hạn nhập (bàn phím điểm tối đa 3 chữ số)
export const MAX_RULE_POINT = 999;

function toPositiveInt(value, fallback) {
  const n = Math.abs(Math.round(Number(value)));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(n, MAX_RULE_POINT);
}

/**
 * Chuẩn hoá luật đọc từ Firebase/localStorage/ô nhập:
 * samPoint luôn là số nguyên dương, chayPoint luôn là số nguyên âm; thiếu hoặc sai thì dùng mặc định.
 */
export function normalizeRules(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  return {
    samPoint: toPositiveInt(r.samPoint, DEFAULT_RULES.samPoint),
    chayPoint: -toPositiveInt(r.chayPoint, -DEFAULT_RULES.chayPoint)
  };
}

export function areRulesEqual(a, b) {
  const x = normalizeRules(a);
  const y = normalizeRules(b);
  return x.samPoint === y.samPoint && x.chayPoint === y.chayPoint;
}

// Các mức điểm tính là Cháy (+1 Cháy & tô đỏ): ngưỡng Cháy và điểm thua Sâm (-samPoint)
export function getChayPoints(rules = DEFAULT_RULES) {
  const { samPoint, chayPoint } = normalizeRules(rules);
  return chayPoint === -samPoint ? [chayPoint] : [chayPoint, -samPoint];
}

export function isChayScore(score, rules = DEFAULT_RULES) {
  return getChayPoints(rules).includes(score);
}

// Điểm người thắng Sâm nhận theo số người chơi trong bàn (mặc định 2 → 25, 3 → 50, 4 → 75, 5 → 100)
export function getSamWinPoints(numPlayers, rules = DEFAULT_RULES) {
  const { samPoint } = normalizeRules(rules);
  return numPlayers >= 2 ? samPoint * (numPlayers - 1) : 0;
}

/**
 * Tìm người thắng Sâm trong một ván (dùng cho đếm Sâm & tô màu bảng lịch sử).
 * Số người trong bàn = số ô có điểm khác 0 của ván đó (ván Sâm thì ai cũng có điểm).
 * Ván là Sâm khi đúng 1 người nhận samPoint × (số người − 1) và tất cả người còn lại −samPoint.
 * Trả về id người thắng Sâm, hoặc null nếu không phải ván Sâm.
 */
export function getSamWinnerId(scores = {}, rules = DEFAULT_RULES) {
  const { samPoint } = normalizeRules(rules);
  const entries = Object.entries(scores)
    .map(([id, v]) => [id, Number(v) || 0])
    .filter(([, v]) => v !== 0);
  const n = entries.length;
  if (n < 2 || n > 5) return null;
  const winPoints = getSamWinPoints(n, rules);
  const winners = entries.filter(([, v]) => v === winPoints);
  if (winners.length !== 1) return null;
  const othersOk = entries.every(([id, v]) => id === winners[0][0] || v === -samPoint);
  return othersOk ? winners[0][0] : null;
}
