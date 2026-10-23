/* Field Notes (blog index): search, topic filter, numbered pages and the
   Overview / Index views.
   The page ships every post already rendered (src/pages/blog/index.astro);
   this re-renders the featured card's visibility and the grid from the same
   card data (window.__FIELD_NOTES__) whenever the query, topic or page
   changes. Frames are black placeholders until new art is made. */

const cards = window.__FIELD_NOTES__ || [];
const PER_PAGE = 12;
// Same ratio cycle as index.astro, so tiles keep their uneven heights after a search
const RATIOS = ['16/9', '3/2', '13/9', '3/2', '29/20', '16/9', '9/7', '16/9', '3/2'];

const $ = (id) => document.getElementById(id);
const q = $('fn-q'), topic = $('fn-topic'), feat = $('fn-feat'), grid = $('fn-grid');
const count = $('fn-count'), pg = $('fn-pg'), latest = $('fn-latest');
const main = $('main'), index = $('fn-index'), overviewBtn = $('fn-overview'), indexBtn = $('fn-index-btn');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let page = 1;
let animate = false; // the first render matches the HTML, so only later ones animate in

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function tile(c, i) {
  return `<a class="fn-tile${animate ? ' fn-in' : ''}" style="--r:${RATIOS[i % RATIOS.length]};--i:${i}" href="${esc(c.href)}">` +
    '<div class="fn-pic"></div>' +
    `<div class="fn-cap"><h3>${esc(c.title)}</h3><span>${esc(c.topic)}</span></div></a>`;
}

function render() {
  const query = q.value.trim().toLowerCase(), tp = topic.value, filtering = !!(query || tp);
  const list = cards.filter((c) =>
    (!tp || c.topic === tp) && (!query || (c.title + ' ' + c.desc + ' ' + c.topic).toLowerCase().includes(query)));

  // the featured card is the newest post, and only while not searching
  let rest = list;
  if (feat) {
    feat.hidden = filtering || !list.length;
    if (!filtering && list.length) rest = list.slice(1);
  }

  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  page = Math.min(page, pages);
  const visible = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  grid.innerHTML = list.length
    ? visible.map(tile).join('')
    : `<div class="fn-empty">No posts match “${esc(query || tp)}”. Try another word, or clear the topic.</div>`;

  count.textContent = filtering
    ? `${list.length} ${list.length === 1 ? 'result' : 'results'}`
    : `${cards.length} posts`;

  pg.innerHTML = '';
  pg.hidden = pages < 2;
  const button = (label, target, arrow, aria) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    if (aria) b.setAttribute('aria-label', aria);
    if (!arrow && target === page) b.setAttribute('aria-current', 'page');
    if (target < 1 || target > pages || (arrow && target === page)) b.disabled = true;
    b.addEventListener('click', () => {
      page = target;
      render();
      const lenis = window.SITE && window.SITE.lenis;
      if (lenis) lenis.scrollTo(latest, { offset: -90 });
      else latest.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    pg.appendChild(b);
  };
  button('Prev', page - 1, true, 'Previous page');
  for (let i = 1; i <= pages; i++) button(String(i), i, false, `Page ${i}`);
  button('Next', page + 1, true, 'Next page');

  // what's on show, in page order: the featured card (if showing), then the tiles
  shown = (feat && !feat.hidden ? [{ c: list[0], el: feat }] : [])
    .concat(visible.map((c, i) => ({ c, el: grid.children[i] })));
  buildIndex();
}

/* ── Index view ──
   A list of every post on show. Pointing at a name (or tabbing to it, or
   tapping it once) lights that post up and scrolls to it; a click on a name
   that's already lit opens the post. With a mouse the hover has already lit
   it, so a click goes straight through, as on a normal link. */
let shown = [];
let lit = -1;
let hoverTimer = 0;

function buildIndex() {
  if (!index) return;
  lit = -1;
  index.querySelector('ol').innerHTML = shown.map(({ c }, i) =>
    `<li><a href="${esc(c.href)}" data-i="${i}"><b>${esc(c.title)}</b><span>${esc(c.topic)}</span></a></li>`).join('');
}

function light(i, scroll) {
  lit = i;
  shown.forEach((s, k) => s.el.classList.toggle('is-lit', k === i));
  index.querySelectorAll('a').forEach((a, k) => a.classList.toggle('is-on', k === i));
  const el = shown[i] && shown[i].el;
  if (scroll && el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: innerWidth <= 900 ? 'start' : 'center' });
}

function setView(isIndex) {
  main.classList.toggle('is-index', isIndex);
  index.hidden = !isIndex;
  overviewBtn.setAttribute('aria-pressed', String(!isIndex));
  indexBtn.setAttribute('aria-pressed', String(isIndex));
  if (!isIndex) shown.forEach((s) => s.el.classList.remove('is-lit'));
  else { lit = -1; latest.parentElement.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' }); }
}

if (index && overviewBtn && indexBtn && main) {
  overviewBtn.addEventListener('click', () => setView(false));
  indexBtn.addEventListener('click', () => setView(true));
  index.addEventListener('pointerover', (e) => {
    const a = e.target.closest('a[data-i]');
    if (!a || e.pointerType !== 'mouse') return;
    clearTimeout(hoverTimer);
    // a short wait, so sweeping the pointer down the list doesn't fling the page around
    hoverTimer = setTimeout(() => light(+a.dataset.i, true), 110);
  });
  index.addEventListener('focusin', (e) => {
    const a = e.target.closest('a[data-i]');
    if (a && a.matches(':focus-visible')) light(+a.dataset.i, true);
  });
  index.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-i]');
    if (!a || +a.dataset.i === lit) return;
    e.preventDefault();
    clearTimeout(hoverTimer);
    light(+a.dataset.i, true);
  });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && !index.hidden) setView(false); });
}

if (q && topic && grid) {
  q.addEventListener('input', () => { page = 1; render(); });
  topic.addEventListener('change', () => { page = 1; render(); });
  render();
  animate = true;
}
