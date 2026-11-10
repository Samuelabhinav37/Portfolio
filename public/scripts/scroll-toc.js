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
  function update() {
    ticking = false;
    const line = innerHeight * 0.35;
    let idx = 0;
    targets.forEach((t, i) => { if (t.getBoundingClientRect().top <= line) idx = i; });
    if (innerHeight + scrollY >= document.documentElement.scrollHeight - 4) idx = targets.length - 1; // a short last section never reaches the line
    if (idx !== current) {
      if (current >= 0) { dashes[current].classList.remove('is-active'); links[current].classList.remove('is-active'); links[current].removeAttribute('aria-current'); }
      current = idx;
      dashes[idx].classList.add('is-active'); links[idx].classList.add('is-active'); links[idx].setAttribute('aria-current', 'location');
    }
    const show = scrollY > innerHeight * 0.4;
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
