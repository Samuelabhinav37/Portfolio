import { createRequire } from 'node:module';
import fs from 'node:fs';
const pw = createRequire(process.cwd() + '/package.json')('playwright');
const out = process.argv[2];
const b = await pw.chromium.launch({ headless: true, channel: 'chrome' });
const p = await b.newPage();
await p.goto('http://localhost:4321/404.html').catch(() => {}); await p.setContent('<html><head></head><body></body></html>');
await p.addScriptTag({ content: fs.readFileSync('public/scripts/sky-cast.js', 'utf8') });
const jobs = [
  ['whale', 'whale({ wave:false, part:"all" })', 360, 2.7, 1.25, 0, -0.02],
  ['manta', 'manta({ ph:0, flat:true })', 150, 2.5, 2.4, 0, 0.25],
  ['turtle', 'turtle({ part:"all" })', 150, 2.5, 2.5, 0, 0],
  ['star', 'seastar({ t:0 })', 90, 2.6, 2.6, 0, 0],
  ['fish', 'fish()', 60, 2.4, 1.8, 0, 0],
];
for (const [name, expr, Sz, wk, hk, ox, oy] of jobs) {
  const r = await p.evaluate(({ expr, Sz, wk, hk, ox, oy }) => {
    const SC = self.SkyCast || window.SkyCast; const f = new Function('SC', 'with (SC) { return ' + expr + '; }')(SC);
    const w = Math.ceil(wk * Sz), h = Math.ceil(hk * Sz), px = 1 / Sz, lw = 1.5 * px;
    const a = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const I = f((x - w / 2) * px + ox, (y - h / 2) * px + oy, lw); a[y * w + x] = I > 0 ? Math.min(255, I * 255) : 0; }
    // the digit drawing, as on the site
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    SC.digits(g, { cell: Math.max(3, Sz / 50), f, cx: w / 2 - ox * Sz, cy: h / 2 - oy * Sz, S: Sz, reach: wk / 2 + .05, reachY: hk / 2 + .05, seed: 3, W: w, H: h });
    return { w, h, a: Array.from(a), png: c.toDataURL('image/png') };
  }, { expr, Sz, wk, hk, ox, oy });
  fs.writeFileSync(`${out}/${name}.raw`, Buffer.from(r.a)); fs.writeFileSync(`${out}/${name}.json`, JSON.stringify({ w: r.w, h: r.h }));
  fs.writeFileSync(`${out}/${name}-digits.png`, Buffer.from(r.png.split(',')[1], 'base64'));
  console.log(name, r.w, r.h, r.a.filter(v => v > 20).length);
}
await b.close();
