// Bakes the About page's ascii.cam into a video: the original text renderer
// (200 cols, ' .:oO@', contrast 1.7) drawn on the real page at 2x, one
// screenshot per frame of the source clip, encoded at 8fps so it plays at
// ~60% of the clip's 13fps. The page then plays a video instead of running
// the renderer. Needs the dev server (npm run dev) and ffmpeg
// (FFMPEG=path, or `pip install imageio-ffmpeg`).
//
// usage: node scripts/bake-ascii-cam.mjs [http://localhost:4321]
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] || "http://localhost:4321";
const ff = process.env.FFMPEG || execFileSync("python", ["-c", "import imageio_ffmpeg as f;print(f.get_ffmpeg_exe())"]).toString().trim();
const dir = mkdtempSync(join(tmpdir(), "ascii-"));

const b = await chromium.launch({ args: ["--disable-webgl", "--disable-3d-apis"] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto(base + "/about", { waitUntil: "networkidle" });
// nothing drawn over the card, and the source clip back in place of the baked one
await p.addStyleTag({ content: ".sky-life,#subliminal-layer,#subliminal-flash,#luna-wrap,.ab-paint{display:none!important} #asciiStage video{display:none}" });
const n = await p.evaluate(async () => {
  const stage = document.getElementById("asciiStage");
  const out = document.createElement("pre"); out.className = "ascii-out"; stage.appendChild(out);
  const vid = document.createElement("video"); vid.muted = true; vid.src = "/videos/ascii-default-clip.mp4";
  await new Promise((r) => vid.addEventListener("loadeddata", r, { once: true }));
  const cols = 200, RAMP = " .:oO@", L = RAMP.length, con = 1.7;
  const rows = Math.max(1, Math.round(cols * (vid.videoHeight / vid.videoWidth) * 0.52));
  const fs = Math.max(1, Math.min(stage.clientWidth / (cols * 0.6), stage.clientHeight / rows)); // the old fit()
  out.style.fontSize = out.style.lineHeight = fs + "px";
  const samp = document.createElement("canvas"); samp.width = cols; samp.height = rows;
  const sc = samp.getContext("2d", { willReadFrequently: true });
  window.__f = async (t) => {
    vid.currentTime = t; await new Promise((r) => vid.addEventListener("seeked", r, { once: true }));
    sc.drawImage(vid, 0, 0, cols, rows);
    const d = sc.getImageData(0, 0, cols, rows).data; let s = "";
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const l = Math.min(1, Math.max(0, ((0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255 - 0.5) * con + 0.5));
        s += RAMP[Math.min(L - 1, (l * L) | 0)];
      }
      s += "\n";
    }
    out.textContent = s;
  };
  window.__out = out;
  return Math.round(vid.duration * 13);
});
await p.evaluate(() => window.__f(0.5));
await p.waitForTimeout(1500); // fonts
const r = await p.evaluate(() => { const o = window.__out.getBoundingClientRect(); return { x: o.x, y: o.y, width: Math.floor(o.width / 2) * 2 / 1, height: Math.floor(o.height / 2) * 2 / 1 }; });
for (let k = 0; k < n; k++) {
  await p.evaluate((t) => window.__f(t), (k + 0.5) / 13);
  await p.screenshot({ clip: r, path: join(dir, `f${String(k).padStart(4, "0")}.png`) });
}
await b.close();

const src = ["-y", "-loglevel", "error", "-framerate", "8", "-i", join(dir, "f%04d.png"), "-an", "-pix_fmt", "yuv420p", "-vf", "pad=ceil(iw/2)*2:ceil(ih/2)*2"];
execFileSync(ff, [...src, "-c:v", "libvpx-vp9", "-crf", "48", "-b:v", "0", "-row-mt", "1", "public/videos/about-ascii-cam.webm"]);
execFileSync(ff, [...src, "-c:v", "libx264", "-crf", "32", "-preset", "slow", "-movflags", "+faststart", "public/videos/about-ascii-cam.mp4"]);
execFileSync(ff, ["-y", "-loglevel", "error", "-i", join(dir, "f0000.png"), "-vf", "format=gray", "public/images/about-ascii-cam-poster.webp"]);
rmSync(dir, { recursive: true });
console.log(n, "frames ->", "public/videos/about-ascii-cam.{webm,mp4}");
