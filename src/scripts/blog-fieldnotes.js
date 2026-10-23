/* Field Notes (blog index): search, topic filter and numbered pages.
   The page ships every post already rendered (src/pages/blog/index.astro);
   this re-renders the featured card's visibility and the grid from the same
   card data (window.__FIELD_NOTES__) whenever the query, topic or page
   changes. Frames are empty glass until new art is made. */

const cards = window.__FIELD_NOTES__ || [];
const PER_PAGE = 12;
// Same ratio cycle as index.astro, so tiles keep their uneven heights after a search
const RATIOS = ['16/9', '3/2', '13/9', '3/2', '29/20', '16/9', '9/7', '16/9', '3/2'];

const $ = (id) => document.getElementById(id);
const q = $('fn-q'), topic = $('fn-topic'), feat = $('fn-feat'), grid = $('fn-grid');
const count = $('fn-count'), pg = $('fn-pg'), latest = $('fn-latest');
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
}

if (q && topic && grid) {
  q.addEventListener('input', () => { page = 1; render(); });
  topic.addEventListener('change', () => { page = 1; render(); });
  render();
  animate = true;
}
