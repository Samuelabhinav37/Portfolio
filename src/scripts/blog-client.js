/* Client behavior ported from blog-template v2.5. The TOC itself is rendered
   at build time from the post's headings; this file only adds the dynamic
   pieces: scroll UI, scrollspy, anchors, copy actions, FAQ, collapsed menu. */

/* ── Scroll-driven UI: navbar swap (mid-hero), rails (past author bar, until
   FAQ ends), reading progress, back-to-top. Single rAF-throttled handler. ── */
(() => {
  const hero = document.getElementById('hero');
  const authorBar = document.querySelector('.author-bar');
  const faqSection = document.getElementById('section-faq');
  const navName = document.getElementById('navName');
  const navBrand = document.getElementById('navBrand');
  const iconRail = document.querySelector('.icon-rail');
  const rightRail = document.querySelector('.left-sidebar');
  const progressBar = document.getElementById('read-progress');
  const backTop = document.getElementById('back-to-top');
  if (!navName || !navBrand || !progressBar || !backTop) return;

  function docTop(el) {
    let top = 0;
    while (el) { top += el.offsetTop; el = el.offsetParent; }
    return top;
  }

  let thresholdNav = 0;
  let thresholdRails = 0;
  let thresholdRailsHide = Number.POSITIVE_INFINITY;
  function recalcThresholds() {
    thresholdNav = hero ? hero.offsetHeight * 0.6 : 0;
    thresholdRails = authorBar ? docTop(authorBar) + authorBar.offsetHeight : thresholdNav;
    thresholdRailsHide = faqSection
      ? docTop(faqSection) + faqSection.offsetHeight
      : Number.POSITIVE_INFINITY;
  }
  recalcThresholds();
  // Fonts, images and async layout can shift the FAQ bottom after first paint.
  window.addEventListener('load', recalcThresholds);
  setTimeout(recalcThresholds, 200);
  setTimeout(recalcThresholds, 1200);

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const navScrolled = scrollTop > thresholdNav;
      const railsVisible = scrollTop > thresholdRails && scrollTop < thresholdRailsHide;
      navName.classList.toggle('hidden', navScrolled);
      navBrand.classList.toggle('visible', navScrolled);
      if (iconRail) iconRail.classList.toggle('visible', railsVisible);
      if (rightRail) rightRail.classList.toggle('visible', railsVisible);
      progressBar.style.width = (docH > 0 ? (scrollTop / docH) * 100 : 0) + '%';
      backTop.classList.toggle('visible', scrollTop > 400);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', recalcThresholds, { passive: true });
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();
})();

/* ── Heading anchor links + TOC scrollspy. Links carry data-target from the
   build-time TOC; headings already have ids from the markdown pipeline. ── */
(() => {
  const article = document.querySelector('.article-col');
  if (!article) return;

  const heads = Array.from(article.querySelectorAll('.heading-2, .heading-3'));
  heads.forEach((h) => {
    if (!h.id) return;
    const a = document.createElement('a');
    a.className = 'hlink';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-label', 'Link to this section');
    h.appendChild(a);
  });

  const links = Array.from(document.querySelectorAll('.toc-list a[data-target]'));
  if (!links.length || !('IntersectionObserver' in window)) return;
  const setActive = (id) =>
    links.forEach((l) => l.classList.toggle('toc-active', l.dataset.target === id));
  // "Motion sensor" band across the upper third of the viewport.
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => { if (e.isIntersecting) setActive(e.target.id); }),
    { rootMargin: '-8% 0px -75% 0px', threshold: 0 }
  );
  heads.forEach((h) => io.observe(h));
})();

/* ── Copy link (icon rail). Share URLs are built at compile time. ── */
(() => {
  const canon = document.querySelector('link[rel="canonical"]');
  const url = (canon && canon.href) || location.href;
  document.querySelectorAll('#shareCopy').forEach((cp) => {
    cp.addEventListener('click', () => {
      navigator.clipboard.writeText(url).then(() => {
        cp.classList.add('copied');
        cp.title = 'Copied';
        setTimeout(() => { cp.classList.remove('copied'); cp.title = 'Copy link'; }, 1600);
      }).catch(() => {});
    });
  });
})();

/* ── Copy code / copy IOC / FAQ accordion — one delegated listener. ── */
document.addEventListener('click', (ev) => {
  const codeBtn = ev.target.closest('.copy-btn');
  if (codeBtn) {
    const code = codeBtn.parentElement.querySelector('pre code');
    if (!code) return;
    navigator.clipboard.writeText(code.innerText).then(() => {
      codeBtn.textContent = 'Copied';
      codeBtn.classList.add('copied');
      setTimeout(() => { codeBtn.textContent = 'Copy'; codeBtn.classList.remove('copied'); }, 1800);
    }).catch(() => {
      const r = document.createRange();
      r.selectNodeContents(code);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(r);
    });
    return;
  }

  const iocBtn = ev.target.closest('.ioc-copy');
  if (iocBtn) {
    const val = iocBtn.closest('tr').querySelector('.ioc-val');
    if (!val) return;
    // Display stays defanged; copy prefers the live value so pasted
    // indicators actually match in a SIEM search.
    const text = val.dataset.fanged || val.textContent.trim();
    navigator.clipboard.writeText(text).then(() => {
      iocBtn.textContent = 'Copied';
      iocBtn.classList.add('copied');
      setTimeout(() => { iocBtn.textContent = 'Copy'; iocBtn.classList.remove('copied'); }, 1600);
    }).catch(() => {});
    return;
  }

  const faqBtn = ev.target.closest('.faq-q');
  if (faqBtn) {
    const item = faqBtn.parentElement;
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item.open').forEach((el) => {
      el.classList.remove('open');
      const b = el.querySelector('.faq-q');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
    if (!isOpen) {
      item.classList.add('open');
      faqBtn.setAttribute('aria-expanded', 'true');
    }
  }
});

/* ── Collapsed menu — toggle, 10s auto-close, weather + GMT clock, plus
   focus management/trap (the flat-HTML source this was ported from has
   neither — added here to match the a11y bar already set for the Luna
   drawer: move focus in on open, trap Tab while open, restore on close). ── */
(() => {
  const trigger = document.getElementById('menu-trigger');
  const overlay = document.getElementById('menu-overlay');
  if (!trigger || !overlay) return;

  function focusableEls() {
    return Array.from(overlay.querySelectorAll('a[href], button')).filter(
      (el) => el.offsetWidth || el.offsetHeight || el.getClientRects().length
    );
  }
  function trapTab(e) {
    if (e.key !== 'Tab' || !overlay.classList.contains('open')) return;
    const els = focusableEls();
    if (!els.length) return;
    const first = els[0], last = els[els.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  let idleTimer = null;
  function armIdle() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => setOpen(false), 10000); // auto-close after 10s idle
  }
  function setOpen(open) {
    overlay.classList.toggle('open', open);
    trigger.textContent = open ? 'Close' : 'Menu';
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      armIdle();
      const first = focusableEls()[0];
      if (first) setTimeout(() => first.focus(), 80);
    } else {
      clearTimeout(idleTimer);
      trigger.focus();
    }
  }
  trigger.addEventListener('click', () => setOpen(!overlay.classList.contains('open')));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) setOpen(false);
  });
  overlay.addEventListener('keydown', trapTab);
  ['mousemove', 'click', 'keydown', 'wheel', 'touchstart'].forEach((ev) => {
    overlay.addEventListener(ev, () => { if (overlay.classList.contains('open')) armIdle(); }, { passive: true });
  });
  overlay.querySelectorAll('#menu-list a').forEach((a) => {
    a.addEventListener('click', () => setOpen(false));
  });

  /* live GMT (UTC) clock — single line: GMT DD MON YY  HH:MM:SS */
  const clock = document.getElementById('menu-clock');
  if (clock) {
    const MON = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const pad = (n) => (n < 10 ? '0' : '') + n;
    function upd() {
      const d = new Date();
      const u = new Date(d.getTime() + d.getTimezoneOffset() * 60000); // -> UTC/GMT
      clock.innerHTML =
        '<span class="d1">GMT</span> ' + pad(u.getDate()) + ' ' + MON[u.getMonth()] + ' ' +
        String(u.getFullYear()).slice(2) + ' ' +
        pad(u.getHours()) + ':' + pad(u.getMinutes()) + ':' + pad(u.getSeconds());
    }
    upd(); setInterval(upd, 1000);
  }

  /* live weather — Open-Meteo (no API key), fixed to California. */
  const weather = document.getElementById('menu-weather');
  if (weather) {
    const WMO = {
      0: 'CLEAR', 1: 'MAINLY CLEAR', 2: 'PARTLY CLOUDY', 3: 'OVERCAST',
      45: 'FOG', 48: 'RIME FOG', 51: 'LIGHT DRIZZLE', 53: 'DRIZZLE', 55: 'HEAVY DRIZZLE',
      61: 'LIGHT RAIN', 63: 'RAIN', 65: 'HEAVY RAIN', 71: 'LIGHT SNOW', 73: 'SNOW', 75: 'HEAVY SNOW',
      80: 'RAIN SHOWERS', 81: 'RAIN SHOWERS', 82: 'VIOLENT SHOWERS',
      95: 'THUNDERSTORM', 96: 'THUNDERSTORM', 99: 'THUNDERSTORM',
    };
    function iconFor(code) {
      if (code === 0 || code === 1) return '☀';
      if (code === 2) return '⛅';
      if (code === 3 || code === 45 || code === 48) return '☁';
      if (code >= 51 && code <= 65) return '☂';
      if (code >= 71 && code <= 75) return '❄';
      if (code >= 80 && code <= 82) return '☂';
      if (code >= 95) return '⚡';
      return '☁';
    }
    function render(city, tempF, code) {
      weather.innerHTML =
        '<span class="mw-icon">' + iconFor(code) + '</span> ' +
        '<span class="mw-city">' + city + '</span><br>' +
        Math.round(tempF) + '° ' + (WMO[code] || '—');
    }
    function load(lat, lon, city) {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon +
        '&current=temperature_2m,weather_code&temperature_unit=fahrenheit';
      fetch(url).then((r) => r.json()).then((j) => {
        const c = j && j.current;
        if (c) render(city, c.temperature_2m, c.weather_code);
      }).catch(() => { weather.innerHTML = '<span class="mw-city">' + city + '</span>'; });
    }
    load(36.78, -119.42, 'CALIFORNIA');
  }
})();
