// Cloudflare Pages Function — POST /api/luna-miss
// Logs questions Luna's chat drawer couldn't answer (KeywordEngine fell
// through to the "did you mean" fallback), so the KB's keyword coverage can
// actually be improved from real usage instead of guessing. No storage
// provisioned yet — this just console.logs a structured line, visible via
// the Cloudflare dashboard's Functions real-time logs or
// `wrangler pages deployment tail`. Upgrade to a KV/D1 write later if a
// queryable history is worth the extra provisioning.

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';

  // Shares the /api/contact rate-limit binding but with a distinct key
  // prefix — same underlying namespace, separate bucket, so a flurry of
  // failed chat queries can't also lock someone out of the contact form.
  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({ key: 'luna:' + ip });
    if (!success) return json({ ok: false }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const query = String((body && body.query) || '').trim().slice(0, 300);
  const page = String((body && body.page) || '').slice(0, 200);
  if (!query) return json({ ok: false }, 400);

  console.log('[luna-miss]', JSON.stringify({ query, page, ip, ts: Date.now() }));

  return json({ ok: true });
}
