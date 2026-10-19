import { test, expect } from '@playwright/test';
import { CSP } from '../functions/_middleware.js';

/**
 * Smoke tests, not feature tests: for every real page, confirm it actually
 * loads (2xx/3xx, not a broken route) and throws no uncaught JS errors.
 * Doesn't test animations, the arcade game, or Luna's behavior in any
 * detail — see the project's own notes on why: this site is heavy on
 * canvas/WebGL work that isn't realistic to assert on automatically.
 * This is the "did the whole thing catch fire" check, nothing deeper.
 */

const PAGES = [
  '/',
  '/about',
  '/contact',
  '/blog',
  '/blog/anatomy-of-a-supply-chain-attack',
  '/es/blog/anatomy-of-a-supply-chain-attack',
  '/blog/_blueprint',
  '/blog/_template',
  '/tools/new-post',
];

// Errors known to be expected right now, not regressions to catch.
// Keep this list short and specific — anything not matched here still fails
// the test, which is the point.
const KNOWN_ERRORS: RegExp[] = [
  // contact.astro's Turnstile widget uses a real sitekey scoped to the
  // production domain(s) in the Cloudflare dashboard. Under CI/local
  // preview the page loads on localhost, which isn't an allowed domain for
  // that sitekey, so the widget logs a domain-validation error — it works
  // fine on the real deployed domain. Narrow to this exact code so an
  // actual Turnstile misconfiguration (wrong sitekey, etc.) still fails.
  /\[Cloudflare Turnstile\] Error: 110200/,
  // Same domain-validation situation, different widget: after rotating to
  // a new Turnstile sitekey, the rejected-domain path logs this styled
  // (invisible-in-a-real-browser, via font-size:0/color:transparent) debug
  // line instead of the numeric error code above. Still the widget's own
  // internal telemetry, not app code — narrow match for the same reason.
  /^%c%d font-size:0;color:transparent/,
  // Same root cause, a third shape: Turnstile's iframe (always https, even
  // locally) runs its own same-origin/clickjacking check against its
  // parent. Real deploys are https end-to-end so parent and frame always
  // match; only the local/CI preview server (plain http) trips this, and
  // only surfaced once the mobile Playwright project was added — Turnstile
  // renders differently in its compact/mobile mode and hits this check
  // path that the desktop layout doesn't.
  /frame requesting access has a protocol of "https".*Protocols must match/,
];

/**
 * `astro preview` doesn't run functions/_middleware.js, so without this the
 * tests never saw the production Content-Security-Policy, and an inline
 * script the CSP blocks (Kai's srcdoc engine, inline onload handlers) passed
 * CI while being broken in production. Every document response gets the
 * exact production header, and every CSP violation, in the page or in any
 * srcdoc iframe, fails the test.
 */
test.beforeEach(async ({ page, baseURL }) => {
  const siteOrigin = new URL(baseURL!).origin;
  await page.route('**/*', async (route) => {
    // Only this site's own documents: third-party frames (Turnstile) send
    // their own CSP, and ours would block them from being framed at all.
    const req = route.request();
    if (req.resourceType() !== 'document' || new URL(req.url()).origin !== siteOrigin) {
      return route.continue();
    }
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), 'content-security-policy': CSP },
    });
  });
  await page.addInitScript(() => {
    (window as any).__cspViolations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      (window as any).__cspViolations.push(
        `${e.effectiveDirective} blocked ${e.blockedURI || 'inline'} in ${location.href.slice(0, 60)}` +
          (e.sourceFile ? ` (${e.sourceFile}:${e.lineNumber})` : ''),
      );
    });
  });
});

async function collectCspViolations(page: import('@playwright/test').Page): Promise<string[]> {
  const all: string[] = [];
  for (const frame of page.frames()) {
    try {
      all.push(...(await frame.evaluate(() => (window as any).__cspViolations || [])));
    } catch {
      // cross-origin or detached frame (e.g. Turnstile): nothing to read
    }
  }
  return [...new Set(all)];
}

for (const path of PAGES) {
  test(`${path} loads with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() !== 'error') return;
      // The page pulls live data from several third-party APIs/RSS proxies
      // (weather, podcast art, security-news feeds) with proper .catch()
      // handling already in the site's own code — a flaky/rate-limited
      // external service showing up here is a fact about that service, not
      // a bug in this codebase. A same-origin failure that actually matters
      // will still surface as a pageerror when the code that depends on it
      // runs, which this test still catches.
      if (/^Failed to load resource/.test(msg.text())) return;
      if (/blocked by CORS policy/.test(msg.text())) return;
      errors.push(msg.text());
    });

    // 'networkidle' is flaky here under parallel load — several pages poll
    // external APIs (weather, RSS) on a timer that never goes fully quiet,
    // and 8 workers hitting one preview server at once can push response
    // times past a networkidle wait. 'load' + a short fixed settle is
    // deterministic and still gives any load-time errors time to surface.
    const response = await page.goto(path, { waitUntil: 'load' });
    expect(response?.ok(), `${path} should return a successful response`).toBeTruthy();
    await page.waitForTimeout(1500);

    const unexpected = errors.filter((e) => !KNOWN_ERRORS.some((known) => known.test(e)));
    expect(unexpected, `unexpected console errors on ${path}:\n${unexpected.join('\n')}`).toEqual([]);

    // Analytics hosts only load on the real domain, so anything reported
    // here is first-party inline code the production CSP will block.
    const violations = await collectCspViolations(page);
    expect(violations, `CSP violations on ${path}:\n${violations.join('\n')}`).toEqual([]);
  });
}
