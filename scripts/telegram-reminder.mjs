#!/usr/bin/env node
/**
 * 🤖 Bot Telegram nhắc chuyển khoản Chiếu Quỷ
 *
 * Sáng thứ 2 đến thứ 6 (GitHub Actions chạy lúc 7:00 giờ Việt Nam; thứ 7 và chủ nhật không nhắc) script này:
 *   1. Đọc phòng trên Firestore (mặc định phòng "vip") qua REST API công khai của web app.
 *   2. Gộp các lần CHỐT SỔ (dailyLedger) của hôm qua để biết ai âm, ai dương.
      Riêng thứ 2: gộp luôn thứ 6, thứ 7, chủ nhật (3 ngày trước đó).
 *   3. Gửi vào nhóm Telegram: 1 lời chúc (100 câu trong loi-chuc.json, đổi theo ngày) + danh sách người âm + link xem chi tiết.
 *
 * Biến môi trường:
 *   TELEGRAM_BOT_TOKEN  (bắt buộc khi gửi) token lấy từ @BotFather
 *   TELEGRAM_CHAT_ID    (bắt buộc khi gửi) id nhóm, dạng -100xxxxxxxxxx
 *   ROOM_ID             phòng cần đọc, mặc định "vip"
 *   POINT_VALUE         số đồng cho 1 điểm (vd 1000). Bỏ trống thì chỉ ghi điểm.
 *   MAX_LEDGER_AGE_DAYS chỉ gộp các lần chốt sổ không cũ hơn số ngày này (mặc định 1; thứ 2 tự nâng lên 3).
 *                       Cũ hơn thì bỏ qua, tránh nhắc lại nợ cũ mỗi ngày.
 *   WEEKDAYS_ONLY=1     thứ 7 và chủ nhật (giờ VN) thì không gửi gì (workflow đặt khi chạy theo lịch)
 *   DRY_RUN=1           chỉ in tin nhắn ra màn hình, không gửi (cũng có thể dùng cờ --dry-run)
 */

import { readFileSync } from 'node:fs';

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
const WEEKDAYS_ONLY = env.WEEKDAYS_ONLY === '1';
const DRY_RUN = process.argv.includes('--dry-run') || env.DRY_RUN === '1';

// 100 lời chúc thu nợ (scripts/loi-chuc.json), xoay vòng mỗi ngày một câu.
export const GREETINGS = JSON.parse(readFileSync(new URL('./loi-chuc.json', import.meta.url), 'utf8'));

export function vnDate(ms) {
  const d = new Date(ms + VN_OFFSET_MS);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate(), weekday: d.getUTCDay(), dayNumber: Math.floor((ms + VN_OFFSET_MS) / 86400000) };
}

/** Thứ 7 / chủ nhật theo giờ Việt Nam: không nhắc nợ. */
export function isWeekend(nowMs) {
  const w = vnDate(nowMs).weekday;
  return w === 0 || w === 6;
}

/** Số ngày lùi lại để gộp chốt sổ: thứ 2 lấy cả thứ 6, 7, CN (3 ngày), ngày khác 1 ngày. */
export function lookbackDays(nowMs) {
  return vnDate(nowMs).weekday === 1 ? Math.max(MAX_LEDGER_AGE_DAYS, 3) : MAX_LEDGER_AGE_DAYS;
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
  const today = vnDate(nowMs).dayNumber;
  const maxAge = lookbackDays(nowMs);
  const recent = ledger.filter(e => {
    const age = today - vnDate(e.timestamp || 0).dayNumber;
    return age >= 1 && age <= maxAge;
  });
  if (recent.length === 0) {
    return { text: lines.join('\n'), hasDebt: false, latest: null };
  }

  // Gộp điểm của tất cả các lần chốt sổ trong khoảng (thứ 2 = thứ 6 + thứ 7 + CN)
  const names = {};
  const totals = {};
  for (const e of recent) {
    for (const p of e.playersInfo || []) names[p.id] = p.name || p.id;
    for (const [id, score] of Object.entries(e.scores || {})) totals[id] = (totals[id] || 0) + (Number(score) || 0);
  }
  const latest = recent.reduce((a, b) => ((b.timestamp || 0) > (a.timestamp || 0) ? b : a));
  const entries = Object.entries(totals).map(([id, score]) => ({ name: names[id] || id, score }));
  const losers = entries.filter(e => e.score < 0).sort((a, b) => a.score - b.score);
  const label = recent.length === 1
    ? (latest.label || latest.dateStr || `${vnDate(latest.timestamp).d}/${vnDate(latest.timestamp).m}`)
    : `${vnDate(Math.min(...recent.map(e => e.timestamp || 0))).d}/${vnDate(Math.min(...recent.map(e => e.timestamp || 0))).m} đến ${vnDate(latest.timestamp).d}/${vnDate(latest.timestamp).m}`;

  if (losers.length === 0) {
    lines.push('', `Chốt sổ ${escapeHtml(label)}: không ai âm, cả nhà hòa cả làng 🤝`);
    return { text: lines.join('\n'), hasDebt: false, latest };
  }

  lines.push('');
  for (const l of losers) lines.push(`• ${escapeHtml(l.name)}: −${formatAmount(l.score)}`);
  lines.push(`Chuyển tiền sớm nha! 👉 <a href="${APP_URL}/${encodeURIComponent(ROOM_ID)}">Chi tiết</a>`);
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
  if (WEEKDAYS_ONLY && isWeekend(Date.now())) {
    console.log('Thứ 7 / chủ nhật: không nhắc nợ.');
    return;
  }
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
