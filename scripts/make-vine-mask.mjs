// Turns a line drawing of a plant into the mask the word creeper fills with text
// (public/scripts/word-vine.js). Usage: node scripts/make-vine-mask.mjs <drawing> <out.png> [height]
//
// The mask is greyscale, 0 = empty sky. Ink lines keep their darkness as 150..255
// (they become the brightest words); the inside of every closed outline (a petal,
// a leaf) is 80 (dimmer fill words). "Inside" = light pixels the page background
// cannot reach by flood fill from the edges, after closing 1px gaps in the ink.
import sharp from 'sharp';

const [src, out, hArg] = process.argv.slice(2);
if (!src || !out) { console.error('usage: make-vine-mask <drawing> <out.png> [height]'); process.exit(1); }
const H = +hArg || 1200;

const { data: g, info } = await sharp(src).flatten({ background: '#fff' }).greyscale().normalise()
  .resize({ height: H }).raw().toBuffer({ resolveWithObject: true });
const W = info.width, N = W * H;

// ink = darker than the paper; the threshold sits well under paper white so grain and halos stay paper
const INK = 150;
const ink = new Uint8Array(N);
for (let i = 0; i < N; i++) ink[i] = g[i] < INK ? 1 : 0;
// close 1px gaps so outlines hold their fill
const wall = new Uint8Array(N);
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  let v = 0;
  for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1; dx++) {
    const xx = x + dx, yy = y + dy;
    if (xx >= 0 && yy >= 0 && xx < W && yy < H && ink[yy * W + xx]) { v = 1; break; }
  }
  wall[y * W + x] = v;
}
// flood the background in from every edge pixel
const outside = new Uint8Array(N), stack = [];
const push = (i) => { if (!outside[i] && !wall[i]) { outside[i] = 1; stack.push(i); } };
for (let x = 0; x < W; x++) { push(x); push((H - 1) * W + x); }
for (let y = 0; y < H; y++) { push(y * W); push(y * W + W - 1); }
while (stack.length) {
  const i = stack.pop(), x = i % W;
  if (x > 0) push(i - 1); if (x < W - 1) push(i + 1);
  if (i >= W) push(i - W); if (i < N - W) push(i + W);
}

const m = Buffer.alloc(N);
let filled = 0;
for (let i = 0; i < N; i++) {
  if (ink[i]) m[i] = 150 + Math.round((INK - g[i]) / INK * 105);
  else if (!outside[i]) { m[i] = 80; filled++; }
}
await sharp(m, { raw: { width: W, height: H, channels: 1 } }).png({ compressionLevel: 9 }).toFile(out);
console.log(out, W + 'x' + H, 'ink', (ink.reduce((a, b) => a + b, 0) / N * 100).toFixed(1) + '%', 'fill', (filled / N * 100).toFixed(1) + '%');
