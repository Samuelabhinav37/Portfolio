// Shared fixed-window rate limiter for Pages Functions, backed by a KV
// namespace. Cloudflare's native Rate Limiting binding (`env.X.limit()`)
// isn't reliably configurable for this project's Pages setup (see
// wrangler.toml) — KV bindings are the well-supported path instead, so this
// implements the same "N requests per window per key" shape on top of one.
//
// One namespace, many keys (callers prefix their own key, e.g. 'contact:'+ip
// vs 'luna:'+ip) — same pattern the native binding's .limit({key}) offered.
//
// Fails OPEN, always: if RATE_LIMIT_KV isn't bound yet, or any KV call
// throws, this returns { success: true } rather than blocking a real
// request over missing infra or a transient KV hiccup. Abuse prevention is
// a nice-to-have here, not something worth breaking the contact form over.
export async function checkRateLimit(env, key, { limit = 5, windowSeconds = 60 } = {}) {
  const kv = env.RATE_LIMIT_KV;
  if (!kv) return { success: true };

  let count = 0;
  try {
    const raw = await kv.get(key);
    count = raw ? parseInt(raw, 10) || 0 : 0;
  } catch (err) {
    console.error('[rate-limit] KV read failed, failing open:', err);
    return { success: true };
  }

  if (count >= limit) return { success: false };

  try {
    // expirationTtl resets on every write, so this is a rolling window (a
    // request just before the window ends pushes it back out) rather than a
    // strict fixed one — acceptable slack for abuse prevention, not billing.
    await kv.put(key, String(count + 1), { expirationTtl: windowSeconds });
  } catch (err) {
    console.error('[rate-limit] KV write failed (limit still enforced this request):', err);
  }

  return { success: true };
}
