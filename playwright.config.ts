import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests only — "did the whole page catch fire," not a check of any
 * specific animation/visual behavior. See tests/smoke.spec.ts.
 *
 * Two projects, desktop + mobile: the site has mobile-only CSS paths (e.g.
 * blog/index.astro's @media(--bp-760) block) that a desktop-viewport-only
 * run never renders, so a regression scoped to that width — like nav
 * elements getting display:none'd — passes CI silently. Same smoke.spec.ts
 * runs under both.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4322',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'] } },
  ],
  webServer: {
    command: 'bun run build && bun run preview -- --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
