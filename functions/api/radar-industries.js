// Cloudflare Pages Function — GET /api/radar-industries
// Server-side proxy for the homepage's "Auto-defense" bento slot, which used
// to hold a purely decorative autoplay arcade runner. Replaced with a real
// live widget: Layer 3 (network-layer) DDoS attack share by targeted
// industry vertical, over the last 24h, from Cloudflare's own public Radar
// API — the same company already proxied for the KEV/CVE feeds elsewhere on
// this site, and a genuine "stock chart"-shaped dataset (multiple named
// series over time), not a fabricated one.
//
// Endpoint used: GET /radar/attacks/layer3/timeseries_groups/industry.
// Cloudflare's own docs mark this specific path deprecated in favor of a
// newer generic "timeseries_groups by dimension" endpoint — but the
// deprecated path is still live and fully documented today, and the
// dimension-based replacement's exact current path wasn't confirmed at the
// time this was written (WebFetch to Cloudflare's own docs site was
// unreliable in this sandbox). If Cloudflare ever removes this path outright
// rather than just deprecating it, re-check developers.cloudflare.com/api
// for the current "Layer 3 Attacks Timeseries Groups By Dimension" endpoint
// and swap the URL below — the rest of this file (response shaping, cache,
// fallback) shouldn't need to change.
//
// REQUIRES A SECRET NOT YET PROVISIONED: this endpoint needs a real
// Cloudflare API token with "User Details Read" (or "Write") permission,
// sent as a Bearer token — not the same secret used anywhere else on this
// site. Until CLOUDFLARE_RADAR_API_TOKEN is set (via
// `wrangler pages secret put CLOUDFLARE_RADAR_API_TOKEN`), this function
// returns an empty result (200, not an error) and the client's own static
// fallback data renders instead — same graceful-degrade convention as every
// other feed on this site.

const RADAR_URL =
  'https://api.cloudflare.com/client/v4/radar/attacks/layer3/timeseries_groups/industry' +
  '?dateRange=1d&aggInterval=1h&limitPerGroup=5&normalization=PERCENTAGE';
const CACHE_TTL = 1800; // 30 minutes — a 24h DDoS share breakdown doesn't shift fast enough to need fresher polling
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

async function fromRadar(token) {
  if (!token) return { timestamps: [], series: [] };
  const resp = await fetchWithTimeout(RADAR_URL, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!resp.ok) throw new Error('radar ' + resp.status);
  const data = await resp.json();
  const result = (data && data.result) || {};
  const timestamps = (result.serie_0 && result.serie_0.timestamps) || [];
  // Every other key on serie_0 besides "timestamps" is one industry's own
  // array of values, aligned index-for-index with `timestamps` — standard
  // shape for every Radar "timeseries_groups" endpoint (confirmed against
  // the sibling by-industry *summary* endpoint's analogous "summary_0"
  // industry->value map).
  const series = Object.keys(result.serie_0 || {})
    .filter((k) => k !== 'timestamps')
    .map((industry) => ({
      industry,
      values: (result.serie_0[industry] || []).map((v) => Number(v) || 0),
    }));
  return { timestamps, series };
}

export async function onRequestGet({ request, env }) {
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;

  const result = await fromRadar(env.CLOUDFLARE_RADAR_API_TOKEN).catch((err) => {
    console.error('Radar industries fetch failed:', err);
    return { timestamps: [], series: [] };
  });

  const response = json({ ...result, generatedAt: Date.now() });
  await cache.put(request, response.clone());
  return response;
}
