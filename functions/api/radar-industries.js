// Cloudflare Pages Function — GET /api/radar-industries
// Server-side proxy for the homepage bento's "DDoS targets" tile: the five
// industries receiving the largest share of Layer 3 DDoS attacks over the
// last 7 days, from Cloudflare Radar.
//
// Endpoint: GET /radar/attacks/layer3/summary/INDUSTRY (the by-dimension
// summary path; the older /timeseries_groups/industry path is deprecated).
//
// Needs a Cloudflare API token with Radar read access, as the
// CLOUDFLARE_RADAR_API_TOKEN (or legacy RADAR_API_TOKEN) Pages secret:
//   wrangler pages secret put CLOUDFLARE_RADAR_API_TOKEN
// Without one it returns { items: [], reason: 'no-token' } (200, not an
// error) and the tile says the feed isn't connected rather than faking data.

const RADAR_URL =
  'https://api.cloudflare.com/client/v4/radar/attacks/layer3/summary/INDUSTRY' +
  '?dateRange=7d&limitPerGroup=6&format=json';
const CACHE_TTL = 1800; // 30 minutes; a 7-day share breakdown barely moves in that time
const FETCH_TIMEOUT = 6000; // ms

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

// Ranked list of the most-targeted industries by share of L3 DDoS attacks
// over the last 7 days. The summary endpoint returns summary_0 as an
// { industry: "percent" } map; "other" is dropped so the list only names
// real industries.
async function fromRadar(token) {
  if (!token) return { items: [], reason: 'no-token' };
  const resp = await fetchWithTimeout(RADAR_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('radar ' + resp.status);
  const data = await resp.json();
  const summary = (data && data.result && data.result.summary_0) || {};
  const items = Object.entries(summary)
    .filter(([k]) => k && k.toLowerCase() !== 'other')
    .map(([industry, v]) => ({ industry, share: Number(v) || 0 }))
    .filter((x) => x.share > 0)
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);
  return { items, range: '7d' };
}

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  // Either secret name works: RADAR_API_TOKEN is what the earlier radar
  // widget on this site used, so it may already be provisioned.
  const token = env.CLOUDFLARE_RADAR_API_TOKEN || env.RADAR_API_TOKEN;
  const result = await fromRadar(token).catch((err) => {
    console.error('Radar industries fetch failed:', err);
    return { items: [], reason: 'upstream' };
  });

  // Only real data is cached. An empty answer (no token yet, or Radar
  // failing) used to be cached for the full 30 minutes too, so the tile kept
  // saying "not connected" for half an hour after the problem was fixed.
  if (!result.items.length) {
    const empty = json({ ...result, generatedAt: Date.now() });
    empty.headers.set('Cache-Control', 'no-store');
    return empty;
  }
  const response = json({ ...result, generatedAt: Date.now() });
  await cache.put(request, response.clone());
  return response;
}
