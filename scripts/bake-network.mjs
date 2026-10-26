// Bakes the About page's network card (8 nodes turning slowly, folding from
// one shape into the next, packets running between them) into a seamless
// 40s video loop, so the page plays a video instead of drawing every frame.
// The log under it is written by public/scripts/about-network-formation.js
// from the video's clock: LOOP, SHAPES and the CONVS order here must match it.
// Needs the dev server (npm run dev, for the font) and ffmpeg
// (FFMPEG=path, or `pip install imageio-ffmpeg`).
//
// usage: node scripts/bake-network.mjs [http://localhost:4321]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] || "http://localhost:4321";
const ff = process.env.FFMPEG || execFileSync("python", ["-c", "import imageio_ffmpeg as f;print(f.get_ffmpeg_exe())"]).toString().trim();
const W = 540, H = 228, FPS = 30, LOOP = 40;
const dir = mkdtempSync(join(tmpdir(), "net-"));

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
await p.goto(base + "/fonts/fonts.css"); // same origin as the font
await p.setContent(`<style>@font-face{font-family:JBM;src:url(${base}/fonts/jetbrains-mono-latin.woff2)}body{margin:0;background:#000}</style><canvas width=${W} height=${H}></canvas>`);
await p.evaluate(() => document.fonts.load("10px JBM"));
await p.evaluate(({ W, H, LOOP }) => {
  const TAU = Math.PI * 2;
  const NAMES = ["GATEWAY", "FIREWALL", "AUTH", "DNS", "HOST·01", "HOST·02", "DB", "PROXY"];
  const SHAPES = [
    { pts: [[0, -0.80, 0], [-0.45, -0.30, 0.20], [0.45, -0.30, 0.20], [-0.30, 0.10, 0.30], [0.30, 0.10, 0.30], [0, 0.40, 0.40], [-0.50, 0.80, -0.10], [0.50, 0.80, -0.10]], edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 4], [3, 5], [4, 5], [5, 6], [5, 7], [6, 7], [0, 5]] },
    { pts: [[0, -0.85, 0], [-0.70, -0.40, -0.10], [0.70, -0.40, -0.10], [-0.80, 0.20, 0.10], [0.80, 0.20, 0.10], [-0.45, 0.70, 0.20], [0.45, 0.70, 0.20], [0, 1.00, 0]], edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 6], [5, 7], [6, 7], [1, 2], [3, 4], [5, 6]] },
    { pts: [[-0.30, -0.90, 0.20], [0.30, -0.90, 0.20], [-0.55, -0.40, 0.10], [0.55, -0.40, 0.10], [-0.70, 0.10, -0.10], [0.70, 0.10, -0.10], [-0.70, 0.85, -0.10], [0.70, 0.85, -0.10]], edges: [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [4, 6], [5, 7], [6, 7], [4, 7], [5, 6]] },
    { pts: [[0, -0.80, 0.10], [-0.90, 0, 0], [0.90, 0, 0], [0, 0.80, 0.10], [-0.42, -0.35, 0.30], [0.42, -0.35, 0.30], [0, 0, 0.65], [0, 0, -0.40]], edges: [[0, 4], [4, 1], [1, 6], [6, 2], [2, 5], [5, 0], [4, 5], [1, 3], [3, 2], [6, 7], [0, 6], [3, 6]] },
  ];
  const SEG = LOOP / SHAPES.length, MORPH = 3.5;
  // one conversation every 4s from t=1: [from, to], in about-network-formation.js's CONVS order
  const CONVS = [[0, 1], [1, 2], [2, 6], [4, 3], [5, 7]], EVERY = 4, TRAVEL = 1.8;
  const g = document.querySelector("canvas").getContext("2d");
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;
  // every wobble repeats a whole number of times per loop, so frame LOOP equals frame 0
  const wob = (i, k) => Math.sin(TAU * (k + (i % 3)) * performance.__t / LOOP + i * 1.7);
  function project([x, y, z], rotY) {
    const rotX = 0.28, cy = Math.cos(rotY), sy = Math.sin(rotY), x1 = x * cy + z * sy, z1 = -x * sy + z * cy;
    const cx = Math.cos(rotX), sx = Math.sin(rotX), y2 = y * cx - z1 * sx, z2 = y * sx + z1 * cx;
    const s = 2.8 / (2.8 + z2), r = H * 0.40;
    return { x: W / 2 + x1 * r * s, y: H / 2 + y2 * r * s, d: z2, s };
  }
  window.draw = (t) => {
    performance.__t = t;
    g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
    const seg = Math.floor(t / SEG) % SHAPES.length, into = t - seg * SEG;
    const from = SHAPES[(seg + SHAPES.length - 1) % SHAPES.length], to = SHAPES[seg];
    const m = ease(Math.min(1, into / MORPH));
    const rotY = TAU * t / LOOP;
    const P = NAMES.map((_, i) => project([
      lerp(from.pts[i][0], to.pts[i][0], m) + 0.02 * wob(i, 2),
      lerp(from.pts[i][1], to.pts[i][1], m) + 0.016 * wob(i + 3, 3),
      lerp(from.pts[i][2], to.pts[i][2], m) + 0.014 * wob(i + 5, 1),
    ], rotY));
    // who is talking: glow rises fast and fades over the trip
    const glow = NAMES.map(() => 0), hot = {}, packets = [];
    for (let k = 0; k < LOOP / EVERY; k++) {
      const t0 = 1 + k * EVERY, u = (t - t0) / TRAVEL;
      if (u < -0.1 || u > 1.6) continue;
      const [a, b] = CONVS[k % CONVS.length], e = Math.max(0, Math.min(1, u < 0 ? 1 + u * 10 : u <= 1 ? 1 : 1 - (u - 1) / 0.6));
      glow[a] = Math.max(glow[a], u < 1 ? e : e * 0.4); glow[b] = Math.max(glow[b], u > 0.85 ? e : e * 0.35);
      hot[a + "-" + b] = hot[b + "-" + a] = e;
      if (u >= 0 && u <= 1) packets.push([a, b, ease(u)]);
    }
    // edges, far ones first; the ones that fold away fade out as the next shape's fade in
    const edges = [];
    to.edges.forEach((e) => edges.push([e, m])); if (m < 1) from.edges.forEach((e) => edges.push([e, 1 - m]));
    edges.map(([e, w]) => [e, w, (P[e[0]].d + P[e[1]].d) / 2]).sort((a, b) => a[2] - b[2]).forEach(([e, w, d]) => {
      const h = hot[e[0] + "-" + e[1]] || 0;
      g.beginPath(); g.moveTo(P[e[0]].x, P[e[0]].y); g.lineTo(P[e[1]].x, P[e[1]].y);
      g.strokeStyle = `rgba(236,240,248,${(w * Math.min(0.85, 0.12 + (d + 1) * 0.12 + h * 0.45)).toFixed(3)})`;
      g.lineWidth = 1.2 + h * 1.2; g.stroke();
    });
    // a packet is a bright head with a soft tail along its link
    packets.forEach(([a, b, u]) => {
      const A = P[a], B = P[b], s = lerp(A.s, B.s, u);
      for (let i = 8; i >= 0; i--) {
        const v = Math.max(0, u - i * 0.022);
        g.beginPath(); g.arc(lerp(A.x, B.x, v), lerp(A.y, B.y, v), (i ? 2.4 : 4) * s, 0, TAU);
        g.fillStyle = `rgba(255,255,255,${i ? (0.3 * (1 - i / 9)).toFixed(3) : 0.95})`;
        if (!i) { g.shadowColor = "rgba(255,255,255,.7)"; g.shadowBlur = 14; }
        g.fill(); g.shadowBlur = 0;
      }
    });
    // nodes, far ones first, with a ring while they talk and their name above
    NAMES.map((n, i) => [n, i, P[i]]).sort((a, b) => a[2].d - b[2].d).forEach(([n, i, p]) => {
      const gl = glow[i], r = (6 + gl * 3) * p.s, a = 0.3 + (p.d + 1) * 0.25;
      if (gl > 0.03) {
        g.beginPath(); g.arc(p.x, p.y, r + 7 + gl * 6, 0, TAU);
        g.strokeStyle = `rgba(255,255,255,${(0.16 * gl).toFixed(3)})`; g.lineWidth = 2; g.stroke();
      }
      g.beginPath(); g.arc(p.x, p.y, r, 0, TAU);
      g.fillStyle = `rgba(255,255,255,${Math.min(0.95, a + gl * 0.4).toFixed(3)})`;
      if (gl > 0.1) { g.shadowColor = "rgba(255,255,255,.55)"; g.shadowBlur = 18 * gl; }
      g.fill(); g.shadowBlur = 0;
      if (p.d > 0.05 || gl > 0.2) { // names on the near side, and on whoever is talking
        g.font = `${(9 * p.s + 3).toFixed(1)}px JBM`; g.textAlign = "center";
        g.fillStyle = `rgba(255,255,255,${Math.min(0.75, (p.d + 1) * 0.2 + gl * 0.5).toFixed(3)})`;
        g.fillText(n, p.x, p.y - r - 6);
      }
    });
  };
}, { W, H, LOOP });

const n = LOOP * FPS;
for (let k = 0; k < n; k++) {
  const png = await p.evaluate((t) => { draw(t); return document.querySelector("canvas").toDataURL("image/png").slice(22); }, k / FPS);
  writeFileSync(join(dir, `f${String(k).padStart(4, "0")}.png`), Buffer.from(png, "base64"));
}
await b.close();

const src = ["-y", "-loglevel", "error", "-framerate", String(FPS), "-i", join(dir, "f%04d.png"), "-an", "-pix_fmt", "yuv420p"];
execFileSync(ff, [...src, "-c:v", "libvpx-vp9", "-crf", "46", "-b:v", "0", "-row-mt", "1", "public/videos/about-network.webm"]);
execFileSync(ff, [...src, "-c:v", "libx264", "-crf", "28", "-preset", "slow", "-movflags", "+faststart", "public/videos/about-network.mp4"]);
execFileSync(ff, ["-y", "-loglevel", "error", "-i", join(dir, "f0060.png"), "public/images/about-network-poster.webp"]);
rmSync(dir, { recursive: true });
console.log(n, "frames ->", "public/videos/about-network.{webm,mp4}");
