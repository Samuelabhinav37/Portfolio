// Draws the day sky's pixel clouds into public/images/clouds as small PNGs,
// shown at 2x with image-rendering:pixelated by public/scripts/pixel-clouds.js.
//
// The look follows hand-made cumulus sprites:
// - the cloud is a pile of round lumps; lower lumps sit nearer the viewer and
//   overlap the ones behind, so each lump shows as its own shaded ball
// - each lump is lit like a sphere from the upper left: white on top, stepping
//   through four blues to the lower right, with no outlines
// - band edges break into small pixel clusters instead of clean curves
// - a flat base with a thin grey shadow ledge under it that runs a little past
//   the cloud, tapering to points
// - a tall tower off centre, long low sides tapering out, a few chips at the rim
// - thin streaks of high cloud passing behind
// Run `node scripts/make-clouds.mjs` after changing a recipe.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

const OUT = 'public/images/clouds/';
// white, ice, pale, light blue, mid blue (shade), ledge (day sky is about #8fb0e0)
const PAL = [[255, 255, 255], [236, 244, 252], [213, 228, 244], [188, 208, 234], [164, 188, 222], [136, 160, 200]];
const LEDGE = 5;

// w, h: canvas in art px; base: row of the flat bottom; tower: [x, half width, height];
// body: [x0, x1, height] of the low part; streaks: [y, x0, x1, tone]
const RECIPES = [
  { name: 'cloud-1', seed: 7, w: 260, h: 96, base: 84, tower: [150, 34, 74], body: [14, 246, 30],
    streaks: [[60, 0, 40, 2], [74, 230, 259, 2], [44, 205, 250, 1]] },
  { name: 'cloud-2', seed: 3, w: 150, h: 56, base: 48, tower: [62, 22, 40], body: [8, 142, 18],
    streaks: [[38, 120, 149, 2]] },
  { name: 'cloud-3', seed: 12, w: 80, h: 32, base: 26, tower: [36, 13, 20], body: [6, 74, 9],
    streaks: [] },
];

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x, y, s) => { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 1274126177); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };

function draw(r) {
  const rnd = rng(r.seed), W = r.w, H = r.h, B = r.base;
  const [tx, thw, th] = r.tower, [bx0, bx1, bh] = r.body;
  // silhouette height above the base at x: a low body tapering to its ends, plus the tower
  const top = (x) => {
    const u = Math.min(1, Math.max(0, Math.min(x - bx0, bx1 - x) / ((bx1 - bx0) * 0.35)));
    const body = bh * Math.pow(u, 0.6);
    const g = (x - tx) / thw, tower = th * Math.exp(-g * g * 0.9);
    return Math.max(body, tower);
  };

  // lumps along the silhouette and a few rows inside it; lower rows sit nearer (bigger z)
  const puffs = [];
  for (let layer = 0; layer < 6; layer++) {
    const depth = layer / 5; // 0 = the rim at the top, 1 = the front row at the base
    for (let x = bx0; x <= bx1;) {
      const h = top(x);
      if (h < 3) { x += 2; continue; }
      const rad = Math.max(2.5, Math.min(h * 0.26 + 2, 13) * (0.75 + rnd() * 0.5));
      const y = B - h * (1 - depth * 0.78) + rad * 0.85 + (rnd() - 0.5) * 2;
      puffs.push({ x: x + (rnd() - 0.5) * rad * 0.5, y, r: rad, z: depth * 40 + rnd() * 4 });
      x += rad * (1.05 + rnd() * 0.5);
    }
  }

  const L = [-0.55, -0.7, 0.45], Ln = Math.hypot(...L);
  const tone = new Int8Array(W * H).fill(-1);
  for (let y = 0; y < B; y++) for (let x = 0; x < W; x++) {
    let best = null, bz = -1e9, bn = null;
    for (const P of puffs) {
      const dx = x + 0.5 - P.x, dy = y + 0.5 - P.y;
      // a ragged rim: each lump's radius loses up to a pixel here and there
      const rr = P.r - hash(x >> 1, y >> 1, r.seed) * 1.2;
      const d2 = dx * dx + dy * dy;
      if (d2 > rr * rr) continue;
      const nz = Math.sqrt(rr * rr - d2), z = P.z + nz;
      if (z > bz) { bz = z; best = P; bn = [dx / rr, dy / rr, nz / rr]; }
    }
    if (!best) continue;
    const lit = (bn[0] * L[0] + bn[1] * L[1] + bn[2] * L[2]) / Ln; // -1..1
    const low = (y - (B - top(x))) / Math.max(1, top(x)); // 0 at the top of the cloud, 1 at the base
    let v = 0.46 + lit * 0.66 - low * 0.45 - (x - tx) / (bx1 - bx0) * 0.18;
    // clusters at the band edges: 2px blocks plus a little single-pixel grain
    v += (hash((x + (y & 1)) >> 1, y >> 1, r.seed + 1) - 0.5) * 0.2;
    tone[y * W + x] = Math.max(0, Math.min(4, Math.floor((1 - v) * 4.2)));
  }

  // the base: the bottom two rows of cloud go to shade, then the ledge runs past both ends
  let L0 = W, L1 = -1;
  for (let x = 0; x < W; x++) if (tone[(B - 1) * W + x] >= 0) { L0 = Math.min(L0, x); L1 = Math.max(L1, x); }
  for (let x = L0; x <= L1; x++) for (let j = 1; j <= 2; j++) { const i = (B - j) * W + x; if (tone[i] >= 0) tone[i] = Math.max(tone[i], 4 - (j - 1)); }
  const e0 = Math.max(0, L0 - 4), e1 = Math.min(W - 1, L1 + Math.round((L1 - L0) * 0.06) + 4);
  for (let x = e0; x <= e1; x++) {
    const t = Math.min(x - e0, e1 - x), thick = t < 3 ? 1 : t < 10 ? 2 : 3;
    for (let j = 0; j < thick; j++) tone[(B + j) * W + x] = LEDGE;
  }

  // high streaks behind the cloud, each with a short second line under one end
  for (const [y, x0, x1, c] of r.streaks) {
    for (let x = x0; x <= x1; x++) if (tone[y * W + x] < 0) tone[y * W + x] = c;
    const a = x0 + Math.round((x1 - x0) * 0.3), b = a + Math.round((x1 - x0) * 0.35);
    for (let x = a; x <= b; x++) if (tone[(y + 1) * W + x] < 0) tone[(y + 1) * W + x] = Math.min(4, c + 1);
  }

  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < tone.length; i++) {
    if (tone[i] < 0) continue;
    const c = PAL[tone[i]];
    out[i * 4] = c[0]; out[i * 4 + 1] = c[1]; out[i * 4 + 2] = c[2]; out[i * 4 + 3] = 255;
  }
  return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png({ palette: true, colours: 8 }).toFile(OUT + r.name + '.png');
}

mkdirSync(OUT, { recursive: true });
for (const r of RECIPES) { await draw(r); console.log(r.name, r.w + 'x' + r.h); }
