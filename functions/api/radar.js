// Cloudflare Pages Function — GET /api/radar
// Server-side proxy for the homepage's "internet weather" bento tile, same
// reasoning as functions/api/threat-feed.js: the browser never needs the
// Radar API token, and the five upstream calls get combined into one small
// response instead of five separate client-side round trips.
// Requires RADAR_API_TOKEN as a Pages secret (Account > Radar > Read
// permission — see https://developers.cloudflare.com/radar/get-started/).
// Degrades to an empty result (not an error) if the token isn't set, same
// as threat-feed.js's OTX_API_KEY handling — the client already has its
// own static fallback for this.

const RADAR_BASE = 'https://api.cloudflare.com/client/v4/radar';
const CACHE_TTL = 1800; // 30 minutes — none of this needs to be fresher than that
const FETCH_TIMEOUT = 6000;

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

async function radarGet(path, token) {
  const resp = await fetchWithTimeout(RADAR_BASE + path, {
    headers: { Authorization: 'Bearer ' + token },
  });
  if (!resp.ok) throw new Error('radar ' + path + ' ' + resp.status);
  const data = await resp.json();
  if (!data.success) throw new Error('radar ' + path + ' unsuccessful');
  return data.result;
}

async function fromTopAttackPairs(token) {
  // Largest layer-7 attack source→target country pairs, last 24h.
  const result = await radarGet('/attacks/layer7/top/attacks?dateRange=1d&limit=5&format=json', token);
  const list = Array.isArray(result.top_0) ? result.top_0 : [];
  return list.slice(0, 5).map((p) => ({
    origin: p.originCountryAlpha2 || '—',
    target: p.targetCountryAlpha2 || '—',
    value: Number(p.value) || 0,
  }));
}

async function fromMitigation(token) {
  // Global layer-7 attack traffic, broken down by which Cloudflare product
  // mitigated it (WAF, DDoS, bot management, ...), last 24h.
  const result = await radarGet('/attacks/layer7/summary/mitigation_product?dateRange=1d&format=json', token);
  const summary = result.summary_0 || {};
  return Object.entries(summary)
    .map(([product, pct]) => ({ product, pct: Number(pct) || 0 }))
    .filter((p) => p.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

async function fromTopTargets(token) {
  // Most-attacked countries by layer-7 attack traffic, last 24h.
  const result = await radarGet('/attacks/layer7/top/locations/target?dateRange=1d&limit=5&format=json', token);
  const list = Array.isArray(result.top_0) ? result.top_0 : [];
  return list.slice(0, 5).map((t) => ({
    cc: t.targetCountryAlpha2 || '—',
    value: Number(t.value) || 0,
  }));
}

async function fromDeviceMix(token) {
  // Global HTTP request share by device type, last 7 days (device mix moves
  // slowly, unlike attack data — a longer window reads as more representative).
  const result = await radarGet('/http/summary/device_type?dateRange=7d&format=json', token);
  const summary = result.summary_0 || {};
  const LABELS = { desktop: 'Desktop', mobile: 'Mobile', other: 'Other' };
  return Object.entries(summary)
    .map(([device, pct]) => ({ device: LABELS[device] || device, pct: Number(pct) || 0 }))
    .filter((d) => d.pct > 0)
    .sort((a, b) => b.pct - a.pct);
}

async function fromTrending(token) {
  // Domains with the sharpest rise in traffic right now.
  const result = await radarGet('/ranking/top?rankingType=TRENDING_RISE&limit=4&format=json', token);
  const list = Array.isArray(result.top_0) ? result.top_0 : [];
  return list.slice(0, 4).map((d) => d.domain).filter(Boolean);
}

export async function onRequestGet({ request, env }) {
  if (!env.RADAR_API_TOKEN) {
    return json({ pairs: [], mitigation: [], targets: [], deviceMix: [], trending: [], generatedAt: Date.now() });
  }

  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const [pairs, mitigation, targets, deviceMix, trending] = await Promise.all([
    fromTopAttackPairs(env.RADAR_API_TOKEN).catch((err) => {
      console.error('Radar attack-pairs fetch failed:', err);
      return [];
    }),
    fromMitigation(env.RADAR_API_TOKEN).catch((err) => {
      console.error('Radar mitigation fetch failed:', err);
      return [];
    }),
    fromTopTargets(env.RADAR_API_TOKEN).catch((err) => {
      console.error('Radar top-targets fetch failed:', err);
      return [];
    }),
    fromDeviceMix(env.RADAR_API_TOKEN).catch((err) => {
      console.error('Radar device-mix fetch failed:', err);
      return [];
    }),
    fromTrending(env.RADAR_API_TOKEN).catch((err) => {
      console.error('Radar trending fetch failed:', err);
      return [];
    }),
  ]);

  const response = json({ pairs, mitigation, targets, deviceMix, trending, generatedAt: Date.now() });
  await cache.put(request, response.clone());
  return response;
}
