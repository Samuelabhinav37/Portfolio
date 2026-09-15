// Cloudflare Pages Function — GET /api/kev
// Server-side proxy + trim for the homepage's CISA KEV live ticker, which
// previously fetched the full raw.githubusercontent.com catalog (~1.7MB)
// directly from the browser on every visit with no caching or timeout.
// Fetches the same source here, keeps only the most-recent 16 entries and the
// handful of fields the client actually renders, and edge-caches the small
// result for 6 hours (KEV updates roughly daily, so this stays fresh enough).

const KEV_URL = 'https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json';
const CACHE_TTL = 21600; // 6 hours
const FETCH_TIMEOUT = 8000; // ms — the source manifest is large

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

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const result = await (async () => {
    const resp = await fetchWithTimeout(KEV_URL);
    if (!resp.ok) throw new Error('kev ' + resp.status);
    const data = await resp.json();
    const vulns = Array.isArray(data.vulnerabilities) ? data.vulnerabilities.slice() : [];
    vulns.sort((a, b) => String(b.dateAdded || '').localeCompare(String(a.dateAdded || '')));
    const items = vulns.slice(0, 16).map((x) => ({
      cveID: x.cveID,
      vendorProject: x.vendorProject,
      product: x.product,
      dateAdded: x.dateAdded,
      ransom: String(x.knownRansomwareCampaignUse || '').toLowerCase() === 'known',
    }));
    return { items, count: data.count || vulns.length, dateReleased: data.dateReleased || null };
  })().catch((err) => {
    console.error('KEV fetch failed:', err);
    return { items: [], count: 0, dateReleased: null };
  });

  const response = json(result);
  await cache.put(request, response.clone());
  return response;
}
