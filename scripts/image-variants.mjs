#!/usr/bin/env node
/* Generates smaller WebP variants of blog images (runs as part of prebuild).

   Pages used to ship the full originals everywhere: 1600px heroes into
   ~300-600px slots, 800px cards into 58px "More stories" thumbnails (about
   700KB of images per blog post). Originals stay untouched as the source of
   truth (desktop hero at 2x, social share previews); this only adds
   `name.w<width>.webp` files beside them:

     *-hero.webp  -> .w800   (blog index cards, post hero on phones)
     *-card.webp  -> .w480   (homepage writing cards)
                  -> .w160   (More stories rail thumbnails)

   Idempotent: a variant is only (re)written when missing or older than its
   source, so new posts get variants automatically on the next build. If
   sharp can't load (unsupported platform), it warns and exits 0; pages fall
   back to the originals via src/lib/image-variant.ts, which only points at
   a variant whose file actually exists. */

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

const IMAGES = new URL('../public/images/', import.meta.url);
const IMAGES_PATH = IMAGES.pathname.replace(/^\/([A-Za-z]:)/, '$1');

const RULES = [
  { match: /-hero\.webp$/, widths: [800] },
  { match: /-card\.webp$/, widths: [480, 160] },
];
const QUALITY = 76;

let sharp;
try {
  sharp = (await import('sharp')).default;
} catch (err) {
  console.warn('image-variants: sharp unavailable, skipping (pages fall back to originals):', err.message);
  process.exit(0);
}

async function mtime(p) {
  try {
    return (await stat(p)).mtimeMs;
  } catch {
    return 0;
  }
}

let written = 0, kept = 0;
for (const name of await readdir(IMAGES_PATH)) {
  const rule = RULES.find((r) => r.match.test(name));
  if (!rule) continue;
  const src = path.join(IMAGES_PATH, name);
  const srcTime = await mtime(src);
  const meta = await sharp(src).metadata();
  for (const w of rule.widths) {
    if (meta.width && meta.width <= w) continue; // never upscale
    const out = path.join(IMAGES_PATH, name.replace(/\.webp$/, `.w${w}.webp`));
    if ((await mtime(out)) >= srcTime) { kept++; continue; }
    await sharp(src).resize({ width: w }).webp({ quality: QUALITY }).toFile(out);
    written++;
  }
}
console.log(`image-variants: ${written} written, ${kept} up to date.`);
