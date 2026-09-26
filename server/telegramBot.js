import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const TelegramBot = require('node-telegram-bot-api');
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../data');
const CHATS_FILE = path.join(DATA_DIR, 'telegram_chats.json');

// Đảm bảo thư mục lưu dữ liệu tồn tại
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let subscribedChats = [];
if (fs.existsSync(CHATS_FILE)) {
  try {
    subscribedChats = JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8'));
  } catch (e) {
    console.error('[Telegram] Lỗi đọc file chats:', e);
  }
}

function saveChats() {
  fs.writeFileSync(CHATS_FILE, JSON.stringify(subscribedChats, null, 2), 'utf-8');
}

const token = process.env.TELEGRAM_BOT_TOKEN;
let bot = null;

if (token) {
  bot = new TelegramBot(token, { polling: true });
  console.log('[Telegram] 🤖 Bot đã được khởi tạo!');

  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    if (!subscribedChats.includes(chatId)) {
      subscribedChats.push(chatId);
      saveChats();
    }
    bot.sendMessage(chatId, 'Chào bạn! Bot đã được kết nối với dự án chieuquyicheck. Mỗi khi có điểm mới, bot sẽ thông báo tại đây. Gõ /diem để xem điểm hiện tại.');
  });

  bot.onText(/\/diem/, async (msg) => {
    const chatId = msg.chat.id;
    try {
      // Import động để tránh circular dependency nếu có
      const { getOrCreateRoomState } = await import('./syncManager.js');
      const state = await getOrCreateRoomState('default'); // Lấy phòng default
      
      let replyMsg = '🏆 ĐIỂM SỐ HIỆN TẠI:\n\n';
      
      if (!state.players || state.players.length === 0) {
        replyMsg += 'Chưa có dữ liệu người chơi.';
      } else {
        // Tính tổng điểm từ history hoặc lấy trực tiếp (tùy cấu trúc)
        // Nếu dự án có lưu tổng điểm trong players hoặc cần tính từ lịch sử
        // Tạm thời liệt kê danh sách người chơi
        state.players.forEach((p, idx) => {
           let totalScore = 0;
           // Tính điểm từ history
           if (state.history) {
             state.history.forEach(round => {
                if (round.scores && round.scores[p.id]) {
                  totalScore += round.scores[p.id];
                }
             });
           }
           replyMsg += `${idx + 1}. ${p.name || 'Trống'} - Điểm: ${totalScore}\n`;
        });
      }
      
      bot.sendMessage(chatId, replyMsg);
    } catch (e) {
      console.error(e);
      bot.sendMessage(chatId, 'Đã xảy ra lỗi khi lấy điểm.');
    }
  });

} else {
  console.warn('[Telegram] ⚠️ Không tìm thấy TELEGRAM_BOT_TOKEN trong biến môi trường!');
}

export function broadcastToTelegram(message) {
  if (!bot) return;
  subscribedChats.forEach(chatId => {
    bot.sendMessage(chatId, message).catch(err => {
      console.error(`[Telegram] Lỗi gửi tin nhắn tới ${chatId}:`, err.message);
    });
  });
}
