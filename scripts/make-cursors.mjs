// Draws the site's cursors (the nav's pointer tab) as 32px pixel art in
// public/cursors, in the style of motherdesign.com's: each object tilted to
// point up and left, flat white with a grey side for volume, a few dark
// details, and a crisp 1px black outline traced around it, so it reads on
// the night sky and the day sky alike.
//
// Each shape is drawn as plain SVG on a 32px grid, rasterised, every pixel
// snapped to the four-colour palette, then outlined. Run
// `node scripts/make-cursors.mjs` after editing a shape; the hotspots are
// listed here and used in NavTools.astro's CSS.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const S = 32;
const PAL = { W: [255, 255, 255], G: [196, 202, 214], D: [128, 136, 152], K: [13, 13, 15] };
const W = '#fff', G = '#c4cad6', D = '#808898', K = '#0d0d0f';
// shapes are drawn upright (pointing up) around 0,0, then turned to point up and left
const tilt = (body) => `<g transform="translate(15.5 15.5) rotate(-45)">${body}</g>`;

export const CURSORS = {
  // a jellyfish swimming up and left, bell first, four tentacles trailing
  jelly: { hot: [7, 7], svg: tilt(`
    ${[-4.6, 0, 4.6].map((x, i) => `<path d="M${x} -1 q${i === 1 ? 1.8 : -1.8} 3.6 0 7.2 t0 7.2" fill="none" stroke="${i === 2 ? G : W}" stroke-width="1.1"/>`).join('')}
    <path d="M-8 -1.2C-8 -8.6-4.4-12.6 0-12.6S8-8.6 8-1.2q-2 1.4-4 0-2 1.4-4 0-2 1.4-4 0-2 1.4-4 0z" fill="${W}"/>
    <path d="M2-12.2C5.8-10.8 8-6.8 8-1.2q-1 .7-2 .5C6-6.4 4.4-10 2-12.2z" fill="${G}"/>
    <path d="M-5.4-3.6h10.8" stroke="${D}" stroke-width="1.1"/>
    <rect x="-3.4" y="-8.6" width="1.4" height="1.4" fill="${D}"/>`) },

  // a four-point sparkle with a small one beside it
  star: { hot: [15, 15], svg: `
    <path d="M15.5 2.5l2.8 10.2 10.2 2.8-10.2 2.8-2.8 10.2-2.8-10.2-10.2-2.8 10.2-2.8z" fill="${W}"/>
    <path d="M15.5 15.5h13l-10.2 2.8-2.8 10.2z" fill="${G}"/>
    <path d="M25.5 3.5l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="${W}"/>
    <rect x="14.7" y="14.7" width="1.6" height="1.6" fill="${D}"/>` },

  // the classic arrow, with a grey side on its tail
  pixel: { hot: [3, 2], svg: `
    <path d="M3 2v22.5l5.5-5 4 9 3.6-1.6-4-8.9h7.4z" fill="${W}"/>
    <path d="M11 19.6l4 8.6 1.1-.5-4-8.9h7.4l-1.6-1.4h-6.4z" fill="${G}"/>` },

  // an old key, its teeth leading, the bow trailing
  key: { hot: [6, 6], svg: tilt(`
    <rect x="-1.7" y="-13" width="3.4" height="18" fill="${W}"/>
    <rect x="0.2" y="-13" width="1.5" height="18" fill="${G}"/>
    <rect x="-6" y="-13" width="4.4" height="2.6" fill="${W}"/>
    <rect x="-5" y="-8.6" width="3.4" height="2.2" fill="${W}"/>
    <rect x="-3" y="3.2" width="6" height="2" fill="${G}"/>
    <path d="M0 4.6a5.8 5.8 0 1 1 0 11.6A5.8 5.8 0 0 1 0 4.6zm0 3.4a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8z" fill="${W}" fill-rule="evenodd"/>
    <path d="M5.8 10.4A5.8 5.8 0 0 1 0 16.2v-3.4a2.4 2.4 0 0 0 2.4-2.4z" fill="${G}"/>`) },

  // a magnifying glass, lens leading; the hotspot is the middle of the lens
  lens: { hot: [11, 11], svg: tilt(`
    <rect x="-1.3" y="0.6" width="2.6" height="4" fill="${W}"/>
    <rect x="-2.3" y="4" width="4.6" height="10" rx="1.2" fill="${W}"/>
    <rect x="0.2" y="4" width="2.1" height="10" fill="${G}"/>
    <rect x="-2.3" y="7.4" width="4.6" height="1.1" fill="${D}"/><rect x="-2.3" y="10.6" width="4.6" height="1.1" fill="${D}"/>
    <circle cx="0" cy="-6" r="7.6" fill="${W}"/>
    <circle cx="0" cy="-6" r="5.2" fill="${G}"/>
    <path d="M-3.6-7.6a3.8 3.8 0 0 1 2.6-2.6" fill="none" stroke="${W}" stroke-width="1.5"/>`) },
};

// rasterise, snap to the palette, then trace the outline
async function pixels(svg) {
  const doc = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}" shape-rendering="crispEdges">${svg}</svg>`;
  const raw = await sharp(Buffer.from(doc)).ensureAlpha().raw().toBuffer();
  const px = new Array(S * S).fill(null); // palette key or null
  for (let i = 0; i < S * S; i++) {
    if (raw[i * 4 + 3] < 128) continue;
    const [r, g, b] = [raw[i * 4], raw[i * 4 + 1], raw[i * 4 + 2]];
    let best = 'W', bd = Infinity;
    for (const [k, [R, Gr, B]] of Object.entries(PAL)) { const d = (r - R) ** 2 + (g - Gr) ** 2 + (b - B) ** 2; if (d < bd) { bd = d; best = k; } }
    px[i] = best;
  }
  const out = px.slice();
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    if (px[y * S + x]) continue;
    const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => { const X = x + dx, Y = y + dy; return X >= 0 && Y >= 0 && X < S && Y < S && px[Y * S + X]; });
    if (near) out[y * S + x] = 'K';
  }
  return out;
}

async function png(keys, file) {
  const buf = Buffer.alloc(S * S * 4);
  keys.forEach((k, i) => { if (k) { buf.set(PAL[k], i * 4); buf[i * 4 + 3] = 255; } });
  await sharp(buf, { raw: { width: S, height: S, channels: 4 } }).png().toFile(file);
}

if (import.meta.url === `file:///${process.argv[1].replace(/\\/g, '/')}`) {
  mkdirSync('public/cursors', { recursive: true });
  for (const [name, { svg, hot }] of Object.entries(CURSORS)) {
    const keys = await pixels(svg);
    // self-check: the hotspot is on the drawing (not empty space) and nothing touches the edge
    console.assert(keys[hot[1] * S + hot[0]], `${name}: hotspot ${hot} is empty`);
    console.assert(![...Array(S).keys()].some((i) => keys[i] || keys[(S - 1) * S + i] || keys[i * S] || keys[i * S + S - 1]), `${name}: touches the edge`);
    await png(keys, `public/cursors/${name}.png`);
  }
  console.log('wrote', Object.keys(CURSORS).map((n) => `public/cursors/${n}.png`).join(' '));
}
