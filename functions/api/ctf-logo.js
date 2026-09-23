// Cloudflare Pages Function — GET /api/ctf-logo?p=<file>
// Proxies an event logo from ctftime.org/media/events/ for the homepage's
// "Upcoming CTFs" strip. Organizers upload whatever they like, and some
// logos run past 1MB for a 30px thumbnail, so anything over MAX_BYTES is
// refused (404) and the client shows its monogram tile instead. Proxying
// rather than hotlinking also lets the edge cache hold each logo for a day.
//
// Only a bare filename under /media/events/ is accepted, so this can't be
// pointed at any other host or path.

const MAX_BYTES = 300 * 1024;
const CACHE_TTL = 86400; // logos don't change once an event is listed
const FETCH_TIMEOUT = 6000; // ms
const UA = 'Mozilla/5.0 (compatible; samuelabhinav.com ctf-logo proxy)';
const NAME_RE = /^[\w][\w.\-]{0,120}\.(png|jpe?g|gif|webp)$/i;

function notFound() {
  return new Response('not found', {
    status: 404,
    headers: { 'Cache-Control': 'public, max-age=3600' },
  });
}

export async function onRequestGet({ request, waitUntil }) {
  const name = new URL(request.url).searchParams.get('p') || '';
  if (!NAME_RE.test(name)) return notFound();

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  let upstream;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    upstream = await fetch('https://ctftime.org/media/events/' + name, {
      headers: { 'User-Agent': UA },
      signal: ctrl.signal,
    });
  } catch {
    return notFound();
  } finally {
    clearTimeout(t);
  }

  const type = upstream.headers.get('Content-Type') || '';
  if (!upstream.ok || !type.startsWith('image/')) return notFound();
  const declared = Number(upstream.headers.get('Content-Length') || 0);
  if (declared > MAX_BYTES) return notFound();

  const body = await upstream.arrayBuffer();
  if (body.byteLength > MAX_BYTES) return notFound();

  const resp = new Response(body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=${CACHE_TTL}`,
      'X-Content-Type-Options': 'nosniff',
    },
  });
  waitUntil(cache.put(request, resp.clone()));
  return resp;
}
