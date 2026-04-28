/**
 * exams/config.js — Cấu hình chung cho toàn bộ trang đề thi
 * ══════════════════════════════════════════════════════════
 * Sửa 1 file này → áp dụng TẤT CẢ trang đề thi
 * (exams/index.html, ets2024/index.html, tests/de-1.html...)
 */
const EXAM_CONFIG = {

  /* ─── LAYOUT ─── */
  hideFooter: true,    /* true = ẩn footer trong trang làm bài */
  hideNav:    false,   /* false = giữ navbar */

  /* ─── THỜI GIAN ─── */
  timeLimit:  120,     /* phút. null = không giới hạn */
  showTimer:  true,
  warningAt:  20,      /* cảnh báo (vàng) khi còn X phút */
  dangerAt:   5,       /* nguy hiểm (đỏ, nhấp nháy) khi còn X phút */

  /* ─── CÂU HỎI ─── */
  shuffleQuestions: false,   /* xáo trộn thứ tự câu hỏi */
  shuffleOptions:   false,   /* xáo trộn thứ tự đáp án A/B/C/D */

  /* ─── SAU KHI TRẢ LỜI ─── */
  showExplanation: true,     /* hiện giải thích ngay sau khi chọn đáp án */

  /* ─── KẾT QUẢ ─── */
  passingScore:     70,      /* % tối thiểu để pass */
  allowShareResult: true,    /* bật nút chia sẻ kết quả */

};

window.EXAM_CONFIG = EXAM_CONFIG;
