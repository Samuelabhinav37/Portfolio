#!/usr/bin/env node
/* One-off image compression pass, run manually (`node scripts/optimize-images.mjs`).
   Not wired into the build — this project has no image pipeline (astro:assets
   isn't used anywhere; every <img> points straight at /public/images), and
   full migration to it is a separate, bigger effort. This just shrinks the
   handful of oversized originals in place, converting to WebP.

   Targets, with rationale:
   - about-profile.png: shown in a ~340px+ card with a 1.42x CSS scale.
     Resized to a 900px max edge for retina headroom, converted to WebP.
     523K -> 27K.
   - supply-chain-hero.jpg / supply-chain-card.jpg: full-bleed hero panel and
     a 1:1 thumbnail respectively. Resized to sane max widths, converted to
     WebP. 826K -> 279K / 857K -> 168K.
   - about-pokemon-ceruledge.gif: the one pokemon sprite whose source
     resolution was actually large enough that a resize+re-encode wins.
     669K -> 272K.

   The other five about-pokemon-*.gif files are deliberately NOT here.
   Tried first: turns out those GIFs are already only ~118×107px at their
   source (barely above their 56px display size — my working assumption
   that they were shipped at "full sprite-sheet resolution" was wrong), each
   with 60-100+ animation frames of near-flat pixel-art color. Re-encoding
   that as animated WebP (lossy OR lossless, tried both, tried quality
   30-82) always came out LARGER than the original GIF — WebP's per-frame
   overhead loses to GIF's palette+LZW on this specific content. Left as
   the original GIFs; not every "convert to WebP" instinct pays off, and
   shipping a bigger file to prove a point isn't the goal. */

import sharp from 'sharp';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const IMAGES = new URL('../public/images/', import.meta.url);

const TARGETS = [
  { file: 'about-pokemon-ceruledge.gif', size: 112, animated: true },
  { file: 'about-profile.png', width: 900, quality: 82 },
  { file: 'supply-chain-hero.jpg', width: 1600, quality: 80 },
  { file: 'supply-chain-card.jpg', width: 800, quality: 80 },
];

async function main() {
  for (const t of TARGETS) {
    const src = new URL(t.file, IMAGES);
    const outName = t.file.replace(/\.(gif|png|jpe?g)$/i, '.webp');
    const dest = new URL(outName, IMAGES);

    const before = (await stat(src)).size;
    const input = await readFile(fileURLToPath(src));

    let pipeline = sharp(input, t.animated ? { animated: true } : undefined);
    if (t.size) {
      pipeline = pipeline.resize({ width: t.size, height: t.size, fit: 'inside' });
    } else if (t.width) {
      pipeline = pipeline.resize({ width: t.width, withoutEnlargement: true });
    }
    pipeline = pipeline.webp({ quality: t.quality ?? 82 });

    await pipeline.toFile(fileURLToPath(dest));

    const after = (await stat(dest)).size;
    console.log(
      `${t.file} -> ${outName}  ${(before / 1024).toFixed(0)}K -> ${(after / 1024).toFixed(0)}K` +
        ` (-${(100 - (after / before) * 100).toFixed(0)}%)`
    );
  }
}

main().catch((err) => {
  console.error('optimize-images.mjs failed:', err);
  process.exit(1);
});
