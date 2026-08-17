/* Client behavior ported from blog-template v2.5. The TOC itself is rendered
   at build time from the post's headings; this file only adds the dynamic
   pieces: scroll UI, scrollspy, anchors, copy actions, FAQ, collapsed menu. */

/* ── Scroll-driven UI: navbar swap (mid-hero), reading progress, back-to-top.
   Single rAF-throttled handler. The "More stories" rail used to need its own
   scroll-threshold show/hide logic here (fixed-positioned, faded in past the
   author bar, hidden again before the FAQ) — now that it's a real sticky grid
   column (see .left-sidebar in blog.css), the browser handles all of that
   declaratively: it stays in view while scrolling through the article and
   stops sticking on its own once .page-grid (which ends where the article
   does) scrolls past. ── */
(() => {
  const hero = document.getElementById('hero');
  const navName = document.getElementById('navName');
  const navBrand = document.getElementById('navBrand');
  const backTop = document.getElementById('back-to-top');
  const ring = document.querySelector('.btt-ring-fill');
  if (!navName || !navBrand || !backTop) return;

  const thresholdNav = hero ? hero.offsetHeight * 0.6 : 0;

  // Circumference from the circle's own r= in the markup, not a hardcoded
  // number here — stays correct if that radius ever changes.
  const ringR = ring ? Number(ring.getAttribute('r')) : 0;
  const ringC = 2 * Math.PI * ringR;
  if (ring) {
    ring.style.strokeDasharray = String(ringC);
    ring.style.strokeDashoffset = String(ringC);
  }

  let ticking = false;
  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      const scrollTop = window.scrollY;
      const docH = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docH > 0 ? scrollTop / docH : 0;
      navName.classList.toggle('hidden', scrollTop > thresholdNav);
      navBrand.classList.toggle('visible', scrollTop > thresholdNav);
      if (ring) ring.style.strokeDashoffset = String(ringC * (1 - pct));
      backTop.classList.toggle('visible', scrollTop > 400);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();
})();

/* ── Heading anchor links — hover a heading, get a shareable # link.
   Headings already have ids from the markdown pipeline. ── */
(() => {
  const article = document.querySelector('.article-col');
  if (!article) return;
  // Localized by BlogPost.astro via data-label-anchor; falls back to English
  // for any older/cached markup that predates the attribute.
  const anchorLabel = article.dataset.labelAnchor || 'Link to this section';

  const heads = Array.from(article.querySelectorAll('.heading-2, .heading-3'));
  heads.forEach((h) => {
    if (!h.id) return;
    const a = document.createElement('a');
    a.className = 'hlink';
    a.href = '#' + h.id;
    a.textContent = '#';
    a.setAttribute('aria-label', anchorLabel);
    h.appendChild(a);
  });
})();

/* ── Share dialog: #shareBtn opens it pre-set to the matching tab.
   Tab switching swaps the preview card and the bottom action (X/LinkedIn
   open a share-intent tab; Copy link swaps the action for an inline
   copy row instead — no destination to "go" to). Focus trap + Escape
   mirror the blog index's "See more" filter dialog. ── */
(() => {
  const dialog = document.getElementById('shareDialog');
  if (!dialog) return;
  const panel = dialog.querySelector('.flt-dialog__panel');
  const tabs = [...dialog.querySelectorAll('.share-tab')];
  const panels = [...dialog.querySelectorAll('.share-preview')];
  const goBtn = document.getElementById('shareDialogGo');
  const copyBtn = document.getElementById('shareDialogCopyBtn');
  const urlInput = document.getElementById('shareDialogUrl');
  let lastFocused = null;

  function setTab(key) {
    tabs.forEach((t) => {
      const on = t.dataset.shareTab === key;
      t.classList.toggle('on', on);
      t.setAttribute('aria-selected', String(on));
    });
    panels.forEach((p) => { p.hidden = p.dataset.sharePanel !== key; });
    // .flt-dialog__apply sets display:block at the same specificity as the
    // browser's default [hidden]{display:none}, so the hidden *attribute*
    // wouldn't reliably hide this element — toggle inline style instead.
    if (key === 'copy') {
      goBtn.style.display = 'none';
    } else {
      goBtn.style.display = '';
      goBtn.href = goBtn.dataset[key + 'Href'];
      goBtn.textContent = goBtn.dataset[key + 'Label'];
    }
  }

  function focusables() { return [...panel.querySelectorAll('a[href],button,input')]; }
  function onKeydown(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'Tab') {
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  function open(key) {
    setTab(key);
    lastFocused = document.activeElement;
    dialog.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKeydown);
    if (key === 'copy') { urlInput.focus(); urlInput.select(); }
    else tabs.find((t) => t.dataset.shareTab === key).focus();
  }
  function close() {
    dialog.setAttribute('aria-hidden', 'true');
    document.removeEventListener('keydown', onKeydown);
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  document.querySelectorAll('[data-share-open]').forEach((btn) => {
    btn.addEventListener('click', () => open(btn.dataset.shareOpen));
  });
  dialog.querySelectorAll('[data-share-close]').forEach((el) => el.addEventListener('click', close));
  tabs.forEach((t) => t.addEventListener('click', () => setTab(t.dataset.shareTab)));

  function doCopy() {
    navigator.clipboard.writeText(urlInput.value).then(() => {
      copyBtn.textContent = 'Copied';
      copyBtn.classList.add('copied');
      setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 1600);
    }).catch(() => {});
  }
  copyBtn.addEventListener('click', doCopy);
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
  // Localized by BlogPost.astro via data-text-*/data-label-*; falls back to
  // English for any older/cached markup that predates the attributes.
  const textClosed = trigger.dataset.textClosed || 'Menu';
  const textOpen = trigger.dataset.textOpen || 'Close';
  const labelClosed = trigger.dataset.labelClosed || 'Open menu';
  const labelOpen = trigger.dataset.labelOpen || 'Close menu';
  function setOpen(open) {
    overlay.classList.toggle('open', open);
    trigger.textContent = open ? textOpen : textClosed;
    trigger.setAttribute('aria-label', open ? labelOpen : labelClosed);
    trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
    overlay.setAttribute('aria-hidden', open ? 'false' : 'true');
    if (open) {
      /* Luna's drawer sits at a much lower z-index than this menu overlay —
         with both open at once the menu covers her drawer, including its
         close button. Neither side knew about the other; close hers when
         this one opens. Same fix as SiteMenu.astro's version. */
      const lc = window.SITE && window.SITE.LunaChat;
      if (lc && lc.isOpen && lc.isOpen()) lc.close();
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

})();
