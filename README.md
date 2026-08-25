# Samuel Abhinav — Portfolio and Threat Intelligence Blog

Source for [samuelabhinav.com](https://samuelabhinav.com), an Astro-based portfolio and technical blog focused on cybersecurity engineering, threat intelligence, and project case studies.

## Overview

The site combines portfolio pages, interactive WebGL and canvas experiences, and an MDX content collection. Blog posts share a common layout and schema, while project case studies appear alongside long-form articles in a unified index.

## Technology

- Astro and MDX
- TypeScript and browser-native JavaScript
- WebGL, Three.js-style rendering, and Canvas APIs
- Playwright smoke tests
- Cloudflare Pages and Pages Functions
- Bun for dependency management and project scripts

## Project structure

```text
functions/                   Cloudflare Pages Functions
public/                      Static assets, security headers, redirects, and client scripts
src/components/              Shared Astro components
src/content/blog/            MDX articles and post template
src/layouts/                 Shared article layouts
src/pages/                   Portfolio, contact, and blog routes
src/styles/                  Shared site and blog styles
tests/                       Browser-level smoke tests
```

Files under `public/` are copied directly into the build output. The security headers in `public/_headers` and disclosure record in `public/.well-known/security.txt` are deployment artifacts and should be reviewed whenever hosting changes.

## Local development

Install dependencies from the committed lockfile and start Astro:

```sh
bun install --frozen-lockfile
bun run dev
```

The development server is available at `http://localhost:4321` by default.

## Verification

Run static analysis, the production build, and browser smoke tests before submitting changes:

```sh
bun run check
bun run build
bun run test
```

The repository’s GitHub Actions workflows run Astro checks, Playwright tests, CodeQL analysis, and dependency review.

## Publishing a blog post

1. Copy `src/content/blog/_template.mdx` to a descriptive filename. The filename becomes the URL slug.
2. Complete the required frontmatter and article body.
3. Place referenced images under `public/images/`.
4. Preview the post locally and verify responsive layouts.
5. Set `draft: false` when the article is ready to publish.
6. Run the complete verification commands above.

## Deployment

The site is designed for Cloudflare Pages:

- Build command: `bun run build`
- Output directory: `dist`
- Package manager: Bun with `bun.lock`

Production environment variables used by Pages Functions must be configured through the hosting platform and must not be committed.

## Security

Please review [SECURITY.md](SECURITY.md) before testing or reporting a vulnerability. Do not place API credentials, private findings, personal data, or unpublished reports in issues or pull requests.

## Current limitations

Some visual engines are intentionally large, browser-oriented scripts and still contain legacy or experimental paths reported by static analysis. Accessibility, reduced-motion behavior, mobile performance, and cross-browser rendering should be checked for changes affecting interactive pages.

## License

No general-purpose license has been declared for the site content or source. Unless a file states otherwise, reuse rights are reserved.
