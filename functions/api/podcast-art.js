// Cloudflare Pages Function — GET /api/podcast-art?term=<show name>
// Server-side proxy for the homepage Signal section's podcast artwork lookup,
// which previously fetched itunes.apple.com directly from the browser. Same
// third-party-request-off-the-client rationale as threat-feed.js/signal-feed.js.
// Podcast artwork/collection links don't change often, so responses are
// edge-cached per search term for 24 hours.

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const CACHE_TTL = 86400; // 24 hours
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

export async function onRequestGet({ request, env }) {
  const term = new URL(request.url).searchParams.get('term');
  if (!term || term.length > 200) return json({ artworkUrl: null, collectionViewUrl: null }, 400);

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const result = await (async () => {
    const url = ITUNES_SEARCH + '?media=podcast&limit=1&term=' + encodeURIComponent(term);
    const resp = await fetchWithTimeout(url);
    if (!resp.ok) throw new Error('itunes ' + resp.status);
    const data = await resp.json();
    const it = (data.results || [])[0];
    if (!it) return { artworkUrl: null, collectionViewUrl: null };
    return {
      artworkUrl: it.artworkUrl100 ? String(it.artworkUrl100).replace('100x100bb', '300x300bb') : null,
      collectionViewUrl: it.collectionViewUrl || null,
    };
  })().catch((err) => {
    console.error('podcast-art fetch failed:', err);
    return { artworkUrl: null, collectionViewUrl: null };
  });

  const response = json(result);
  await cache.put(request, response.clone());
  return response;
}
