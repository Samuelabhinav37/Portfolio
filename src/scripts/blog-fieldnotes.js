/* Field Notes (blog index): search, topic filter and numbered pages.
   The page ships every post already rendered (src/pages/blog/index.astro);
   this re-renders the featured row and the two columns from the same card
   data (window.__FIELD_NOTES__) whenever the query, topic or page changes. */

const cards = window.__FIELD_NOTES__ || [];
const PER_PAGE = 6;

const $ = (id) => document.getElementById(id);
const q = $('fn-q'), topic = $('fn-topic'), feat = $('fn-feat'), wide = $('fn-wide'), narrow = $('fn-narrow');
const count = $('fn-count'), pg = $('fn-pg'), latest = $('fn-latest');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
let page = 1;
let animate = false; // the first render matches the HTML, so only later ones animate in

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function shot(c, fit, sizes) {
  if (!c.img) return `<div class="fn-shot${fit ? ' fit' : ''}"><span class="fn-tag">${esc(c.topic)}</span></div>`;
  const srcset = c.srcset ? ` srcset="${esc(c.srcset)}" sizes="${sizes}"` : '';
  return `<div class="fn-shot${fit ? ' fit' : ''}">` +
    (fit ? `<img class="fill" src="${esc(c.img)}" alt="" aria-hidden="true" decoding="async">` : '') +
    `<img class="art" src="${esc(c.img)}"${srcset} alt="" loading="lazy" decoding="async">` +
    `<span class="fn-tag">${esc(c.topic)}</span></div>`;
}
const meta = (c) => `<div class="fn-meta"><span>${esc(c.dateLabel)}</span><span>${c.mins} min read</span></div>`;

function card(c, isWide, i) {
  return `<a class="fn-card${animate ? ' fn-in' : ''}" style="--i:${i}" href="${esc(c.href)}">` +
    shot(c, isWide, isWide ? '(max-width: 820px) 92vw, 780px' : '(max-width: 820px) 92vw, 380px') +
    `<div class="body">${meta(c)}<h3>${esc(c.title)}<span class="arr" aria-hidden="true">›</span></h3>` +
    (isWide ? `<p>${esc(c.desc)}</p>` : '') + '</div></a>';
}

function render() {
  const query = q.value.trim().toLowerCase(), tp = topic.value, filtering = !!(query || tp);
  const list = cards.filter((c) =>
    (!tp || c.topic === tp) && (!query || (c.title + ' ' + c.desc + ' ' + c.topic).toLowerCase().includes(query)));

  // the featured row is the newest post, and only while not searching
  let rest = list;
  if (feat) {
    feat.hidden = filtering || !list.length;
    if (!filtering && list.length) rest = list.slice(1);
  }

  const pages = Math.max(1, Math.ceil(rest.length / PER_PAGE));
  page = Math.min(page, pages);
  const visible = rest.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  wide.innerHTML = list.length ? '' :
    `<div class="fn-empty">No posts match “${esc(query || tp)}”. Try another word, or clear the topic.</div>`;
  narrow.innerHTML = '';
  visible.forEach((c, i) => (i % 2 === 0 ? wide : narrow).insertAdjacentHTML('beforeend', card(c, i % 2 === 0, i)));

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
      latest.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    });
    pg.appendChild(b);
  };
  button('‹', page - 1, true, 'Previous page');
  for (let i = 1; i <= pages; i++) button(String(i), i, false, `Page ${i}`);
  button('›', page + 1, true, 'Next page');
}

if (q && topic && wide && narrow) {
  q.addEventListener('input', () => { page = 1; render(); });
  topic.addEventListener('change', () => { page = 1; render(); });
  render();
  animate = true;
}
