/**
 * nav.js — Tự động build Navbar + Footer + SEO + Dark Mode
 * ══════════════════════════════════════════════════════════
 * CÁCH DÙNG: Khai báo PATH_TO_ROOT TRƯỚC khi load file này.
 *
 *   Trang root (index.html):
 *     <script>const PATH_TO_ROOT = '';</script>
 *
 *   Trang 1 cấp sâu (exams/index.html):
 *     <script>const PATH_TO_ROOT = '../';</script>
 *
 *   Trang 2 cấp sâu (exams/ets2024/index.html):
 *     <script>const PATH_TO_ROOT = '../../';</script>
 *
 *   Trang 3 cấp sâu (exams/ets2024/tests/de-1.html):
 *     <script>const PATH_TO_ROOT = '../../../';</script>
 *
 * HIDE FOOTER: Khai báo trong config section của từng trang
 *   EXAM_CONFIG.hideFooter = true  → ẩn footer
 *   EXAM_CONFIG.hideNav    = true  → ẩn navbar (hiếm dùng)
 */
(function () {

  /* ── Helpers ── */
  const ROOT = (typeof PATH_TO_ROOT !== 'undefined') ? PATH_TO_ROOT : '';
  const r = (path) => ROOT + path.replace(/^\//, '');

  /* ══════════════════════════════════════════════
     DARK MODE
     ══════════════════════════════════════════════ */
  const DM = {
    key:    'tts_theme',
    get:    ()  => localStorage.getItem(DM.key) || SITE.darkMode?.default || 'light',
    set:    (v) => { localStorage.setItem(DM.key, v); DM.apply(v); },
    toggle: ()  => DM.set(DM.get() === 'dark' ? 'light' : 'dark'),
    icon:   ()  => DM.get() === 'dark' ? '☀️' : '🌙',
    apply:  (v) => {
      const theme = v === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : v;
      document.documentElement.setAttribute('data-theme', theme);
    },
  };

  /* Áp dụng theme ngay lập tức (trước khi render) */
  DM.apply(DM.get());

  /* ══════════════════════════════════════════════
     SEO — Inject meta tags tự động
     ══════════════════════════════════════════════ */
  function injectSEO() {
    const s         = SITE;
    const pageTitle = document.title || s.name;
    const pageDesc  = document.querySelector('meta[name="description"]')?.content || s.description;
    const pageUrl   = window.location.href;
    const ogImg     = r(s.ogImage);

    /* Meta tags cần inject */
    const metas = [
      { name: 'robots',              content: 'index, follow' },
      { name: 'author',              content: s.author },
      { property: 'og:type',         content: 'website' },
      { property: 'og:site_name',    content: s.name },
      { property: 'og:title',        content: pageTitle },
      { property: 'og:description',  content: pageDesc },
      { property: 'og:url',          content: pageUrl },
      { property: 'og:image',        content: ogImg },
      { property: 'og:image:width',  content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:locale',       content: s.locale },
      { name: 'twitter:card',        content: 'summary_large_image' },
      { name: 'twitter:title',       content: pageTitle },
      { name: 'twitter:description', content: pageDesc },
      { name: 'twitter:image',       content: ogImg },
      { name: 'theme-color',         content: s.themeColor },
    ];

    metas.forEach(({ name, property, content }) => {
      const sel = name ? `meta[name="${name}"]` : `meta[property="${property}"]`;
      if (document.querySelector(sel)) return; /* đã có → bỏ qua */
      const m = document.createElement('meta');
      if (name)     m.setAttribute('name', name);
      if (property) m.setAttribute('property', property);
      m.setAttribute('content', content);
      document.head.appendChild(m);
    });

    /* Canonical */
    if (!document.querySelector('link[rel="canonical"]')) {
      const l = document.createElement('link');
      l.rel = 'canonical';
      l.href = pageUrl;
      document.head.appendChild(l);
    }

    /* Favicon */
    if (!document.querySelector('link[rel="icon"]')) {
      const f = document.createElement('link');
      f.rel  = 'icon';
      f.type = 'image/png';
      f.href = r(s.favicon);
      document.head.appendChild(f);
    }
  }

  /* ══════════════════════════════════════════════
     NAVBAR
     ══════════════════════════════════════════════ */
  function buildNav() {
    /* Cho phép ẩn toàn bộ navbar nếu cần */
    if (window.EXAM_CONFIG?.hideNav === true) return;

    const currentPath = window.location.pathname;

    /* Build nav links */
    const linksHTML = SITE.nav.map(n => {
      const href      = r(n.href);
      const segment   = n.href.split('/')[0];
      const isActive  = (currentPath.includes(segment) && segment !== 'index.html') ? 'active' : '';
      return `
        <li>
          <a href="${href}" class="${isActive}">
            <span class="nav-icon" aria-hidden="true">${n.icon}</span>
            ${n.label}
          </a>
        </li>`;
    }).join('');

    /* Logo — chữ thuần */
    const logoHTML = `
      <a href="${r('index.html')}" class="nav-logo" aria-label="${SITE.name} — Trang chủ">
        <span class="nav-logo-fallback">${SITE.name}</span>
      </a>`;

    /* Tạo nav element */
    const nav = document.createElement('nav');
    nav.className = 'nav';
    nav.id = 'mainNav';
    nav.setAttribute('role', 'navigation');
    nav.setAttribute('aria-label', 'Điều hướng chính');
    nav.innerHTML = `
      <div class="nav-inner">
        ${logoHTML}
        <ul class="nav-links" id="navLinks" role="menubar">
          ${linksHTML}
        </ul>
        <div class="nav-right" id="navRight">
          <button
            class="dark-toggle"
            id="darkToggle"
            aria-label="Đổi giao diện sáng/tối"
            title="Đổi giao diện">
            ${DM.icon()}
          </button>
        </div>
        <button
          class="hamburger"
          id="hamburger"
          aria-label="Mở menu điều hướng"
          aria-expanded="false"
          aria-controls="navLinks">
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>`;

    document.body.insertAdjacentElement('afterbegin', nav);

    /* Overlay (đóng menu khi click ra ngoài) */
    const overlay = document.createElement('div');
    overlay.className = 'nav-overlay';
    overlay.id = 'navOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    document.body.insertAdjacentElement('afterbegin', overlay);

    /* ── Mobile menu toggle ── */
    const hamburger = document.getElementById('hamburger');
    const navLinks  = document.getElementById('navLinks');
    const navRight  = document.getElementById('navRight');
    const navOverlay= document.getElementById('navOverlay');

    function openMenu()  { setMenu(true);  }
    function closeMenu() { setMenu(false); }

    function setMenu(open) {
      hamburger.classList.toggle('open', open);
      hamburger.setAttribute('aria-expanded', String(open));
      navLinks.classList.toggle('open', open);
      navRight.classList.toggle('open', open);
      navOverlay.classList.toggle('show', open);
      document.body.style.overflow = open ? 'hidden' : '';
    }

    hamburger.addEventListener('click', () => {
      const isOpen = navLinks.classList.contains('open');
      isOpen ? closeMenu() : openMenu();
    });
    navOverlay.addEventListener('click', closeMenu);
    navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMenu));

    /* ── Dark mode button ── */
    const darkBtn = document.getElementById('darkToggle');
    darkBtn.addEventListener('click', () => {
      DM.toggle();
      darkBtn.textContent = DM.icon();
    });
  }

  /* ══════════════════════════════════════════════
     FOOTER
     ══════════════════════════════════════════════ */
  function buildFooter() {
    /* Ẩn footer nếu EXAM_CONFIG yêu cầu */
    if (window.EXAM_CONFIG?.hideFooter === true) return;

    const footer = document.createElement('footer');
    footer.className = 'footer';
    footer.innerHTML = `
      <div class="container">
        <div class="footer-copy">© ${new Date().getFullYear()} ${SITE.name}</div>
      </div>`;

    document.body.appendChild(footer);
  }

  /* ══════════════════════════════════════════════
     INIT
     ══════════════════════════════════════════════ */
  function init() {
    injectSEO();
    buildNav();
    buildFooter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

/* ══════════════════════════════════════════════════════════
   GLOBAL UTILITIES — Dùng được từ bất kỳ trang nào
   ══════════════════════════════════════════════════════════ */

/**
 * Hiện toast notification
 * @param {string} msg - Nội dung thông báo
 * @param {string} type - '' | 'success' | 'error'
 * @param {number} duration - Milliseconds (default 2500)
 */
function showToast(msg, type = '', duration = 2500) {
  /* Xoá toast cũ nếu có */
  const old = document.querySelector('.toast');
  if (old) old.remove();

  const t = document.createElement('div');
  t.className = `toast ${type}`.trim();
  t.textContent = msg;
  document.body.appendChild(t);

  setTimeout(() => {
    t.style.opacity    = '0';
    t.style.transition = 'opacity .3s ease';
    setTimeout(() => t.remove(), 300);
  }, duration);
}

/**
 * Copy URL trang hiện tại vào clipboard
 */
function copyCurrentLink() {
  navigator.clipboard.writeText(window.location.href)
    .then(()  => showToast('✅ Đã copy link!', 'success'))
    .catch(()  => showToast('❌ Không copy được', 'error'));
}
