/* ═══════════════════════════════════════════════════════════════
   TOEICThaySang — exam-engine.js (ES Module)
   Import Firebase, kiểm tra auth/whitelist trước khi vào làm bài
   Render: auth gate → chọn part → làm bài → kết quả
═══════════════════════════════════════════════════════════════ */

import { initializeApp }        from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut }
                                from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc, addDoc, collection, query, where, getDocs }
                                from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

// ── Firebase config ──
const firebaseConfig = {
  apiKey:            'AIzaSyCZsFnaI6k4lxUkQOCcfxjEWyvtAJGfa_8',
  authDomain:        'toeic-thay-sang.firebaseapp.com',
  projectId:         'toeic-thay-sang',
  storageBucket:     'toeic-thay-sang.firebasestorage.app',
  messagingSenderId: '30478577148',
  appId:             '1:30478577148:web:6cae530feb9abdf2a59679',
};
const fbApp = initializeApp(firebaseConfig);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);

// ── GUARD: phải có EXAM_DATA ──
if (typeof EXAM_DATA === 'undefined') {
  document.body.innerHTML = '<div style="padding:40px;font-family:sans-serif;color:#dc2626">Lỗi: Không tìm thấy EXAM_DATA.</div>';
  throw new Error('EXAM_DATA missing');
}
const ED = EXAM_DATA;

// ══════════════════════════════════════════════════════════════
// HELPERS
// ══════════════════════════════════════════════════════════════
const el   = id  => document.getElementById(id);
const make = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls)              e.className = cls;
  if (html !== undefined) e.innerHTML = html;
  return e;
};
const fmtTime = sec => {
  const m = Math.floor(sec / 60).toString().padStart(2,'0');
  const s = (sec % 60).toString().padStart(2,'0');
  return `${m}:${s}`;
};
const escHtml = str => String(str)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
const youtubeEmbed = url => {
  if (!url) return '';
  const m1 = url.match(/youtu\.be\/([^?&]+)/);
  if (m1) return `https://www.youtube.com/embed/${m1[1]}`;
  const m2 = url.match(/[?&]v=([^&]+)/);
  if (m2) return `https://www.youtube.com/embed/${m2[1]}`;
  if (url.includes('/embed/')) return url;
  return url;
};

// ══════════════════════════════════════════════════════════════
// FIREBASE AUTH & WHITELIST
// ══════════════════════════════════════════════════════════════
async function checkWhitelist(email) {
  try {
    const q    = query(collection(db,'whitelist'), where('email','==', email));
    const snap = await getDocs(q);
    return !snap.empty;
  } catch(e) { return false; }
}

async function doSignIn() {
  const provider = new GoogleAuthProvider();
  try {
    const result  = await signInWithPopup(auth, provider);
    const allowed = await checkWhitelist(result.user.email);
    if (!allowed) {
      await signOut(auth);
      return { user: null, allowed: false, email: result.user.email };
    }
    return { user: result.user, allowed: true, email: result.user.email };
  } catch(e) {
    return { user: null, allowed: false, email: null };
  }
}

async function saveResultToFirebase(user, R) {
  try {
    await addDoc(collection(db,'results'), {
      uid:           user.uid,
      email:         user.email,
      displayName:   user.displayName || '',
      examId:        R.examId,
      examTitle:     R.examTitle,
      mode:          R.mode,
      selectedParts: R.selectedParts,
      partResults:   R.partResults,
      totalCorrect:  R.totalCorrect,
      totalQ:        R.totalQ,
      elapsed:       R.elapsed,
      score:         R.totalCorrect * 5,
      pct:           R.totalQ > 0 ? Math.round(R.totalCorrect / R.totalQ * 100) : 0,
      createdAt:     new Date(),
    });
  } catch(e) { console.error('Firebase save error:', e); }
}

async function getHistory(user, examId) {
  try {
    const q    = query(collection(db,'results'),
      where('uid','==', user.uid), where('examId','==', examId));
    const snap = await getDocs(q);
    const rows = [];
    snap.forEach(d => rows.push({ id: d.id, ...d.data() }));
    rows.sort((a,b) => {
      const ta = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
      const tb = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
      return tb - ta;
    });
    return rows;
  } catch(e) { return []; }
}

// ══════════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════════
let currentUser = null;

let state = {
  mode:          null,
  selectedParts: [],
  timeLimit:     0,
  screens:       [],
  currentIdx:    0,
  answers:       {},
  flags:         {},
  timerInterval: null,
  secondsLeft:   0,
  started:       false,
  finished:      false,
  startTime:     null,
  showSolution:  {},
  showImg:       {},
};

const LS_KEY = 'exam_progress_' + ED.id;

// ══════════════════════════════════════════════════════════════
// LOCALSTORAGE
// ══════════════════════════════════════════════════════════════
function saveProgress() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify({
      mode:          state.mode,
      selectedParts: state.selectedParts,
      timeLimit:     state.timeLimit,
      secondsLeft:   state.secondsLeft,
      currentIdx:    state.currentIdx,
      answers:       state.answers,
      flags:         state.flags,
      startTime:     state.startTime,
      savedAt:       Date.now(),
    }));
  } catch(e) {}
}
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)); } catch(e) { return null; }
}
function clearProgress() { localStorage.removeItem(LS_KEY); }

// ══════════════════════════════════════════════════════════════
// EXAM DATA HELPERS
// ══════════════════════════════════════════════════════════════
function getPartQuestions(p) {
  const part = ED.parts[String(p)];
  if (!part) return [];
  if (part.questions) return part.questions.map(q => q.q);
  if (part.groups)    return part.groups.flatMap(g => g.questions.map(q => q.q));
  return [];
}

function getQuestionData(qNum) {
  for (let p = 1; p <= 7; p++) {
    const part = ED.parts[String(p)];
    if (!part) continue;
    if (part.questions) {
      const q = part.questions.find(q => q.q === qNum);
      if (q) return { part: p, q };
    }
    if (part.groups) {
      for (const g of part.groups) {
        const q = g.questions.find(q => q.q === qNum);
        if (q) return { part: p, group: g, q };
      }
    }
  }
  return null;
}

function countAnswered(qNums) {
  return qNums.filter(q => state.answers[q]).length;
}

function screenKey(sc) {
  if (sc.q)     return `p${sc.part}_q${sc.q.q}`;
  if (sc.group) return `p${sc.part}_g${sc.groupIdx}`;
  return `p${sc.part}`;
}

// ══════════════════════════════════════════════════════════════
// BUILD SCREENS
// ══════════════════════════════════════════════════════════════
function buildScreens(parts) {
  const screens = [];
  parts.forEach(pNum => {
    const part = ED.parts[String(pNum)];
    if (!part) return;
    if ([1,2,5].includes(pNum) && part.questions) {
      part.questions.forEach(q => screens.push({ type:`p${pNum}`, part:pNum, q }));
    }
    if ([3,4,6,7].includes(pNum) && part.groups) {
      part.groups.forEach((g, gi) => screens.push({ type:`p${pNum}`, part:pNum, group:g, groupIdx:gi }));
    }
  });
  return screens;
}

// ══════════════════════════════════════════════════════════════
// 1. AUTH GATE
// ══════════════════════════════════════════════════════════════
function renderAuthGate(blockedEmail) {
  document.body.innerHTML = '';
  document.body.className = 'auth-page';

  const card = make('div','auth-card');
  const isBlocked = !!blockedEmail;

  card.innerHTML = `
    <div class="auth-lock-icon">${isBlocked ? '🔒' : '🔑'}</div>
    <div class="auth-title">${isBlocked ? 'Tài khoản chưa được kích hoạt' : 'Đăng nhập để làm bài'}</div>
    <div class="auth-sub">
      ${isBlocked
        ? `Gmail <b>${blockedEmail}</b> chưa có quyền truy cập.<br>Vui lòng nâng cấp tài khoản hoặc đăng nhập bằng Gmail khác.`
        : `Vui lòng đăng nhập bằng Gmail để tiếp tục.`}
    </div>
    <button class="btn-google-login" id="btnGoogle">
      <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google">
      Đăng nhập bằng Google
    </button>
    ${isBlocked ? '<div class="auth-divider">hoặc</div><button class="btn-upgrade" id="btnUpgrade">🚀 Nâng cấp tài khoản</button>' : ''}
  `;
  document.body.appendChild(card);

  card.querySelector('#btnGoogle').addEventListener('click', async () => {
    const btn = card.querySelector('#btnGoogle');
    btn.textContent = 'Đang đăng nhập...';
    btn.disabled = true;

    const { user, allowed, email } = await doSignIn();
    if (allowed && user) {
      currentUser = user;
      renderSelectPage();
    } else if (email) {
      renderAuthGate(email);
    } else {
      btn.innerHTML = `<img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google"> Đăng nhập bằng Google`;
      btn.disabled = false;
    }
  });

  const btnUpgrade = card.querySelector('#btnUpgrade');
  if (btnUpgrade) {
    btnUpgrade.addEventListener('click', () => {
      const root = typeof PATH_TO_ROOT !== 'undefined' ? PATH_TO_ROOT : '../../../';
      window.location.href = root + 'upgrade.html';
    });
  }
}

// ══════════════════════════════════════════════════════════════
// 2. TRANG CHỌN PART
// ══════════════════════════════════════════════════════════════
function renderSelectPage() {
  document.body.innerHTML = '';
  document.body.className = '';

  const page = make('div','select-page');

  // Header
  const hdr = make('div','select-header');
  hdr.innerHTML = `
    <div class="select-logo">TOEIC Thầy Sang</div>
    <div class="select-title">${ED.title}</div>`;
  page.appendChild(hdr);

  // Card
  const card = make('div','select-card');

  // Tabs chế độ
  const tabs = make('div','mode-tabs');
  tabs.innerHTML = `
    <button class="mode-tab active" data-mode="practice">
      <span class="mode-tab-label">🎯 Luyện tập</span>
      <span class="mode-tab-note">Luyện tập trọn đề hoặc theo part, xem bài giải tự do</span>
    </button>
    <button class="mode-tab" data-mode="test">
      <span class="mode-tab-label">📝 Thi thử</span>
      <span class="mode-tab-note">Thi thử trọn đề hoặc theo part, xem bài giải chỉ khi hoàn thành</span>
    </button>`;
  card.appendChild(tabs);

  const body = make('div','select-body');

  // Lịch sử làm bài
  if (currentUser) {
    const historyWrap = make('div','');
    historyWrap.id = 'historyWrap';
    historyWrap.style.marginBottom = '8px';
    body.appendChild(historyWrap);
    loadHistoryBadge(historyWrap);
  }

  // Chọn part
  body.appendChild(make('div','select-section-label','Chọn part'));

  const PART_INFO = [
    {p:1,range:'Câu 1–6'   }, {p:2,range:'Câu 7–31'  },
    {p:3,range:'Câu 32–70' }, {p:4,range:'Câu 71–100' },
    {p:5,range:'Câu 101–130'},{p:6,range:'Câu 131–146'},
    {p:7,range:'Câu 147–200'},
  ];
  const partGrid = make('div','part-grid');
  PART_INFO.forEach(({p,range}) => {
    const btn = make('button','part-btn');
    btn.dataset.part = p;
    btn.innerHTML = `<span class="part-btn-label">Part ${p}</span><span class="part-btn-range">${range}</span>`;
    partGrid.appendChild(btn);
  });
  body.appendChild(partGrid);

  const selectAllBtn = make('button','select-all-btn','☑ Chọn tất cả 7 part');
  body.appendChild(selectAllBtn);

  // Ghi chú thi thử full
  const fullNote = make('div','exam-full-note',
    '⏱ Thi thử trọn đề: thời gian cố định <b>120 phút</b>.');
  body.appendChild(fullNote);

  body.appendChild(make('div','select-divider'));

  // Chọn thời gian
  const timeLabel = make('div','select-section-label','Thời gian làm bài');
  body.appendChild(timeLabel);

  const timeSection = make('div','time-section');
  const timeOptions = make('div','time-options');
  for (let m = 5; m <= 75; m += 5) {
    const chip = make('button','time-chip',`${m} phút`);
    chip.dataset.minutes = m;
    timeOptions.appendChild(chip);
  }
  timeSection.appendChild(timeOptions);

  const customWrap = make('div','time-custom-wrap');
  customWrap.innerHTML = `
    <label>Hoặc nhập số phút (tối đa 120):</label>
    <input type="number" class="time-custom-input" id="customMinutes" min="1" max="120" placeholder="—">`;
  timeSection.appendChild(customWrap);
  body.appendChild(timeSection);

  body.appendChild(make('div','select-divider'));

  // Nút bắt đầu
  const btnStart = make('button','btn-start','Chọn part và thời gian để bắt đầu');
  btnStart.id = 'btnStart';
  btnStart.disabled = true;
  body.appendChild(btnStart);

  // Nút đăng xuất
  if (currentUser) {
    const signOutWrap = make('div','');
    signOutWrap.style.cssText = 'text-align:center;margin-top:16px';
    signOutWrap.innerHTML = `
      <span style="font-size:12px;color:#94a3b8">Đăng nhập: ${currentUser.email}</span>
      <button id="btnSignOut" style="margin-left:10px;background:none;border:none;font-size:12px;color:#94a3b8;cursor:pointer;text-decoration:underline">Đăng xuất</button>`;
    body.appendChild(signOutWrap);
  }

  card.appendChild(body);
  page.appendChild(card);
  document.body.appendChild(page);

  // ── Logic ──
  let selParts  = [];
  let selMinutes = 0;
  let curMode   = 'practice';

  function isFullTest() {
    return curMode === 'test' && selParts.length === 7;
  }

  function updateUI() {
    const full  = isFullTest();
    fullNote.classList.toggle('visible', full);
    timeSection.style.display = full ? 'none' : '';
    timeLabel.style.display   = full ? 'none' : '';

    const ready = selParts.length > 0 && (full || selMinutes > 0);
    btnStart.disabled = !ready;
    btnStart.className = 'btn-start' + (ready ? ' ready' : '');
    btnStart.textContent = ready ? '▶ Bắt đầu làm bài' : 'Chọn part và thời gian để bắt đầu';
  }

  // Tabs
  tabs.querySelectorAll('.mode-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.querySelectorAll('.mode-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      curMode = tab.dataset.mode;
      updateUI();
    });
  });

  // Part buttons
  partGrid.querySelectorAll('.part-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = parseInt(btn.dataset.part);
      if (selParts.includes(p)) {
        selParts = selParts.filter(x => x !== p);
        btn.classList.remove('selected');
      } else {
        selParts.push(p);
        btn.classList.add('selected');
      }
      selParts.sort((a,b) => a-b);
      selectAllBtn.classList.toggle('active', selParts.length === 7);
      updateUI();
    });
  });

  // Chọn tất cả
  selectAllBtn.addEventListener('click', () => {
    if (selParts.length === 7) {
      selParts = [];
      partGrid.querySelectorAll('.part-btn').forEach(b => b.classList.remove('selected'));
      selectAllBtn.classList.remove('active');
    } else {
      selParts = [1,2,3,4,5,6,7];
      partGrid.querySelectorAll('.part-btn').forEach(b => b.classList.add('selected'));
      selectAllBtn.classList.add('active');
    }
    updateUI();
  });

  // Chips thời gian
  timeOptions.querySelectorAll('.time-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      timeOptions.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      selMinutes = parseInt(chip.dataset.minutes);
      el('customMinutes').value = '';
      updateUI();
    });
  });

  // Custom input
  el('customMinutes').addEventListener('input', e => {
    let v = parseInt(e.target.value);
    if (isNaN(v) || v < 1) { selMinutes = 0; }
    else {
      if (v > 120) { v = 120; e.target.value = 120; }
      selMinutes = v;
    }
    timeOptions.querySelectorAll('.time-chip').forEach(c => c.classList.remove('selected'));
    updateUI();
  });

  // Bắt đầu
  btnStart.addEventListener('click', () => {
    if (btnStart.disabled) return;
    const minutes = isFullTest() ? 120 : selMinutes;
    startExam(curMode, selParts, minutes * 60);
  });

  // Đăng xuất
  const btnSignOut = el('btnSignOut');
  if (btnSignOut) {
    btnSignOut.addEventListener('click', async () => {
      await signOut(auth);
      currentUser = null;
      renderAuthGate(null);
    });
  }

  // Resume
  const saved = loadProgress();
  if (saved && saved.answers && Object.keys(saved.answers).length > 0) {
    showResumeModal(saved);
  }
}

// ── Lịch sử làm bài ──
async function loadHistoryBadge(wrap) {
  if (!currentUser) return;
  const history = await getHistory(currentUser, ED.id);
  if (history.length === 0) return;

  const last = history[0];
  const date = last.createdAt?.toDate
    ? last.createdAt.toDate().toLocaleDateString('vi-VN')
    : '—';

  const badge = make('div','');
  badge.style.cssText = 'background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;font-size:13px;color:#15803d;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between';
  badge.innerHTML = `
    <span>✓ Đã làm: <b>${last.totalCorrect}/${last.totalQ} câu đúng</b> — ${date}</span>
    <button id="btnHistory" style="background:none;border:none;font-size:12px;color:#15803d;cursor:pointer;text-decoration:underline;font-weight:600">Xem lịch sử</button>`;
  wrap.appendChild(badge);

  badge.querySelector('#btnHistory').addEventListener('click', () => showHistoryModal(history));
}

function showHistoryModal(history) {
  const overlay = make('div','modal-overlay show');
  let rows = history.map(r => {
    const date = r.createdAt?.toDate
      ? r.createdAt.toDate().toLocaleString('vi-VN') : '—';
    const pct  = r.totalQ > 0 ? Math.round(r.totalCorrect/r.totalQ*100) : 0;
    return `<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #e2e8f0;font-size:13px">
      <span>${date}</span>
      <span><b>${r.totalCorrect}/${r.totalQ}</b> (${pct}%) — ${r.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}</span>
    </div>`;
  }).join('');

  overlay.innerHTML = `
    <div class="modal-box" style="max-width:500px;text-align:left">
      <div class="modal-title" style="text-align:center">📊 Lịch sử làm bài</div>
      <div style="margin:16px 0;max-height:300px;overflow-y:auto">${rows}</div>
      <div class="modal-actions"><button class="modal-btn confirm" id="closeHistory">Đóng</button></div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#closeHistory').addEventListener('click', () => overlay.remove());
}

// ══════════════════════════════════════════════════════════════
// RESUME MODAL
// ══════════════════════════════════════════════════════════════
function showResumeModal(saved) {
  const overlay = make('div','modal-overlay show');
  const total   = Object.keys(saved.answers).length;
  const date    = new Date(saved.savedAt).toLocaleString('vi-VN');

  overlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">📂 Tiếp tục bài làm?</div>
      <div class="resume-info">
        Bạn có bài làm chưa hoàn thành:<br>
        <b>${saved.mode === 'practice' ? 'Luyện tập' : 'Thi thử'}</b> — Part ${saved.selectedParts.join(', ')}<br>
        Đã trả lời: <b>${total} câu</b><br>
        Lưu lúc: ${date}
      </div>
      <div class="modal-actions">
        <button class="modal-btn cancel" id="resumeNo">Bắt đầu mới</button>
        <button class="modal-btn confirm" id="resumeYes">Tiếp tục</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector('#resumeYes').addEventListener('click', () => {
    overlay.remove();
    state.mode          = saved.mode;
    state.selectedParts = saved.selectedParts;
    state.timeLimit     = saved.timeLimit;
    state.secondsLeft   = saved.secondsLeft;
    state.currentIdx    = saved.currentIdx;
    state.answers       = saved.answers;
    state.flags         = saved.flags || {};
    state.startTime     = saved.startTime;
    state.screens       = buildScreens(saved.selectedParts);
    state.showSolution  = {};
    state.showImg       = {};
    renderExamPage();
  });

  overlay.querySelector('#resumeNo').addEventListener('click', () => {
    overlay.remove();
    clearProgress();
  });
}

// ══════════════════════════════════════════════════════════════
// BẮT ĐẦU LÀM BÀI
// ══════════════════════════════════════════════════════════════
function startExam(mode, parts, seconds) {
  state = {
    mode, selectedParts: parts, timeLimit: seconds,
    secondsLeft: seconds, screens: buildScreens(parts),
    currentIdx: 0, answers: {}, flags: {},
    timerInterval: null, started: true, finished: false,
    startTime: Date.now(), showSolution: {}, showImg: {},
  };
  renderExamPage();
}

// ══════════════════════════════════════════════════════════════
// RENDER TRANG LÀM BÀI
// ══════════════════════════════════════════════════════════════
function renderExamPage() {
  document.body.innerHTML = '';
  document.body.className = 'exam-page';

  // Topbar
  const topbar = make('div','topbar');
  topbar.innerHTML = `
    <div class="topbar-logo">TOEIC Thầy Sang</div>
    <div class="topbar-title">${ED.title}</div>
    <div class="topbar-right">
      <div class="timer" id="timerDisplay">${fmtTime(state.secondsLeft)}</div>
      <button class="topbar-btn" id="btnSheet">📋 Phiếu tô</button>
      <button class="topbar-btn submit-btn" id="btnSubmit">Nộp bài</button>
    </div>`;
  document.body.appendChild(topbar);

  // Answer sheet overlay
  const sheetOverlay = make('div','answer-sheet-overlay');
  sheetOverlay.id = 'sheetOverlay';
  sheetOverlay.innerHTML = `
    <div class="answer-sheet">
      <div class="answer-sheet-head">
        <div class="answer-sheet-head-title">Phiếu tô đáp án</div>
        <div class="answer-sheet-legend">
          <div class="legend-item"><div class="legend-dot answered"></div> Đã chọn</div>
          <div class="legend-item"><div class="legend-dot unanswered"></div> Chưa chọn</div>
          <div class="legend-item"><span style="font-size:12px">🚩</span> Đánh dấu</div>
        </div>
      </div>
      <div class="answer-sheet-body" id="sheetBody"></div>
    </div>`;
  document.body.appendChild(sheetOverlay);

  // Exam body
  const examBody = make('div','exam-body');
  examBody.id = 'examBody';
  document.body.appendChild(examBody);

  // Confirm modal
  const confirmOverlay = make('div','modal-overlay');
  confirmOverlay.id = 'confirmOverlay';
  confirmOverlay.innerHTML = `
    <div class="modal-box">
      <div class="modal-title">📤 Nộp bài?</div>
      <div class="modal-body" id="confirmBody"></div>
      <div class="modal-actions">
        <button class="modal-btn cancel" id="confirmCancel">Làm tiếp</button>
        <button class="modal-btn confirm" id="confirmOk">Nộp bài</button>
      </div>
    </div>`;
  document.body.appendChild(confirmOverlay);

  // Warning 2 phút
  const warningOverlay = make('div','warning-overlay');
  warningOverlay.id = 'warningOverlay';
  warningOverlay.innerHTML = `
    <div class="warning-box">
      <div class="warning-icon">⚠️</div>
      <div class="warning-text">Còn 2 phút!</div>
      <div class="warning-sub">Kiểm tra lại bài làm của bạn.</div>
    </div>`;
  document.body.appendChild(warningOverlay);

  // Events
  el('btnSheet').addEventListener('click', () => toggleSheet());
  sheetOverlay.addEventListener('click', e => { if (e.target === sheetOverlay) toggleSheet(false); });
  el('btnSubmit').addEventListener('click', showConfirmModal);
  el('confirmCancel').addEventListener('click', () => confirmOverlay.classList.remove('show'));
  el('confirmOk').addEventListener('click', () => { confirmOverlay.classList.remove('show'); submitExam(); });
  document.addEventListener('keydown', handleKeydown);

  renderScreen(state.currentIdx);
  renderSheet();
  startTimer();
}

// ══════════════════════════════════════════════════════════════
// RENDER MÀN HÌNH
// ══════════════════════════════════════════════════════════════
function renderScreen(idx) {
  const examBody = el('examBody');
  if (!examBody) return;
  examBody.innerHTML = '';

  const sc  = state.screens[idx];
  if (!sc) return;

  const isPractice = state.mode === 'practice';
  const isTest     = state.mode === 'test';
  const sk         = screenKey(sc);

  const screenEl = make('div','exam-screen active');
  const left     = make('div','screen-left');
  const right    = make('div','screen-right');

  // ══ PART 1 ══
  if (sc.type === 'p1') {
    const q = sc.q;
    left.appendChild(buildAudioBlock(q.mp3, isPractice, sk));
    if (q.img) {
      const img = make('img','exam-img');
      img.src = q.img; img.alt = `Câu ${q.q}`;
      left.appendChild(img);
    }
    if (isPractice && state.showSolution[sk]) {
      appendFrag(left, buildScriptBlock(q.script, q.trans));
    }
    right.appendChild(buildQHeader(q.q, 1, sk));
    right.appendChild(buildOptions(q.q, ['A','B','C','D'], isPractice));
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // ══ PART 2 ══
  if (sc.type === 'p2') {
    const q = sc.q;
    left.appendChild(buildAudioBlock(q.mp3, isPractice, sk));
    if (isPractice && state.showSolution[sk]) {
      appendFrag(left, buildScriptBlock(q.script, q.trans));
    }
    right.appendChild(buildQHeader(q.q, 2, sk));
    right.appendChild(buildOptions(q.q, ['A','B','C'], isPractice));
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // ══ PART 3 ══
  if (sc.type === 'p3') {
    const g = sc.group;
    left.appendChild(buildAudioBlock(g.mp3, isPractice, sk));
    if (g.img) {
      const img = make('img','exam-img'); img.src = g.img; img.alt = 'Ảnh Part 3';
      left.appendChild(img);
    }
    if (isPractice && state.showSolution[sk]) {
      appendFrag(left, buildScriptBlock(g.script, g.trans));
    }
    g.questions.forEach(q => {
      right.appendChild(buildGroupQBlock(q, 3, isPractice, sk));
    });
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // ══ PART 4 ══
  if (sc.type === 'p4') {
    const g = sc.group;
    left.appendChild(buildAudioBlock(g.mp3, isPractice, sk));
    if (g.img) {
      const img = make('img','exam-img'); img.src = g.img; img.alt = 'Ảnh Part 4';
      left.appendChild(img);
    }
    if (isPractice && state.showSolution[sk]) {
      appendFrag(left, buildScriptBlock(g.script, g.trans));
    }
    g.questions.forEach(q => {
      right.appendChild(buildGroupQBlock(q, 4, isPractice, sk));
    });
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // ══ PART 5 ══
  if (sc.type === 'p5') {
    const q = sc.q;
    if (isPractice && state.showSolution[sk] && q.videoUrl) {
      const vw = make('div','video-wrap');
      vw.innerHTML = `<iframe src="${youtubeEmbed(q.videoUrl)}" allowfullscreen></iframe>`;
      left.appendChild(vw);
    } else {
      left.classList.add('empty');
    }
    right.appendChild(buildQHeader(q.q, 5, sk));
    if (q.enQ) right.appendChild(make('div','q-text', q.enQ));
    right.appendChild(buildOptions(q.q, ['A','B','C','D'], isPractice));
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // ══ PART 6 ══
  if (sc.type === 'p6') {
    const g = sc.group;
    buildMediaLeft(left, g, isPractice, sk, false);
    g.questions.forEach(q => {
      const qw = make('div','q-block');
      qw.style.cssText = 'margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e2e8f0';
      qw.appendChild(buildQHeader(q.q, 6, sk));
      if (q.enQ) qw.appendChild(make('div','q-text', q.enQ));
      qw.appendChild(buildOptions(q.q, ['A','B','C','D'], isPractice));
      right.appendChild(qw);
    });
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // ══ PART 7 ══
  if (sc.type === 'p7') {
    const g = sc.group;
    buildMediaLeft(left, g, isPractice, sk, true);
    g.questions.forEach(q => {
      const qw = make('div','q-block');
      qw.style.cssText = 'margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e2e8f0';
      qw.appendChild(buildQHeader(q.q, 7, sk));
      if (q.enQ) qw.appendChild(make('div','q-text', q.enQ));
      qw.appendChild(buildOptions(q.q, ['A','B','C','D'], isPractice));
      right.appendChild(qw);
    });
    if (isPractice) right.appendChild(buildSolutionBtn(sk));
  }

  // Navigation
  const nav     = make('div','screen-nav');
  const prevBtn = make('button','nav-btn');
  prevBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg> Trước`;

  const isListening = [1,2,3,4].includes(sc.part);
  prevBtn.disabled  = state.currentIdx === 0 || (isTest && isListening);

  const counter = make('div','screen-counter', `${idx+1} / ${state.screens.length}`);

  const nextBtn = make('button','nav-btn');
  nextBtn.innerHTML = `Sau <svg viewBox="0 0 24 24"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>`;
  nextBtn.disabled  = idx >= state.screens.length - 1;

  prevBtn.addEventListener('click', () => {
    state.currentIdx--; renderScreen(state.currentIdx); renderSheet(); saveProgress();
  });
  nextBtn.addEventListener('click', () => {
    state.currentIdx++; renderScreen(state.currentIdx); renderSheet(); saveProgress();
  });

  nav.appendChild(prevBtn);
  nav.appendChild(counter);
  nav.appendChild(nextBtn);

  screenEl.appendChild(left);
  screenEl.appendChild(right);
  el('examBody').appendChild(screenEl);
  el('examBody').appendChild(nav);
  window.scrollTo(0,0);
}

// ── Part 6/7 LEFT: ảnh hoặc video ──
function buildMediaLeft(left, g, isPractice, sk, isP7) {
  const showingVideo = isPractice && state.showSolution[sk] && !state.showImg[sk];

  if (showingVideo) {
    const firstQ = g.questions[0];
    if (firstQ && firstQ.videoUrl) {
      const vw = make('div','video-wrap');
      vw.innerHTML = `<iframe src="${youtubeEmbed(firstQ.videoUrl)}" allowfullscreen></iframe>`;
      left.appendChild(vw);
    }
    const btn = make('button','btn-toggle-img','🖼 Hiện ảnh đề thi');
    btn.addEventListener('click', () => { state.showImg[sk] = true; renderScreen(state.currentIdx); });
    left.appendChild(btn);
  } else {
    // Hiện ảnh
    if (isP7 && g.imgs && g.imgs.length > 0) {
      const cnt  = g.imgs.filter(Boolean).length;
      const grid = make('div', `exam-img-grid${cnt===2?' two':cnt>=3?' three':''}`);
      g.imgs.forEach((src, i) => {
        if (!src) return;
        const img = make('img','exam-img'); img.src = src; img.alt = `Ảnh ${i+1}`;
        grid.appendChild(img);
      });
      left.appendChild(grid);
    } else if (!isP7 && g.img) {
      const img = make('img','exam-img'); img.src = g.img; img.alt = 'Ảnh đề';
      left.appendChild(img);
    }
    // Nút xem video nếu đang hiện ảnh sau toggle
    if (isPractice && state.showSolution[sk] && state.showImg[sk]) {
      const btn = make('button','btn-toggle-img','▶ Xem video giải');
      btn.style.marginTop = '12px';
      btn.addEventListener('click', () => { state.showImg[sk] = false; renderScreen(state.currentIdx); });
      left.appendChild(btn);
    }
  }
}

// ── Group Q Block (Part 3,4) ──
function buildGroupQBlock(q, part, isPractice, sk) {
  const wrap = make('div','q-block');
  wrap.style.cssText = 'margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid #e2e8f0';
  wrap.appendChild(buildQHeader(q.q, part, sk));
  if (q.enQ) wrap.appendChild(make('div','q-text', q.enQ));
  if (isPractice && state.showSolution[sk] && q.viQ) {
    wrap.appendChild(make('div','q-text-vi', q.viQ));
  }
  wrap.appendChild(buildOptions(q.q, ['A','B','C','D'], isPractice));
  return wrap;
}

// ── Audio Block ──
function buildAudioBlock(mp3Url, isPractice, sk) {
  const wrap  = make('div','audio-wrap');
  const title = make('div','audio-title','🎧 Audio');
  wrap.appendChild(title);

  const audio = document.createElement('audio');
  audio.id       = 'examAudio_' + sk;
  audio.src      = mp3Url || '';
  audio.controls = true;

  if (!isPractice) {
    // Thi thử: phát 1 lần, không tua
    let played = false, lastTime = 0;
    audio.addEventListener('play',        () => { played = true; });
    audio.addEventListener('timeupdate',  () => { if (!audio.seeking) lastTime = audio.currentTime; });
    audio.addEventListener('seeking',     () => { if (played) audio.currentTime = lastTime; });
    audio.addEventListener('ended',       () => { audio.controls = false; });
  }
  wrap.appendChild(audio);

  if (isPractice) {
    const ctrl = make('div','audio-controls');

    const back3 = make('button','audio-ctrl-btn','⏪ -3s');
    back3.addEventListener('click', () => { audio.currentTime = Math.max(0, audio.currentTime - 3); });

    const fwd3 = make('button','audio-ctrl-btn','+3s ⏩');
    fwd3.addEventListener('click', () => { audio.currentTime = Math.min(audio.duration||0, audio.currentTime+3); });

    const spd = document.createElement('select');
    spd.className = 'speed-select';
    [0.5,0.75,1,1.25,1.5,1.75,2].forEach(v => {
      const o = document.createElement('option');
      o.value = v; o.textContent = `x${v}`;
      if (v===1) o.selected = true;
      spd.appendChild(o);
    });
    spd.addEventListener('change', () => { audio.playbackRate = parseFloat(spd.value); });

    ctrl.appendChild(back3);
    ctrl.appendChild(fwd3);
    ctrl.appendChild(spd);
    ctrl.appendChild(make('div','audio-shortcut-hint',
      '← lùi 3s &nbsp;·&nbsp; → tiến 3s &nbsp;·&nbsp; Space tạm dừng/tiếp tục'));
    wrap.appendChild(ctrl);
  }

  return wrap;
}

// ── Script Block ──
function buildScriptBlock(script, trans) {
  const frag = document.createDocumentFragment();
  if (script) {
    const b = make('div','script-box');
    b.innerHTML = `<div class="script-label">Script</div>${escHtml(script)}`;
    frag.appendChild(b);
  }
  if (trans) {
    const b = make('div','script-box vi');
    b.innerHTML = `<div class="script-label" style="color:rgba(245,197,24,0.6)">Dịch</div>${escHtml(trans)}`;
    frag.appendChild(b);
  }
  return frag;
}

function appendFrag(parent, frag) { parent.appendChild(frag); }

// ── Q Header ──
function buildQHeader(qNum, part, sk) {
  const wrap = make('div','q-header');
  wrap.appendChild(make('div','q-number', String(qNum)));
  wrap.appendChild(make('div','q-part-badge', `Part ${part}`));

  const flagBtn = make('button','q-flag-btn' + (state.flags[qNum] ? ' flagged' : ''));
  flagBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`;
  flagBtn.title = 'Đánh dấu câu này';
  flagBtn.addEventListener('click', () => {
    state.flags[qNum] = !state.flags[qNum];
    flagBtn.classList.toggle('flagged', !!state.flags[qNum]);
    renderSheet();
    saveProgress();
  });
  wrap.appendChild(flagBtn);
  return wrap;
}

// ── Options ──
function buildOptions(qNum, letters, isPractice) {
  const qd   = getQuestionData(qNum);
  const opts = qd ? (qd.q.enOpts || []) : [];
  const list = make('div','options-list');

  letters.forEach((letter, i) => {
    const item = make('div','option-item');
    item.dataset.q      = qNum;
    item.dataset.letter = letter;
    if (state.answers[qNum] === letter) item.classList.add('selected');

    item.appendChild(make('div','opt-radio'));
    item.appendChild(make('div','opt-label', letter + '.'));
    item.appendChild(make('div','opt-text',  opts[i] || ''));

    item.addEventListener('click', () => {
      state.answers[qNum] = letter;
      list.querySelectorAll('.option-item').forEach(it =>
        it.classList.toggle('selected', it.dataset.letter === letter));
      renderSheet();
      saveProgress();
    });
    list.appendChild(item);
  });
  return list;
}

// ── Solution Button ──
function buildSolutionBtn(sk) {
  const wrap = make('div','');
  wrap.style.cssText = 'display:flex;justify-content:flex-end;margin-top:8px';
  const btn = make('button','btn-solution',
    state.showSolution[sk] ? '🙈 Ẩn bài giải' : '💡 Xem bài giải');
  btn.addEventListener('click', () => {
    state.showSolution[sk] = !state.showSolution[sk];
    renderScreen(state.currentIdx);
  });
  wrap.appendChild(btn);
  return wrap;
}

// ══════════════════════════════════════════════════════════════
// PHIẾU TÔ
// ══════════════════════════════════════════════════════════════
function renderSheet() {
  const body = el('sheetBody');
  if (!body) return;
  body.innerHTML = '';

  const isTest = state.mode === 'test';
  const byPart = {};
  state.screens.forEach((sc, idx) => {
    const p = sc.part;
    if (!byPart[p]) byPart[p] = [];
    byPart[p].push({ sc, idx });
  });

  Object.keys(byPart).sort((a,b)=>a-b).forEach(p => {
    body.appendChild(make('div','answer-sheet-part-label',`Part ${p}`));

    byPart[p].forEach(({ sc, idx }) => {
      const qNums   = sc.q ? [sc.q.q] : sc.group ? sc.group.questions.map(q=>q.q) : [];
      const letters = parseInt(p)===2 ? ['A','B','C'] : ['A','B','C','D'];
      const isListening = [1,2,3,4].includes(parseInt(p));

      qNums.forEach(qNum => {
        const row = make('div','sheet-row');
        if (isTest && isListening) {
          row.classList.add('no-jump');
        } else {
          row.addEventListener('click', () => {
            state.currentIdx = idx;
            renderScreen(state.currentIdx);
            toggleSheet(false);
          });
        }

        row.appendChild(make('div','sheet-qnum', String(qNum)));

        const opts = make('div','sheet-opts');
        letters.forEach(lt => {
          const opt = make('div','sheet-opt', lt);
          if (state.answers[qNum] === lt) opt.classList.add('chosen');
          opts.appendChild(opt);
        });
        row.appendChild(opts);

        const flag = make('div','sheet-flag'+(state.flags[qNum]?' flagged':''));
        flag.innerHTML = `<svg viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`;
        flag.addEventListener('click', e => {
          e.stopPropagation();
          state.flags[qNum] = !state.flags[qNum];
          flag.classList.toggle('flagged', !!state.flags[qNum]);
          renderSheet();
          saveProgress();
        });
        row.appendChild(flag);
        body.appendChild(row);
      });
    });
  });
}

function toggleSheet(force) {
  const overlay = el('sheetOverlay');
  if (!overlay) return;
  if (force === false) overlay.classList.remove('open');
  else overlay.classList.toggle('open');
}

// ══════════════════════════════════════════════════════════════
// TIMER
// ══════════════════════════════════════════════════════════════
function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  let warned = false;

  state.timerInterval = setInterval(() => {
    state.secondsLeft--;

    const td = el('timerDisplay');
    if (td) {
      td.textContent = fmtTime(state.secondsLeft);
      td.className   = state.secondsLeft <= 60  ? 'timer danger'
                     : state.secondsLeft <= 300 ? 'timer warning'
                     : 'timer';
    }

    if (state.secondsLeft === 120 && !warned) {
      warned = true;
      const wo = el('warningOverlay');
      if (wo) { wo.classList.add('show'); setTimeout(()=>wo.classList.remove('show'), 5000); }
    }

    if (state.secondsLeft <= 0) {
      clearInterval(state.timerInterval);
      submitExam();
    }

    if (state.secondsLeft % 15 === 0) saveProgress();
  }, 1000);
}

// ══════════════════════════════════════════════════════════════
// PHÍM TẮT
// ══════════════════════════════════════════════════════════════
function handleKeydown(e) {
  if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement.tagName)) return;
  const audio = document.querySelector('audio');
  if (!audio) return;
  if (e.code === 'Space')      { e.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  if (e.code === 'ArrowLeft')  { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime-3); }
  if (e.code === 'ArrowRight') { e.preventDefault(); audio.currentTime = Math.min(audio.duration||0, audio.currentTime+3); }
}

// ══════════════════════════════════════════════════════════════
// CONFIRM & SUBMIT
// ══════════════════════════════════════════════════════════════
function showConfirmModal() {
  const allQs      = state.screens.flatMap(sc =>
    sc.q ? [sc.q.q] : sc.group ? sc.group.questions.map(q=>q.q) : []);
  const answered   = countAnswered(allQs);
  const unanswered = allQs.length - answered;

  const body = el('confirmBody');
  if (body) body.innerHTML = `
    Tổng số câu: <b>${allQs.length}</b><br>
    Đã trả lời: <b>${answered}</b><br>
    ${unanswered > 0
      ? `<span style="color:#dc2626">Chưa trả lời: <b>${unanswered} câu</b></span>`
      : `<span style="color:#16a34a">Đã trả lời đủ tất cả câu!</span>`}`;

  el('confirmOverlay').classList.add('show');
}

function submitExam() {
  clearInterval(state.timerInterval);
  document.removeEventListener('keydown', handleKeydown);
  state.finished = true;

  const elapsed = Math.round((Date.now() - state.startTime) / 1000);
  const allQs   = state.screens.flatMap(sc =>
    sc.q ? [sc.q.q] : sc.group ? sc.group.questions.map(q=>q.q) : []);

  // Tính kết quả từng part
  const partResults = {};
  for (let p = 1; p <= 7; p++) {
    const pQs = getPartQuestions(p).filter(q => allQs.includes(q));
    if (!pQs.length) continue;
    const correct = pQs.filter(q => {
      const qd = getQuestionData(q);
      return qd && state.answers[q] === qd.q.answer;
    }).length;
    partResults[p] = { total: pQs.length, correct };
  }

  const totalCorrect = Object.values(partResults).reduce((s,r) => s+r.correct, 0);

  const resultData = {
    examId: ED.id, examTitle: ED.title,
    mode: state.mode, selectedParts: state.selectedParts,
    answers: state.answers, flags: state.flags,
    partResults, totalCorrect, totalQ: allQs.length,
    elapsed, timeLimit: state.timeLimit,
  };

  // Lưu localStorage để result.html đọc
  const resultKey = 'exam_result_' + ED.id + '_' + Date.now();
  localStorage.setItem(resultKey, JSON.stringify(resultData));
  clearProgress();

  // Lưu Firebase
  if (currentUser) saveResultToFirebase(currentUser, resultData);

  // Mở tab kết quả
  const root   = typeof PATH_TO_ROOT !== 'undefined' ? PATH_TO_ROOT : '../../../';
  const resUrl = root + 'exams/result.html?key=' + encodeURIComponent(resultKey);
  window.open(resUrl, '_blank');

  // Chế độ xem lại
  enterReviewMode(resultData);
}

// ══════════════════════════════════════════════════════════════
// CHẾ ĐỘ XEM LẠI
// ══════════════════════════════════════════════════════════════
function enterReviewMode(R) {
  state.mode     = 'practice';
  state.finished = true;

  const topRight = document.querySelector('.topbar-right');
  if (topRight) topRight.innerHTML = `
    <span style="font-size:13px;color:rgba(255,255,255,0.7)">✓ Đã nộp — Chế độ xem lại</span>`;

  // Cập nhật legend phiếu tô
  const leg = document.querySelector('.answer-sheet-legend');
  if (leg) leg.innerHTML = `
    <div class="legend-item"><div class="legend-dot correct"></div> Đúng</div>
    <div class="legend-item"><div class="legend-dot wrong"></div> Sai</div>
    <div class="legend-item"><div class="legend-dot missed"></div> Bỏ trống (đáp án đúng)</div>
    <div class="legend-item"><span style="font-size:12px">🚩</span> Đánh dấu</div>`;

  renderSheetReview(R);
  renderScreen(state.currentIdx);
}

function renderSheetReview(R) {
  const body = el('sheetBody');
  if (!body) return;
  body.innerHTML = '';

  const byPart = {};
  state.screens.forEach((sc, idx) => {
    const p = sc.part;
    if (!byPart[p]) byPart[p] = [];
    byPart[p].push({ sc, idx });
  });

  Object.keys(byPart).sort((a,b)=>a-b).forEach(p => {
    body.appendChild(make('div','answer-sheet-part-label',`Part ${p}`));

    byPart[p].forEach(({ sc, idx }) => {
      const qNums   = sc.q ? [sc.q.q] : sc.group ? sc.group.questions.map(q=>q.q) : [];
      const letters = parseInt(p)===2 ? ['A','B','C'] : ['A','B','C','D'];

      qNums.forEach(qNum => {
        const qd      = getQuestionData(qNum);
        const correct = qd ? qd.q.answer : null;
        const chosen  = state.answers[qNum];

        const row = make('div','sheet-row');
        row.addEventListener('click', () => {
          state.currentIdx = idx;
          renderScreen(state.currentIdx);
          toggleSheet(false);
        });

        row.appendChild(make('div','sheet-qnum', String(qNum)));

        const opts = make('div','sheet-opts');
        letters.forEach(lt => {
          const opt = make('div','sheet-opt', lt);
          if      (!chosen && lt === correct)  opt.classList.add('missed-ans');
          else if (lt === chosen && lt === correct) opt.classList.add('correct-ans');
          else if (lt === chosen && lt !== correct) opt.classList.add('wrong-ans');
          opts.appendChild(opt);
        });
        row.appendChild(opts);

        const flag = make('div','sheet-flag'+(state.flags[qNum]?' flagged':''));
        flag.innerHTML = `<svg viewBox="0 0 24 24"><path d="M14.4 6L14 4H5v17h2v-7h5.6l.4 2h7V6z"/></svg>`;
        row.appendChild(flag);
        body.appendChild(row);
      });
    });
  });
}

// ══════════════════════════════════════════════════════════════
// KHỞI ĐỘNG — kiểm tra auth trước
// ══════════════════════════════════════════════════════════════

// Hiện loading trong khi Firebase kiểm tra session
document.body.innerHTML = '';
document.body.style.cssText = 'min-height:100vh;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)';
document.body.innerHTML = `
  <div style="text-align:center;color:rgba(255,255,255,0.7);font-family:'Segoe UI',sans-serif">
    <div style="width:40px;height:40px;border:3px solid rgba(255,255,255,0.2);border-top-color:#f5c518;border-radius:50%;animation:spin 0.75s linear infinite;margin:0 auto 16px"></div>
    <div style="font-size:14px">Đang kiểm tra tài khoản...</div>
    <style>@keyframes spin{to{transform:rotate(360deg)}}</style>
  </div>`;

onAuthStateChanged(auth, async user => {
  if (!user) {
    renderAuthGate(null);
    return;
  }
  const allowed = await checkWhitelist(user.email);
  if (!allowed) {
    await signOut(auth);
    renderAuthGate(user.email);
    return;
  }
  currentUser = user;
  renderSelectPage();
});
