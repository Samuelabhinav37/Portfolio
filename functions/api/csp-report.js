// Cloudflare Pages Function — POST /api/csp-report
// Receives Content-Security-Policy violation reports from visitors'
// browsers, so something the production CSP blocks shows up in the logs
// instead of silently breaking (see functions/_middleware.js for how that
// happened before). Logs one structured `[csp]` line per violation, visible
// in the Cloudflare dashboard's Functions logs or via
// `wrangler pages deployment tail`.
//
// Accepts both report formats browsers send:
//   - application/csp-report   (legacy report-uri): { "csp-report": {...} }
//   - application/reports+json (Reporting API report-to): [{ type, body }]
//
// Rate-limited per IP with the same KV limiter as clienterr/contact, under
// its own key prefix. Always answers 204 so a browser never retries.

import { checkRateLimit } from '../_lib/rate-limit.js';

const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const done = () => new Response(null, { status: 204 });

function normalize(r) {
  // Legacy keys are kebab-case, Reporting API keys are camelCase.
  const g = (a, b) => (r[a] != null ? r[a] : r[b]);
  return {
    directive: clip(g('effective-directive', 'effectiveDirective') || g('violated-directive', 'violatedDirective'), 60),
    blocked: clip(g('blocked-uri', 'blockedURL'), 300),
    page: clip(g('document-uri', 'documentURL'), 300),
    source: clip(g('source-file', 'sourceFile'), 300),
    line: clip(g('line-number', 'lineNumber'), 10),
    sample: clip(g('script-sample', 'sample'), 120),
    disposition: clip(r.disposition, 10),
  };
}

export async function onRequestPost({ request, env }) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const { success } = await checkRateLimit(env, 'csp:' + ip, { limit: 30, windowSeconds: 60 });
  if (!success) return done();

  let body;
  try {
    body = JSON.parse((await request.text()).slice(0, 64 * 1024));
  } catch {
    return done();
  }

  const reports = Array.isArray(body)
    ? body.filter((r) => r && r.type === 'csp-violation' && r.body).map((r) => r.body)
    : body && body['csp-report']
      ? [body['csp-report']]
      : [];

  const ua = clip(request.headers.get('User-Agent'), 200);
  for (const r of reports.slice(0, 10)) {
    console.log('[csp]', JSON.stringify({ ...normalize(r), ua, ts: Date.now() }));
  }
  return done();
}
