// Danh sách 10 mã màu sắc chuẩn cho tối đa 10 người chơi
export const PLAYER_COLORS_10 = [
  '#f4e950', // Vàng (P1)
  '#66ff33', // Xanh lá (P2)
  '#16e4ff', // Cyan (P3)
  '#c073ff', // Tím (P4)
  '#fd6161', // Đỏ (P5)
  '#ff9f43', // Cam (P6)
  '#54a0ff', // Xanh dương đậm (P7)
  '#1dd1a1', // Xanh ngọc (P8)
  '#ff6b81', // Hồng san hô (P9)
  '#feca57'  // Vàng nghệ (P10)
];

// Dữ liệu mẫu ban đầu cho Sổ thống kê điểm theo từng lần chốt sổ (#1, #2, #3...)
// Hỗ trợ hiển thị nhiều người chơi (tối đa 10 người), trượt ngang để xem người thứ 6, 7, 8
export const SAMPLE_DAILY_LEDGER = [
  {
    id: 'ledger-1',
    roundIndex: 1,
    label: '#1',
    timestamp: Date.now() - 86400000 * 2,
    playersInfo: [
      { id: 'LINH', name: 'LINH', color: '#f4e950' },
      { id: 'CÔNG', name: 'CÔNG', color: '#66ff33' },
      { id: 'MINH', name: 'MINH', color: '#16e4ff' },
      { id: 'HẢI', name: 'HẢI', color: '#c073ff' },
      { id: 'TUẤN', name: 'TUẤN', color: '#fd6161' } // Tuấn chơi ở lần 1
    ],
    scores: {
      p1: 80, LINH: 80,
      p2: -20, CÔNG: -20,
      p3: -20, MINH: -20,
      p4: -20, HẢI: -20,
      p5: -20, TUẤN: -20
    }
  },
  {
    id: 'ledger-2',
    roundIndex: 2,
    label: '#2',
    timestamp: Date.now() - 86400000,
    playersInfo: [
      { id: 'LINH', name: 'LINH', color: '#f4e950' },
      { id: 'CÔNG', name: 'CÔNG', color: '#66ff33' },
      { id: 'MINH', name: 'MINH', color: '#16e4ff' },
      { id: 'HẢI', name: 'HẢI', color: '#c073ff' },
      { id: 'CHIẾN', name: 'CHIẾN', color: '#ff9f43' } // Người thứ 6 thay Tuấn ở lần 2
    ],
    scores: {
      p1: 20, LINH: 20,
      p2: 0, CÔNG: 0,
      p3: -20, MINH: -20,
      p4: 0, HẢI: 0,
      p5: 0, CHIẾN: 0
    }
  },
  {
    id: 'ledger-3',
    roundIndex: 3,
    label: '#3',
    timestamp: Date.now(),
    playersInfo: [
      { id: 'LINH', name: 'LINH', color: '#f4e950' },
      { id: 'CÔNG', name: 'CÔNG', color: '#66ff33' },
      { id: 'MINH', name: 'MINH', color: '#16e4ff' },
      { id: 'TOÀN', name: 'TOÀN', color: '#54a0ff' }, // Người thứ 7
      { id: 'DŨNG', name: 'DŨNG', color: '#1dd1a1' }  // Người thứ 8
    ],
    scores: {
      p1: 15, LINH: 15,
      p2: -1, CÔNG: -1,
      p3: -1, MINH: -1,
      TOÀN: -11,
      DŨNG: -2
    }
  }
];

// Danh sách gợi ý tên người chơi đã từng chơi
export const DEFAULT_KNOWN_PLAYERS = [
  'Linh',
  'Công',
  'Minh',
  'Chiến',
  'Toàn',
  'Tuấn',
  'Hải',
  'An',
  'Dũng',
  'Bình'
];
