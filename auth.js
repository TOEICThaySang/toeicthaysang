/**
 * auth.js — Xác thực Google + kiểm tra whitelist
 * Load sau nav.js, trước exam-engine.js
 * Exports (window):
 *   _ttsAuthReady   — Promise<{user, whitelisted}>
 *   _ttsUser        — Firebase User | null
 *   _ttsWhitelisted — boolean
 *   _ttsDb          — Firestore instance
 */

import { initializeApp, getApps, getApp }
  from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-app.js';
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged }
  from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-auth.js';
import { getFirestore, doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/12.0.0/firebase-firestore.js';

const FB_CONFIG = {
  apiKey:            'AIzaSyCZsFnaI6k4lxUkQOCcfxjEWyvtAJGfa_8',
  authDomain:        'toeic-thay-sang.firebaseapp.com',
  projectId:         'toeic-thay-sang',
  storageBucket:     'toeic-thay-sang.firebasestorage.app',
  messagingSenderId: '30478577148',
  appId:             '1:30478577148:web:6cae530feb9abdf2a59679',
};

const fbApp = getApps().length ? getApp() : initializeApp(FB_CONFIG);
const auth  = getAuth(fbApp);
const db    = getFirestore(fbApp);
const gProvider = new GoogleAuthProvider();

// ── Whitelist: Firestore collection "whitelist", doc ID = email thường ──
async function checkWhitelist(email) {
  if (!email) return false;
  try {
    const key = email.toLowerCase().trim();
    const snap = await getDoc(doc(db, 'whitelist', key));
    return snap.exists();
  } catch(e) {
    console.error('[whitelist] error:', e);
    return false;
  }
}

// ── State chia sẻ với các script khác ──
window._ttsDb          = db;
window._ttsUser        = null;
window._ttsWhitelisted = false;
window._ttsAuthReady   = new Promise(resolve => {
  onAuthStateChanged(auth, async user => {
    window._ttsUser        = user;
    window._ttsWhitelisted = user ? await checkWhitelist(user.email) : false;
    resolve({ user: window._ttsUser, whitelisted: window._ttsWhitelisted });
    injectAuthUI();
    window.dispatchEvent(new CustomEvent('tts-auth', {
      detail: { user: window._ttsUser, whitelisted: window._ttsWhitelisted },
    }));
  });
});

// ── Đóng dropdown khi click ra ngoài (một listener duy nhất) ──
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('_ttsDropdown');
  const menuBtn  = document.getElementById('_ttsMenuBtn');
  if (!dropdown) return;
  if (!dropdown.contains(e.target) && e.target !== menuBtn && !menuBtn?.contains(e.target)) {
    dropdown.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  }
});

// ── Inject UI vào #navRight ──
function injectAuthUI() {
  const doInject = () => {
    const navRight = document.getElementById('navRight');
    if (!navRight) return;
    document.getElementById('_ttsAuthUI')?.remove();

    const user        = window._ttsUser;
    const whitelisted = window._ttsWhitelisted;
    const wrap = document.createElement('div');
    wrap.id = '_ttsAuthUI';

    if (user) {
      const name    = user.displayName || user.email.split('@')[0];
      const initial = name[0].toUpperCase();
      const avatar  = user.photoURL
        ? `<img class="tts-avatar" src="${user.photoURL}" alt="">`
        : `<div class="tts-avatar-fb">${initial}</div>`;

      wrap.innerHTML = `
        <div class="tts-user-menu">
          <button class="tts-menu-btn" id="_ttsMenuBtn" aria-expanded="false" aria-label="Menu tài khoản">
            <svg viewBox="0 0 16 12" width="16" height="12" fill="currentColor">
              <rect y="0"  width="16" height="2" rx="1"/>
              <rect y="5"  width="16" height="2" rx="1"/>
              <rect y="10" width="16" height="2" rx="1"/>
            </svg>
          </button>
          <div class="tts-dropdown" id="_ttsDropdown">
            <div class="tts-drop-user">
              ${avatar}
              <div class="tts-drop-info">
                <span class="tts-drop-name">${name}</span>
                ${whitelisted ? `<span class="tts-drop-badge">Học viên</span>` : ''}
              </div>
            </div>
            <div class="tts-drop-divider"></div>
            <button class="tts-drop-logout" id="_ttsLogout">Đăng xuất</button>
          </div>
        </div>`;

      wrap.querySelector('#_ttsMenuBtn').addEventListener('click', (e) => {
        e.stopPropagation();
        const dropdown = wrap.querySelector('#_ttsDropdown');
        const btn      = wrap.querySelector('#_ttsMenuBtn');
        const isOpen   = dropdown.classList.toggle('open');
        btn.setAttribute('aria-expanded', String(isOpen));
      });

      wrap.querySelector('#_ttsLogout').addEventListener('click', () => signOut(auth));

    } else {
      wrap.innerHTML = `
        <button class="tts-btn-in" id="_ttsLogin">
          <svg viewBox="0 0 24 24" width="15" height="15" style="flex-shrink:0">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Đăng nhập
        </button>`;
      wrap.querySelector('#_ttsLogin').addEventListener('click', async () => {
        try { await signInWithPopup(auth, gProvider); }
        catch(e) { if (e.code !== 'auth/popup-closed-by-user') console.error('Login:', e); }
      });
    }

    navRight.insertBefore(wrap, navRight.firstChild);
  };

  if (document.getElementById('navRight')) {
    doInject();
  } else {
    document.addEventListener('DOMContentLoaded', () => setTimeout(doInject, 0), { once: true });
  }
}

// ── CSS ──
const css = `
/* ── Nút hamburger (menu 3 gạch) ── */
.tts-user-menu { position: relative; }

.tts-menu-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 6px 10px;
  border-radius: 8px;
  border: 1.5px solid var(--border, #e2e8f0);
  background: transparent;
  color: var(--text-2, #475569);
  cursor: pointer;
  transition: all .14s;
  white-space: nowrap;
}
.tts-menu-btn:hover {
  background: rgba(99,102,241,.08);
  color: #6366f1;
  border-color: rgba(99,102,241,.35);
  transform: translateY(-1px);
}

/* ── Dropdown ── */
.tts-dropdown {
  display: none;
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  min-width: 200px;
  background: var(--bg-card, #fff);
  border: 1.5px solid var(--border, #e2e8f0);
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0,0,0,.13);
  padding: 12px;
  z-index: 9000;
}
.tts-dropdown.open { display: block; }

.tts-drop-user {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-bottom: 10px;
}
.tts-avatar {
  width: 32px; height: 32px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
}
.tts-avatar-fb {
  width: 32px; height: 32px; border-radius: 50%; flex-shrink: 0;
  background: linear-gradient(135deg,#6366f1,#8b5cf6);
  color: #fff; font-size: 13px; font-weight: 700;
  display: flex; align-items: center; justify-content: center;
}
.tts-drop-info { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
.tts-drop-name {
  font-size: 14px; font-weight: 600; color: var(--text-1, #1e293b);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tts-drop-badge {
  font-size: 10px; font-weight: 700; white-space: nowrap; align-self: flex-start;
  background: linear-gradient(90deg,#6366f1,#8b5cf6);
  color: #fff; padding: 2px 7px; border-radius: 10px;
}

.tts-drop-divider { height: 1px; background: var(--border, #e2e8f0); margin: 0 0 10px; }

.tts-drop-logout {
  width: 100%;
  padding: 8px 12px;
  background: transparent;
  color: var(--text-2, #475569);
  border: 1.5px solid var(--border, #e2e8f0);
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all .14s;
}
.tts-drop-logout:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

/* ── Nút đăng nhập ── */
.tts-btn-in {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 6px 13px; background: #fff; color: #3c4043;
  border: 1.5px solid #dadce0; border-radius: 8px;
  font-size: 13px; font-weight: 600; cursor: pointer; white-space: nowrap;
  box-shadow: 0 1px 3px rgba(0,0,0,.1); transition: box-shadow .14s, background .14s;
}
.tts-btn-in:hover { box-shadow: 0 2px 8px rgba(0,0,0,.15); background: #f8f9fa; }

`;
const styleEl = document.createElement('style');
styleEl.textContent = css;
document.head.appendChild(styleEl);
