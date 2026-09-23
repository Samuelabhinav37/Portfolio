// Cloudflare Pages Function — GET /api/signal-feed
// Server-side aggregator for the homepage's "Signal" panel (security news +
// upcoming CTFs), so the browser never has to route through a public CORS
// proxy (allorigins.win, corsproxy.io) — those have no uptime SLA and go
// down/rate-limit independently of each other. Cached at the edge since
// refetching the same feeds per visitor would be wasteful.

const NEWS_FEEDS = [
  { n: 'The Hacker News', u: 'https://feeds.feedburner.com/TheHackersNews', site: 'https://thehackernews.com' },
  { n: 'BleepingComputer', u: 'https://www.bleepingcomputer.com/feed/', site: 'https://www.bleepingcomputer.com' },
  { n: 'Krebs on Security', u: 'https://krebsonsecurity.com/feed/', site: 'https://krebsonsecurity.com' },
];
const CACHE_TTL = 900; // 15 minutes
const SNAPSHOT_TTL = 604800; // 7 days — long-lived last-known-good store, separate from the normal response cache
const UA = 'Mozilla/5.0 (compatible; SignalFeedBot/1.0; +https://samuelabhinav.com)';
const FETCH_TIMEOUT = 6000; // ms — a single slow/hanging upstream shouldn't stall the whole panel

function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
    },
  });
}

function stripCdata(s) {
  return s.replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/, '$1');
}
function decodeEntities(s) {
  // &amp; must decode last: decoding it first would turn a feed's own
  // double-escaped "&amp;lt;" (literal text "&lt;") into "&lt;" and then
  // straight into "<" on the next replace below — an unintended unescape.
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&amp;/g, '&');
}
function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decodeEntities(stripCdata(m[1]).trim()) : '';
}

async function fetchFeed(f) {
  const resp = await fetchWithTimeout(f.u, { headers: { 'User-Agent': UA } });
  if (!resp.ok) throw new Error(f.n + ' ' + resp.status);
  const xml = await resp.text();
  const blocks = xml.match(/<item[\s\S]*?<\/item>/gi) || [];
  const items = [];
  for (const block of blocks.slice(0, 5)) {
    const title = tag(block, 'title');
    if (!title) continue;
    const link = tag(block, 'link');
    const pubDate = tag(block, 'pubDate') || tag(block, 'date');
    const desc = tag(block, 'description') || tag(block, 'content:encoded');
    let img = '';
    const im = desc.match(/<img[^>]+src=["']([^"']+)["']/i);
    if (im) img = im[1];
    if (!img) {
      const em = block.match(/<enclosure[^>]+url=["']([^"']+)["']/i);
      if (em && /\.(jpg|jpeg|png|webp)/i.test(em[1])) img = em[1];
    }
    items.push({ title, link, date: pubDate ? Date.parse(pubDate) || 0 : 0, source: f.n, img });
  }
  return items;
}

async function fromNews() {
  const results = await Promise.all(NEWS_FEEDS.map((f) => fetchFeed(f).catch(() => [])));
  const all = results.flat();
  all.sort((a, b) => b.date - a.date);
  return all.slice(0, 5);
}

async function fromCtf() {
  const now = Math.floor(Date.now() / 1000);
  const fin = now + 150 * 86400;
  const resp = await fetchWithTimeout(
    `https://ctftime.org/api/v1/events/?limit=40&start=${now}&finish=${fin}`,
    { headers: { 'User-Agent': UA } }
  );
  if (!resp.ok) throw new Error('ctftime ' + resp.status);
  const data = await resp.json();
  if (!Array.isArray(data)) throw new Error('ctftime bad shape');
  return data
    .filter((e) => new Date(e.start).getTime() > Date.now())
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, 5)
    .map((e) => ({
      title: e.title,
      href: e.ctftime_url || e.url || '',
      format: e.format || 'CTF',
      start: e.start,
      // Just the filename under ctftime.org/media/events/; the client loads
      // it through /api/ctf-logo, which size-caps and caches it.
      logo: (String(e.logo || '').match(/^https:\/\/ctftime\.org\/+media\/events\/([^/?#]+)$/) || [])[1] || '',
    }));
}

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  // Separate long-TTL cache entry used purely as a last-known-good snapshot,
  // distinct from the normal short-TTL response cache above. Without this, a
  // cold cache + every upstream failing/timing out would return {news:[],
  // ctfs:[]} with a 200, and that empty result would itself get cached for
  // the full 15-minute TTL — actively serving "nothing here" for up to 15
  // minutes instead of the last real content.
  const snapshotKey = new Request(request.url + (request.url.includes('?') ? '&' : '?') + '__snapshot=1');

  const [news, ctfs] = await Promise.all([
    fromNews().catch((err) => {
      console.error('Signal news fetch failed:', err);
      return [];
    }),
    fromCtf().catch((err) => {
      console.error('Signal CTF fetch failed:', err);
      return [];
    }),
  ]);

  let payload = { news, ctfs, generatedAt: Date.now() };
  const useful = news.length > 0 || ctfs.length > 0;

  if (!useful) {
    const snapHit = await cache.match(snapshotKey);
    const prev = snapHit ? await snapHit.json().catch(() => null) : null;
    if (prev) payload = { ...prev, stale: true };
  }

  const response = json(payload);
  await cache.put(request, response.clone());
  if (useful) {
    await cache.put(
      snapshotKey,
      new Response(JSON.stringify(payload), {
        status: 200,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${SNAPSHOT_TTL}` },
      })
    );
  }
  return response;
}
