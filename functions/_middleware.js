// Runs for every request to the Pages project — static assets included, not
// just functions/api/* routes — since a root-level _middleware.js wraps the
// whole request pipeline. This is where Content-Security-Policy is set; it
// used to live in public/_headers, but the real script-src needs a per-build
// hash list (see scripts/obfuscate.mjs) that's too long for that file's
// static format — Cloudflare silently drops any _headers rule over 2000
// characters per line, confirmed via an actual `wrangler pages dev` run,
// which would have shipped with NO Content-Security-Policy at all. A
// Response's headers have no such limit, so CSP moved here instead. Every
// other header (HSTS, X-Frame-Options, Permissions-Policy, etc.) stays in
// public/_headers — they're short and have no reason to move.
//
// 'unsafe-inline' stays in script-src alongside the hashes, deliberately.
// Per the CSP2+ spec, once a script-src directive contains ANY hash-source,
// browsers that understand hash-source syntax (everything shipped since
// ~2016 — Chrome 40+, Firefox 31+, Safari 15.4+) ignore 'unsafe-inline'
// entirely for that directive; only a browser too old to parse
// 'sha256-...' sources at all falls back to it. So real-world protection
// already matches removing 'unsafe-inline' outright — full hash-enforced
// allowlisting on every browser that matters — while this keeps a built-in
// safety net: if CSP_SCRIPT_HASHES is ever wrong (a missed inline block,
// this file's own bundling somehow shipping stale hashes), the site fails
// open to today's already-shipping behavior instead of breaking for
// everyone. That safety net is the whole point — don't "clean up" this
// header by deleting 'unsafe-inline' later; it costs nothing once a hash is
// present, and it's the only thing standing between a bad hash and a
// broken site. (A security scanner or reviewer reading raw header text
// won't know that and may still flag the literal string — a real, known
// cosmetic tradeoff of this approach, not a mistake.)
//
// style-src's 'unsafe-inline' is untouched — deliberately out of scope.
// Astro emits its own scoped-CSS <style> blocks with build-generated
// content, and inline <style is:global> blocks exist throughout the site
// too; hashing style-src needs the same treatment but is a materially
// bigger, separately-worth-doing effort.
import { CSP_SCRIPT_HASHES } from './_generated/csp-hashes.js';

function buildCsp() {
  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https://cdnjs.cloudflare.com',
    'https://challenges.cloudflare.com',
    'https://www.clarity.ms',
    ...CSP_SCRIPT_HASHES,
  ].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https://challenges.cloudflare.com https://www.clarity.ms https://*.clarity.ms",
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

const CSP = buildCsp(); // built once per Worker isolate, not per request — CSP_SCRIPT_HASHES is static per deploy

export async function onRequest({ next }) {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
