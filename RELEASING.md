# Release Procedure

The production site is deployed through Cloudflare Pages.

1. Install dependencies from `bun.lock` with `bun install --frozen-lockfile`.
2. Run static checks, the production build, and Playwright smoke tests.
3. Review generated routes, security headers, redirects, and Pages Function configuration.
4. Preview interactive pages on desktop and mobile with reduced-motion behavior considered.
5. Merge through the protected default-branch workflow and monitor the Pages deployment.
6. Verify primary routes, blog rendering, contact behavior, security headers, and error pages in production.

If verification fails, roll back to the last known-good Cloudflare deployment and preserve build logs for diagnosis. Keep API tokens and deployment credentials in the hosting platform, never in the repository.
