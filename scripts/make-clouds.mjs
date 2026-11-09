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

// w, h: canvas in art px; base: row of the bottom; heads: [x, half width, height] towers;
// body: [x0, x1, height] of the low part; streaks: [y, x0, x1, tone]
// round: no flat cut, lumps keep round bottoms; ledge: [extra px left, right];
// tail: [side -1|1, length, thickness] a thin shelf off the base; wob: base steps up a pixel in places
const RECIPES = [
  // tall cumulus, two heads, ledge pushed out to the right
  { name: 'cloud-1', seed: 7, w: 260, h: 100, base: 86, heads: [[150, 30, 76], [96, 18, 44]], body: [20, 240, 26],
    ledge: [2, 22], wob: 1, streaks: [[44, 205, 252, 1], [72, 0, 30, 2]] },
  // wide low lumpy cloud whose base trails off left into a thin shelf with streaks
  { name: 'cloud-2', seed: 3, w: 220, h: 52, base: 44, heads: [[120, 16, 30], [160, 14, 24], [84, 12, 20]], body: [60, 200, 14],
    tail: [-1, 62, 7], wob: 1, streaks: [[30, 0, 46, 1], [37, 8, 52, 2], [26, 186, 219, 1]] },
  // small round puff, soft bottom
  { name: 'cloud-3', seed: 12, w: 64, h: 34, base: 26, heads: [[30, 12, 18]], body: [8, 56, 8], round: 1, streaks: [] },
  // two tiny puffs drifting together
  { name: 'cloud-4', seed: 21, w: 60, h: 24, base: 18, heads: [[15, 6, 9], [43, 8, 12]], body: [6, 54, 0], round: 1, streaks: [] },
  // a long thin wisp: streaks with a couple of small lumps
  { name: 'cloud-5', seed: 5, w: 180, h: 22, base: 15, heads: [[70, 10, 8], [104, 8, 6]], body: [44, 130, 4], round: 1,
    streaks: [[8, 20, 150, 1], [12, 0, 60, 2], [16, 96, 179, 2], [19, 30, 110, 3]] },
];

function rng(seed) {
  let s = seed | 0;
  return () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x, y, s) => { let h = Math.imul(x * 374761393 + y * 668265263 + s * 2246822519, 1274126177); h ^= h >>> 13; return ((h >>> 0) % 1000) / 1000; };

function draw(r) {
  const rnd = rng(r.seed), W = r.w, H = r.h, B = r.base;
  const [bx0, bx1, bh] = r.body, tx = r.heads[0][0];
  // silhouette height above the base at x: a low body tapering to its ends, plus the tower
  const top = (x) => {
    const u = Math.min(1, Math.max(0, Math.min(x - bx0, bx1 - x) / ((bx1 - bx0) * 0.35)));
    const body = bh * Math.pow(u, 0.6);
    let h = body;
    for (const [hx, hw, hh] of r.heads) { const g = (x - hx) / hw; h = Math.max(h, hh * Math.exp(-g * g * 0.9)); }
    return h;
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
  // the flat base, stepping up a pixel in a few runs so it is not ruled straight
  const cut = (x) => r.round ? H : B - (r.wob && hash(x >> 3, 9, r.seed) < 0.35 ? 1 : 0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (y >= cut(x)) continue;
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
    const low = Math.min(1.3, (y - (B - top(x))) / Math.max(1, top(x))); // 0 at the top of the cloud, 1 at the base
    let v = 0.46 + lit * 0.66 - low * 0.45 - (x - tx) / (bx1 - bx0) * 0.18;
    // clusters at the band edges: 2px blocks plus a little single-pixel grain
    v += (hash((x + (y & 1)) >> 1, y >> 1, r.seed + 1) - 0.5) * 0.2;
    tone[y * W + x] = Math.max(0, Math.min(4, Math.floor((1 - v) * 4.2)));
  }

  if (!r.round) {
    // the bottom two rows of cloud go to shade
    let L0 = W, L1 = -1;
    for (let x = 0; x < W; x++) if (tone[(cut(x) - 1) * W + x] >= 0) { L0 = Math.min(L0, x); L1 = Math.max(L1, x); }
    for (let x = L0; x <= L1; x++) for (let j = 1; j <= 2; j++) { const i = (cut(x) - j) * W + x; if (tone[i] >= 0) tone[i] = Math.max(tone[i], 5 - j); }
    // the ledge: a shadow strip under the base, running past each end by its own amount
    if (r.ledge) {
      const e0 = Math.max(0, L0 - r.ledge[0]), e1 = Math.min(W - 1, L1 + r.ledge[1]);
      for (let x = e0; x <= e1; x++) {
        const t = Math.min(x - e0, e1 - x), thick = t < 3 ? 1 : t < 12 ? 2 : 3;
        for (let j = 0; j < thick; j++) tone[(B + j) * W + x] = LEDGE;
      }
    }
    // the tail: a thin shelf out of the base, thinning and breaking up toward its end
    if (r.tail) {
      const [side, len, th] = r.tail, from = side < 0 ? L0 + 4 : L1 - 4;
      for (let k = 0; k < len; k++) {
        const x = from + side * k, t = k / len;
        if (x < 0 || x >= W || (t > 0.6 && hash(x >> 2, 3, r.seed) < t - 0.45)) continue;
        const thick = Math.max(1, Math.round(th * Math.pow(1 - t, 0.8)));
        for (let j = 0; j < thick; j++) { const i = (B - 1 - j) * W + x; if (tone[i] < 0) tone[i] = j === thick - 1 ? 1 : j === 0 ? 4 : 2; }
      }
    }
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
