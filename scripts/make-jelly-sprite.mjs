// Jellyfish clip (public/videos/contact-jelly.webm: digits on black, 15fps x 5s) -> public/images/jelly-sprite.webp,
// one transparent sheet of its 75 frames: white ink, alpha = brightness x GAIN (what the old screen blend + brightness filter gave).
// Needs the built site served: npx astro preview --port 4322, then: node scripts/make-jelly-sprite.mjs 120 210 0.8 public/images/jelly-sprite.webp
import { chromium } from 'playwright';
import fs from 'node:fs';
const [FW, FH, Q, out] = [+process.argv[2], +process.argv[3], +process.argv[4], process.argv[5]];
const b = await chromium.launch({ channel: 'chrome', headless: false });
const p = await b.newPage();
await p.goto('http://[::1]:4322/404-none', { waitUntil: 'load' }).catch(() => {});
const res = await p.evaluate(async ({ FW, FH, Q }) => {
  const N = 75, COLS = 15, ROWS = 5, GAIN = 2.5;
  const v = document.createElement('video'); v.muted = true; v.src = '/videos/contact-jelly.webm';
  await new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); v.load(); });
  const sheet = Object.assign(document.createElement('canvas'), { width: FW * COLS, height: FH * ROWS }), sx = sheet.getContext('2d');
  const c = Object.assign(document.createElement('canvas'), { width: FW, height: FH }), x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  let tint = 0, lit = 0;
  for (let i = 0; i < N; i++) {
    v.currentTime = (i + 0.5) / 15;
    await new Promise((r) => v.addEventListener('seeked', r, { once: true }));
    x.clearRect(0, 0, FW, FH); x.drawImage(v, 0, 0, FW, FH);
    const im = x.getImageData(0, 0, FW, FH), d = im.data;
    for (let k = 0; k < d.length; k += 4) {
      const m = Math.max(d[k], d[k + 1], d[k + 2]);
      if (m > 40) { lit++; tint += Math.max(d[k], d[k + 1], d[k + 2]) - Math.min(d[k], d[k + 1], d[k + 2]); }
      const a = Math.min(255, m * GAIN); d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a < 6 ? 0 : a; // the clip's near-black noise floor goes fully clear
    }
    x.putImageData(im, 0, 0);
    sx.drawImage(c, (i % COLS) * FW, Math.floor(i / COLS) * FH);
  }
  const blob = await new Promise((r) => sheet.toBlob(r, 'image/webp', Q));
  const buf = new Uint8Array(await blob.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return { b64: btoa(s), avgTint: tint / lit, w: sheet.width, h: sheet.height };
}, { FW, FH, Q });
fs.writeFileSync(out, Buffer.from(res.b64, 'base64'));
console.log(out, res.w + 'x' + res.h, (fs.statSync(out).size / 1024).toFixed(0) + ' KB', 'avg colour spread of lit pixels', res.avgTint.toFixed(1));
await b.close();
