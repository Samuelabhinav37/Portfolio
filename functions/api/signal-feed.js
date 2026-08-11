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
const UA = 'Mozilla/5.0 (compatible; SignalFeedBot/1.0; +https://samuelabhinav.com)';

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
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'");
}
function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>', 'i'));
  return m ? decodeEntities(stripCdata(m[1]).trim()) : '';
}

async function fetchFeed(f) {
  const resp = await fetch(f.u, { headers: { 'User-Agent': UA } });
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
  const resp = await fetch(
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
    }));
}

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

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

  const response = json({ news, ctfs, generatedAt: Date.now() });
  await cache.put(request, response.clone());
  return response;
}
