/* Client behavior ported from blog-template v2.5. The TOC itself is rendered
   at build time from the post's headings; this file only adds the dynamic
   pieces: scroll UI, scrollspy, anchors, copy actions, FAQ, collapsed menu. */

/* ── Scroll-driven UI: reading progress ring on the back-to-top button.
   Single rAF-throttled handler. ── */
(() => {
  const backTop = document.getElementById('back-to-top');
  const ring = document.querySelector('.btt-ring-fill');
  if (!backTop) return;

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
      if (ring) ring.style.strokeDashoffset = String(ringC * (1 - pct));
      backTop.classList.toggle('visible', scrollTop > 400);
      ticking = false;
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  backTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
  onScroll();
})();

/* ── On this page: the right-edge contents strip (.etoc) and the narrow-
   screen box (.toc-inline), both rendered from the same list in
   BlogPost.astro. Scrollspy reads heading positions on scroll (one cheap
   rect read per heading) rather than an IntersectionObserver rootMargin,
   which browsers ignore inside cross-origin frames. The card opens on
   hover after a short dwell and closes 200ms after the pointer leaves, so
   crossing from the dashes to the card never drops it; keyboard focus
   opens it too (CSS :focus-within) and Escape closes it (WCAG 1.4.13). ── */
(() => {
  const strip = document.getElementById('etoc');
  const links = [...document.querySelectorAll('.etoc-card a[data-toc], .toc-inline a[data-toc]')];
  if (!links.length) return;
  const ids = [...new Set(links.map((a) => a.dataset.toc))];
  const targets = ids.map((id) => document.getElementById(id)).filter(Boolean);
  const dashes = strip ? [...strip.querySelectorAll('.etoc-dashes span')] : [];
  const article = document.querySelector('.article-col');
  const end = document.querySelector('.post-next') || document.querySelector('.post-footer');
  let current = null;
  let openT, closeT;
  function close() { clearTimeout(openT); clearTimeout(closeT); if (strip) strip.classList.remove('is-open'); }

  function setCurrent(id) {
    if (id === current) return;
    current = id;
    links.forEach((a) => {
      const on = a.dataset.toc === id;
      a.classList.toggle('is-active', on);
      if (on) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    dashes.forEach((d) => d.classList.toggle('is-active', d.dataset.toc === id));
  }

  let ticking = false;
  function update() {
    ticking = false;
    const line = 120;
    let id = targets.length ? targets[0].id : null;
    for (const t of targets) if (t.getBoundingClientRect().top <= line) id = t.id;
    setCurrent(id);
    if (strip && article) {
      const show = article.getBoundingClientRect().top < innerHeight * 0.5 &&
        (!end || end.getBoundingClientRect().top > innerHeight * 0.4);
      strip.classList.toggle('is-shown', show);
      if (!show) close();
    }
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  update();

  if (strip) {
    strip.addEventListener('mouseenter', () => { clearTimeout(closeT); openT = setTimeout(() => strip.classList.add('is-open'), 60); });
    strip.addEventListener('mouseleave', () => { clearTimeout(openT); closeT = setTimeout(() => strip.classList.remove('is-open'), 200); });
    strip.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { close(); if (document.activeElement) document.activeElement.blur(); }
    });
  }
  // Clicking a link closes the card and the narrow-screen box; the jump
  // itself is a normal #anchor (html scroll-behavior + scroll-margin-top).
  links.forEach((a) => a.addEventListener('click', () => {
    setTimeout(close, 150);
    const box = a.closest('details');
    if (box) box.open = false;
  }));
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
    overlay.inert = !open; // closed menu links must not take keyboard focus
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

/* html.is-scrolled drives the solid top bar (#topbar-scrim in blog.css). A
   sentinel + IntersectionObserver, not a scroll listener. */
(() => {
  const s = document.createElement('div');
  s.setAttribute('aria-hidden', 'true');
  s.style.cssText = 'position:absolute;top:0;left:0;width:1px;height:48px;pointer-events:none;visibility:hidden';
  document.body.prepend(s);
  new IntersectionObserver((es) => {
    document.documentElement.classList.toggle('is-scrolled', !es[0].isIntersecting);
  }).observe(s);
})();

/* ── Listen: read the post aloud with the browser's own voice ──
   The article is spoken a sentence at a time: Chrome's network voices stop
   mid-utterance after about 15 seconds, and short pieces let pause, speed
   and seeking pick up exactly where they left off. Progress and time come
   from a clock that estimates how far into the current sentence the voice
   is (refined by word-boundary events where the voice sends them). The
   paragraph being read is underlined. ── */
(() => {
  const box = document.getElementById('postAudio');
  const synth = window.speechSynthesis;
  if (!box || !synth || typeof SpeechSynthesisUtterance === 'undefined') return;
  const article = document.querySelector('.article-col');
  if (!article) return;
  const blocks = [...article.querySelectorAll('.post-standfirst, .heading-2, .heading-3, .body-text, .lead-list li, .article-col > ol li, .pull-quote p, .callout-detect p')]
    .filter((el) => !el.closest('figure, .dtable, .toc-inline') && el.textContent.trim());
  // every sentence, with the block it belongs to
  const chunks = [];
  blocks.forEach((el, b) => {
    const text = el.textContent.replace(/#$/, '').replace(/\s+/g, ' ').trim();
    (text.match(/[^.!?]+(?:[.!?]+["”’)]*|$)\s*/g) || [text]).map((t) => t.trim()).filter(Boolean)
      .forEach((t) => chunks.push({ t, b }));
  });
  if (!chunks.length) return;
  const CPS = 14.5; // characters spoken per second at 1x, about 150 words a minute
  const starts = [], total = chunks.reduce((n, c) => { starts.push(n); return n + c.t.length + 1; }, 0);
  const RATES = [1, 1.25, 1.5, 2, 0.75];
  const es = box.dataset.lang === 'es';
  const $ = (id) => document.getElementById(id);
  const play = $('paPlay'), bar = $('paBar'), fill = $('paFill'), time = $('paTime'), speed = $('paSpeed');
  let i = 0, rate = 1, playing = false, voice = null, current = null, t0 = 0, within = 0, boundary = -1;

  function pickVoice() {
    const vs = synth.getVoices().filter((v) => v.lang.toLowerCase().startsWith(es ? 'es' : 'en'));
    voice = vs.find((v) => /natural|neural/i.test(v.name)) || vs.find((v) => /google|samantha|daniel|aria|jenny/i.test(v.name)) || vs[0] || null;
  }
  pickVoice();
  if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice);
  box.hidden = false;

  const fmt = (sec) => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  // characters read so far
  function pos() {
    if (i >= chunks.length) return total;
    let w = within;
    if (playing) w = boundary >= 0 ? boundary : Math.min(chunks[i].t.length, within + (performance.now() - t0) / 1000 * CPS * rate);
    return starts[i] + w;
  }
  function show() {
    const p = pos(), whole = total / CPS / rate;
    fill.style.width = (p / total * 100).toFixed(2) + '%';
    bar.setAttribute('aria-valuenow', String(Math.round(p / total * 100)));
    bar.setAttribute('aria-valuetext', fmt(p / CPS / rate) + (es ? ' de ' : ' of ') + fmt(whole));
    time.textContent = p > 0 ? `${fmt(p / CPS / rate)} / ${fmt(whole)}` : fmt(whole);
    const b = i < chunks.length ? chunks[i].b : -1;
    blocks.forEach((el, k) => el.classList.toggle('is-reading', (playing || p > 0) && k === b));
    box.classList.toggle('is-playing', playing);
    play.setAttribute('aria-label', playing ? (es ? 'Pausa' : 'Pause') : (es ? 'Escuchar' : 'Listen'));
  }
  function speak() {
    if (i >= chunks.length) { playing = false; i = 0; within = 0; show(); return; }
    const c = chunks[i], text = c.t.slice(Math.floor(within));
    const u = new SpeechSynthesisUtterance(text);
    const offset = Math.floor(within);
    u.rate = rate; if (voice) u.voice = voice; u.lang = voice ? voice.lang : (es ? 'es-ES' : 'en-US');
    u.onstart = () => { if (u === current) t0 = performance.now(); };
    u.onboundary = (e) => { if (u === current && e.name !== 'sentence') boundary = offset + e.charIndex; };
    u.onend = () => { if (u !== current || !playing) return; i++; within = 0; boundary = -1; t0 = performance.now(); speak(); };
    current = u; t0 = performance.now(); boundary = -1;
    synth.speak(u);
  }
  // Chrome sometimes drops a speak() that follows cancel() at once
  function startAt(chunk, offset) {
    current = null; synth.cancel();
    i = Math.max(0, Math.min(chunks.length - 1, chunk)); within = offset || 0; boundary = -1;
    if (playing) setTimeout(speak, 60);
    show();
  }
  // the start of the word being spoken
  const wordAt = () => Math.max(0, chunks[i].t.lastIndexOf(' ', pos() - starts[i]) + 1);
  function pause() { within = wordAt(); playing = false; current = null; synth.cancel(); show(); }
  function seekTo(chars) {
    let k = starts.findIndex((s, n) => s + chunks[n].t.length >= chars);
    if (k < 0) k = chunks.length - 1;
    // start at the beginning of that sentence, so no word is cut in half
    startAt(k, 0);
  }

  play.addEventListener('click', () => { if (playing) pause(); else { playing = true; startAt(i, within); } });
  $('paBack').addEventListener('click', () => seekTo(pos() - 15 * CPS * rate - 1));
  $('paFwd').addEventListener('click', () => seekTo(pos() + 15 * CPS * rate));
  speed.addEventListener('click', () => {
    const at = i < chunks.length ? wordAt() : 0;
    rate = RATES[(RATES.indexOf(rate) + 1) % RATES.length];
    speed.textContent = rate + '×';
    // carry on from the same word at the new speed
    if (playing) startAt(i, at); else show();
  });
  bar.addEventListener('click', (e) => { const r = bar.getBoundingClientRect(); seekTo((e.clientX - r.left) / r.width * total); });
  bar.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { seekTo(pos() + 15 * CPS * rate); e.preventDefault(); }
    if (e.key === 'ArrowLeft') { seekTo(pos() - 15 * CPS * rate - 1); e.preventDefault(); }
  });
  setInterval(() => { if (playing) show(); }, 250);
  addEventListener('pagehide', () => { current = null; synth.cancel(); });
  show();
})();

/* ── More stories: slide the row sideways as the page scrolls past it ──
   The section is made exactly as tall as the row is wide (plus a screen), and
   its inside is pinned, so each pixel scrolled down moves the row a pixel
   left. Phones and reduced motion get a row to swipe instead. ── */
(() => {
  const sec = document.getElementById('postMore');
  if (!sec) return;
  const track = sec.querySelector('.pm-track'), pin = sec.querySelector('.pm-pin');
  const swipe = matchMedia('(max-width: 760px), (prefers-reduced-motion: reduce)');
  let travel = 0, ticking = false;
  function size() {
    sec.classList.toggle('is-swipe', swipe.matches);
    if (swipe.matches) { sec.style.height = ''; track.style.transform = ''; return; }
    travel = Math.max(0, track.scrollWidth - innerWidth);
    // tall enough for the whole slide while the row stays pinned under the site bar
    sec.style.height = innerHeight - (parseFloat(getComputedStyle(pin).top) || 0) + travel + 'px';
    slide();
  }
  function slide() {
    ticking = false;
    if (swipe.matches) return;
    const top = parseFloat(getComputedStyle(pin).top) || 0;
    const p = Math.min(1, Math.max(0, (top - sec.getBoundingClientRect().top) / Math.max(1, travel)));
    track.style.transform = `translate3d(${-p * travel}px,0,0)`;
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(slide); } }, { passive: true });
  addEventListener('resize', size);
  swipe.addEventListener('change', size);
  size();
})();
