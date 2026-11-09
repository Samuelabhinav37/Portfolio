// Draws the day sky's pixel clouds into public/images/clouds as small PNGs,
// shown at 2x with image-rendering:pixelated by public/scripts/pixel-clouds.js.
//
// Each cloud follows a few pixel-art rules, nothing random-looking:
// - three flat colours only, no dithering: sunlit cream, pale blue, grey-blue
// - a cauliflower dome of round lumps; every lump has a cream cap lit from
//   the upper left over a pale-blue body, and a one-pixel pale seam where a
//   lump in front overlaps it, which is what shows the lumps
// - a flat grey-blue belly along the base, its top edge scalloped by the lumps
// - a couple of one-pixel streaks of high cloud passing behind
// Run `node scripts/make-clouds.mjs` after changing a recipe.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'public/images/clouds/';
const PAL = [[253, 248, 236], [208, 226, 244], [180, 199, 225]]; // cream, pale blue, grey-blue (sky #8fb0e0)

// w, h: canvas in art px; dome: [centre x, half width, height] of the cloud body; base: belly bottom row;
// streaks: [y, x0, x1, colour]; tail: a flat stratus shelf trailing off one side
const RECIPES = [
  { name: 'cloud-1', seed: 4, w: 220, h: 70, dome: [112, 78, 52], base: 62, tail: -1,
    streaks: [[22, 4, 70, 1], [27, 150, 214, 1], [48, 176, 218, 0]] },
  { name: 'cloud-2', seed: 9, w: 140, h: 46, dome: [70, 46, 32], base: 40, tail: 1,
    streaks: [[16, 92, 136, 1]] },
  { name: 'cloud-3', seed: 2, w: 104, h: 36, dome: [52, 34, 24], base: 31, tail: 0, streaks: [[12, 70, 102, 1]] },
];

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function draw(r) {
  const rnd = rng(r.seed), [cx, hw, dh] = r.dome, W = r.w, H = r.h;
  // dome height at x, peaking a little left of centre
  const prof = (x) => { const u = (x - cx + hw * 0.12) / hw; return Math.pow(Math.max(0, 1 - u * u / 1.21), 0.75); };

  // lumps in rows, back (top of the dome) to front (along the base)
  const puffs = [];
  const rows = [
    { span: 0.5, y: 0.6, r: 0.36 },
    { span: 0.78, y: 0.36, r: 0.27 },
    { span: 0.98, y: 0.14, r: 0.18 },
  ];
  for (const row of rows) {
    const x0 = cx - hw * row.span, x1 = cx + hw * row.span, step = dh * row.r * 1.7;
    for (let x = x0; x <= x1; x += step * (0.8 + rnd() * 0.4)) {
      const f = prof(x);
      if (f < 0.15) continue;
      const rad = dh * row.r * (0.65 + 0.45 * f) * (0.85 + rnd() * 0.3);
      const y = r.base - dh * row.y * Math.sqrt(f) - rad * 0.2 + (rnd() - 0.5) * 2;
      const P = { x: x + (rnd() - 0.5) * step * 0.3, y, r: rad };
      // light per lump, so a whole cap is lit or in shade: the upper left of the cloud is lit
      P.lit = (P.x - cx) / hw * 0.55 + (P.y - (r.base - dh)) / dh * 0.9 < 0.74 + (rnd() - 0.5) * 0.2;
      // small bumps behind the top of each lump break its circle into a cauliflower edge
      const nb = 2 + Math.floor(rnd() * 3);
      for (let b = 0; b < nb; b++) {
        const a = Math.PI * (1.1 + 0.8 * (b + 0.5 + (rnd() - 0.5) * 0.6) / nb);
        puffs.push({ x: P.x + Math.cos(a) * P.r * 0.8, y: P.y + Math.sin(a) * P.r * 0.8, r: P.r * (0.34 + rnd() * 0.12), lit: P.lit });
      }
      puffs.push(P);
    }
  }

  const own = new Int16Array(W * H).fill(-1);
  for (let y = 0; y <= r.base; y++) for (let x = 0; x < W; x++) {
    for (let i = puffs.length - 1; i >= 0; i--) {
      const P = puffs[i], dx = x + 0.5 - P.x, dy = y + 0.5 - P.y;
      if (dx * dx + dy * dy <= P.r * P.r) { own[y * W + x] = i; break; }
    }
  }
  const px = new Int8Array(W * H).fill(-1);
  const O = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -1 : own[y * W + x]);
  // the belly: a flat band along the base, its top stepping with the lumps above
  const belly = (x) => Math.round(dh * 0.2 + Math.sin(x / 9 + r.seed) * 1.6 + Math.sin(x / 3.7) * 0.8);

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = O(x, y);
    if (i < 0) continue;
    const P = puffs[i], nx = (x + 0.5 - P.x) / P.r, ny = (y + 0.5 - P.y) / P.r;
    // cream cap: the upper-left part of each lump
    // cream cap: the upper-left of each lump, and only on the sunlit side of the whole cloud
    let c = ny < 0.1 - nx * 0.5 && P.lit ? 0 : 1;
    // the seam: a lump in front just below or beside casts a one-pixel pale line on this one
    if (c === 0 && (O(x, y + 1) > i || O(x + 1, y + 1) > i || O(x - 1, y + 1) > i)) c = 1;
    if (y > r.base - belly(x)) c = 2;
    px[y * W + x] = c;
  }

  // a flat stratus shelf trailing off one side at the base: stepped strips, grey under pale
  if (r.tail) {
    const from = r.tail < 0 ? cx - hw * 0.7 : cx + hw * 0.7, to = r.tail < 0 ? 2 : W - 3;
    const len = Math.abs(to - from);
    for (let k = 0; k <= len; k++) {
      const x = Math.round(from + Math.sign(to - from) * k), t = k / len;
      const thick = Math.max(1, Math.round(7 * Math.pow(1 - t, 0.7) + (rnd() < 0.3 ? -1 : 0)));
      for (let j = 0; j < thick; j++) {
        const y = r.base - j - Math.round(t * 2);
        if (px[y * W + x] < 0) px[y * W + x] = j === thick - 1 && thick > 2 ? 1 : 2;
      }
    }
  }

  // high streaks behind the cloud, with a short second line under the start
  for (const [y, x0, x1, col] of r.streaks) {
    for (let x = x0; x <= x1; x++) if (px[y * W + x] < 0) px[y * W + x] = col;
    for (let x = x0 + 3; x <= x0 + 12; x++) if (px[(y + 1) * W + x] < 0) px[(y + 1) * W + x] = col;
  }

  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < px.length; i++) {
    if (px[i] < 0) continue;
    const c = PAL[px[i]];
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ palette: true, colours: 4 }).toFile(OUT + r.name + '.png');
}

mkdirSync(OUT, { recursive: true });
for (const r of RECIPES) { await draw(r); console.log(r.name, r.w + 'x' + r.h); }
