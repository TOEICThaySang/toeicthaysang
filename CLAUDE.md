# TOEIC Thầy Sang — Context cho Claude Code

## Dự án là gì
Web luyện thi TOEIC bán khoá học online. Học viên trả tiền → được truy cập đề thi ETS có giải thích chi tiết.

## Mô hình kinh doanh
- Tất cả đề thi là **paid** — click vào → redirect `upgrade.html`
- Sau này có thể mở 1–2 đề **free** để trải nghiệm (sửa `lessons.json`)
- Thanh toán: chuyển khoản → thêm Gmail vào Firebase Firestore thủ công → học viên đăng nhập được

## Những việc sắp làm
- `auth.js` + `login.html` — Firebase Auth + Firestore whitelist
- `upgrade.html` — trang giới thiệu khoá học + CTA mua
- Chèn nội dung thật vào `exams/ets2024/tests/de-1.html` → `de-10.html`
- Thêm bộ đề ETS 2023, 2025 (cùng cấu trúc `ets2024/`)

## Quy tắc KHÔNG được phá vỡ
1. **Thứ tự load script** trong mỗi trang làm bài phải đúng:
   - config.js gốc → PATH_TO_ROOT → nav.js → auth.js (khi có) → exams/config.js → EXAM_DATA → exam-engine.js
2. **exam-engine.js luôn là script cuối cùng**
3. **exams/index.html không được load exams/config.js** (sẽ ẩn footer trang danh sách)
4. **PATH_TO_ROOT phải đúng theo độ sâu:**
   - root: `''`
   - exams/: `'../'`
   - exams/ets2024/: `'../../'`
   - exams/ets2024/tests/: `'../../../'`
5. **Không tự ý gộp file** — exams.css và style.css trong exams/ là 2 file riêng có lý do

## Khi thêm bộ đề mới
Tạo đúng cấu trúc:
```
exams/etsNAM/
├── lessons.json
└── tests/
    ├── de-1.html  ← PATH_TO_ROOT = '../../../'
    └── ...
```
Sau đó cập nhật `exams/index.html` để fetch thêm lessons.json mới.

## Khi chèn nội dung đề thi
Trong mỗi file `de-X.html`:
1. Xoá `<div class="pending-wrap">...</div>`
2. Bỏ comment `examWrap` và `examSubmitWrap`
3. Thêm `EXAM_DATA` với đúng format
4. Bỏ comment `<script src="../../exam-engine.js"></script>`

## Format EXAM_DATA
```javascript
const EXAM_DATA = {
  id:        'ets2024_1',        // unique, dùng cho localStorage key
  title:     'ETS 2024 — Test 1',
  questions: [
    {
      part:        'Part 5',
      question:    'Nội dung câu hỏi...',
      options:     ['A. ...', 'B. ...', 'C. ...', 'D. ...'],
      answer:      'A',
      explanation: 'Giải thích tại sao A đúng...'
    }
  ]
};
```

## localStorage keys
- `tts_theme` — dark/light mode
- `tts_exam_{EXAM_DATA.id}` — lịch sử làm bài (ví dụ: `tts_exam_ets2024_1`)
