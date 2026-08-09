# Samuel Abhinav — Portfolio + Blog

Astro site combining the portfolio and the Threat Intel Blog. The portfolio
pages (`/`, `/about`, `/contact`) are large self-contained `.astro` files
(fonts, CSS, JS, imagery inlined), each with a WebGL/canvas backdrop and the
Luna companion embedded as an iframe. `/blog` is the unified blog index —
it carries the same design (hero, live threat wire, filterable project
grid) and shows both the hand-built project case studies (Sentinel, PRISM,
Axon, HackerOne findings) and the real MDX writeups in one feed. Individual
posts are Astro content-collection entries: each is an `.mdx` file with
frontmatter, rendered through one shared layout — new posts don't need any
HTML/CSS work.

## Structure
```
public/
  404.html            custom not-found page
  _redirects          /resume -> /resume.pdf
  _headers            Cloudflare Pages security headers (CSP, HSTS, etc.)
  robots.txt, sitemap.xml
  (everything in public/ is copied as-is into the build output)

src/
  pages/index.astro        /        — portfolio home
  pages/about.astro        /about   — about + embedded arcade
  pages/contact.astro      /contact — contact
  pages/blog/index.astro   /blog    — unified blog index: project case studies + real posts, one grid
  pages/blog/[...slug].astro        — individual post route
  content/blog/*.mdx       one file per post — copy _template.mdx to start a new one
  content.config.ts        frontmatter schema (Zod)
  layouts/BlogPost.astro   shared article layout: nav, hero, Luna, footer
  components/*.astro       SiteMenu, Luna, PortfolioLunaShell, CaseFile, Dropcap, Mnote, IocTable, etc.
  scripts/luna-greeting.js shared Luna drawer greeting (time-of-day + returning-visitor variety)
  styles/blog.css          single shared stylesheet for the blog
  scripts/blog-client.js   scroll UI, TOC, collapsed menu, copy actions
```

## Adding a new blog post
1. Copy `src/content/blog/_template.mdx`, rename it (filename = URL slug).
2. Fill in the frontmatter and body; drop any images in `public/images/`.
3. Set `draft: false` when ready.
4. `bun run build` (or `bun run dev` to preview first).

## Deploy
Cloudflare Pages, single build:
- Build command: `bun run build`
- Build output directory: `dist`

## Local preview
```
bun install
bun run dev
# http://localhost:4321
```
