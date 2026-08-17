#!/usr/bin/env node
/* Generates public/sitemap.xml from the blog content collection so it can
   never drift out of sync with what actually gets published. Runs as a
   "prebuild" step (npm's implicit pre-hook for "build") so the freshly
   written file is in place before `astro build` copies public/ into dist/.

   Mirrors the routing rules baked into src/pages/blog/[...slug].astro and
   src/pages/es/blog/[...slug].astro:
   - draft posts get a real page (direct-link-only) but are excluded from
     the sitemap, same as they're excluded from blog/index.astro's listing.
   - a translation only gets a route (and thus a sitemap entry) if the
     matching es/<slug>.mdx file exists and isn't itself a draft.

   Uses the `yaml` package for frontmatter parsing — not a direct dependency
   of this project, but pulled in transitively by Astro itself, so no new
   dependency is added. */

import { readFile, writeFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parse as parseYaml } from 'yaml';

const SITE = 'https://samuelabhinav.com';
const BLOG_DIR = fileURLToPath(new URL('../src/content/blog/', import.meta.url));
const OUT_FILE = new URL('../public/sitemap.xml', import.meta.url);

function extractFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) throw new Error('No frontmatter block found');
  return parseYaml(match[1]);
}

async function loadPosts() {
  const entries = await readdir(BLOG_DIR, { withFileTypes: true, recursive: true });
  const posts = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
    if (entry.name.startsWith('_')) continue; // _template.mdx, _blueprint.mdx

    const dir = entry.parentPath ?? entry.path;
    const fullPath = path.join(dir, entry.name);
    const id = path.relative(BLOG_DIR, fullPath).replace(/\\/g, '/').replace(/\.mdx$/, '');

    const raw = await readFile(fullPath, 'utf8');
    const data = extractFrontmatter(raw);
    posts.push({ id, data });
  }
  return posts;
}

function fmtDate(d) {
  return new Date(d).toISOString().slice(0, 10);
}

async function main() {
  const posts = await loadPosts();

  const englishPosts = posts.filter((p) => !p.id.includes('/') && !p.data.draft);
  const esSlugs = new Set(
    posts.filter((p) => p.id.startsWith('es/') && !p.data.draft).map((p) => p.id.slice('es/'.length))
  );

  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/blog`, priority: '0.9' },
    { loc: `${SITE}/about`, priority: '0.8' },
    { loc: `${SITE}/contact`, priority: '0.8' },
  ];

  for (const post of englishPosts.sort((a, b) => a.data.pubDate - b.data.pubDate)) {
    urls.push({
      loc: `${SITE}/blog/${post.id}`,
      lastmod: fmtDate(post.data.updatedDate ?? post.data.pubDate),
      priority: '0.7',
    });
    if (esSlugs.has(post.id)) {
      const esPost = posts.find((p) => p.id === `es/${post.id}`);
      urls.push({
        loc: `${SITE}/es/blog/${post.id}`,
        lastmod: fmtDate(esPost.data.updatedDate ?? esPost.data.pubDate),
        priority: '0.6',
      });
    }
  }

  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : '';
      return `  <url><loc>${u.loc}</loc>${lastmod}<priority>${u.priority}</priority></url>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;

  await writeFile(OUT_FILE, xml, 'utf8');
  console.log(`sitemap: wrote ${urls.length} urls to public/sitemap.xml`);
}

main().catch((err) => {
  console.error('generate-sitemap failed:', err);
  process.exit(1);
});
