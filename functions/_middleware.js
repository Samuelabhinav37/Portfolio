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
// 'unsafe-inline' stays in script-src alongside the hashes, but it is NOT a
// safety net. Per CSP2+, once script-src contains any hash-source, every
// modern browser ignores 'unsafe-inline' for that directive, so an inline
// script or inline event handler (onload="...") without a matching hash is
// simply BLOCKED. It only matters to browsers too old to parse hash
// sources. This bit the site once: Kai's srcdoc iframe inherits this CSP and
// its inline engine script had no hash, so Kai silently never rendered; and
// the async-font `onload="this.media='all'"` trick never fired. Anything
// inline must either be hashed by scripts/obfuscate.mjs or moved to a file
// under /scripts/ ('self'). Inline event-handler attributes can't be hashed
// here at all (that would need 'unsafe-hashes'), so don't use them.
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
    'https://scripts.clarity.ms', // clarity's tag loader pulls the real script from here
    'https://static.cloudflareinsights.com', // Cloudflare Web Analytics beacon
    ...CSP_SCRIPT_HASHES,
  ].join(' ');
  return [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https:",
    "media-src 'self' data: blob:",
    "connect-src 'self' https://challenges.cloudflare.com https://www.clarity.ms https://*.clarity.ms https://cloudflareinsights.com",
    "frame-src 'self' https://challenges.cloudflare.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
    // Violations get reported to /api/csp-report and logged as [csp] lines,
    // so a blocked script shows up in the logs instead of breaking silently.
    // report-uri is the widely supported form; report-to (plus the
    // Reporting-Endpoints header below) is its successor.
    'report-uri /api/csp-report',
    'report-to csp',
  ].join('; ');
}

// Exported so tests/smoke.spec.ts can apply the exact production policy
// (astro preview doesn't run this middleware).
export const CSP = buildCsp(); // built once per Worker isolate, not per request — CSP_SCRIPT_HASHES is static per deploy

export async function onRequest({ next }) {
  const response = await next();
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CSP);
  headers.set('Reporting-Endpoints', 'csp="/api/csp-report"');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
