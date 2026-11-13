/* Floating contents strip (ScrollToc.astro). Builds one dash + one link per
   [data-toc] element, tracks the current one on scroll, opens the card on
   hover after a short dwell and closes it 200ms after the pointer leaves. */
(window.onPage || function (f) { f(new AbortController().signal); })(function (signal) {
  const nav = document.getElementById('stoc');
  const targets = [...document.querySelectorAll('[data-toc]')];
  if (!nav || targets.length < 2) return;
  const dashList = nav.querySelector('.stoc-dashes');
  const linkList = nav.querySelector('.stoc-card ol');
  const dashes = [], links = [];
  targets.forEach((t, i) => {
    if (!t.id) t.id = 'toc-' + i;
    const sub = t.hasAttribute('data-toc-sub');
    const d = document.createElement('li');
    if (!sub) d.className = 'top';
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.href = '#' + t.id;
    a.textContent = t.dataset.toc;
    if (sub) a.className = 'sub';
    a.addEventListener('click', (e) => {
      const lenis = window.SITE && window.SITE.lenis;
      if (lenis) { e.preventDefault(); lenis.scrollTo(t, { offset: -80 }); }
      setTimeout(close, 150);
    });
    li.appendChild(a);
    dashList.appendChild(d); linkList.appendChild(li);
    dashes.push(d); links.push(a);
  });
  nav.hidden = false;

  let current = -1, openT, closeT, ticking = false;
  function close() { clearTimeout(openT); clearTimeout(closeT); nav.classList.remove('is-open'); }
  // Section positions are measured when the page's size changes, not on every
  // scroll frame: reading layout mid-scroll, after the scroll effects have
  // moved things, made the browser lay the page out twice a frame.
  let tops = null, pageH = 0, viewH = 0;
  function measure() {
    const y = scrollY;
    tops = targets.map((t) => t.getBoundingClientRect().top + y);
    pageH = document.documentElement.scrollHeight; viewH = innerHeight;
  }
  if (window.ResizeObserver) {
    const ro = new ResizeObserver(() => { tops = null; if (!ticking) { ticking = true; requestAnimationFrame(update); } });
    ro.observe(document.body);
    addEventListener('resize', () => { tops = null; }, { signal });
    signal.addEventListener('abort', () => ro.disconnect());
  }
  function update() {
    ticking = false;
    if (!tops) measure();
    const L = window.SITE && window.SITE.lenis;
    const y = L ? L.scroll : scrollY, line = y + viewH * 0.35; // Lenis's own number when it drives the page: reading scrollY after the scroll effects have moved things makes the browser recalculate the whole page
    let idx = 0;
    tops.forEach((top, i) => { if (top <= line) idx = i; });
    if (viewH + y >= pageH - 4) idx = targets.length - 1; // a short last section never reaches the line
    if (idx !== current) {
      if (current >= 0) { dashes[current].classList.remove('is-active'); links[current].classList.remove('is-active'); links[current].removeAttribute('aria-current'); }
      current = idx;
      dashes[idx].classList.add('is-active'); links[idx].classList.add('is-active'); links[idx].setAttribute('aria-current', 'location');
    }
    const show = y > viewH * 0.4;
    nav.classList.toggle('is-shown', show);
    if (!show) close();
  }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true, signal });
  signal.addEventListener('abort', close);
  update();

  nav.addEventListener('mouseenter', () => { clearTimeout(closeT); openT = setTimeout(() => nav.classList.add('is-open'), 60); });
  nav.addEventListener('mouseleave', () => { clearTimeout(openT); closeT = setTimeout(() => nav.classList.remove('is-open'), 200); });
  nav.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); document.activeElement && document.activeElement.blur(); } });
});
