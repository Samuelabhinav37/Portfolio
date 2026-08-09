import { test, expect } from '@playwright/test';

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
  '/blog/detecting-lateral-movement-active-directory',
  '/blog/honeypot-lab-aws-threat-intel',
  '/blog/_blueprint',
  '/blog/_template',
  '/tools/new-post',
];

// Errors known to be expected right now, not regressions to catch.
// Keep this list short and specific — anything not matched here still fails
// the test, which is the point.
const KNOWN_ERRORS = [
  /Turnstile.*400020/, // placeholder sitekey — see src/pages/contact.astro, needs a real key before launch
];

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

    const response = await page.goto(path, { waitUntil: 'networkidle' });
    expect(response?.ok(), `${path} should return a successful response`).toBeTruthy();

    const unexpected = errors.filter((e) => !KNOWN_ERRORS.some((known) => known.test(e)));
    expect(unexpected, `unexpected console errors on ${path}:\n${unexpected.join('\n')}`).toEqual([]);
  });
}
