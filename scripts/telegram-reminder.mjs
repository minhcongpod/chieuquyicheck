#!/usr/bin/env node
/**
 * 🤖 Bot Telegram nhắc chuyển khoản Chiếu Quỷ
 *
 * Mỗi sáng (GitHub Actions chạy lúc 10:00 giờ Việt Nam) script này:
 *   1. Đọc phòng trên Firestore (mặc định phòng "vip") qua REST API công khai của web app.
 *   2. Lấy lần CHỐT SỔ mới nhất (dailyLedger) để biết ai âm, ai dương.
 *   3. Gửi vào nhóm Telegram: 1 câu chúc (đổi theo ngày) + danh sách người âm cần chuyển khoản.
 *
 * Biến môi trường:
 *   TELEGRAM_BOT_TOKEN  (bắt buộc khi gửi) token lấy từ @BotFather
 *   TELEGRAM_CHAT_ID    (bắt buộc khi gửi) id nhóm, dạng -100xxxxxxxxxx
 *   ROOM_ID             phòng cần đọc, mặc định "vip"
 *   POINT_VALUE         số đồng cho 1 điểm (vd 1000). Bỏ trống thì chỉ ghi điểm.
 *   MAX_LEDGER_AGE_DAYS chỉ nhắc nợ khi lần chốt sổ mới nhất không cũ hơn số ngày này (mặc định 1).
 *                       Cũ hơn thì chỉ gửi câu chúc, tránh nhắc lại nợ cũ mỗi ngày.
 *   DRY_RUN=1           chỉ in tin nhắn ra màn hình, không gửi (cũng có thể dùng cờ --dry-run)
 */

const FIREBASE_API_KEY = 'AIzaSyAJw-5twD9rve15m_BUrvrLjVG0wrBMWfE'; // khóa web công khai, giống src/firebase.js
const PROJECT_ID = 'chieuquyicheck';
const APP_URL = 'https://minhcongpod.github.io/chieuquyicheck';
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

const env = process.env;
const ROOM_ID = (env.ROOM_ID || 'vip').trim();
const POINT_VALUE = Number(env.POINT_VALUE) || 0;
const MAX_LEDGER_AGE_DAYS = env.MAX_LEDGER_AGE_DAYS === undefined || env.MAX_LEDGER_AGE_DAYS === ''
  ? 1
  : Number(env.MAX_LEDGER_AGE_DAYS);
const DRY_RUN = process.argv.includes('--dry-run') || env.DRY_RUN === '1';

// Câu chúc đổi theo ngày trong năm, xoay vòng qua cả danh sách.
export const GREETINGS = [
  'Chào buổi sáng cả nhà! Chúc một ngày làm việc năng suất, tối về bài toàn Sâm 🍀',
  'Sáng nay trời đẹp, chúc anh em tinh thần phơi phới, tay to như bàn tay vàng ✨',
  'Chúc cả nhà ngày mới nhiều năng lượng, ít bug, nhiều tiền 💰',
  'Cà phê chưa? Chúc anh em một ngày thật suôn sẻ, chiều về chiến tiếp ☕',
  'Chúc mọi người hôm nay gặp toàn chuyện vui, đánh đâu thắng đó 🏆',
  'Ngày mới an lành! Ai đen hôm qua thì hôm nay chắc chắn đỏ 🔥',
  'Chúc cả nhà sức khỏe dồi dào, công việc hanh thông, bài về đôi heo 🐷🐷',
  'Một ngày tuyệt vời bắt đầu bằng nụ cười, và… một cái chuyển khoản đúng hạn 😄',
  'Chúc anh em sáng nay deadline nhẹ nhàng, sếp vui vẻ, lương về sớm 🎉',
  'Hít thở sâu, uống ngụm nước, chúc cả nhà một ngày rực rỡ 🌞',
  'Chúc mọi người hôm nay may mắn gấp đôi, xui xẻo chia đôi 🍀',
  'Chào ngày mới! Chúc anh em làm gì cũng thuận, nói gì cũng trúng 🎯',
  'Chúc cả nhà một ngày bình yên, chiều nay ai cũng có bộ tứ quý 🃏',
  'Sáng rồi, dậy thôi! Chúc anh em năng lượng tràn trề như vừa báo Sâm thành công 💪',
  'Chúc mọi người hôm nay code chạy ngay lần đầu, bài lên ngay ván đầu 🚀',
  'Ngày mới vui vẻ! Thua keo này ta bày keo khác, quan trọng là sòng phẳng 🤝',
  'Chúc cả nhà hôm nay cười nhiều hơn hôm qua, và thắng nhiều hơn hôm qua 😆',
  'Chúc anh em một ngày làm việc trơn tru, không bị cháy việc, cũng không bị cháy bài 🔥',
  'Buổi sáng tốt lành! Chúc ai cũng có một ngày thật đáng nhớ 🌈',
  'Chúc cả nhà mạnh khỏe, bình an, tiền vào như nước sông Đà 🌊',
  'Ngày mới, vận mới! Chúc anh em đỏ cả tình lẫn bạc ❤️',
  'Chúc mọi người hôm nay gặp toàn quý nhân, bốc toàn quân xịn 👑',
  'Một tách trà, một nụ cười, chúc cả nhà ngày mới nhẹ nhàng 🍵',
  'Chúc anh em hôm nay làm việc hết mình, chiều về chiến hết sức 💥',
  'Chúc cả nhà một ngày tràn ngập niềm vui, nợ nần sạch sẽ, lòng nhẹ tênh 🕊️',
  'Chào buổi sáng! Chúc mọi người tinh thần thép, bài chặt heo ngon lành 🐖',
  'Chúc anh em ngày mới thuận buồm xuôi gió, vạn sự như ý 🌬️',
  'Hôm nay là một ngày tuyệt vời để thắng lớn. Chúc cả nhà may mắn 🍀',
  'Chúc mọi người buổi sáng an yên, buổi chiều thắng to, buổi tối ngủ ngon 🌙',
  'Ngày mới khởi sắc! Chúc anh em vừa giỏi việc, vừa giỏi bài 🧠',
  'Chúc cả nhà hôm nay ăn ngon, làm khỏe, chơi vui, trả nợ nhanh 😎',
];

export function vnDate(ms) {
  const d = new Date(ms + VN_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), dayNumber: Math.floor((ms + VN_OFFSET_MS) / 86400000) };
}

export function pickGreeting(nowMs) {
  return GREETINGS[vnDate(nowMs).dayNumber % GREETINGS.length];
}

// Chuyển giá trị Firestore REST (stringValue, mapValue…) về JS thuần
export function fromFirestore(value) {
  if (!value || typeof value !== 'object') return value;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('nullValue' in value) return null;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(fromFirestore);
  if ('mapValue' in value) return fromFields(value.mapValue.fields || {});
  return undefined;
}

function fromFields(fields) {
  return Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, fromFirestore(v)]));
}

async function fetchRoom(roomId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/rooms/${encodeURIComponent(roomId)}?key=${FIREBASE_API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Không đọc được phòng "${roomId}" từ Firestore: HTTP ${res.status} ${await res.text()}`);
  const json = await res.json();
  return fromFields(json.fields || {});
}

function formatNumber(n) {
  return Math.abs(n).toLocaleString('vi-VN');
}

function formatAmount(points) {
  const pts = `${formatNumber(points)} điểm`;
  if (!POINT_VALUE) return pts;
  return `${formatNumber(points * POINT_VALUE)}đ (${pts})`;
}

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Dựng nội dung tin nhắn (HTML của Telegram) từ dữ liệu phòng. */
export function buildMessage(room, nowMs = Date.now()) {
  const lines = [`🌅 <b>${escapeHtml(pickGreeting(nowMs))}</b>`];

  const ledger = Array.isArray(room.dailyLedger) ? room.dailyLedger : [];
  const latest = ledger.reduce((a, b) => (!a || (b.timestamp || 0) > (a.timestamp || 0) ? b : a), null);

  const ageDays = latest ? vnDate(nowMs).dayNumber - vnDate(latest.timestamp || 0).dayNumber : Infinity;
  if (!latest || ageDays > MAX_LEDGER_AGE_DAYS) {
    return { text: lines.join('\n'), hasDebt: false, latest: null };
  }

  const names = Object.fromEntries((latest.playersInfo || []).map(p => [p.id, p.name || p.id]));
  const entries = Object.entries(latest.scores || {})
    .map(([id, score]) => ({ name: names[id] || id, score: Number(score) || 0 }));
  const losers = entries.filter(e => e.score < 0).sort((a, b) => a.score - b.score);
  const winners = entries.filter(e => e.score > 0).sort((a, b) => b.score - a.score);
  const label = latest.label || latest.dateStr || `${vnDate(latest.timestamp).d}/${vnDate(latest.timestamp).m}`;

  if (losers.length === 0) {
    lines.push('', `Chốt sổ ${escapeHtml(label)}: không ai âm, cả nhà hòa cả làng 🤝`);
    return { text: lines.join('\n'), hasDebt: false, latest };
  }

  lines.push('', `💸 <b>Nhắc chuyển khoản, chốt sổ ${escapeHtml(label)}:</b>`);
  for (const l of losers) lines.push(`• ${escapeHtml(l.name)}: −${formatAmount(l.score)}`);
  if (winners.length) {
    lines.push('', '💰 <b>Nhận:</b>');
    for (const w of winners) lines.push(`• ${escapeHtml(w.name)}: +${formatAmount(w.score)}`);
  }
  lines.push('', `Anh em âm nhớ chuyển khoản sớm nha 🙏`, `👉 Xem chi tiết: ${APP_URL}/${encodeURIComponent(ROOM_ID)}`);
  return { text: lines.join('\n'), hasDebt: true, latest };
}

async function sendTelegram(text) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error('Thiếu TELEGRAM_BOT_TOKEN hoặc TELEGRAM_CHAT_ID.');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.ok) throw new Error(`Telegram từ chối: HTTP ${res.status} ${JSON.stringify(json)}`);
}

async function main() {
  const room = await fetchRoom(ROOM_ID);
  const { text } = buildMessage(room);
  console.log(text);
  if (DRY_RUN) {
    console.log('\n(DRY_RUN: không gửi Telegram)');
    return;
  }
  await sendTelegram(text);
  console.log('\n✅ Đã gửi vào nhóm Telegram.');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}
