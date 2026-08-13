// Cloudflare Pages Function — POST /api/contact
// Relays the portfolio contact form to samuelabhinav37@gmail.com via Resend.
// Requires RESEND_API_KEY and TURNSTILE_SECRET_KEY secrets set on the Pages project.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const TO_EMAIL = 'samuelabhinav37@gmail.com';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const TURNSTILE_ACTION = 'contact'; // must match the widget's data-action in contact.astro

// allowedHostnames is optional (see env.TURNSTILE_HOSTNAMES below) — Pages preview
// deploys get a fresh *.pages.dev hostname per build, so unlike Cloudflare's own
// canonical example, an unset/empty allowlist here means "skip the check" rather
// than "reject everything": that keeps preview deploys functional without every
// contributor having to touch dashboard env vars just to test the form.
async function verifyTurnstile(token, ip, secret, allowedHostnames) {
  if (!token || token.length > 2048) return false;
  try {
    const resp = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, response: token, remoteip: ip }),
    });
    const data = await resp.json();
    if (!data.success) return false;
    if (data.action !== TURNSTILE_ACTION) return false;
    if (allowedHostnames && allowedHostnames.size > 0 && !allowedHostnames.has(data.hostname)) return false;
    return true;
  } catch (err) {
    console.error('Turnstile verify failed:', err);
    return false;
  }
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const message = String(body.message || '').trim();
  const company = String(body.company || '').trim(); // honeypot
  const turnstileToken = String(body.turnstileToken || '');

  if (company) return json({ ok: true }); // bot: silent no-op, matches client behavior

  if (!name || !EMAIL_RE.test(email) || message.length < 2) {
    return json({ error: 'Invalid input' }, 400);
  }
  if (name.length > 200 || email.length > 200 || message.length > 5000) {
    return json({ error: 'Too long' }, 400);
  }

  if (env.RATE_LIMITER) {
    const { success } = await env.RATE_LIMITER.limit({
      key: request.headers.get('CF-Connecting-IP') || 'unknown',
    });
    if (!success) return json({ error: 'Too many requests' }, 429);
  }

  if (!env.RESEND_API_KEY || !env.TURNSTILE_SECRET_KEY) {
    console.error(
      'contact.js misconfigured: missing',
      !env.RESEND_API_KEY ? 'RESEND_API_KEY' : '',
      !env.TURNSTILE_SECRET_KEY ? 'TURNSTILE_SECRET_KEY' : ''
    );
    return json({ error: 'Not configured' }, 500);
  }

  const allowedHostnames = new Set(
    (env.TURNSTILE_HOSTNAMES || '').split(',').map((h) => h.trim()).filter(Boolean)
  );
  const humanVerified = await verifyTurnstile(
    turnstileToken,
    request.headers.get('CF-Connecting-IP'),
    env.TURNSTILE_SECRET_KEY,
    allowedHostnames
  );
  if (!humanVerified) {
    return json({ error: 'Verification failed' }, 403);
  }

  const resendResp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Portfolio Contact <onboarding@resend.dev>',
      to: [TO_EMAIL],
      reply_to: email,
      subject: `Portfolio contact from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
    }),
  });

  if (!resendResp.ok) {
    console.error('Resend send failed:', resendResp.status, await resendResp.text());
    return json({ error: 'Send failed' }, 502);
  }

  return json({ ok: true });
}
