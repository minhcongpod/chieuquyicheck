import React from 'react';

// Exact SVG from Figma node 20:727
export function TrophyIcon({ className = "w-[16px] h-[16px]", width = 16, height = 16 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 19 19" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.3132 1.04694H14.3082V0.484693C14.3082 0.217004 14.0912 0 13.8235 0H5.15716C4.88947 0 4.67247 0.217004 4.67247 0.484693V1.04694H1.68676C1.22634 1.04694 0.853088 1.42018 0.853088 1.88061V3.50917C0.853088 5.97141 2.71431 8.02651 5.099 8.31733C5.52437 9.20795 6.25962 9.92541 7.16728 10.3197C7.98875 10.6766 8.51123 11.497 8.51123 12.3926V13.3C8.51123 13.8675 8.05118 14.3275 7.48368 14.3275C7.216 14.3275 6.99899 14.5445 6.99899 14.8122V15.0255C6.99899 15.593 6.53894 16.053 5.97144 16.053H5.48675C5.21906 16.053 5.00206 16.27 5.00206 16.5377V18.5153C5.00206 18.7829 5.21906 19 5.48675 19H13.4745C13.7422 19 13.9592 18.7829 13.9592 18.5153V16.5377C13.9592 16.27 13.7422 16.053 13.4745 16.053H12.9898C12.4223 16.053 11.9622 15.593 11.9622 15.0255V14.8122C11.9622 14.5445 11.7452 14.3275 11.4776 14.3275C10.9101 14.3275 10.45 13.8675 10.45 13.3V12.3841C10.45 11.4886 10.9723 10.6684 11.7935 10.3113C12.7014 9.91653 13.4368 9.2081 13.8622 8.31733C16.2857 8.02651 18.1469 5.9908 18.1469 3.50917V1.88061C18.1469 1.42018 17.7737 1.04694 17.3132 1.04694ZM2.52043 3.50917V2.98788C2.52043 2.83677 2.64293 2.71428 2.79403 2.71428H4.39887C4.54997 2.71428 4.67247 2.83677 4.67247 2.98788V6.10639C4.67247 6.31158 4.45612 6.44142 4.27233 6.35017C3.24063 5.83794 2.52043 4.75018 2.52043 3.50917ZM16.4796 3.50917C16.4796 4.74946 15.7602 5.82139 14.7294 6.34417C14.5457 6.43738 14.3275 6.30738 14.3275 6.10133V2.98788C14.3275 2.83677 14.45 2.71428 14.6011 2.71428H16.206C16.3571 2.71428 16.4796 2.83677 16.4796 2.98788V3.50917Z" fill="white"/>
    </svg>
  );
}

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

// Icon thu nhỏ bảng lịch sử điểm
export function CompressIcon({ className = "w-[16px] h-[16px]", width = 16, height = 16, color = "currentColor" }) {
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
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
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

// Exact SVG from Figma node 20:721
export function InfoIcon({ className = "w-[28px] h-[28px]", width = 28, height = 28 }) {
  return (
    <svg className={className} width={width} height={height} viewBox="0 0 33 34" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M23.3538 30.3308L22.8927 32.2728C21.5094 32.8353 20.4045 33.2635 19.5817 33.5578C18.758 33.8531 17.8009 34 16.7104 34C15.0358 34 13.7333 33.5773 12.8043 32.7378C11.8754 31.895 11.4107 30.8269 11.4107 29.5312C11.4107 29.0297 11.4444 28.5138 11.5145 27.9881C11.5852 27.4619 11.6976 26.8692 11.8514 26.2067L13.5801 19.9026C13.7339 19.299 13.8646 18.727 13.9693 18.1861C14.0755 17.6486 14.1267 17.154 14.1267 16.7088C14.1267 15.9038 13.9649 15.3406 13.6428 15.024C13.3207 14.7083 12.7061 14.5481 11.7937 14.5481C11.3468 14.5481 10.8875 14.6218 10.4193 14.7644C9.94907 14.9076 9.54713 15.046 9.20967 15.1746L9.67194 13.231C10.8044 12.756 11.8869 12.3492 12.9223 12.0115C13.9578 11.673 14.9362 11.5036 15.8616 11.5036C17.5247 11.5036 18.808 11.9177 19.7091 12.7459C20.6103 13.5748 21.0608 14.6492 21.0608 15.9732C21.0608 16.2472 21.0312 16.7299 20.9676 17.4198C20.9055 18.1112 20.7899 18.7447 20.6213 19.3209L18.8999 25.5997C18.7589 26.104 18.632 26.6806 18.5217 27.3293C18.4078 27.9738 18.3534 28.4662 18.3534 28.7966C18.3534 29.6303 18.5338 30.1995 18.8955 30.5021C19.2599 30.8047 19.8875 30.9552 20.7789 30.9552C21.1974 30.9552 21.6736 30.8787 22.2027 30.7285C22.7303 30.5783 23.1151 30.4463 23.3538 30.3308ZM23.7903 3.97053C23.7903 5.06448 23.3902 5.99876 22.586 6.76697C21.7839 7.53792 20.8174 7.92369 19.6867 7.92369C18.5524 7.92369 17.5835 7.53792 16.7723 6.76697C15.9625 5.99846 15.5567 5.06448 15.5567 3.97053C15.5567 2.87871 15.9625 1.94291 16.7723 1.16495C17.582 0.388216 18.5527 0 19.6867 0C20.8171 0 21.7839 0.38913 22.586 1.16495C23.3908 1.94291 23.7903 2.87902 23.7903 3.97053Z" fill="black"/>
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

// Icon Copy (Sao chép) theo ảnh đính kèm (media_1790305006150.png)
export function CopyIcon({ className = "w-[18px] h-[18px]", width = 18, height = 18, color = "#ffffff" }) {
  return (
    <svg
      className={className}
      width={width}
      height={height}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16 1H4C2.9 1 2 1.9 2 3v14h2V3h12V1z" />
      <path d="M13 5H8C6.9 5 6 5.9 6 7v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V12h-8V5z" />
      <path d="M14.5 5H21v6.5L14.5 5z" />
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
