// Draws the site's cursors (the nav's pointer tab) as 32px PNGs in
// public/cursors. White with a dark outline so each one shows on the night
// and the day sky. Run `node scripts/make-cursors.mjs` after editing a shape;
// the hotspots live next to each shape and in NavTools.astro's CSS.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const INK = '#111', W = '#fff';
// a white line with a dark edge: the dark stroke first, the white one on top
const line = (d, w = 2.2) => `<path d="${d}" fill="none" stroke="${INK}" stroke-width="${w + 2.4}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${W}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shape = (d) => `<path d="${d}" fill="${W}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`;

// the classic arrow, drawn in 2px blocks like the arcade game
const PIX = [
  'B', 'BB', 'BWB', 'BWWB', 'BWWWB', 'BWWWWB', 'BWWWWWB', 'BWWWWWWB', 'BWWWWWWWB',
  'BWWWWWBBBB', 'BWWBWWB', 'BWB.BWWB', 'BB..BWWB', 'B....BWWB', '.....BWWB', '......BB',
];
const pixel = PIX.flatMap((row, y) => [...row].map((c, x) => (c === '.' ? '' : `<rect x="${x * 2}" y="${y * 2}" width="2" height="2" fill="${c === 'B' ? INK : W}"/>`))).join('');

export const CURSORS = {
  jelly: { hot: [16, 4], svg:
    line('M11 16q-2 4 0 7t0 6') + line('M16 16q-2 4 0 7t0 6') + line('M21 16q-2 4 0 7t0 6') +
    shape('M6.5 15C6.5 8 10.5 4 16 4s9.5 4 9.5 11q-2.4 1.8-4.75 0-2.4 1.8-4.75 0-2.4 1.8-4.75 0-2.4 1.8-4.75 0z') },
  star: { hot: [16, 16], svg: shape('M16 2l2.9 11.1L30 16l-11.1 2.9L16 30l-2.9-11.1L2 16l11.1-2.9z') },
  pixel: { hot: [1, 1], svg: `<g shape-rendering="crispEdges">${pixel}</g>` },
  key: { hot: [4, 4], svg: line('M19 19L5 5M8.5 8.5l3-3M12 12l2.5-2.5') + line('M23.5 18.5a5 5 0 1 1-5 5 5 5 0 0 1 5-5z') },
  lens: { hot: [12, 12], svg: line('M18 18l9 9', 3.4) + `<circle cx="12" cy="12" r="7.5" fill="rgba(255,255,255,.35)"/>` + line('M12 4.5a7.5 7.5 0 1 1 0 15 7.5 7.5 0 0 1 0-15z') },
};

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  mkdirSync('public/cursors', { recursive: true });
  for (const [name, { svg }] of Object.entries(CURSORS)) {
    const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">${svg}</svg>`;
    await sharp(Buffer.from(doc)).png().toFile(`public/cursors/${name}.png`);
  }
  console.log('wrote', Object.keys(CURSORS).map((n) => `public/cursors/${n}.png`).join(' '));
}
