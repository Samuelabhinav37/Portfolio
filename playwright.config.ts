import { defineConfig } from '@playwright/test';

/**
 * Smoke tests only — "did the whole page catch fire," not a check of any
 * specific animation/visual behavior. See tests/smoke.spec.ts.
 */
export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4322',
  },
  webServer: {
    command: 'bun run build && bun run preview -- --port 4322',
    url: 'http://localhost:4322',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
