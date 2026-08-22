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
 *
 * Mobile uses a Chromium-based device (Pixel 5), not an iOS one — iOS
 * presets default to the WebKit engine, and ci.yml only installs Chromium
 * (`playwright install --with-deps chromium`). An iPhone preset happened to
 * pass locally only because WebKit was already installed on this machine
 * from unrelated work; CI had no such binary and failed with "Executable
 * doesn't exist" for every mobile test. Pixel 5 gives the same real
 * mobile-viewport/touch/UA coverage without needing a second browser engine.
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
    { name: 'mobile', use: { ...devices['Pixel 5'] } },
  ],
  webServer: {
    command: 'bun run build && bun run preview -- --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
