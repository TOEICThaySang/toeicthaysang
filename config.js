/**
 * ═══════════════════════════════════════════════════════
 *   TOEIC THẦY SANG — CẤU HÌNH TRUNG TÂM
 *   File: config.js (root)
 *
 *   Sửa file này khi cần:
 *   - Đổi tên web, domain
 *   - Thêm/bớt mục menu
 *   - Thay thông tin footer
 * ═══════════════════════════════════════════════════════
 */
const SITE = {

  /* ─── THÔNG TIN WEB ─── */
  name:        'TOEIC Thầy Sang',
  shortName:   'ToeicThaySang',
  tagline:     'Luyện TOEIC hiệu quả cùng Thầy Sang',
  description: 'Luyện thi TOEIC cùng Thầy Sang — Đề thi ETS chuẩn format, có giải thích chi tiết từng câu.',
  url:         'https://toeicthaysang.pages.dev',
  logo:        'assets/logo.png',                 /* ← relative từ root, nav.js tự tính */
  favicon:     'assets/favicon.png',
  ogImage:     'assets/og-image.png',             /* ← upload sau */
  themeColor:  '#1d6ff2',
  locale:      'vi_VN',
  author:      'Thầy Sang',

  /* ─── NAV LINKS ─── */
  /* Thêm mục sau: { label: '...', icon: '...', href: '...' } */
  nav: [
    { label: 'Luyện đề', icon: '📝', href: 'exams/index.html' },
  ],

  /* ─── FOOTER ─── */
  footer: {
    about:     'Luyện thi TOEIC cùng Thầy Sang — Đề thi ETS chuẩn format, có giải thích chi tiết.',
    copyright: `© ${new Date().getFullYear()} TOEIC Thầy Sang. All rights reserved.`,
  },

  /* ─── DARK MODE ─── */
  darkMode: {
    enabled: true,
    default: 'light', /* 'light' | 'dark' | 'system' */
  },

};

window.SITE = SITE;
