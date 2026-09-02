// Cloudflare Pages Function — POST /api/clienterr
// Receives client-side uncaught errors / unhandled rejections so a crash on
// a visitor's device reports itself, instead of relying on someone happening
// to describe it. No storage provisioned — this just console.logs one
// structured line, visible via the Cloudflare dashboard's Functions
// real-time logs or `wrangler pages deployment tail`. Upgrade to a KV/D1
// write later if a queryable history is worth the provisioning.
//
// Mirrors functions/api/luna-miss.js: POST-only, optional shared rate-limit
// binding with its own key prefix, returns fast, never throws back at the
// client. The client hook (src/components/ErrorReporter.astro) already caps
// itself to a few beacons per page load and dedupes, so this endpoint stays
// cheap even during an error loop.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Shares the (currently unconfigured — see wrangler.toml) contact
  // rate-limit binding, with a distinct key prefix so an error storm can't
  // also lock someone out of the contact form or Luna.
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: 'err:' + ip });
    if (!success) return json({ ok: false }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const rec = {
    kind: clip(body && body.kind, 20) || 'error', // 'error' | 'rejection'
    msg: clip(body && body.msg, 500),
    src: clip(body && body.src, 300),
    pos: clip(body && body.pos, 20),
    stack: clip(body && body.stack, 1200),
    page: clip(body && body.page, 300),
    ua: clip(request.headers.get('User-Agent'), 300),
    vp: clip(body && body.vp, 20),
    ts: Date.now(),
    ip,
  };
  if (!rec.msg) return json({ ok: false }, 400);

  console.log('[clienterr]', JSON.stringify(rec));

  return json({ ok: true });
}
