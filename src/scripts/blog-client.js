/* Client behavior ported from blog-template v2.5. The TOC itself is rendered
   at build time from the post's headings; this file only adds the dynamic
   pieces: scroll UI, scrollspy, anchors, copy actions, FAQ, collapsed menu. */

import { renderClock, renderWeather } from './clock-weather.js';

/* ── Scroll-driven UI: navbar swap (mid-hero), rails (past author bar, until
   FAQ ends), reading progress, back-to-top. Single rAF-throttled handler. ── */
(() => {
  const hero = document.getElementById('hero');
  const authorBar = document.querySelector('.author-bar');
  const faqSection = document.getElementById('section-faq');
  const articleCol = document.querySelector('.article-col');
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
    // Rail is scoped to the article itself — cut off right where the post
    // ends, before the FAQ (FAQ's own top edge when there is one; otherwise
    // the article column's bottom edge), not after it.
    // scrollTop alone isn't "before the FAQ" perceptually — the FAQ heading
    // scrolls into view well before scrollTop reaches its offsetTop, since
    // the viewport shows everything between scrollTop and scrollTop+innerHeight.
    // Subtracting innerHeight hides the rail right as that boundary is about
    // to reach the bottom of the viewport, i.e. before the FAQ is visible at all.
    const cutoff = faqSection
      ? docTop(faqSection)
      : articleCol
        ? docTop(articleCol) + articleCol.offsetHeight
        : null;
    thresholdRailsHide = cutoff === null ? Number.POSITIVE_INFINITY : cutoff - window.innerHeight;
  }
  recalcThresholds();
  // Fonts, images and async layout can shift the FAQ bottom after first paint.
  // recalcThresholds() only updates the numbers — without a re-run of onScroll()
  // right after, a rail hidden under stale (pre-reflow) thresholds stays hidden
  // until the next scroll event, which may never come if the user already
  // stopped scrolling. Every recalc is followed by an immediate re-sync.
  function recalcAndSync() { recalcThresholds(); onScroll(); }
  window.addEventListener('load', recalcAndSync);
  setTimeout(recalcAndSync, 200);
  setTimeout(recalcAndSync, 1200);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalcAndSync);

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
  window.addEventListener('resize', recalcAndSync, { passive: true });
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

/* ── Share dialog: icon-rail buttons open it pre-set to the matching tab.
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
  renderClock(document.getElementById('menu-clock'));

  renderWeather(document.getElementById('menu-weather'));
})();
