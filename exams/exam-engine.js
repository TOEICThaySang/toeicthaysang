/**
 * exam-engine.js — Engine làm bài thi
 * ══════════════════════════════════════════════════════════
 * Dùng chung cho TẤT CẢ file đề (de-1.html → de-10.html)
 *
 * Mỗi file đề cần khai báo EXAM_DATA TRƯỚC khi load file này:
 *   const EXAM_DATA = {
 *     id:        'ets2024_1',           // unique ID, dùng cho localStorage
 *     title:     'ETS 2024 — Test 1',  // hiện trên exam-bar và kết quả
 *     questions: [
 *       {
 *         part:        'Part 5',
 *         question:    'Nội dung câu hỏi...',
 *         options:     ['A. ...', 'B. ...', 'C. ...', 'D. ...'],
 *         answer:      'A',             // đáp án đúng: 'A' | 'B' | 'C' | 'D'
 *         explanation: 'Giải thích...' // optional
 *       },
 *       ...
 *     ]
 *   };
 */
(function () {

  /* ══════════════════════════════════════════════
     STATE
     ══════════════════════════════════════════════ */
  const state = {
    answers:   {},     /* { questionIndex: 'A'|'B'|'C'|'D' } */
    timeLeft:  EXAM_CONFIG.timeLimit ? EXAM_CONFIG.timeLimit * 60 : null,
    interval:  null,
    startTime: null,
    submitted: false,
  };

  /* ══════════════════════════════════════════════
     TIMER
     ══════════════════════════════════════════════ */
  function startTimer() {
    if (!EXAM_CONFIG.showTimer || state.timeLeft === null) return;

    updateTimerDisplay();

    state.interval = setInterval(() => {
      state.timeLeft--;
      updateTimerDisplay();
      if (state.timeLeft <= 0) {
        clearInterval(state.interval);
        _doSubmit(); /* hết giờ → nộp tự động */
      }
    }, 1000);
  }

  function updateTimerDisplay() {
    const el = document.getElementById('timerDisplay');
    if (!el || state.timeLeft === null) return;

    const minutes = Math.floor(state.timeLeft / 60);
    const seconds = state.timeLeft % 60;
    el.textContent = `⏱ ${minutes}:${String(seconds).padStart(2, '0')}`;

    /* Màu theo thời gian còn lại */
    const cls = state.timeLeft <= EXAM_CONFIG.dangerAt  * 60 ? 'danger'
              : state.timeLeft <= EXAM_CONFIG.warningAt * 60 ? 'warning'
              : '';
    el.className = `timer-display ${cls}`.trim();
  }

  /* ══════════════════════════════════════════════
     CHỌN ĐÁP ÁN
     ══════════════════════════════════════════════ */
  window.selectAnswer = function (questionIndex, chosen, optElement) {
    /* Đã trả lời câu này rồi → bỏ qua */
    if (state.answers[questionIndex] !== undefined) return;

    state.answers[questionIndex] = chosen;

    const question = EXAM_DATA.questions[questionIndex];
    const allOpts  = optElement.parentElement.querySelectorAll('.q-opt');

    /* Disable tất cả options của câu này */
    allOpts.forEach(o => {
      o.classList.add('disabled');
      o.style.pointerEvents = 'none';
    });

    /* Hiện kết quả đúng/sai */
    if (chosen === question.answer) {
      optElement.classList.add('correct');
      optElement.querySelector('.opt-check').textContent = '✓';
    } else {
      optElement.classList.add('wrong');
      optElement.querySelector('.opt-check').textContent = '✗';
      /* Highlight đáp án đúng */
      allOpts.forEach(o => {
        if (o.dataset.val === question.answer) {
          o.classList.add('correct');
          o.querySelector('.opt-check').textContent = '✓';
        }
      });
    }

    /* Hiện giải thích */
    if (EXAM_CONFIG.showExplanation && question.explanation) {
      const card = optElement.closest('.q-card');
      const expEl = card?.querySelector('.q-explanation');
      if (expEl) expEl.style.display = 'block';
    }

    /* Cập nhật progress và q-dot */
    updateProgress();
    updateQDot(questionIndex, chosen === question.answer);
  };

  /* ══════════════════════════════════════════════
     PROGRESS BAR
     ══════════════════════════════════════════════ */
  function updateProgress() {
    const answered = Object.keys(state.answers).length;
    const total    = EXAM_DATA.questions.length;
    const pct      = Math.round((answered / total) * 100);

    const fill  = document.getElementById('examProgressFill');
    const label = document.getElementById('examProgressLabel');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = `${answered}/${total}`;
  }

  /* ══════════════════════════════════════════════
     Q-NAV DOTS
     ══════════════════════════════════════════════ */
  function updateQDot(questionIndex, isCorrect) {
    const dot = document.querySelector(`.q-dot[data-idx="${questionIndex}"]`);
    if (!dot) return;
    dot.classList.remove('current', 'answered', 'wrong');
    dot.classList.add(isCorrect ? 'answered' : 'wrong');
  }

  window.scrollToQ = function (idx) {
    /* Cập nhật "current" dot */
    document.querySelectorAll('.q-dot').forEach(d => {
      if (!d.classList.contains('answered') && !d.classList.contains('wrong')) {
        d.classList.remove('current');
      }
    });
    const dot = document.querySelector(`.q-dot[data-idx="${idx}"]`);
    if (dot && !dot.classList.contains('answered') && !dot.classList.contains('wrong')) {
      dot.classList.add('current');
    }

    /* Scroll đến câu hỏi */
    const card = document.getElementById(`q-${idx}`);
    if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /* ══════════════════════════════════════════════
     NỘP BÀI
     ══════════════════════════════════════════════ */
  window.submitExam = function () {
    if (state.submitted) return;
    const unanswered = EXAM_DATA.questions.length - Object.keys(state.answers).length;
    if (unanswered > 0) {
      const ok = confirm(`Còn ${unanswered} câu chưa trả lời. Bạn vẫn muốn nộp bài?`);
      if (!ok) return;
    } else {
      const ok = confirm('Bạn chắc chắn muốn nộp bài?');
      if (!ok) return;
    }
    _doSubmit();
  };

  function _doSubmit() {
    if (state.submitted) return;
    state.submitted = true;
    clearInterval(state.interval);

    const questions    = EXAM_DATA.questions;
    const correctCount = questions.filter((q, i) => state.answers[i] === q.answer).length;
    const total        = questions.length;
    const pct          = Math.round((correctCount / total) * 100);
    const pass         = pct >= EXAM_CONFIG.passingScore;
    const elapsed      = Math.round((Date.now() - state.startTime) / 1000);
    const mins         = Math.floor(elapsed / 60);
    const secs         = elapsed % 60;

    /* Lưu lịch sử vào localStorage */
    const histKey = `tts_exam_${EXAM_DATA.id}`;
    const history = JSON.parse(localStorage.getItem(histKey) || '[]');
    history.unshift({
      date:    new Date().toLocaleDateString('vi-VN'),
      score:   pct,
      correct: correctCount,
      total,
    });
    localStorage.setItem(histKey, JSON.stringify(history.slice(0, 10)));

    /* ── Render màn hình kết quả ── */
    const wrap = document.getElementById('examWrap');
    if (!wrap) return;

    const circ   = 2 * Math.PI * 54;
    const offset = circ - (pct / 100) * circ;

    const histHTML = history.length > 1
      ? `<div class="results-history">
          <div class="results-history-title">📊 Lịch sử làm bài</div>
          ${history.slice(0, 5).map(h => `
            <div class="history-row">
              <span class="history-date">${h.date}</span>
              <span class="history-score ${h.score >= EXAM_CONFIG.passingScore ? 'pass' : 'fail'}">
                ${h.score}% &nbsp;(${h.correct}/${h.total})
              </span>
            </div>`).join('')}
        </div>`
      : '';

    wrap.innerHTML = `
      <div class="results-screen">

        <div class="score-ring-wrap">
          <svg width="150" height="150" viewBox="0 0 120 120">
            <circle class="ring-bg"
              cx="60" cy="60" r="54"/>
            <circle class="ring-fill ${pass ? 'pass' : 'fail'}"
              cx="60" cy="60" r="54"
              stroke-dasharray="${circ.toFixed(2)}"
              stroke-dashoffset="${circ.toFixed(2)}"
              id="ringFill"/>
          </svg>
          <div class="score-text">
            <div class="score-pct ${pass ? 'pass' : 'fail'}">${pct}%</div>
            <div class="score-lbl">${pass ? 'PASSED' : 'FAILED'}</div>
          </div>
        </div>

        <div class="results-title">${pass ? '🎉 Xuất sắc!' : '📚 Cần ôn thêm!'}</div>
        <div class="results-sub">
          ${pass
            ? 'Bạn đã vượt qua bài thi. Tiếp tục phát huy!'
            : `Cần đạt ${EXAM_CONFIG.passingScore}% để pass. Cố lên nhé!`}
        </div>

        <div class="results-stats">
          <div class="stat-box">
            <div class="stat-val green">${correctCount}</div>
            <div class="stat-key">Đúng</div>
          </div>
          <div class="stat-box">
            <div class="stat-val red">${total - correctCount}</div>
            <div class="stat-key">Sai</div>
          </div>
          <div class="stat-box">
            <div class="stat-val blue">${mins}:${String(secs).padStart(2,'0')}</div>
            <div class="stat-key">Thời gian</div>
          </div>
        </div>

        <div class="results-actions">
          <button class="btn btn-ghost" onclick="location.reload()">🔄 Làm lại</button>
          <button class="btn btn-ghost" onclick="history.back()">← Về danh sách</button>
          ${EXAM_CONFIG.allowShareResult
            ? `<button class="btn btn-primary"
                onclick="shareResult(${pct}, ${correctCount}, ${total})">
                📤 Chia sẻ
               </button>`
            : ''}
        </div>

        ${histHTML}
      </div>`;

    /* Animate ring sau 100ms (đảm bảo DOM đã render) */
    setTimeout(() => {
      const ring = document.getElementById('ringFill');
      if (ring) ring.style.strokeDashoffset = offset.toFixed(2);
    }, 100);

    /* Ẩn nút nộp bài */
    const submitWrap = document.getElementById('examSubmitWrap');
    if (submitWrap) submitWrap.style.display = 'none';

    /* Scroll lên đầu kết quả */
    wrap.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ══════════════════════════════════════════════
     CHIA SẺ KẾT QUẢ
     ══════════════════════════════════════════════ */
  window.shareResult = function (pct, correct, total) {
    const text = [
      `🎯 Tôi vừa làm ${EXAM_DATA.title} trên TOEIC Thầy Sang!`,
      `✅ Kết quả: ${pct}% (${correct}/${total} câu đúng)`,
      `👉 Luyện thi cùng mình: ${window.location.href}`,
    ].join('\n');

    if (navigator.share) {
      navigator.share({ title: 'Kết quả TOEIC Thầy Sang', text })
        .catch(() => {}); /* user cancel → không làm gì */
    } else {
      navigator.clipboard.writeText(text)
        .then(() => showToast('✅ Đã copy kết quả!', 'success'))
        .catch(() => showToast('❌ Không copy được', 'error'));
    }
  };

  /* ══════════════════════════════════════════════
     RENDER ĐỀ THI
     ══════════════════════════════════════════════ */
  function renderExam() {
    /* Kiểm tra EXAM_DATA */
    if (typeof EXAM_DATA === 'undefined') {
      console.error('exam-engine: EXAM_DATA chưa được khai báo!');
      return;
    }
    if (!Array.isArray(EXAM_DATA.questions) || EXAM_DATA.questions.length === 0) {
      console.error('exam-engine: EXAM_DATA.questions rỗng!');
      return;
    }

    state.startTime = Date.now();
    const questions = EXAM_CONFIG.shuffleQuestions
      ? [...EXAM_DATA.questions].sort(() => Math.random() - .5)
      : EXAM_DATA.questions;

    /* ── Hiện exam-bar ── */
    const examBar = document.getElementById('examBar');
    if (examBar) examBar.style.display = 'block';

    /* ── Title trên exam-bar ── */
    const barTitle = document.getElementById('examBarTitle');
    if (barTitle) barTitle.textContent = EXAM_DATA.title;

    /* ── Progress label initial ── */
    const label = document.getElementById('examProgressLabel');
    if (label) label.textContent = `0/${questions.length}`;

    /* ── Q-nav dots ── */
    const qNav = document.getElementById('qNav');
    if (qNav) {
      qNav.innerHTML = questions.map((q, i) => `
        <div class="q-dot ${i === 0 ? 'current' : ''}"
             data-idx="${i}"
             onclick="scrollToQ(${i})"
             title="Câu ${i + 1}">${i + 1}</div>`
      ).join('');
    }

    /* ── Render câu hỏi ── */
    const wrap = document.getElementById('examWrap');
    if (!wrap) return;

    wrap.innerHTML = questions.map((q, i) => {
      const opts = EXAM_CONFIG.shuffleOptions
        ? [...q.options].sort(() => Math.random() - .5)
        : q.options;

      const optsHTML = opts.map(o => {
        const letter = o[0]; /* 'A', 'B', 'C', 'D' */
        const text   = o.slice(3).trim(); /* bỏ 'A. ' */
        return `
          <div class="q-opt"
               data-val="${letter}"
               onclick="selectAnswer(${i}, '${letter}', this)">
            <div class="opt-circle">${letter}</div>
            <span class="opt-text">${text}</span>
            <span class="opt-check"></span>
          </div>`;
      }).join('');

      return `
        <div class="q-card" id="q-${i}">
          <div class="q-part-tag">${q.part || 'TOEIC'}</div>
          <div class="q-num">Câu ${i + 1} / ${questions.length}</div>
          <div class="q-text">${q.question}</div>
          <div class="q-opts">${optsHTML}</div>
          ${q.explanation
            ? `<div class="q-explanation">
                <strong>💡 Giải thích:</strong> ${q.explanation}
               </div>`
            : ''}
        </div>`;
    }).join('');

    /* ── Start timer ── */
    startTimer();
  }

  /* ── Init ── */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderExam);
  } else {
    renderExam();
  }

})();
