// Cloudflare Pages Function — GET /api/podcast
// The nav's music tab plays Darknet Diaries. The show's RSS feed is about
// 1MB, so this fetches it here, keeps the newest 12 episodes and only the
// fields the player shows, and edge-caches the small result for 6 hours
// (a new episode comes out every few weeks). The audio itself streams
// straight from the show's host; nothing is proxied.

import { cacheKey } from '../_lib/cache-key.js';

const FEED_URL = 'https://podcast.darknetdiaries.com/';
const CACHE_TTL = 21600; // 6 hours
const FETCH_TIMEOUT = 8000; // ms
const KEEP = 12;

function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" };
const text = (s) => (s == null ? '' : s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&(amp|lt|gt|quot|apos|#39);/g, (_, e) => ENT[e])
  .trim());
const first = (s, re) => (s.match(re) || [])[1];
// only plain https links leave this function; the player sets them as src
const httpsOnly = (u) => (u && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : null);

// the summary's opening line ("What if you got infected by a friend...?"), tags stripped
const subtitleOf = (s) => {
  const flat = s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const one = (flat.match(/^.*?[.?!](?=\s|$)/) || [flat])[0];
  return one.length > 160 ? one.slice(0, 159).trimEnd() + '…' : one || null;
};

export function parseFeed(xml, keep = KEEP) {
  const head = xml.split('<item')[0];
  const show = text(first(head, /<title>([\s\S]*?)<\/title>/)) || 'Darknet Diaries';
  const episodes = xml.split(/<item[\s>]/).slice(1)
    .map((it) => ({
      title: text(first(it, /<title>([\s\S]*?)<\/title>/)).slice(0, 200),
      url: httpsOnly(text(first(it, /<enclosure[^>]*url="([^"]+)"/))),
      duration: text(first(it, /<itunes:duration>([^<]*)</)).slice(0, 12) || null,
      subtitle: subtitleOf(text(first(it, /<itunes:summary>([\s\S]*?)<\/itunes:summary>/))),
    }))
    .filter((e) => e.title && e.url)
    .slice(0, keep);
  return { show, episodes };
}

function json(data, cacheable) {
  return new Response(JSON.stringify(data), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': cacheable ? `public, max-age=${CACHE_TTL}` : 'no-store',
    },
  });
}

export async function onRequestGet({ request }) {
  const cache = caches.default;
  const key = cacheKey(request);
  const cached = await cache.match(key);
  if (cached) return cached;

  const result = await (async () => {
    const resp = await fetchWithTimeout(FEED_URL, { headers: { 'User-Agent': 'samuelabhinav.com podcast player' } });
    if (!resp.ok) throw new Error('feed ' + resp.status);
    return parseFeed(await resp.text());
  })().catch((err) => {
    console.error('Podcast feed fetch failed:', err);
    return { show: 'Darknet Diaries', episodes: [] };
  });

  // only real data is cached, so one upstream blip doesn't empty the player for 6 hours
  const response = json(result, result.episodes.length > 0);
  if (result.episodes.length) await cache.put(key, response.clone());
  return response;
}
