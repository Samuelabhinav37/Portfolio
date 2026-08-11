// Cloudflare Pages Function — GET /api/threat-feed
// Server-side aggregator for the homepage bento's "Threat intel" quadrant, so the
// browser never needs an API key and never hits a CORS wall directly:
//   - CIRCL MISP OSINT feed: keyless, but sends no CORS header and the manifest is
//     ~1.4MB, so it has to be fetched and trimmed here rather than in the browser.
//   - AlienVault OTX pulse activity: needs X-OTX-API-KEY. If OTX_API_KEY isn't set
//     as a Pages secret, this silently degrades to MISP-only instead of failing.
// Response is cached at the edge for 30 minutes via the Cache API, since refetching
// the MISP manifest per visitor would be wasteful.

const MISP_MANIFEST = 'https://www.circl.lu/doc/misp/feed-osint/manifest.json';
const OTX_ACTIVITY = 'https://otx.alienvault.com/api/v1/pulses/activity?limit=6';
const CACHE_TTL = 1800; // 30 minutes
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

async function fromMisp() {
  const resp = await fetchWithTimeout(MISP_MANIFEST);
  if (!resp.ok) throw new Error('misp manifest ' + resp.status);
  const manifest = await resp.json();
  return Object.entries(manifest)
    .filter(([, e]) => e && e.info)
    .sort((a, b) => Number(b[1].timestamp || 0) - Number(a[1].timestamp || 0))
    .slice(0, 8)
    .map(([uuid, e]) => ({
      source: 'MISP',
      title: e.info,
      org: (e.Orgc && e.Orgc.name) || 'CIRCL',
      href: 'https://www.circl.lu/doc/misp/feed-osint/' + uuid + '.json',
      ts: Number(e.timestamp || 0) * 1000,
    }));
}

async function fromOtx(apiKey) {
  if (!apiKey) return [];
  const resp = await fetchWithTimeout(OTX_ACTIVITY, { headers: { 'X-OTX-API-KEY': apiKey } });
  if (!resp.ok) throw new Error('otx ' + resp.status);
  const data = await resp.json();
  const results = Array.isArray(data.results) ? data.results : [];
  return results.slice(0, 8).map((p) => ({
    source: 'OTX',
    title: p.name || p.title || 'Untitled pulse',
    org: p.author_name || 'OTX community',
    href: p.id ? 'https://otx.alienvault.com/pulse/' + p.id : 'https://otx.alienvault.com/',
    ts: p.created ? Date.parse(p.created) : 0,
  }));
}

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const [misp, otx] = await Promise.all([
    fromMisp().catch((err) => {
      console.error('MISP fetch failed:', err);
      return [];
    }),
    fromOtx(env.OTX_API_KEY).catch((err) => {
      console.error('OTX fetch failed:', err);
      return [];
    }),
  ]);

  const items = [...otx, ...misp].sort((a, b) => b.ts - a.ts).slice(0, 5);
  const response = json({ items, generatedAt: Date.now() });
  await cache.put(request, response.clone());
  return response;
}
