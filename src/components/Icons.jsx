import React from 'react';

// Icon phóng to bảng lịch sử điểm
export function ExpandIcon({ className = "w-[16px] h-[16px]", width = 16, height = 16, color = "currentColor" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    </svg>
  );
}

// Exact SVG from Figma node 20:719
export function UndoIcon({ className = "w-[28px] h-[28px]", width = 28, height = 28 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 35 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.3668 27.14H10.1682V21.0794H23.3668C26.1516 21.0794 28.4172 18.8138 28.4172 16.029C28.4172 13.2441 26.1516 10.9785 23.3668 10.9785H11.919V15.8965L0 7.94823L11.919 0V4.91794H23.3668C29.4934 4.91794 34.4778 9.90235 34.4778 16.029C34.4778 22.1556 29.4934 27.14 23.3668 27.14Z" fill="black"/>
    </svg>
  );
}

// Icon QR Code chuyển khoản Quỹ Chiếu Quỷ (SVG fi_6540326)
export function QrCodeIcon({ className = "w-[28px] h-[28px]", width = 28, height = 28, color = "black" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      id="fi_6540326"
    >
      <path
        d="m16 17v-1h-3v-3h3v2h2v2h-1v2h-2v2h-2v-3h2v-1zm5 4h-4v-2h2v-2h2zm-18-18h8v8h-8zm10 0h8v8h-8zm-10 10h8v8h-8zm15 0h3v2h-3zm-12-7v2h2v-2zm0 10v2h2v-2zm10-10v2h2v-2z"
        fill={color}
      />
    </svg>
  );
}

// Icon Lịch / Sổ thống kê điểm theo ngày (Cập nhật path mới theo yêu cầu)
export function LedgerCalendarIcon({ className = "w-[26px] h-[26px]", width = 26, height = 26, color = "black" }) {
  return (
    <svg
      id="Layer_1"
      data-name="Layer 1"
      className={className}
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M0,5.32v10.68h16V5.32H0ZM7.25,14.14h-2.74v-4.41h2.74v4.41ZM11.48,14.14h-2.74v-6.96h2.74v6.96Z"
        fill={color}
      />
      <polygon
        points="13.17 1.53 13.17 0 11.86 0 11.86 1.53 4.17 1.53 4.17 0 2.87 0 2.87 .63 2.87 .63 2.87 1.53 0 1.53 0 4.05 16 4.05 16 1.53 13.17 1.53"
        fill={color}
      />
    </svg>
  );
}

// Icon Thùng Rác (Theo ảnh media_1790239596433.png) để xoá lần chốt sổ
export function TrashIcon({ className = "w-[18px] h-[18px]", width = 18, height = 18, color = "#fd6161" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M5 2.5L6.5 0.5H9.5L11 2.5H14.5V5H1.5V2.5H5ZM2.5 6.5H13.5V16H2.5V6.5Z"
        fill={color}
      />
    </svg>
  );
}

// Exact SVG from Figma node 20:713
export function CheckmarkIcon({ className = "w-[28px] h-[28px]", width = 28, height = 28, color = "black" }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M31.2311 4.57031L12.8886 21.5868L5.13144 13.3086L0 18.117L12.5321 31.4909L36 9.73965L31.2311 4.57031Z" fill={color}/>
    </svg>
  );
}

// Exact SVG from Figma node 20:945
export function BackspaceIcon({ className = "w-[29px] h-[16px]" }) {
  return (
    <svg className={className} width="29" height="16" viewBox="0 0 29 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M11.919 10.9785H28.7105V4.91794H11.919V0L0 7.94823L11.919 15.8965V10.9785Z" fill="white"/>
    </svg>
  );
}

// Reset icon (User SVG: fi_9454264)
export function ResetIcon({ className = "w-[28px] h-[28px]", width = 28, height = 28, color = "black" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m379.387 279.243v11.999c0 67.949-55.358 123.23-123.401 123.23-68.028 0-123.373-55.281-123.373-123.23 0-63.891 48.956-116.579 111.374-122.623v69.933l158.273-115.276-158.273-115.276v70.845c-111.877 6.239-200.986 99.12-200.986 212.397 0 117.315 95.544 212.758 212.985 212.758 56.898 0 110.388-22.128 150.62-62.308 40.235-40.184 62.394-93.615 62.394-150.45v-11.999z"
        fill={color}
      />
    </svg>
  );
}

// Red Cancel Cross icon for keyboard and toolbar (Exact SVG from Figma node 21:1021)
export function CrossIcon({ className = "w-[32px] h-[32px]", width = 32, height = 32, color = "#FD6161" }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 46 40" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="13.7532" y="6.24683" width="32.0925" height="6.80746" transform="rotate(45 13.7532 6.24683)" fill={color}/>
      <rect x="36.4461" y="11.0604" width="32.0925" height="6.80746" transform="rotate(135 36.4461 11.0604)" fill={color}/>
    </svg>
  );
}

// Icon Copy (Sao chép) theo SVG yêu cầu
export function CopyIcon({ className = "w-[18px] h-[18px]", width = 18, height = 18, color = "#ffffff" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M16 1H4C2.9 1 2 1.9 2 3V17H4V3H16V1ZM19 5H8C6.9 5 6 5.9 6 7V21C6 22.1 6.9 23 8 23H19C20.1 23 21 22.1 21 21V7C21 5.9 20.1 5 19 5ZM19 21H8V7H19V21Z"
        fill={color}
      />
    </svg>
  );
}

// Icon Mở đường link (media_1790304978172.png)
export function ExternalLinkIcon({ className = "w-[24px] h-[24px]", width = 24, height = 24, color = "#000000" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z" />
    </svg>
  );
}

// Icon Lưu / Tải QR (media_1790304908415.png)
export function DownloadQrIcon({ className = "w-[24px] h-[24px]", width = 24, height = 24, color = "#000000" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M11 3h2v10h4.5L12 17.5 6.5 13H11V3zm-7 16h16v2H4v-2z" />
    </svg>
  );
}

// Icon Loading quay khi đang tải QR
export function LoadingSpinnerIcon({ className = "w-[24px] h-[24px]", width = 24, height = 24, color = "#000000" }) {
  return (
    <svg
      className={`animate-spin ${className}`}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="2.75"
        strokeOpacity="0.25"
      />
      <path
        d="M12 3a9 9 0 0 1 9 9"
        stroke={color}
        strokeWidth="2.75"
        strokeLinecap="round"
      />
    </svg>
  );
}


// Icon Checkmark xác nhận đã sao chép
export function CheckIcon({ className = "w-[18px] h-[18px]", width = 18, height = 18, color = "#66ff33" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

// Icon Sắp xếp theo số điểm: Cao bên trái - thấp dần bên phải (1 2 ->)
export function SortScoreIcon({ className = "w-[26px] h-[26px]", width = 26, height = 26, color = "white" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M2.56006 22.575H22.5849L29.8601 22.4718L22.6689 29.7166L20.4473 27.5254L22.5873 25.6926H2.56006V22.575Z" fill={color}/>
      <path d="M13.3717 3.97396V18.9908H9.93971V7.59932L7.27956 8.32907L6.44299 5.3898L10.3685 3.97396H13.3717Z" fill={color}/>
      <path d="M15.4519 16.5545L20.3868 11.4303C21.2478 10.548 21.8782 9.68707 21.8782 8.82616C21.8782 7.9019 21.2905 7.27224 20.3029 7.27224C19.3153 7.27224 18.5391 7.94388 18.1399 8.86813L15.3046 7.2089C16.2494 5.02456 18.2239 3.99574 20.2609 3.99574C22.8856 3.99574 25.2379 5.71757 25.2379 8.67886C25.2379 10.4427 24.293 11.9546 22.949 13.2986L20.5128 15.7554H25.4477V18.9892H15.4519V16.553V16.5545Z" fill={color}/>
    </svg>
  );
}

// Icon Sắp xếp theo tên: A đến Z (A Z ->)
export function SortNameIcon({ className = "w-[26px] h-[26px]", width = 26, height = 26, color = "white" }) {
  return (
    <svg width={width} height={height} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      <path d="M22.6689 29.7168L20.4473 27.5254L22.5869 25.6924H2.55957V22.5752H22.585L29.8604 22.4717L22.6689 29.7168ZM29.8604 4.06445V6.88672L22.5977 15.5752H29.8604V18.9521H17.9463V16.126L25.209 7.43652H17.9463V4.06445H29.8604ZM16.5459 18.9082H13.1797L12.2422 16.5127H6.44043L5.50684 18.9082H2.13965L7.91797 4.1084H10.7676L16.5459 18.9082ZM7.75781 13.1357H10.9268L9.3418 9.08008L7.75781 13.1357Z" fill={color}/>
    </svg>
  );
}
